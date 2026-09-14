/*
 * Tags every Go module `lang:go`.
 *
 * @nx-go/nx-go infers the Go projects from `go.mod` and gives them targets, but a project's tags can
 * only come from a project.json, a package.json or a plugin, and nx-go sets none. CI splits the
 * languages on that tag: the `go` job selects it and the `js` job excludes it. Without this file
 * each module would need a project.json holding nothing but one tag.
 *
 * Nx merges what several plugins say about the same project root, so this adds the tag and
 * leaves everything else to nx-go.
 */
const { dirname } = require('node:path')

module.exports.createNodesV2 = [
  '**/go.mod',
  async (files) =>
    files.map((file) => [file, { projects: { [dirname(file)]: { tags: ['lang:go'] } } }]),
]
