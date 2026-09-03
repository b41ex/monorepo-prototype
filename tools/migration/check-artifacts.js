#!/usr/bin/env node
/**
 * TESTING-PROCEDURE L2, run against the built workspace rather than a packed tarball.
 *
 * For every publishable package, assert that every path its manifest names — main, module,
 * types, typings, and every string target inside exports — exists and is non-empty, and that
 * no declaration entry is the self-referential `export * from './index'` stub that resolves
 * to itself and exports nothing.
 *
 * Four separate defects on this project shipped a green build with an unusable artifact.
 * A compiler exiting 0 says it found no type errors; it says nothing about what it emitted.
 */
const fs = require('fs')
const path = require('path')

const roots = ['frontend', 'tests', 'tools']
const pkgs = []
function walk(d, depth) {
  if (depth > 4) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    // Skip build output: api-processor copies a package.json into dist/cjs, and walking
    // into it reports the built directory as a package whose entry points are missing.
    if (!e.isDirectory()) continue
    if (['node_modules', '.git', 'dist', 'build', 'out', 'dist-showcase'].includes(e.name)) continue
    const s = path.join(d, e.name)
    const pj = path.join(s, 'package.json')
    if (fs.existsSync(pj)) {
      try {
        pkgs.push({ dir: s.split(path.sep).join('/'), json: JSON.parse(fs.readFileSync(pj, 'utf8')) })
      } catch {}
    }
    walk(s, depth + 1)
  }
}
for (const r of roots) if (fs.existsSync(r)) walk(r, 0)

const collectTargets = (exp, out = []) => {
  if (typeof exp === 'string') out.push(exp)
  else if (exp && typeof exp === 'object') for (const v of Object.values(exp)) collectTargets(v, out)
  return out
}

let checked = 0
let problems = 0
for (const p of pkgs) {
  if (p.json.private) continue
  const targets = new Set()
  for (const f of ['main', 'module', 'types', 'typings', 'browser']) {
    if (typeof p.json[f] === 'string') targets.add(p.json[f])
  }
  for (const t of collectTargets(p.json.exports)) targets.add(t)
  if (!targets.size) {
    console.log(`?  ${p.dir.padEnd(50)} declares no entry points`)
    continue
  }
  const rows = []
  for (const t of targets) {
    if (t.includes('*')) continue // pattern export; not resolvable without a subpath
    const abs = path.join(p.dir, t)
    if (!fs.existsSync(abs)) {
      rows.push(['MISSING', t])
      continue
    }
    const stat = fs.statSync(abs)
    if (stat.isDirectory()) continue
    if (stat.size === 0) {
      rows.push(['EMPTY', t])
      continue
    }
    if (/\.d\.ts$/.test(t)) {
      const body = fs
        .readFileSync(abs, 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*') && !l.trim().startsWith('*'))
        .join('\n')
        .trim()
      if (/^export \* from ['"]\.\/index['"];?$/.test(body)) rows.push(['SELF-REFERENTIAL', t])
    }
  }
  checked++
  if (rows.length) {
    console.log(`\nFAIL ${p.dir}  (${p.json.name})`)
    for (const [why, t] of rows) console.log(`       ${why.padEnd(18)} ${t}`)
    problems += rows.length
  } else {
    console.log(`ok   ${p.dir.padEnd(50)} ${targets.size} entry point(s)`)
  }
}
console.log(`\n${checked} publishable packages checked, ${problems} problems`)
process.exit(problems ? 1 : 0)
