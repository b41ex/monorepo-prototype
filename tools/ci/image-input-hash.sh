#!/usr/bin/env bash
#
# Content-addressed identity for a Docker image, per monorepo-design.md §6.
#
# Prints a stable hash of everything that can change the image: the project's own tree, the
# trees of every project it transitively depends on, the lockfile, and the Dockerfile. The
# image is then tagged `<name>:src-<hash>`, and a build is skipped entirely when that tag
# already exists in the registry — the branch tag is published as an alias with
# `docker buildx imagetools create`, a manifest operation taking about a second and
# transferring no layers.
#
# That is what gives **affected-only cost with always-build semantics**: the property being
# protected is that an E2E stack is never assembled from images built at different commits,
# which is the cross-repo version skew the monorepo exists to remove.
#
# Why git tree hashes rather than Nx's own project hash: Nx does not expose a project hash
# through a supported command — it is an internal of the task hasher, visible only in run
# output and in .nx/cache directory names. Deriving the identity from `git rev-parse
# <ref>:<dir>` is deterministic, needs no Nx invocation, is trivially reproducible by hand
# when an image needs explaining, and cannot drift when Nx changes its hashing. The cost is
# that it is coarser than Nx's: it hashes the whole project tree rather than the
# `production` named input, so a change to a test file rebuilds the image. That is the safe
# direction to err in.
#
# Usage:  image-input-hash.sh <nx-project-name> <graph.json> [dockerfile...]
set -euo pipefail

project="${1:?usage: image-input-hash.sh <nx-project> <graph.json> [dockerfile...]}"
graph="${2:?missing graph.json — produce it with: nx graph --file=graph.json}"
shift 2

# Transitive dependency closure of the project, plus the project itself, as Nx sees it.
closure="$(node -e '
  const g = require(process.argv[1]).graph
  const seen = new Set()
  ;(function visit(n) {
    if (seen.has(n)) return
    seen.add(n)
    for (const d of g.dependencies[n] || []) visit(d.target)
  })(process.argv[2])
  const roots = [...seen]
    .map((n) => g.nodes[n] && g.nodes[n].data && g.nodes[n].data.root)
    .filter(Boolean)
    .sort()
  console.log(roots.join("\n"))
' "$graph" "$project")"

{
  # Each project directory contributes its git tree hash. `git rev-parse HEAD:<dir>` is the
  # tree object, which changes if and only if any tracked file under it changes.
  while read -r dir; do
    [ -n "$dir" ] || continue
    printf '%s %s\n' "$dir" "$(git rev-parse "HEAD:$dir")"
  done <<< "$closure"

  # The lockfile: a resolution change alters what is installed into the image.
  printf 'pnpm-lock.yaml %s\n' "$(git rev-parse HEAD:pnpm-lock.yaml)"

  # The Dockerfiles named on the command line, and this script itself — both change the
  # image without touching any project tree.
  for f in "$@"; do
    printf '%s %s\n' "$f" "$(git rev-parse "HEAD:$f")"
  done
  printf 'hasher %s\n' "$(git rev-parse HEAD:tools/ci/image-input-hash.sh)"
} | sort | sha256sum | cut -c1-16
