#!/usr/bin/env bash
#
# One component's Storybook into the store, for the branch this run is on.
#
# THE STORE is ghcr. A build is an OCI artifact, `ghcr.io/<owner>/storybook-<component>:src-<hash>`,
# holding one gzipped tarball of `dist-showcase`. A branch is a POINTER, `…:branch-<slug>`: a
# separate manifest whose annotation names the content it points at. pages.yml assembles the
# site from pointers; nothing is committed to any branch.
#
# THE HASH is tools/ci/image-input-hash.sh, the images' identity, so a Storybook is rebuilt for
# exactly the reasons an image would be. Two inputs needed adding for Storybook specifically,
# both carried in storybooks.json rather than here:
#
#   ui            the config lives in ui-shared but loads stories from ui-portal and ui-agents
#                 and aliases both packages, so all three trees decide the build
#   apispec-view  packages/elements/.storybook only re-exports the WORKSPACE root's
#                 .storybook, and the Storybook dependencies are declared in the workspace
#                 root package.json. Neither sits inside the elements project
#
# This script passes ITSELF to the hasher as well: it decides the artifact's layout, so a
# change here must not be served from content built under the old layout.
#
# POINTERS ARE NEVER TAGS ON THE CONTENT MANIFEST. Deleting a package version in ghcr removes
# every tag on it, which storybook-probe.yml measured. An alias tag for feature-x would mean
# deleting feature-x deletes the Storybook of every branch sharing its content.
#
# Environment: COMPONENT PROJECT HASH_PROJECTS HASH_PATHS OUTPUT OWNER, plus the GITHUB_* the
# runner provides. Expects `oras` logged in to ghcr.
set -euo pipefail

: "${COMPONENT:?}" "${PROJECT:?}" "${HASH_PROJECTS:?}" "${OUTPUT:?}" "${OWNER:?}"
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
tmp="${RUNNER_TEMP:-$(mktemp -d)}"

owner_lc="$(echo "$OWNER" | tr '[:upper:]' '[:lower:]')"
repo="ghcr.io/$owner_lc/storybook-$COMPONENT"
slug="$(node tools/ci/storybook-site.js slug "$GITHUB_REF_NAME")"

pnpm exec nx graph --file=graph.json >/dev/null
# HASH_PATHS is a space-separated list and deliberately unquoted, so it word-splits.
# shellcheck disable=SC2086
hash="$(bash tools/ci/image-input-hash.sh "$HASH_PROJECTS" graph.json tools/ci/storybook-store.sh tools/ci/storybook-strip-maps.js $HASH_PATHS)"
rm -f graph.json
src="src-$hash"

{
  echo "### storybook: $COMPONENT"
  echo
  echo "| | |"
  echo "|---|---|"
  echo "| content | \`$repo:$src\` |"
  echo "| pointer | \`$repo:branch-$slug\` for \`$GITHUB_REF_NAME\` |"
} >> "$summary"

# ---- the content: build only when it is new -------------------------------------------------
# A failed lookup reads as a miss, which costs a build and never serves stale content. That is
# the safe direction for this check to be wrong in.
if oras manifest fetch "$repo:$src" >/dev/null 2>&1; then
  echo "| build | **hit**, this content is already in the store |" >> "$summary"
else
  # Remove any earlier output first. The checks below look for files, and a directory left
  # behind by some other step would satisfy them without this build having produced anything.
  rm -rf "$OUTPUT"

  # run-many rather than `nx run $PROJECT:build:showcase`, which Nx could read as target
  # `build` with configuration `showcase`.
  set -o pipefail
  pnpm exec nx run-many -t build:showcase --projects="$PROJECT" 2>&1 | tee "$tmp/nx.log"

  # Validate the artifact, not the exit code. These three are what Storybook's manager loads
  # first: without index.json it renders an empty sidebar and reports nothing.
  for f in index.html iframe.html index.json; do
    [ -s "$OUTPUT/$f" ] || { echo "::error::$OUTPUT/$f is missing or empty after build:showcase"; exit 1; }
  done

  # Sourcemaps are 22 of apispec-view's 43 MiB and 19 of rest-playground's 34, and every
  # published build counts against Pages' 1 GB. The script says what it measured and why.
  stripped="$(node tools/ci/storybook-strip-maps.js "$OUTPUT")"
  files="$(find "$OUTPUT" -type f | wc -l)"
  bytes="$(du -sb "$OUTPUT" | cut -f1)"

  tar czf "$tmp/storybook.tar.gz" -C "$OUTPUT" .
  packed="$(stat -c %s "$tmp/storybook.tar.gz")"

  # Pushed from inside $tmp: oras refuses absolute file paths, and the name it records is the
  # name pages.yml pulls back out.
  (
    cd "$tmp"
    oras push "$repo:$src" \
      --artifact-type application/vnd.b41ex.storybook.v1 \
      --annotation "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" \
      --annotation "org.opencontainers.image.revision=$GITHUB_SHA" \
      --annotation "com.b41ex.storybook.component=$COMPONENT" \
      storybook.tar.gz:application/vnd.b41ex.storybook.layer.v1.tar+gzip
  )
  echo "| build | **built**: $stripped; $files files, $((bytes / 1024)) KiB, packed to $((packed / 1024)) KiB |" >> "$summary"
fi

# ---- the pointer: on both paths --------------------------------------------------------------
# A new branch changes no content and still needs its pointer, and so does a branch whose
# previous run was cancelled between the two pushes.
echo "$src" > "$tmp/pointer.txt"
(
  cd "$tmp"
  oras push "$repo:branch-$slug" \
    --artifact-type application/vnd.b41ex.storybook-pointer.v1 \
    --annotation "com.b41ex.storybook.content=$src" \
    --annotation "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" \
    --annotation "org.opencontainers.image.revision=$GITHUB_SHA" \
    --annotation "org.opencontainers.image.version=$GITHUB_REF_NAME" \
    pointer.txt
)

# Read the pointer back off the registry. A push exiting 0 says a manifest was written, not
# that it says what the assembler will read; a misspelled annotation key is not an error.
got="$(oras manifest fetch "$repo:branch-$slug" | node -e '
  const m = JSON.parse(require("fs").readFileSync(0, "utf8"))
  process.stdout.write((m.annotations || {})["com.b41ex.storybook.content"] || "")
')"
if [ "$got" != "$src" ]; then
  echo "::error::pointer branch-$slug reads content='$got', expected '$src'"
  exit 1
fi
echo "| pointer | written and read back: \`branch-$slug\` → \`$got\` |" >> "$summary"
