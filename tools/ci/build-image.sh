#!/usr/bin/env bash
#
# Build an APIHUB image locally, exactly the way CI does.
#
# WHY THIS EXISTS
#
# The migration moves image builds from "npm pack the published tarball inside the image" to
# "COPY the workspace build output". That removes a registry round trip, the NPMRC build
# secret, and — for build-task-consumer — an `npm ci` that ran INSIDE the image, which is why
# it was the 15.7-minute outlier: its build stage had no --platform=$BUILDPLATFORM, so the
# arm64 leg did a cold install under QEMU emulation.
#
# The cost is that the Dockerfiles stop being self-contained. `docker build -f
# frontend/build-task-consumer/Dockerfile .` on a fresh clone fails, because the build output
# and the `pnpm deploy` tree do not exist yet. That is a real ergonomics regression against
# the old Dockerfiles, and this script is the answer to it: one command, same steps as CI,
# no need to read the workflow to find out what the prerequisites are.
#
# WHY NOT PUT `pnpm deploy` IN THE DOCKERFILE INSTEAD
#
#   1. It reintroduces the in-image install, and with it the QEMU emulation cost on any
#      non-native architecture. Dormant while we build amd64 only; live the moment multi-arch
#      is turned on for release/main.
#   2. `pnpm deploy` resolves `workspace:` specifiers, so it needs the lockfile and every
#      workspace package. In-image that means the build context must carry the whole
#      workspace — 5,840 files and 202 MB even after pruning, against 492 files and 89.8 MB
#      with the opt-in .dockerignore.
#   3. It needs registry access and credentials inside the build, which is the NPMRC secret
#      the migration deletes.
#
# USAGE
#   tools/ci/build-image.sh ui
#   tools/ci/build-image.sh build-task-consumer
#   IMAGE_TAG=mine tools/ci/build-image.sh ui
#
# Uses docker if present, else podman.
set -euo pipefail

target="${1:-}"
case "$target" in
  ui)
    dockerfile=frontend/ui/Dockerfile
    image=apihub-ui
    build_projects=ui-portal,ui-agents
    deploy=''
    ;;
  build-task-consumer)
    dockerfile=frontend/build-task-consumer/Dockerfile
    image=apihub-build-task-consumer
    build_projects=build-task-consumer
    deploy=build-task-consumer
    ;;
  *)
    echo "usage: $0 {ui|build-task-consumer}" >&2
    exit 2
    ;;
esac

cd "$(git rev-parse --show-toplevel)"

engine="$(command -v docker || command -v podman || true)"
[ -n "$engine" ] || { echo "neither docker nor podman found on PATH" >&2; exit 1; }
echo "==> engine: $engine"

echo "==> building workspace output: $build_projects"
pnpm exec nx run-many -t build --projects="$build_projects"

if [ -n "$deploy" ]; then
  echo "==> producing the deploy tree: .deploy/$deploy"
  # --legacy is required on pnpm 10: without it, deploy refuses on a workspace that does not
  # set inject-workspace-packages=true. See the note in .github/workflows/ci.yml.
  #
  # The retry is for Windows. pnpm deploy builds the tree under a temp name and renames it
  # into place, and that rename intermittently fails with EPERM — a file handle still held,
  # typically by a virus scanner walking the several thousand files just written. It is a
  # local-only problem: the same command is reliable on the Linux runners.
  ok=0
  for attempt in 1 2 3; do
    rm -rf ".deploy/$deploy" ".deploy/${deploy}_tmp_"* 2>/dev/null || true
    if pnpm deploy --legacy --filter="./frontend/$deploy" --prod ".deploy/$deploy"; then
      ok=1
      break
    fi
    echo "    attempt $attempt failed; retrying"
    sleep 3
  done
  if [ "$ok" != 1 ]; then
    rm -rf ".deploy/${deploy}_tmp_"* 2>/dev/null || true
    cat >&2 <<'MSG'

`pnpm deploy` failed after three attempts.

If the error above is EPERM on a rename, this is the known Windows failure: pnpm builds the
deploy tree under a temporary name and renames it into place, and the rename loses to a file
handle still held over the thousands of files just written — usually a virus scanner. It is
local-only; the same command is reliable on the Linux CI runners, where this image builds.

Options, in order of preference:
  - build this image in CI, or in WSL / a Linux container, rather than on Windows
  - exclude the workspace from real-time scanning and retry
  - build the `ui` image locally instead; it needs no deploy tree

MSG
    exit 1
  fi
fi

# The same assertion CI makes before handing the context to the builder. It exists because
# both of the commands above have exited 0 while matching nothing, and the resulting failure
# surfaced two steps later as a missing COPY source.
echo "==> verifying the COPY sources exist"
missing=0
check() {
  if [ -e "$1" ]; then
    echo "    OK      $1  ($(find "$1" -type f 2>/dev/null | wc -l) files)"
  else
    echo "    MISSING $1"
    missing=1
  fi
}
for p in ${build_projects//,/ }; do
  root="$(pnpm exec nx show project "$p" --json | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).root')"
  check "$root/dist"
done
[ -z "$deploy" ] || { check ".deploy/$deploy/package.json"; check ".deploy/$deploy/node_modules"; }
[ "$missing" = 0 ] || { echo "build outputs missing — the image build would fail on a COPY source" >&2; exit 1; }

tag="${IMAGE_TAG:-local}"
echo "==> building $image:$tag from $dockerfile"
"$engine" build -f "$dockerfile" -t "$image:$tag" .

echo "==> done: $image:$tag"
echo "    inspect with: $engine run --rm --entrypoint sh $image:$tag -c 'ls -la /'"
