#!/usr/bin/env node
/** List every package.json in the workspace tree: name, version, private, dir. */
const fs = require('fs')
const path = require('path')

const roots = ['frontend', 'tests', 'tools', 'backend']
const found = []

function walk(d, depth) {
  if (depth > 4) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name === '.git') continue
    const s = path.join(d, e.name)
    const pj = path.join(s, 'package.json')
    if (fs.existsSync(pj)) {
      try {
        const p = JSON.parse(fs.readFileSync(pj, 'utf8'))
        found.push({ dir: s.split(path.sep).join('/'), name: p.name, version: p.version, private: !!p.private })
      } catch (err) {
        found.push({ dir: s.split(path.sep).join('/'), name: '<unparseable>', version: '', private: false })
      }
    }
    walk(s, depth + 1)
  }
}

for (const r of roots) if (fs.existsSync(r)) walk(r, 0)
found.sort((a, b) => a.dir.localeCompare(b.dir))
for (const f of found) {
  console.log((f.private ? 'p' : ' '), String(f.version || '-').padEnd(12), String(f.name).padEnd(58), f.dir)
}
console.log('total', found.length)
