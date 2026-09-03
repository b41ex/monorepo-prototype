#!/usr/bin/env node
/**
 * G24's audit: which workspace packages are BOTH bundled by a consumer AND loaded
 * directly in a browser?
 *
 * Those two consumer classes need opposite externals policies — the bundling consumer
 * needs react external, or the app ships two Reacts; the browser needs it bundled,
 * because a browser has no module resolver. A package with both shapes cannot have one
 * externals policy, and the failure is silent: both builds exit 0.
 *
 * That cost api-doc-viewer's 947 screenshot tests three pushes of red while every record
 * said the branch was green. The instruction that follows from it is "enumerate the
 * consumer classes, not the builds", and this script is that enumeration — run before any
 * monorepo build config is unified, not after.
 *
 * A package is counted as
 *   BUNDLED  if another workspace package declares it as a dependency and that consumer
 *            builds with a bundler (vite, webpack, rolldown) rather than plain tsc.
 *   BROWSER  if it has a showcase build (storybook, or any build whose output directory
 *            is served) or a screenshot suite that serves that output over HTTP.
 *
 * For each package in both classes it then reports what the library build says about
 * react, and whether the showcase build inherits that config.
 */
const fs = require('fs')
const path = require('path')

const roots = ['frontend', 'tests', 'tools']
const pkgs = []
function walk(d, depth) {
  if (depth > 4) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules') continue
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

const byName = new Map(pkgs.filter((p) => p.json.name).map((p) => [p.json.name, p]))

function scripts(p) {
  return Object.entries(p.json.scripts || {})
}
function scriptText(p) {
  return scripts(p)
    .map(([k, v]) => `${k} ${v}`)
    .join('\n')
}

// Does this package's own build go through a bundler at all?
function bundler(p) {
  const t = scriptText(p)
  const found = []
  if (/\bvite build\b/.test(t)) found.push('vite')
  if (/\bwebpack\b/.test(t)) found.push('webpack')
  if (/\bnest build\b/.test(t)) found.push('nest')
  if (/\btsc\b/.test(t) && !found.length) found.push('tsc')
  return found
}

// Is it loaded straight into a browser by something in this repository?
function browserLoaded(p) {
  const t = scriptText(p)
  const why = []
  if (/storybook build/.test(t)) why.push('storybook showcase build')
  if (/dist-showcase/.test(t)) why.push('serves dist-showcase over HTTP')
  if (/screenshot-test|regenerate-screenshots/.test(t)) why.push('screenshot suite')
  if (/build\.webcomponents|web-components/.test(t)) why.push('web-components bundle')
  return [...new Set(why)]
}

// Which workspace packages declare it, and do they bundle?
function consumers(name) {
  const out = []
  for (const p of pkgs) {
    const all = {
      ...p.json.dependencies,
      ...p.json.devDependencies,
      ...p.json.peerDependencies,
    }
    if (!(name in all)) continue
    if (p.json.name === name) continue
    out.push({ dir: p.dir, name: p.json.name, bundles: bundler(p).filter((b) => b !== 'tsc') })
  }
  return out
}

/**
 * WHERE an externals decision lives is the whole discriminator, and it is a Storybook
 * implementation detail: Storybook auto-loads the package's own vite config and
 * **replaces** `build.rollupOptions` while **merging** `plugins`.
 *
 * So an externals decision inside build.rollupOptions.external never reaches the showcase
 * — the showcase bundles, which is what a browser needs. The same decision expressed as a
 * plugin DOES reach it, and the showcase then emits bare specifiers no browser can
 * resolve. That is exactly what item 1.11 did to api-doc-viewer, and both builds exit 0
 * either way.
 *
 * Every package below is therefore safe or unsafe by virtue of a detail none of their
 * configs mentions. This function reports the location so the six can be told apart.
 */
function externalsLocation(p) {
  const notes = []
  const files = []
  function collect(d, depth) {
    if (depth > 2 || !fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'dist-showcase') continue
      const s = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name === '.storybook' || depth === 0) collect(s, depth + 1)
        continue
      }
      if (/\.(config|conf)\.(js|cjs|mjs|ts)$|^main\.(ts|js)$|^preview\.(ts|js)$/.test(e.name)) files.push(s)
    }
  }
  collect(p.dir, 0)
  for (const f of files) {
    let src
    try {
      src = fs.readFileSync(f, 'utf8')
    } catch {
      continue
    }
    const rel = f.split(path.sep).join('/')
    const inStorybook = /\.storybook\//.test(rel)
    const strips = /builtin:esm-external-require|stripPluginByName/.test(src)
    if (inStorybook && strips) {
      notes.push(`SAFE-BY-FIX   ${rel} strips the externals plugin from the showcase config`)
      continue
    }
    if (inStorybook) {
      if (/viteFinal|rollupOptions|plugins/.test(src)) notes.push(`showcase      ${rel} overrides the vite config`)
      continue
    }
    // rollupOptions.external / webpack externals: Storybook REPLACES build.rollupOptions,
    // so this cannot leak into the showcase.
    if (/rollupOptions\s*:[\s\S]{0,400}?external/.test(src)) {
      notes.push(`REPLACED      ${rel} externalises inside build.rollupOptions — Storybook replaces it`)
    }
    if (/\bexternals\s*:/.test(src)) {
      notes.push(`WEBPACK       ${rel} externalises via webpack \`externals\` — a separate config, not merged`)
    }
    // A plugin, on the other hand, IS merged into the showcase config.
    if (/esmExternalRequire|externalRequirePlugin/.test(src)) {
      notes.push(`MERGED        ${rel} externalises through a PLUGIN — Storybook merges plugins, so this reaches the showcase`)
    }
  }
  return notes
}

const rows = []
for (const p of pkgs) {
  if (!p.json.name) continue
  const browser = browserLoaded(p)
  const cons = consumers(p.json.name)
  const bundling = cons.filter((c) => c.bundles.length)
  rows.push({ p, browser, cons, bundling })
}

console.log('=== Packages in BOTH consumer classes (the G24 shape) ===\n')
let both = 0
for (const r of rows) {
  if (!r.browser.length || !r.bundling.length) continue
  both++
  console.log(`${r.p.json.name}`)
  console.log(`  at              ${r.p.dir}`)
  console.log(`  own build       ${bundler(r.p).join(', ') || '(none)'}`)
  console.log(`  browser class   ${r.browser.join('; ')}`)
  console.log(`  bundled by      ${r.bundling.map((c) => `${c.name} (${c.bundles.join('/')})`).join(', ')}`)
  const pol = externalsLocation(r.p)
  console.log(`  externals       ${pol.length ? '' : '(no externals decision in any build config — it bundles everything)'}`)
  for (const n of pol) console.log(`                  ${n}`)
  console.log()
}
console.log(`${both} package(s) in both classes\n`)

console.log('=== Browser-loaded but NOT bundled by any workspace consumer ===')
for (const r of rows) {
  if (!r.browser.length || r.bundling.length) continue
  console.log(`  ${r.p.json.name.padEnd(56)} ${r.browser.join('; ')}`)
}

console.log('\n=== Bundled by a consumer but NOT browser-loaded here ===')
for (const r of rows) {
  if (r.browser.length || !r.bundling.length) continue
  console.log(`  ${r.p.json.name.padEnd(56)} bundled by ${r.bundling.map((c) => c.name).join(', ')}`)
}
