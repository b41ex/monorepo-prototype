#!/usr/bin/env node
/**
 * Convert every internal @b41ex dependency to the workspace: protocol, and strip the
 * per-component package-manager configuration that one workspace replaces.
 *
 * Per §12 Phase 2 step 4. Reports what it changed so the diff is reviewable.
 *
 *   --dry-run   report only
 */
const fs = require('fs')
const path = require('path')

const DRY = process.argv.includes('--dry-run')
const roots = ['frontend', 'tests', 'tools', 'backend']
const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

const pkgs = []
function walk(d, depth) {
  if (depth > 4) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name === '.git') continue
    const s = path.join(d, e.name)
    const pj = path.join(s, 'package.json')
    if (fs.existsSync(pj)) {
      try {
        pkgs.push({ dir: s.split(path.sep).join('/'), file: pj, json: JSON.parse(fs.readFileSync(pj, 'utf8')) })
      } catch {}
    }
    walk(s, depth + 1)
  }
}
for (const r of roots) if (fs.existsSync(r)) walk(r, 0)

const provided = new Map(pkgs.filter((p) => p.json.name).map((p) => [p.json.name, p]))

let rewritten = 0
const changes = []
for (const p of pkgs) {
  let dirty = false
  for (const f of FIELDS) {
    const block = p.json[f]
    if (!block) continue
    for (const [name, spec] of Object.entries(block)) {
      if (!provided.has(name)) continue
      if (String(spec).startsWith('workspace:')) continue
      const target = provided.get(name)
      // A private 0.0.0 package cannot be selected by a caret range at publish time, and
      // never is published; use '*' there and '^' where a real version exists.
      const next = target.json.private || target.json.version === '0.0.0' ? 'workspace:*' : 'workspace:^'
      changes.push([p.dir, name, spec, next])
      block[name] = next
      dirty = true
      rewritten++
    }
  }
  // npm's own workspaces field is superseded by pnpm-workspace.yaml; leaving it makes two
  // records of the same thing that can disagree.
  if (p.json.workspaces) {
    changes.push([p.dir, '(workspaces field)', JSON.stringify(p.json.workspaces), 'removed'])
    delete p.json.workspaces
    dirty = true
  }
  if (dirty && !DRY) fs.writeFileSync(p.file, JSON.stringify(p.json, null, 2) + '\n')
}

for (const [dir, name, from, to] of changes) {
  console.log(`${dir.padEnd(52)} ${name.padEnd(56)} ${String(from).padEnd(30)} -> ${to}`)
}
console.log(`\n${rewritten} dependency specs rewritten to the workspace protocol`)

// Per-component registry config and lock files: one workspace has one of each.
const doomed = []
for (const p of pkgs) {
  for (const f of ['.npmrc', 'package-lock.json', 'npm-shrinkwrap.json']) {
    const q = path.join(p.dir, f)
    if (fs.existsSync(q)) doomed.push(q.split(path.sep).join('/'))
  }
}
console.log(`\n${doomed.length} per-component files superseded by the workspace root:`)
for (const d of doomed) console.log('  ', d)
if (!DRY) for (const d of doomed) fs.unlinkSync(d)
