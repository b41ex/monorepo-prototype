#!/usr/bin/env node
/**
 * Capture what every per-component lock file actually resolved, before the lock files are
 * deleted in favour of one workspace lock file.
 *
 * §12 Phase 2 step 2: "preserve resolved versions, not just declared ranges". The first
 * prototype's JS build failures all came from skipping this. Pinning direct dependencies is
 * not sufficient — the api-unifier regression came from @asyncapi/specs drifting one level
 * below a correctly-pinned parser — so this records every entry in the tree, not just the
 * manifest's own.
 *
 * Output: JSON, { component: { packageName: [versions…] } }.
 */
const fs = require('fs')
const path = require('path')

const root = process.argv[2] || process.cwd()
const out = {}

function walk(dir, depth) {
  if (depth > 4) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    if (e.name === 'node_modules' || e.name === '.git') continue
    const sub = path.join(dir, e.name)
    for (const lf of ['package-lock.json', 'npm-shrinkwrap.json']) {
      const p = path.join(sub, lf)
      if (!fs.existsSync(p)) continue
      const rel = path.relative(root, sub).split(String.fromCharCode(92)).join('/')
      const lock = JSON.parse(fs.readFileSync(p, 'utf8'))
      const map = {}
      for (const [k, v] of Object.entries(lock.packages || {})) {
        if (!k || !v.version) continue
        const name = v.name || k.slice(k.lastIndexOf('node_modules/') + 13)
        if (!name) continue
        ;(map[name] ||= [])
        if (!map[name].includes(v.version)) map[name].push(v.version)
      }
      out[rel] = { lockfile: lf, packages: map }
    }
    walk(sub, depth + 1)
  }
}

walk(root, 0)
process.stdout.write(JSON.stringify(out, null, 1))
