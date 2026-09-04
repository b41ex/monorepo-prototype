#!/usr/bin/env node
/**
 * Render the plan job's decision as a GitHub job summary, with a Mermaid diagram.
 *
 * GitHub renders ```mermaid fenced blocks in job summaries, so the summary can show what a
 * push actually triggered rather than describing it in three lines of text. The value is in
 * the *negative* space: a skipped screenshot job is 1,888 tests and roughly twenty minutes
 * not spent, and that is invisible in the run list — a skipped job looks the same whether
 * skipping was correct or a bug in the affected computation. This makes the reasoning legible
 * at a glance, which matters because job selection has no equivalent of Nx's
 * `Cache: N/N hit` line to read.
 *
 * Usage:
 *   node tools/ci/plan-summary.js <graph.json> <affected.json> <shots.json> <images.json> \
 *        <forced-reason-or-empty> >> "$GITHUB_STEP_SUMMARY"
 */
const fs = require('fs')
const path = require('path')

const [graphPath, affectedRaw, shotsRaw, imagesRaw, forcedRaw] = process.argv.slice(2)
const graph = JSON.parse(fs.readFileSync(path.resolve(graphPath), 'utf8')).graph
const affected = new Set(JSON.parse(affectedRaw))
const shots = JSON.parse(shotsRaw)
const images = JSON.parse(imagesRaw)
const forced = (forcedRaw || '').trim()

const out = []
const say = (s = '') => out.push(s)

// Mermaid ids must be identifier-safe; project names contain dashes, which are fine, but
// nothing else here is guaranteed to be.
const id = (n) => 'p_' + n.replace(/[^A-Za-z0-9_]/g, '_')

say('## What this push triggers')
say()

// ---- the job-level decision, always shown and always small -----------------------------
const jobState = (list, name) =>
  list.length ? `${name}<br/>${list.length} job${list.length > 1 ? 's' : ''}` : `${name}<br/>skipped`
const cls = (list) => (list.length ? 'runs' : 'skips')

say('```mermaid')
say('flowchart LR')
say('  plan["plan<br/>affected: ' + affected.size + ' project' + (affected.size === 1 ? '' : 's') + '"]:::runs')
say('  js["js<br/>build + test"]:::runs')
say('  shots["' + jobState(shots, 'screenshot-tests') + '"]:::' + cls(shots))
say('  imgs["' + jobState(images, 'images') + '"]:::' + cls(images))
say('  ok["ci-ok"]:::runs')
say('  plan --> js')
say('  js --> shots')
say('  js --> imgs')
say('  js --> ok')
say('  shots --> ok')
say('  imgs --> ok')
say('  classDef runs fill:#1f6f3f,stroke:#0d3b21,color:#fff')
say('  classDef skips fill:#3a3f45,stroke:#22262a,color:#9aa4ad')
say('```')
say()

// ---- what was affected, and why anything downstream of it runs --------------------------
if (!affected.size) {
  say('**Nothing affected.** No project changed, so `js` has no tasks and both matrix jobs')
  say('are skipped. This is the cheapest possible run.')
} else {
  const list = [...affected].sort()
  say(`**${list.length} project${list.length > 1 ? 's' : ''} affected:** ` + list.map((p) => `\`${p}\``).join(', '))
  say()

  // The dependency subgraph is only legible while it is small. Above the cap, the list above
  // already says everything and a 33-node diagram says less than nothing.
  const CAP = 14
  const hasEdges = list.some((a) => (graph.dependencies[a] || []).some((d) => affected.has(d.target)))
  if (list.length <= CAP && hasEdges) {
    const edges = []
    for (const a of list) {
      for (const d of graph.dependencies[a] || []) {
        // Draw an edge only when the dependency is itself a project we are naming, so the
        // diagram stays a picture of the affected set rather than of the whole workspace.
        if (affected.has(d.target)) edges.push([a, d.target])
      }
    }
    say('Dependency edges within the affected set — each arrow is a `dependsOn: ["^build"]`')
    say('relationship, and every upstream that did not change is served from the Nx cache:')
    say()
    say('```mermaid')
    say('flowchart TD')
    for (const p of list) say(`  ${id(p)}["${p}"]`)
    for (const [a, b] of edges) say(`  ${id(b)} --> ${id(a)}`)
    say('```')
  } else if (list.length > CAP) {
    say(`_(dependency diagram omitted above ${CAP} projects — it stops being readable)_`)
  } else {
    say('_(no dependency edges within the affected set — nothing here depends on anything else here)_')
  }
}
say()

// ---- the two matrix decisions, spelled out ----------------------------------------------
say('| | Selected | Meaning |')
say('|---|---|---|')
say(
  `| screenshot-tests | ${shots.length ? shots.map((s) => `\`${s}\``).join(', ') : '_none_'} | ` +
    (shots.length
      ? 'these suites run in a container'
      : 'no screenshot component changed — 1,888 tests not run') +
    ' |',
)
say(
  `| images | ${images.length ? images.map((s) => `\`${s}\``).join(', ') : '_none_'} | ` +
    (images.length ? 'built if the content hash is new, else retagged' : 'no image input changed') +
    ' |',
)

if (forced) {
  say()
  say('**Images were forced on**, because inputs outside any Nx project changed:')
  say()
  say('```text')
  say(forced)
  say('```')
  say()
  say('`.dockerignore`, `tools/ci/` and the workflow itself decide how an image is built but')
  say('belong to no project, so `nx affected` cannot see them.')
}

process.stdout.write(out.join('\n') + '\n')
