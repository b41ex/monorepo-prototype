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
  say('**Nothing affected** — no project changed, so `js` scheduled no tasks at all and there')
  say('is no build graph to draw.')
  say()
  if (images.length) {
    // An image job CAN run while nothing is affected: the forcing rule selects it on files
    // that belong to no Nx project, which is the whole reason that rule exists. The previous
    // wording here asserted flatly that "the two matrix jobs are skipped", and run
    // 33894555872 printed exactly that while both image jobs were running and retagging —
    // contradicted three lines later by this script's own table. A summary that states a
    // skip which did not happen is the same defect as a step that reports a success it did
    // not achieve, and it is worse here than saying nothing, because this file exists to be
    // the thing you can believe about job selection.
    say('The screenshot jobs are skipped. The image jobs are **not** — they were selected on')
    say('inputs that belong to no project, and the table below says which.')
  } else {
    say('Every matrix job is skipped, and this is the cheapest run the pipeline can produce.')
  }
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

  // NODES: the changed projects plus their DIRECT dependencies. Drawing the transitive
  // closure produced 20 nodes and 80 edges for a one-project change — a hairball that says
  // less than the sentence above it. The readable question is "what does the thing I changed
  // consume", and the transitive rest is a count, not a picture.
  //
  // EDGES: every dependency edge whose consumer is a changed project and whose dependency is
  // drawn — which INCLUDES changed-to-changed edges. Filtering edges on `direct` alone is
  // indistinguishable from this while ONE project changes, because a single changed project
  // has no changed dependencies, and it is decisive once many do. Measured on the affected
  // set of run 33889988315: 30 of 33 projects affected, so `direct` held exactly one node and
  // **99 of the graph's 100 edges ran between changed projects**. A `direct`-only edge filter
  // draws that run as 31 boxes and one arrow.
  //
  // There is NO node cap. There was one, at 18, and it fired on precisely the runs where the
  // picture is worth the most: a push to `.gitignore`, the lockfile or any root config makes
  // everything affected, and what the cap printed instead was a comma-separated list of 30
  // project names — the same data in its least legible form, with the structure removed. The
  // whole workspace is 33 nodes and 100 edges, about 5 KB of Mermaid, which is nowhere near
  // GitHub's limits on either the diagram or the summary.
  const direct = new Set()
  for (const p of changed) for (const d of graph.dependencies[p] || []) if (!affected.has(d.target)) direct.add(d.target)
  const transitiveOnly = upstream.size - direct.size
  const drawn = new Set([...changed, ...direct])

  say('```mermaid')
  say('flowchart BT')
  for (const p of changed) say(`  ${id(p)}["${p}"]:::changed`)
  for (const p of [...direct].sort()) say(`  ${id(p)}["${p}"]:::cached`)
  for (const p of changed) {
    for (const d of graph.dependencies[p] || []) {
      if (drawn.has(d.target)) say(`  ${id(d.target)} --> ${id(p)}`)
    }
  }
  say('  classDef changed fill:#8a5a00,stroke:#000,color:#fff')
  say('  classDef cached fill:#2d333b,stroke:#444c56,color:#adbac7')
  say('```')
  say()
  say('Amber rebuilt; grey restored from cache. Arrows run dependency → consumer, which is')
  say('the order the tasks execute in. Nodes are the changed projects and their **direct**')
  if (transitiveOnly) {
    say(`dependencies — the other **${transitiveOnly}** in the closure are reached through`)
    say('these and are cache restores for the same reason.')
  } else {
    say('dependencies; nothing else in the workspace is upstream of them.')
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
