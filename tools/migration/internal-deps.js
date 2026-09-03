#!/usr/bin/env node
/**
 * List every @b41ex/@b41ex dependency declared anywhere in the workspace, with the
 * spec, and say whether a workspace package provides it.
 *
 * A scoped dependency that no workspace package provides is an *external* one: rescoping
 * it would point it at a package that does not exist, and converting it to workspace:*
 * would fail the install. Run before the rescope and again after wiring workspace:*.
 */
const fs = require('fs')
const path = require('path')

const roots = ['frontend', 'tests', 'tools', 'backend']
const pkgs = []

function walk(d, depth) {
  if (depth > 4) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name === '.git') continue
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

const provided = new Set(pkgs.map((p) => p.json.name).filter(Boolean))
const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
const rows = []
for (const p of pkgs) {
  for (const f of FIELDS) {
    for (const [name, spec] of Object.entries(p.json[f] || {})) {
      if (!/^@(netcracker|b41ex)\//.test(name)) continue
      rows.push({ from: p.dir, field: f, name, spec, internal: provided.has(name) })
    }
  }
}
rows.sort((a, b) => a.name.localeCompare(b.name) || a.from.localeCompare(b.from))
for (const r of rows) {
  console.log(
    (r.internal ? '  ' : 'EXT'),
    r.name.padEnd(56),
    String(r.spec).padEnd(30),
    r.field.padEnd(16),
    r.from,
  )
}
const ext = rows.filter((r) => !r.internal)
console.log(`\n${rows.length} scoped dependency entries; ${ext.length} not provided by any workspace package`)
for (const e of [...new Set(ext.map((r) => r.name))]) console.log('  EXTERNAL:', e)
