#!/usr/bin/env node
/**
 * Does a pnpm-lock.yaml change MOVE A VERSION, or is it only peer re-wiring?
 *
 * WHY THIS EXISTS
 *
 * A one-line manifest change produces a lockfile diff of hundreds or thousands of lines,
 * because pnpm re-resolves peer dependencies and records the wiring in every affected entry.
 * Measured on this workspace: adding one workspace devDependency cost 630 lines under
 * pnpm 10.34.5 and 11,218 under pnpm 12.3.4 the first time. Neither changed a single installed
 * version.
 *
 * A diff that large cannot be reviewed by eye, so the question "did anything actually change"
 * gets answered by assumption. This answers it instead:
 *
 *   packages:   the set of name@version that will be installed. If this is unchanged, nothing
 *               new is downloaded and nothing is removed. This is the number that matters.
 *   specifiers: what each workspace project DECLARES. Fleet-alignment work lives here.
 *   versions:   what each project RESOLVES — compared twice, once literally and once with the
 *               peer suffixes stripped. If they differ literally but match once stripped, the
 *               churn is representation and not resolution.
 *
 *   node tools/migration/lockfile-diff.js                  # HEAD vs the working tree
 *   node tools/migration/lockfile-diff.js <ref>            # <ref> vs the working tree
 *   node tools/migration/lockfile-diff.js <fileA> <fileB>  # two files
 *   node tools/migration/lockfile-diff.js --self-test      # prove the tool can fail
 *
 * IT IS A REPORT, NOT A GATE. It exits 0 whatever it finds, because a moved version is
 * routine — it is a dependency bump. Pass --strict to exit 1 when a version moves, which is
 * useful on a change that is supposed to be representation-only, such as a package-manager
 * upgrade or a lockfile format conversion.
 *
 * THE TRAP THIS TOOL WAS BORN FROM, and which it must not fall into itself: pnpm 12 lockfiles
 * are MULTI-DOCUMENT. A small `packageManagerDependencies` document is written first and has
 * an `importers:` key of its own, nine lines long. A parser that takes the first `importers:`
 * reads that one, compares two nine-line samples, and reports "identical" — a false pass, with
 * no error and no clue. That defect was found in compare-resolutions.js, fixed there, and then
 * written again from scratch two days later in the throwaway script this tool replaces. So:
 * always the LAST document, and --self-test asserts the tool notices a real change.
 */
const fs = require('fs')
const { execFileSync } = require('child_process')

const argv = process.argv.slice(2)
const strict = argv.includes('--strict')
const args = argv.filter((a) => !a.startsWith('--'))

/**
 * The last YAML document of a lockfile. pnpm 10 wrote one; pnpm 12 writes two and the first is
 * not the lockfile. "Last" is correct for both — which is why this is not `indexOf`.
 */
function lastDocument(text) {
  const docs = text.split('\n').reduce(
    (acc, line) => {
      if (line === '---') acc.push([])
      else acc[acc.length - 1].push(line)
      return acc
    },
    [[]],
  )
  const nonEmpty = docs.filter((d) => d.some((l) => l.trim()))
  return nonEmpty[nonEmpty.length - 1] || []
}

/** Lines of a top-level section, e.g. `packages:` up to the next top-level key. */
function section(lines, name) {
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && lines[i] === name + ':') { start = i + 1; continue }
    if (start >= 0 && /^\S/.test(lines[i]) && lines[i].trim()) return lines.slice(start, i)
  }
  return start < 0 ? [] : lines.slice(start)
}

function parse(text, label) {
  const lines = lastDocument(text)

  // `packages:` and `snapshots:` entries are keys at two spaces. packages: carries no peer
  // suffix; snapshots: does.
  const keys = (name) =>
    new Set(
      section(lines, name)
        .map((l) => l.match(/^ {2}'?(.+?)'?:$/))
        .filter(Boolean)
        .map((m) => m[1]),
    )

  // importers: project at 2 spaces, dependency group at 4, dependency name at 6, and its
  // `specifier:`/`version:` at 8.
  const specifiers = []
  const versions = []
  let project = '?'
  let dep = '?'
  for (const l of section(lines, 'importers')) {
    let m
    if ((m = l.match(/^ {2}(\S.*):$/))) { project = m[1]; continue }
    if ((m = l.match(/^ {6}'?(.+?)'?:$/))) { dep = m[1]; continue }
    if ((m = l.match(/^ {8}specifier: (.+)$/))) { specifiers.push(`${project} ${dep} = ${m[1]}`); continue }
    if ((m = l.match(/^ {8}version: (.+)$/))) { versions.push(`${project} ${dep} -> ${m[1]}`) }
  }

  const parsed = { label, packages: keys('packages'), snapshots: keys('snapshots'), specifiers, versions }

  // A parser that silently matches nothing is the failure mode this tool exists to avoid, so
  // say so rather than reporting a confident "identical" over an empty sample.
  if (!parsed.packages.size && !parsed.versions.length) {
    throw new Error(
      `parsed nothing out of ${label}. Either it is not a pnpm lockfile, or its layout moved ` +
        `and this parser needs updating. Refusing to report a comparison of two empty sets.`,
    )
  }
  return parsed
}

