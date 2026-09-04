#!/usr/bin/env node
/**
 * Render the plan job's decision as a GitHub job summary.
 *
 * WHAT THIS DELIBERATELY DOES NOT DRAW
 *
 * The first version of this script drew the job graph — plan -> js -> screenshot-tests /
 * images -> ci-ok, coloured by run/skip. That was useless: GitHub already renders exactly
 * that in the run view, out of the box, with the same skip states. A summary that repeats
 * the surrounding UI costs a scroll and returns nothing.
 *
 * WHAT IS ACTUALLY INVISIBLE
 *
 * The Nx project graph. GitHub shows five jobs; it cannot show that `js` scheduled 15 tasks,
 * that 1 of them rebuilt and 14 were served from cache, or which upstreams those were. That
 * is where the run's cost comes from and none of it appears anywhere else:
 *
 *   - which projects changed, versus which were only pulled in by `dependsOn: ["^build"]`
 *   - therefore why an incremental push is ~4.5 minutes rather than ~20
 *   - what the skip actually saved, in tests rather than in the word "skipped"
 *
 * A skipped job also looks identical whether the skip was correct or a bug in the affected
 * computation, and job selection has no equivalent of Nx's `Cache: N/N hit` line to read —
 * which is how a .dockerignore change once shipped unvalidated. So the reasoning is rendered
 * rather than left to be inferred from an absence.
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
const id = (n) => 'p_' + n.replace(/[^A-Za-z0-9_]/g, '_')

/** Everything a project transitively depends on — the tasks `^build` drags into the graph. */
function upstreamsOf(root) {
  const seen = new Set()
  ;(function visit(n) {
    for (const d of graph.dependencies[n] || []) {
      if (seen.has(d.target)) continue
      seen.add(d.target)
      visit(d.target)
    }
  })(root)
  return seen
}

say('## What this run builds, and what it reuses')
say()

if (!affected.size) {
  say('**Nothing affected** — no project changed, so `js` scheduled no tasks at all. The two')
  say('matrix jobs are skipped and this is the cheapest run the pipeline can produce.')
  say()
} else {
  // The build closure: what changed, plus everything dragged in by dependsOn ["^build"].
  const changed = [...affected].sort()
  const upstream = new Set()
  for (const p of changed) for (const u of upstreamsOf(p)) if (!affected.has(u)) upstream.add(u)

  const total = changed.length + upstream.size
  say(
    `\`js\` schedules **${total} build task${total === 1 ? '' : 's'}**: ` +
      `**${changed.length} rebuilt** because ${changed.length === 1 ? 'it' : 'they'} changed, and ` +
      `**${upstream.size} expected from cache** — pulled in by \`dependsOn: ["^build"]\` ` +
      'because a consumer needs their `dist`, not because anything about them moved.',
  )
  say()
  say('This is the whole of why an incremental push costs minutes rather than tens of minutes,')
  say('and it is the one thing the job graph above cannot show.')
  say()

  // DIRECT dependencies only. Drawing the transitive closure produced 20 nodes and 80 edges
  // for a one-project change — a hairball that says less than the sentence above it. The
  // readable question is "what does the thing I changed consume", and the transitive rest is
  // a count, not a picture. Edge count is what destroys legibility here, not node count,
  // which is what an earlier node-only cap got wrong.
  const direct = new Set()
  for (const p of changed) for (const d of graph.dependencies[p] || []) if (!affected.has(d.target)) direct.add(d.target)
  const transitiveOnly = upstream.size - direct.size

  const NODE_CAP = 18
  if (changed.length + direct.size <= NODE_CAP) {
    say('```mermaid')
    say('flowchart BT')
    for (const p of changed) say(`  ${id(p)}["${p}"]:::changed`)
    for (const p of [...direct].sort()) say(`  ${id(p)}["${p}"]:::cached`)
    for (const p of changed) {
      for (const d of graph.dependencies[p] || []) {
        if (direct.has(d.target)) say(`  ${id(d.target)} --> ${id(p)}`)
      }
    }
    say('  classDef changed fill:#8a5a00,stroke:#000,color:#fff')
    say('  classDef cached fill:#2d333b,stroke:#444c56,color:#adbac7')
    say('```')
    say()
    say('Amber rebuilt; grey restored from cache. Arrows run dependency → consumer, which is')
    say('the order the tasks execute in. Only **direct** dependencies are drawn — the other')
    say(
      `**${transitiveOnly}** in the closure are reached through these and are cache restores ` +
        'for the same reason.',
    )
  } else {
    say(`_(${changed.length} changed projects with ${direct.size} direct dependencies — too many to draw.)_`)
    say()
    say(`Changed: ${changed.map((p) => `\`${p}\``).join(', ')}`)
  }
  say()
}

// ---- what the skips actually saved, in units that mean something ------------------------
const SUITE_SIZE = { 'api-doc-viewer': 947, 'apispec-view': 883, 'class-view': 58 }
const allShots = Object.keys(SUITE_SIZE)
const skippedShots = allShots.filter((s) => !shots.includes(s))
const skippedTests = skippedShots.reduce((n, s) => n + SUITE_SIZE[s], 0)

say('| | Selected | Not run |')
say('|---|---|---|')
say(
  `| screenshot suites | ${shots.length ? shots.map((s) => `\`${s}\` (${SUITE_SIZE[s]})`).join(', ') : '_none_'} | ` +
    (skippedTests ? `**${skippedTests.toLocaleString("en-US")} screenshot tests**, ~20 min of container time` : '_none_') +
    ' |',
)
say(
  `| images | ${images.length ? images.map((s) => `\`${s}\``).join(', ') : '_none_'} | ` +
    (images.length ? 'built if the content hash is new, else retagged in ~1s' : 'no image input changed') +
    ' |',
)

if (forced) {
  say()
  say('**Images were forced on** — these changed and belong to no Nx project, so `nx affected`')
  say('cannot see them, and without this rule the change would ship unvalidated:')
  say()
  say('```text')
  say(forced)
  say('```')
}

process.stdout.write(out.join('\n') + '\n')
