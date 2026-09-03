#!/usr/bin/env node
/**
 * Rewrite `npm run` / `npm test` / `npx` in package scripts to their pnpm equivalents,
 * per §12 Phase 2 step 5.
 *
 * This is not cosmetic. Under node-linker=isolated, a script that shells out to `npm run`
 * resolves modules through npm's own view of node_modules, which is not the view the
 * install created. In prototype 1 ui-portal reported 114 type errors under the
 * orchestrator while a direct pnpm-run tsc in the same tree reported 0; the tell was
 * `npm warn Unknown env config "node-linker"` in the build log.
 *
 * §4's checklist also notes what this removes: npm's `npm run` inherits an ancestor .bin
 * fallback that quietly supplies undeclared binaries, so expect this rewrite to surface
 * missing dependency declarations rather than to be inert.
 *
 * Replacements, in order:
 *   npm run <x>   -> pnpm run <x>
 *   npm test      -> pnpm test
 *   npx <x>       -> pnpm exec <x>
 *
 * Deliberately NOT rewritten: `npm ci`, `npm install`, `npm pack` and `npm publish`.
 * Those are package-manager operations rather than script dispatch, they appear in
 * Dockerfiles and CI rather than in these manifests, and §6/§8 replace each with a
 * different mechanism (`pnpm deploy --prod`, `pnpm publish -r`) rather than a spelling.
 *
 *   --dry-run   report only
 */
const fs = require('fs')
const path = require('path')

const DRY = process.argv.includes('--dry-run')
const roots = ['frontend', 'tests', 'tools']

// Word-boundary anchored so `npm running` or a package called `npmx` cannot match.
const RULES = [
  [/\bnpm run\b/g, 'pnpm run'],
  [/\bnpm test\b/g, 'pnpm test'],
  [/\bnpx\b/g, 'pnpm exec'],
]

const files = []
function walk(d, depth) {
  if (depth > 4) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules') continue
    const s = path.join(d, e.name)
    const pj = path.join(s, 'package.json')
    if (fs.existsSync(pj)) files.push(pj)
    walk(s, depth + 1)
  }
}
for (const r of roots) if (fs.existsSync(r)) walk(r, 0)

let changed = 0
let scripts = 0
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const m = raw.match(/\n([ \t]+)"/)
  const indent = m ? m[1] : '  '
  const trailing = /\r?\n$/.test(raw)
  let json
  try {
    json = JSON.parse(raw)
  } catch {
    continue
  }
  if (!json.scripts) continue
  let dirty = false
  for (const [name, body] of Object.entries(json.scripts)) {
    let next = String(body)
    for (const [re, to] of RULES) next = next.replace(re, to)
    if (next === body) continue
    console.log(`${file.split(path.sep).join('/').padEnd(52)} ${name.padEnd(32)} ${body}`)
    console.log(`${''.padEnd(52)} ${''.padEnd(32)} ${next}`)
    json.scripts[name] = next
    dirty = true
    scripts++
  }
  if (!dirty) continue
  changed++
  if (!DRY) {
    const body = JSON.stringify(json, null, indent).split('\n').join(eol)
    fs.writeFileSync(file, body + (trailing ? eol : ''))
  }
}

console.log(`\n${scripts} scripts rewritten across ${changed} manifests`)

// Negative control: nothing should be left that dispatches through npm or npx. Reported
// rather than asserted, because `npm ci`/`npm install`/`npm pack` legitimately remain.
const left = []
for (const file of files) {
  let json
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    continue
  }
  for (const [name, body] of Object.entries(json.scripts || {})) {
    if (/\b(npm run|npm test|npx)\b/.test(String(body))) left.push(`${file} ${name}: ${body}`)
  }
}
console.log(`${left.length} script(s) still dispatching through npm run / npm test / npx`)
for (const l of left) console.log('  ', l)
