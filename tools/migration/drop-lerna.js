#!/usr/bin/env node
/**
 * Drop lerna from the three former lerna roots, per §3 and §12 Phase 2 step 5.
 *
 * §3: "Lerna itself is dropped — its two jobs (run-in-topological-order, version/publish)
 * are taken over by the orchestrator."
 *
 * A root script that fans out to its own children is a second scheduler competing with the
 * first, and the competition is not theoretical: once the npm `workspaces` field is gone in
 * favour of pnpm-workspace.yaml, lerna cannot enumerate the children at all and exits
 * EWORKSPACES. In prototype 2 that took api-doc-viewer's build down, and
 * apispec-view/packages/elements with it for want of a dist. UPSTREAM-GAPS G11.
 *
 * Three different lerna versions are declared across the three roots — ^8.2.2, 9.0.7 and
 * 8.2.2 — which is the other half of G11.
 *
 * Removal is keyed by manifest and by script name, never by pattern, so that a script
 * which merely *mentions* lerna is not deleted by accident and every deletion is
 * reviewable as an explicit list.
 *
 *   --dry-run   report only
 */
const fs = require('fs')

const DRY = process.argv.includes('--dry-run')

// Scripts that exist only to fan out to children. Each root's sub-packages carry the real
// script of the same name, so the orchestrator reaches them directly.
const REMOVE = {
  'frontend/api-doc-viewer/package.json': [
    'generate-compatibility-suite',
    'build',
    'build:showcase',
    'test',
    'screenshot-test',
    'screenshot-test-single-suite',
    'regenerate-screenshots',
    'regenerate-screenshots-single-suite',
    'development:storybook',
  ],
  'frontend/apispec-view/package.json': [
    'generate-compatibility-suite',
    'build',
    'build:showcase',
    'screenshot-test',
    'regenerate-screenshots',
  ],
  'frontend/ui/package.json': [
    'build',
    'build:analyze',
    // These two are `npm run --workspace=…`, not lerna, but they are the same thing in a
    // different spelling: a root reaching into a child through npm's workspace machinery,
    // which pnpm-workspace.yaml has just replaced. The child carries both scripts.
    'build:showcase',
    'test',
    // These fan out with --scope to select a single child; `pnpm --filter` is the
    // replacement and belongs in the development guide, not in a root manifest.
    'dev:agents',
    'dev:portal',
  ],
}

function edit(file, fn) {
  const raw = fs.readFileSync(file, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const m = raw.match(/\n([ \t]+)"/)
  const indent = m ? m[1] : '  '
  const trailing = /\r?\n$/.test(raw)
  const json = JSON.parse(raw)
  const notes = fn(json)
  if (!notes.length) return notes
  if (!DRY) {
    const body = JSON.stringify(json, null, indent).split('\n').join(eol)
    fs.writeFileSync(file, body + (trailing ? eol : ''))
  }
  return notes
}

for (const [file, names] of Object.entries(REMOVE)) {
  const notes = edit(file, (j) => {
    const gone = []
    for (const n of names) {
      if (j.scripts && n in j.scripts) {
        gone.push(`script ${n}: ${j.scripts[n]}`)
        delete j.scripts[n]
      }
    }
    for (const field of ['dependencies', 'devDependencies']) {
      if (j[field] && j[field].lerna) {
        gone.push(`${field}.lerna: ${j[field].lerna}`)
        delete j[field].lerna
      }
    }
    return gone
  })
  console.log(`\n${file}`)
  for (const g of notes) console.log(`  - ${g}`)
}

for (const f of ['frontend/api-doc-viewer/lerna.json', 'frontend/apispec-view/lerna.json', 'frontend/ui/lerna.json']) {
  if (!fs.existsSync(f)) continue
  console.log(`\ndeleted ${f}: ${fs.readFileSync(f, 'utf8').replace(/\s+/g, ' ').trim()}`)
  if (!DRY) fs.unlinkSync(f)
}
