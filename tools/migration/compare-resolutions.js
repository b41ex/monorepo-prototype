#!/usr/bin/env node
/**
 * Compare what the one workspace lock file resolved against what each component's own lock
 * file used to resolve (tools/migration/resolutions-before.json).
 *
 * §4: "One lock file changes resolved versions, not just declared ranges." This answers
 * how much, and where — per component, for that component's *direct* dependencies, which
 * are the ones a maintainer declared and can reason about.
 *
 * Reads pnpm-lock.yaml without a YAML parser: only the importers section is needed, and
 * its shape is fixed.
 *
 *   node tools/migration/compare-resolutions.js [--all]   # --all: transitive too
 */
const fs = require('fs')

const before = JSON.parse(fs.readFileSync('tools/migration/resolutions-before.json', 'utf8'))

// pnpm 12 makes pnpm-lock.yaml a MULTI-DOCUMENT YAML file. It writes a small first document
// recording the package manager itself — `packageManagerDependencies: pnpm 12.3.4` plus its
// eight @pnpm/exe platform binaries — ahead of the lockfile proper, and that first document
// has an `importers:` key of its own.
//
// So the obvious `lock.indexOf('importers:')` now finds the WRONG SECTION, and does it
// quietly: the packageManager document's importer carries no `version:` lines this parser
// recognises, so every component comes back as "no importer in the workspace lock" and the
// script prints a confident, entirely wrong report. Reading the last document rather than
// the first is correct under both formats — pnpm 10 wrote exactly one, so "last" was "only".
const documents = fs
  .readFileSync('pnpm-lock.yaml', 'utf8')
  .split('\n')
  .reduce(
    (docs, line) => {
      if (line === '---') docs.push([])
      else docs[docs.length - 1].push(line)
      return docs
    },
    [[]],
  )
  .filter((d) => d.some((l) => l.trim()))
const lock = documents[documents.length - 1]

// importers:
//   frontend/api-diff:
//     dependencies:
//       lodash:
//         specifier: ^4.17.21
//         version: 4.17.21
const importers = {}
let i = lock.indexOf('importers:')
if (i < 0) throw new Error('no importers section in pnpm-lock.yaml')
let cur = null
let pkg = null
for (i++; i < lock.length; i++) {
  const line = lock[i]
  if (/^\S/.test(line) && line.trim()) break // next top-level key
  let m
  if ((m = line.match(/^ {2}(\S.*):$/))) {
    cur = m[1].replace(/^'|'$/g, '')
    importers[cur] = {}
    pkg = null
  } else if ((m = line.match(/^ {6}(\S.*):$/))) {
    pkg = m[1].replace(/^'|'$/g, '')
  } else if ((m = line.match(/^ {8}version: (.*)$/)) && cur && pkg) {
    // strip peer-suffixes: 4.17.21(react@18.2.0)
    importers[cur][pkg] = m[1].replace(/\(.*$/, '').trim()
  }
}

// The scope rename means before/after names differ for internal packages; those are
// workspace links now and carry no registry version, so skip them.
const isInternal = (n) => /^@(netcracker|b41ex)\//.test(n) || n === 'qubership-apihub-vscode'

const rows = []
for (const [comp, data] of Object.entries(before)) {
  const now = importers[comp]
  if (!now) {
    rows.push({ comp, note: 'no importer in the workspace lock' })
    continue
  }
  let same = 0
  const moved = []
  for (const [name, v] of Object.entries(now)) {
    if (isInternal(name)) continue
    const was = data.packages[name]
    if (!was) {
      moved.push([name, '(absent)', v])
      continue
    }
    if (was.includes(v)) same++
    else moved.push([name, was.join('|'), v])
  }
  rows.push({ comp, same, moved })
}

let totalMoved = 0
for (const r of rows) {
  if (r.note) {
    console.log(`\n${r.comp}: ${r.note}`)
    continue
  }
  console.log(`\n${r.comp}  —  ${r.same} direct deps unchanged, ${r.moved.length} moved`)
  for (const [n, was, now] of r.moved) console.log(`    ${n.padEnd(42)} ${was.padEnd(26)} -> ${now}`)
  totalMoved += r.moved.length
}
console.log(`\n${totalMoved} direct dependency resolutions differ from the per-component lock files`)
