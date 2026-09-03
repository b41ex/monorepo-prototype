#!/bin/sh
# Artifact difference classification, revision 2.
#
# Revision 1 reported api-processor as 47 "real" differences. Opening one showed the emitted
# JavaScript identical and the whole difference inside the INLINE BASE64 SOURCEMAP on the
# last line: the @netcracker -> @b41ex rename shortens every require path by five characters,
# which shifts the VLQ mappings. A scope normalisation applied to the text cannot see that,
# because the rename is inside the base64.
#
# So the comparison is now made on the shipped code and declarations with sourcemaps removed,
# which is the contract a consumer actually depends on. Sourcemaps are counted separately
# rather than dropped, because "the sourcemap changed" is a true statement and a different one
# from "the code changed".
#
# Normalisations, cumulative:
#   the scope rename                             (the prototype's own, not a migration effect)
#   pnpm store paths in //#region comments        (rolldown records the resolved module path)
#   inline //# sourceMappingURL=data: lines       (shifted by the rename, see above)
OUT=/c/Users/balex/AppData/Local/Temp/claude/C--git-apihub-monorepo/ca35b3ff-e5ec-4787-8615-23a19e5037e6/scratchpad/baseline
FLEET=/c/git/apihub-monorepo/_existing_phase1b
T=/c/git/apihub-monorepo/_target3

norm() {
  sed -e 's/@netcracker/@b41ex/g' \
      -e 's|\.\./\.\./node_modules/\.pnpm/[^/]*/node_modules/|node_modules/|g' \
      -e 's|node_modules/\.pnpm/[^/]*/node_modules/|node_modules/|g' \
      -e '/^\/\/# sourceMappingURL=data:/d' \
      -e '/^\/\*# sourceMappingURL=data:/d' "$1"
}

printf '%-34s %8s %9s %9s\n' COMPONENT CHANGED SOURCEMAP 'CODE/DECL'
for name in ddlapi graphapi http-spec api-unifier class-view rest-playground api-diff \
            api-visitor api-doc-viewer api-processor apispec-view build-task-consumer ui vscode; do
  basedir="$FLEET/$name"; wsdir="$T/frontend/$name"
  changed=$(join -j 2 -o 0,1.1,2.1 <(sort -k2 "$OUT/h3-base/$name.sha256") <(sort -k2 "$OUT/h3-ws/$name.sha256") | awk '$2!=$3{print $1}')
  n=0; smap=0; code=0
  : > "$OUT/h3-ws/$name.code.txt"
  for f in $changed; do
    n=$((n+1))
    case "$f" in *.map) smap=$((smap+1)); continue;; esac
    if diff -q <(norm "$basedir/$f") <(norm "$wsdir/$f") >/dev/null 2>&1; then continue; fi
    code=$((code+1)); echo "$f" >> "$OUT/h3-ws/$name.code.txt"
  done
  printf '%-34s %8s %9s %9s\n' "$name" "$n" "$smap" "$code"
done