const only = (a, b) => [...b].filter((x) => !a.has(x))
const stripPeers = (list) => list.map((s) => s.replace(/\(.*$/, '').trim()).sort()

/**
 * execFileSync, never execSync, and the reason is not style.
 *
 * execSync runs through a shell — cmd.exe on Windows, where `^` is the ESCAPE character. The
 * first version of this used a shell and `git show HEAD^:pnpm-lock.yaml` silently became
 * `git show HEAD:pnpm-lock.yaml`. Both sides then read the same file, every set matched, and
 * the tool reported "VERDICT: no change" for a commit that changed 630 lines. A false pass, in
 * the tool written to stop false passes. execFileSync passes argv directly, so nothing is
 * interpreted.
 */
function read(spec, fallbackToWorkingTree) {
  if (spec && fs.existsSync(spec)) return { text: fs.readFileSync(spec, 'utf8'), label: spec }
  if (spec) {
    const out = execFileSync('git', ['show', `${spec}:pnpm-lock.yaml`], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    })
    return { text: out, label: `${spec}:pnpm-lock.yaml` }
  }
  if (!fallbackToWorkingTree) throw new Error('nothing to read')
  return { text: fs.readFileSync('pnpm-lock.yaml', 'utf8'), label: 'pnpm-lock.yaml (working tree)' }
}

function compare(beforeSrc, afterSrc) {
  // Two different sources that turn out byte-identical is usually a resolution mistake, not a
  // result. Saying so is what turns the shell-escaping bug described on `read` into something
  // visible rather than a confident "no change".
  if (beforeSrc.label !== afterSrc.label && beforeSrc.text === afterSrc.text) {
    console.log('NOTE: the two inputs are BYTE-IDENTICAL although they name different sources.')
    console.log('      If a difference was expected, suspect how the refs resolved before')
    console.log('      believing the verdict below.')
    console.log('')
  }

  const a = parse(beforeSrc.text, beforeSrc.label)
  const b = parse(afterSrc.text, afterSrc.label)

  const pkgAdded = only(a.packages, b.packages)
  const pkgRemoved = only(b.packages, a.packages)
  const specChanged = JSON.stringify(a.specifiers) !== JSON.stringify(b.specifiers)
  const versionsLiterallyEqual = JSON.stringify(a.versions) === JSON.stringify(b.versions)
  const versionsStrippedEqual = JSON.stringify(stripPeers(a.versions)) === JSON.stringify(stripPeers(b.versions))

  console.log(`before  ${a.label}`)
  console.log(`after   ${b.label}`)
  console.log('')
  console.log(`packages   (installed name@version)  ${a.packages.size} -> ${b.packages.size}` +
    `   added ${pkgAdded.length}, removed ${pkgRemoved.length}`)
  console.log(`snapshots  (with peer suffixes)      ${a.snapshots.size} -> ${b.snapshots.size}`)
  console.log(`specifiers (what projects declare)   ${a.specifiers.length} -> ${b.specifiers.length}` +
    `   ${specChanged ? 'CHANGED' : 'identical'}`)
  console.log(`versions   (what projects resolve)   ${a.versions.length} -> ${b.versions.length}` +
    `   ${versionsLiterallyEqual ? 'identical' : 'differ'}` +
    `, peer suffixes stripped: ${versionsStrippedEqual ? 'identical' : 'DIFFER'}`)

  for (const [title, list] of [['packages added', pkgAdded], ['packages removed', pkgRemoved]]) {
    if (list.length) {
      console.log(`\n${title}:`)
      for (const x of list.slice(0, 40)) console.log('   ' + x)
      if (list.length > 40) console.log(`   … and ${list.length - 40} more`)
    }
  }

  if (specChanged) {
    const added = only(new Set(a.specifiers), b.specifiers)
    const removed = only(new Set(b.specifiers), a.specifiers)
    console.log('\ndeclared specifiers that changed:')
    for (const x of removed.slice(0, 20)) console.log('   - ' + x)
    for (const x of added.slice(0, 20)) console.log('   + ' + x)
  }

  if (!versionsStrippedEqual) {
    const before = new Set(stripPeers(a.versions))
    const moved = stripPeers(b.versions).filter((x) => !before.has(x))
    console.log('\nRESOLVED VERSIONS THAT MOVED (peer suffixes already stripped):')
    for (const x of moved.slice(0, 40)) console.log('   ' + x)
    if (moved.length > 40) console.log(`   … and ${moved.length - 40} more`)
  }

  const versionMoved = pkgAdded.length > 0 || pkgRemoved.length > 0 || !versionsStrippedEqual
  const before = new Set(stripPeers(a.versions))
  const moved = stripPeers(b.versions).filter((x) => !before.has(x))
  const allWorkspaceLinks = moved.length > 0 && moved.every((x) => / -> link:/.test(x))

  console.log('')
  if (pkgAdded.length || pkgRemoved.length) {
    console.log('VERDICT: the installed package set changed — ' +
      `${pkgAdded.length} added, ${pkgRemoved.length} removed.`)
  } else if (!versionsStrippedEqual && allWorkspaceLinks) {
    console.log(`VERDICT: no package added or removed. ${moved.length} workspace link(s) changed —`)
    console.log('         a dependency edge between projects in this repo, not a download.')
  } else if (!versionsStrippedEqual) {
    console.log(`VERDICT: no package added or removed, but ${moved.length} project resolution(s)`)
    console.log('         moved. Read the list above — this is a real change.')
  } else if (!versionsLiterallyEqual || a.snapshots.size !== b.snapshots.size) {
    console.log('VERDICT: representation only. Same packages at the same versions; only the')
    console.log('         recorded peer wiring changed. Large line counts here are expected.')
  } else {
    console.log('VERDICT: no change.')
  }
  return versionMoved
}

