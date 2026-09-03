#!/bin/sh
# Artifact comparison, third instrument revision.
#
# Revision 1 pruned only the TOP-LEVEL node_modules on the baseline side and filtered nested
# ones on the workspace side — apples to oranges, and it swept apispec-view's nested
# @testing-library copies (704 of 707 "dist files") and, via .vscode-test, 225 of VS Code's
# own. That is the defect already on record against phantom-deps.js, reproduced here.
#
# Revision 2 pruned node_modules on both sides but .vscode-test is not under node_modules,
# so 139 of vscode's 145 baseline "dist files" were still VS Code's own installation.
#
# Revision 3 prunes node_modules, .vscode-test and dist-showcase on both sides, and splits
# the result into three columns that mean different things:
#   MISSING  a path the baseline has and the workspace does not — a build that did not run
#   EXTRA    a path the workspace has and the baseline does not
#   CHANGED  the same path with different bytes — the only column that is about the build
OUT=/c/Users/balex/AppData/Local/Temp/claude/C--git-apihub-monorepo/ca35b3ff-e5ec-4787-8615-23a19e5037e6/scratchpad/baseline
FLEET=/c/git/apihub-monorepo/_existing_phase1b
T=/c/git/apihub-monorepo/_target3
mkdir -p "$OUT/h3-base" "$OUT/h3-ws"

hash_tree() {
  ( cd "$1" 2>/dev/null || exit 0
    find . -name node_modules -prune -o -name dist-showcase -prune -o -name .vscode-test -prune -o \
         -path '*/dist/*' -type f -print 2>/dev/null \
      | sort | while read f; do
          printf '%s  %s\n' "$(sha256sum "$f" | cut -c1-64)" "$f"
        done )
}

printf '%-34s %6s %6s %8s %6s %8s\n' COMPONENT BASE WS MISSING EXTRA CHANGED
run() {
  name="$1"
  hash_tree "$2" > "$OUT/h3-base/$name.sha256"
  hash_tree "$3" > "$OUT/h3-ws/$name.sha256"
  b=$(wc -l < "$OUT/h3-base/$name.sha256"); w=$(wc -l < "$OUT/h3-ws/$name.sha256")
  awk '{print $2}' "$OUT/h3-base/$name.sha256" | sort > "$OUT/h3-base/$name.paths"
  awk '{print $2}' "$OUT/h3-ws/$name.sha256"   | sort > "$OUT/h3-ws/$name.paths"
  miss=$(comm -23 "$OUT/h3-base/$name.paths" "$OUT/h3-ws/$name.paths" | wc -l)
  extra=$(comm -13 "$OUT/h3-base/$name.paths" "$OUT/h3-ws/$name.paths" | wc -l)
  # same path, different hash
  chg=$(join -j 2 -o 0,1.1,2.1 <(sort -k2 "$OUT/h3-base/$name.sha256") <(sort -k2 "$OUT/h3-ws/$name.sha256") \
        | awk '$2!=$3' | wc -l)
  printf '%-34s %6s %6s %8s %6s %8s\n' "$name" "$b" "$w" "$miss" "$extra" "$chg"
}

for r in compatibility-suites ddlapi graphapi http-spec json-crawl \
         api-unifier class-view rest-playground api-diff api-visitor \
         api-doc-viewer api-processor apispec-view build-task-consumer ui vscode; do
  run "$r" "$FLEET/$r" "$T/frontend/$r"
done
run jest-chrome-in-docker-environment "$FLEET/jest-chrome-in-docker-environment" "$T/tools/jest-chrome-in-docker-environment"
