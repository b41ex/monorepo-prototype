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
        // Preserve each file's own newline style and indentation. Every manifest in this
        // fleet is CRLF while .gitattributes says eol=lf, so writing LF unconditionally
        // rewrites every line of every file it touches and buries the one-line change
        // being made in a whole-file diff.
        const raw = fs.readFileSync(pj, 'utf8')
        const eol = raw.includes('\r\n') ? '\r\n' : '\n'
        const m = raw.match(/\n([ \t]+)"/)
        const indent = m ? m[1] : '  '
        const trailing = /\r?\n$/.test(raw)
        pkgs.push({ dir: s.split(path.sep).join('/'), file: pj, json: JSON.parse(raw), eol, indent, trailing })
      } catch {}
    }
    walk(s, depth + 1)
  }
}
for (const r of roots) if (fs.existsSync(r)) walk(r, 0)

function serialise(p) {
  const body = JSON.stringify(p.json, null, p.indent).split('\n').join(p.eol)
  return body + (p.trailing ? p.eol : '')
}

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
  // npm-gitflow is retired as a published package (§3: it becomes repo-local scripts under
  // tools/release), and §12 Phase 2 step 4 deletes the three script families it supplies.
  // It is not one of the eighteen components, so nothing in this workspace provides the
  // name and leaving the devDependency would fail the install.
  const GITFLOW = '@b41ex/qubership-apihub-npm-gitflow'
  const GITFLOW_SCRIPTS = /^(development:(un)?link|update-lock-file|release-start|release-finish|validate-dependencies)$/
  for (const f of FIELDS) {
    if (p.json[f] && p.json[f][GITFLOW]) {
      changes.push([p.dir, GITFLOW, p.json[f][GITFLOW], `removed from ${f}`])
      delete p.json[f][GITFLOW]
      if (!Object.keys(p.json[f]).length) delete p.json[f]
      dirty = true
    }
  }
  for (const s of Object.keys(p.json.scripts || {})) {
    if (!GITFLOW_SCRIPTS.test(s)) continue
    changes.push([p.dir, `script ${s}`, p.json.scripts[s], 'removed'])
    delete p.json.scripts[s]
    dirty = true
  }

  // npm's own workspaces field is superseded by pnpm-workspace.yaml; leaving it makes two
  // records of the same thing that can disagree.
  if (p.json.workspaces) {
    changes.push([p.dir, '(workspaces field)', JSON.stringify(p.json.workspaces), 'removed'])
    delete p.json.workspaces
    dirty = true
  }
  if (dirty && !DRY) fs.writeFileSync(p.file, serialise(p))
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
