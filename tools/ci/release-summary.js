#!/usr/bin/env node
/**
 * Render `nx release`'s output as a GitHub job summary.
 *
 * WHY THIS IS NOT `grep`
 *
 * The first version of the release workflow piped the log through `grep` straight into the
 * summary, and the result was unreadable: Nx colours its output even when stdout is not a
 * terminal, so every line arrived wrapped in escape sequences and the summary showed
 * `ESC[1mESC[31mapi-doc-viewer` instead of a project name.
 *
 * Stripping the colour would have been enough to make it legible, but not enough to make it
 * useful. The raw log also prints each manifest write TWICE for any project that is both
 * versioned and updated as a dependent, and it interleaves the projects that did nothing with
 * the ones that did — seventeen lines to say that four things moved.
 *
 * So this reads the three facts worth keeping — what each project was, what it became, and
 * which releases were created — and prints them as a table. Colour is stripped rather than
 * suppressed at the source, deliberately: the live Actions log renders the colour fine and it
 * helps there, so `NO_COLOR` would cost something for no gain.
 *
 * Usage:  nx release ... | tee log ; node tools/ci/release-summary.js <log> <mode> >> $GITHUB_STEP_SUMMARY
 *         <mode> is `dry run` or `real`, and is reported rather than inferred.
 *
 *   --self-test   run the assertions at the bottom and exit
 */
const fs = require('fs')

// CSI sequences only. Nx emits SGR colour, which is all this needs to cover.
const stripAnsi = (s) => s.replace(/\[[0-9;]*[A-Za-z]/g, '')

function parse(raw) {
  const lines = stripAnsi(raw).split(/\r?\n/)
  const current = new Map()
  const next = new Map()
  const unchanged = []
  const releases = []

  for (const line of lines) {
    // `<project> 🏷️  Resolved the current version as 1.2.3 from git tag "..."`
    let m = line.match(/^(\S+)\s+\S*\s*Resolved the current version as (\S+)\s+from/u)
    if (m) {
      current.set(m[1], m[2])
      continue
    }
    // `<project> ✍️  New version 1.2.3 written to manifest: <path>` — printed more than once
    // for a project that is both versioned and bumped as a dependent, so last write wins and
    // the Map deduplicates for free.
    m = line.match(/^(\S+)\s+\S*\s*New version (\S+)\s+written to manifest/u)
    if (m) {
      next.set(m[1], m[2])
      continue
    }
    m = line.match(/^(\S+)\s+\S*\s*No changes were detected/u)
    if (m) {
      unchanged.push(m[1])
      continue
    }
    // `CREATE https://github.com/<owner>/<repo>/releases/tag/<tag>` with an optional marker
    m = line.match(/^CREATE (https:\/\/\S+\/releases\/tag\/(\S+?))(\s+\[dry-run\])?$/)
    if (m) releases.push({ url: m[1], tag: m[2], dryRun: Boolean(m[3]) })
  }
  return { current, next, unchanged, releases }
}

function render({ current, next, unchanged, releases }, mode) {
  const out = []
  const say = (s = '') => out.push(s)

  say('## Release finish')
  say()
  say(`Mode: **${mode}**`)
  say()

  if (!next.size) {
    // Not a failure, and worth saying so explicitly: `nx release` exits 0 when it decides
    // nothing needs releasing, which in a log is indistinguishable from a release that worked.
    say('**Nothing to release.** No project had a conventional commit that resolves a bump since')
    say(`its last \`component/version\` tag. ${unchanged.length} project${unchanged.length === 1 ? '' : 's'} checked.`)
    return out.join('\n') + '\n'
  }

  say('| project | from | to | bump |')
  say('|---|---|---|---|')
  for (const [project, to] of [...next].sort()) {
    const from = current.get(project) ?? '—'
    say(`| \`${project}\` | ${from} | **${to}** | ${bumpKind(from, to)} |`)
  }
  say()
  say(`${unchanged.length} other project${unchanged.length === 1 ? '' : 's'} unchanged.`)
  say()

  if (releases.length) {
    say(`### GitHub Releases${releases.some((r) => r.dryRun) ? ' (not created — dry run)' : ''}`)
    say()
    for (const r of releases.sort((a, b) => a.tag.localeCompare(b.tag))) {
      say(`- [\`${r.tag}\`](${r.url})`)
    }
  } else {
    say('_No GitHub Release lines in the output._')
  }
  return out.join('\n') + '\n'
}

/** major/minor/patch, by comparing the two version strings rather than trusting the log. */
function bumpKind(from, to) {
  const a = String(from).split('.').map(Number)
  const b = String(to).split('.').map(Number)
  if (a.length < 3 || b.length < 3 || a.some(isNaN) || b.some(isNaN)) return '—'
  if (b[0] !== a[0]) return '**major**'
  if (b[1] !== a[1]) return 'minor'
  if (b[2] !== a[2]) return 'patch'
  return '—'
}

if (process.argv[2] === '--self-test') {
  const assert = require('node:assert')
  const E = ''
  const log = [
    `${E}[1m${E}[31mapi-doc-viewer${E}[39m${E}[22m 🏷️  Resolved the current version as 3.4.4 from git tag "api-doc-viewer/3.4.4", based on x`,
    `${E}[1m${E}[31mapi-doc-viewer${E}[39m${E}[22m ✍️  New version 3.4.5 written to manifest: a/package.json`,
    `${E}[1m${E}[31mapi-doc-viewer${E}[39m${E}[22m ✍️  New version 3.4.5 written to manifest: a/package.json`,
    `api-diff 🏷️  Resolved the current version as 3.5.0 from git tag "api-diff/3.5.0", based on x`,
    `api-diff ✍️  New version 4.0.0 written to manifest: b/package.json`,
    `ddlapi 🚫 No changes were detected using git history and the conventional commits standard`,
    `CREATE https://github.com/o/r/releases/tag/api-diff/4.0.0`,
  ].join('\n')
  const p = parse(log)
  assert.strictEqual(p.next.get('api-doc-viewer'), '3.4.5', 'colour must not defeat the match')
  assert.strictEqual(p.next.size, 2, 'the repeated manifest write must collapse to one row')
  assert.strictEqual(p.unchanged.length, 1, 'unchanged projects must be counted, not listed')
  assert.strictEqual(p.releases[0].tag, 'api-diff/4.0.0', 'a tag containing a slash must survive')
  assert.strictEqual(p.releases[0].dryRun, false)
  assert.strictEqual(bumpKind('3.5.0', '4.0.0'), '**major**')
  assert.strictEqual(bumpKind('3.4.4', '3.4.5'), 'patch')
  assert.strictEqual(bumpKind('1.1.0', '1.2.0'), 'minor')
  const md = render(p, 'real')
  assert.ok(!md.includes(E), 'no escape sequence may reach the summary')
  assert.ok(md.includes('| `api-diff` | 3.5.0 | **4.0.0** | **major** |'), 'the table row must render')
  assert.ok(render(parse('x 🚫 No changes were detected using git'), 'real').includes('Nothing to release'))
  console.log('release-summary self-test: all assertions passed')
  process.exit(0)
}

const [logPath, mode] = process.argv.slice(2)
if (!logPath) {
  console.error('usage: release-summary.js <log> <mode>')
  process.exit(2)
}
process.stdout.write(render(parse(fs.readFileSync(logPath, 'utf8')), mode || 'real'))
