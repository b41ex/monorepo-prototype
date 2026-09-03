#!/usr/bin/env node
/**
 * Which imports does a workspace package make that it cannot resolve from its own tree?
 *
 * Phase 1 item 1.2 declared what was declared *nowhere*. A monorepo needs the stronger
 * property: declared *by the package that imports it*. Under npm's flat hoist those are the
 * same thing in practice; under pnpm's isolated linker they are not, and §4 "Known
 * migration cost" predicted exactly this for ui, api-doc-viewer and apispec-view.
 *
 * Measured against the real installed tree rather than by reading manifests, so a
 * declaration inherited some other legitimate way still counts as resolvable.
 *
 * tsconfig `paths` keys are excluded: an alias is not a dependency. Every tsconfig at or
 * above the package inside its component contributes its keys.
 */
const fs = require('fs')
const path = require('path')
const Module = require('module')

const SKIP = new Set([
  'node_modules', '.git', 'dist', 'dist-showcase', 'build', 'out', 'coverage',
  '__image_snapshots__', '.vscode-test', '.nx', '.storybook-static',
])
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const NAME_RE = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i
const builtin = new Set(Module.builtinModules)

// A nested workspace member is scanned as itself, so a parent must not also claim its
// files - otherwise ui reports every alias and dependency of portal, agents and shared.
function walk(d, stop, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const sub = path.join(d, e.name).split(path.sep).join('/')
      if (!SKIP.has(e.name) && !stop.has(sub)) walk(path.join(d, e.name), stop, out)
    } else if (SOURCE_EXT.has(path.extname(e.name))) {
      out.push(path.join(d, e.name))
    }
  }
  return out
}

const pkgOf = (spec) => {
  const b = spec.lastIndexOf('!')
  const bare = b === -1 ? spec : spec.slice(b + 1)
  if (/^[./~]/.test(bare) || bare.startsWith('node:')) return null
  const p = bare.split('/')
  const n = bare.startsWith('@') ? p.slice(0, 2).join('/') : p[0]
  return NAME_RE.test(n) ? n : null
}

// Only real import/require/from forms, and only the specifier.
const IMPORT_RE = /(?:^|[\s;{}(])(?:import|export)\s[^'"()]*?from\s*['"]([^'"]+)['"]|(?:^|[^\w.])require\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[^\w.])import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm

function aliasKeys(dir, componentRoot) {
  const keys = new Set()
  let d = dir
  for (;;) {
    for (const f of fs.existsSync(d) ? fs.readdirSync(d) : []) {
      if (!/^tsconfig(\..+)?\.json$/.test(f)) continue
      const txt = fs.readFileSync(path.join(d, f), 'utf8')
      for (const m of txt.matchAll(/"([^"*]+)(?:\/\*)?"\s*:\s*\[/g)) keys.add(m[1].replace(/\/$/, ''))
    }
    if (path.resolve(d) === path.resolve(componentRoot)) break
    const up = path.dirname(d)
    if (up === d) break
    d = up
  }
  return keys
}

const workspaceDirs = process.argv.slice(2)
let total = 0
for (const dir of workspaceDirs) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  // The component root is the nearest ancestor that is itself a workspace member, else dir.
  const componentRoot = workspaceDirs
    .filter((w) => dir.startsWith(w + '/') && w !== dir)
    .sort((a, b) => b.length - a.length)[0] || dir
  const aliases = aliasKeys(dir, componentRoot)
  // createRequire needs an absolute path; given a relative one it does not walk the right
  // node_modules chain and every specifier looks unresolvable.
  const req = Module.createRequire(path.resolve(dir, 'noop.js'))
  const isAliased = (n) => aliases.has(n) || [...aliases].some((a) => n.startsWith(a + '/'))
  const nested = new Set(workspaceDirs.filter((w) => w !== dir && w.startsWith(dir + '/')))

  const missing = new Map()
  for (const file of walk(dir, nested)) {
    const src = fs.readFileSync(file, 'utf8')
    if (src.length > 2_000_000) continue
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] || m[2] || m[3] || m[4]
      if (!spec) continue
      const name = pkgOf(spec)
      if (!name || builtin.has(name) || name === manifest.name || isAliased(name)) continue
      try {
        req.resolve(name + '/package.json')
        continue
      } catch {}
      try {
        req.resolve(name)
        continue
      } catch {}
      // A types-only import is satisfied by @types/<name>; the runtime package need not be
      // present. http-spec imports swagger-schema-official in 15 files and declares only
      // @types/swagger-schema-official, which is correct.
      try {
        req.resolve((name.startsWith('@') ? '@types/' + name.slice(1).replace('/', '__') : '@types/' + name) + '/package.json')
        continue
      } catch {}
      const rec = missing.get(name) || { count: 0, sample: file }
      rec.count++
      missing.set(name, rec)
    }
  }
  if (missing.size) {
    console.log(`\n## ${dir}  (${manifest.name})`)
    for (const [n, r] of [...missing].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`  ${n.padEnd(50)} ${String(r.count).padStart(4)} imports   e.g. ${path.relative(dir, r.sample)}`)
    }
    total += missing.size
  }
}
console.log(`\n${total} package/dependency pairs unresolvable from the importing package`)