// ---------------------------------------------------------------------------------------
// Self-test. The point is not that the tool reports "identical" on identical input — that is
// the failure mode, not the check. It is that the tool NOTICES a version change and IGNORES a
// peer-only one, and that it refuses a lockfile it cannot parse instead of comparing two empty
// sets. Every one of those has been a real false pass in this repository.
// ---------------------------------------------------------------------------------------
function selfTest() {
  const base = [
    '---', "lockfileVersion: '9.0'", '', 'importers:', '', '  .:', '    devDependencies:',
    "      lib:", '        specifier: ^1.0.0', '        version: 1.0.0(peer@1)', '',
    'packages:', '', "  lib@1.0.0:", '    resolution: {integrity: sha512-x}', '',
    'snapshots:', '', '  lib@1.0.0(peer@1): {}', '',
  ].join('\n')
  // pnpm 12 shape: a packageManagerDependencies document FIRST, with its own importers:.
  const multiDoc = ['---', "lockfileVersion: '9.0'", '', 'importers:', '', '  .:',
    '    packageManagerDependencies:', '      pnpm:', '        specifier: 12.3.4',
    '        version: 12.3.4', '', 'packages:', '', "  '@pnpm/exe.win32-x64@12.3.4':",
    '    resolution: {integrity: sha512-y}', ''].join('\n') + '\n' + base

  const peerOnly = base.replace('1.0.0(peer@1)', '1.0.0(peer@2)').replace('lib@1.0.0(peer@1): {}', 'lib@1.0.0(peer@2): {}')
  const versionMove = base.replace(/1\.0\.0/g, '1.1.0')

  const run = (x, y) => {
    const log = console.log
    console.log = () => {}
    try { return compare({ text: x, label: 'a' }, { text: y, label: 'b' }) } finally { console.log = log }
  }

  const cases = [
    ['detects a moved version', () => run(base, versionMove) === true],
    ['ignores peer-only churn', () => run(base, peerOnly) === false],
    ['reads the LAST document of a multi-document lockfile',
      () => parse(multiDoc, 'm').specifiers.length === 1 && parse(multiDoc, 'm').specifiers[0].includes('lib')],
    ['refuses input it cannot parse', () => {
      try { parse('nothing here\n', 'junk'); return false } catch { return true }
    }],
  ]

  let ok = true
  for (const [name, fn] of cases) {
    let pass = false
    try { pass = fn() } catch (e) { pass = false }
    console.log(`  ${pass ? 'pass' : 'FAIL'}  ${name}`)
    ok = ok && pass
  }
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED')
  process.exit(ok ? 0 : 1)
}

if (argv.includes('--self-test')) selfTest()

let moved = false
if (args.length >= 2) moved = compare(read(args[0]), read(args[1]))
else if (args.length === 1) moved = compare(read(args[0]), read(null, true))
else moved = compare(read('HEAD'), read(null, true))

process.exit(strict && moved ? 1 : 0)
