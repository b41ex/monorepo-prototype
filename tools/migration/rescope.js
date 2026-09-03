#!/usr/bin/env node
/**
 * Rename the npm scope @netcracker -> @b41ex across the workspace.
 *
 * The prototype runs in a personal sandbox: rescoping is what makes it structurally
 * incapable of resolving from, or publishing to, the real Netcracker namespace. The real
 * migration keeps @netcracker.
 *
 * Skips '@netcracker.' so the opensourcegroup@netcracker.com contact address survives in
 * SECURITY.md, CODE-OF-CONDUCT.md and the OpenAPI contact blocks.
 *
 * Skips the per-component lock files (they are deleted in favour of one workspace lock)
 * and tools/migration/resolutions-before.json (a record of the pre-migration state, which
 * must keep the original names).
 */
const fs = require('fs')
const { execFileSync } = require('child_process')

const SKIP = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json)$|^tools\/migration\/resolutions-before\.json$/
const PATTERN = /@netcracker(?!\.)/g

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !SKIP.test(f))

let touched = 0
let occurrences = 0
const byExt = {}

for (const f of files) {
  let buf
  try {
    buf = fs.readFileSync(f)
  } catch {
    continue
  }
  if (buf.includes(0)) continue // binary
  const src = buf.toString('utf8')
  if (!src.includes('@netcracker')) continue
  const out = src.replace(PATTERN, '@b41ex')
  if (out === src) continue
  const n = (src.match(PATTERN) || []).length
  occurrences += n
  touched++
  const ext = f.includes('.') ? f.slice(f.lastIndexOf('.') + 1) : '(none)'
  byExt[ext] = (byExt[ext] || 0) + 1
  if (!process.argv.includes('--dry-run')) fs.writeFileSync(f, out)
}

console.log(`${occurrences} occurrences across ${touched} files`)
for (const [e, n] of Object.entries(byExt).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)} .${e}`)
