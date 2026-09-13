#!/usr/bin/env node
/*
 * The Newman verdict for the E2E job.
 *
 * The collections run with `newman run -x`, which suppresses newman's exit code so that every
 * collection runs after one fails. That also means the step that runs them succeeds whatever
 * the assertions did, and for as long as the Verdict read that step, no Newman failure could
 * fail the job: run 34756454533 went green with five failed assertions. The workflow this was
 * ported from compensated by counting failures out of the HTML reports, and the port dropped
 * that count.
 *
 * This reads newman's JSON report instead, and it FAILS CLOSED. The HTML count it replaces
 * summed a number grepped out of the markup, so a changed template made the grep empty and the
 * total zero. Here, anything this cannot positively read is a failure:
 *
 *   - no collections named at all                 an empty list is not a passing check
 *   - a named collection with no report           the run died, or never reached it
 *   - a report that does not parse, or is not a newman run report
 *   - run.error set                                newman aborted the run
 *   - zero requests executed                       a report of nothing
 *   - assertion failures that do not match run.stats.assertions.failed
 *   - a failure naming a request that is not in the report's own collection
 *
 * Then every failure is classified against tools/ci/newman-known-failures.json, keyed exactly
 * on collection, the request's folder path and the assertion's name. A failure not on the list
 * fails the job. A listed failure that did not occur is reported as stale and does not.
 *
 * The request path is rebuilt from the collection tree in the report, by the failing item's id.
 * `failure.parent` is not used: it is absent for a top-level request and names only the nearest
 * folder otherwise. The rebuilt path is the one newman prints after `inside` in its CLI output.
 * A failure that is not an assertion (a refused connection, a script error) has no test name,
 * so its assertion key is `<where>: <error name>`, for example `request: Error`.
 *
 * Usage:  newman-results-check.js <reports dir> <known-failures.json> "<collection> [collection...]"
 */
const fs = require('node:fs')
const path = require('node:path')

const [reportsDir, knownPath, collectionsRaw] = process.argv.slice(2)

const errors = []
const summary = []
const md = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

const collections = (collectionsRaw || '')
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean)

if (!reportsDir || !knownPath || collections.length === 0) {
  console.error('usage: newman-results-check.js <reports dir> <known-failures.json> "<collections>"')
  console.error('an empty collection list is not a passing check')
  process.exit(1)
}

// ---- the known-failures list -------------------------------------------------------------
let known = []
try {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(knownPath), 'utf8'))
  if (!Array.isArray(parsed.failures)) throw new Error('no `failures` array')
  known = parsed.failures
} catch (e) {
  console.error(`cannot read the known-failures list ${knownPath}: ${e.message}`)
  process.exit(1)
}
const keyOf = (f) => JSON.stringify([f.collection, f.request, f.assertion])
const knownKeys = new Map()
for (const [i, f] of known.entries()) {
  if (![f.collection, f.request, f.assertion].every((v) => typeof v === 'string' && v.length > 0)) {
    errors.push(`known-failures entry ${i} needs a non-empty collection, request and assertion`)
    continue
  }
  if (knownKeys.has(keyOf(f))) errors.push(`known-failures entry ${i} duplicates entry ${knownKeys.get(keyOf(f))}`)
  else knownKeys.set(keyOf(f), i)
}

// ---- the reports ---------------------------------------------------------------------------
const occurred = new Map() // key -> { collection, request, assertion, message, count }
const perCollection = []

for (const c of collections) {
  const file = path.join(reportsDir, `${c}.json`)
  let report
  try {
    report = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    errors.push(`${c}: ${e.code === 'ENOENT' ? `no report at ${file}` : `report does not parse: ${e.message}`}`)
    continue
  }

  const run = report && report.run
  const stats = run && run.stats
  if (!stats || !stats.requests || !stats.assertions || !Array.isArray(run.failures) || !report.collection) {
    errors.push(`${c}: ${file} is not a newman JSON run report`)
    continue
  }
  if (run.error) {
    errors.push(`${c}: newman aborted the run: ${run.error.message || JSON.stringify(run.error)}`)
  }
  if (!(stats.requests.total > 0)) {
    errors.push(`${c}: the report records ${stats.requests.total} requests; a run of nothing is not a pass`)
  }

  // id -> "folder / folder / request", the path newman prints after `inside`
  const paths = new Map()
  const walk = (items, trail) => {
    for (const item of items || []) {
      const here = [...trail, item.name]
      paths.set(item.id, here.join(' / '))
      if (Array.isArray(item.item)) walk(item.item, here)
    }
  }
  walk(report.collection.item, [])

  let assertionFailures = 0
  for (const f of run.failures) {
    const where = String(f.at || '')
    if (where.startsWith('assertion')) assertionFailures++

    const id = f.source && f.source.id
    const request = paths.get(id)
    if (request === undefined) {
      errors.push(`${c}: a failure names request id ${id}, which is not in this report's collection`)
      continue
    }
    const err = f.error || {}
    const assertion = typeof err.test === 'string' && err.test ? err.test : `${where || 'unknown'}: ${err.name || 'Error'}`
    const entry = { collection: c, request, assertion }
    const k = keyOf(entry)
    const seen = occurred.get(k)
    if (seen) seen.count++
    else occurred.set(k, { ...entry, message: err.message || '', count: 1 })
  }

  if (assertionFailures !== stats.assertions.failed) {
    errors.push(
      `${c}: ${assertionFailures} assertion failures listed but run.stats.assertions.failed is ${stats.assertions.failed}`,
    )
  }

  perCollection.push({
    collection: c,
    requests: stats.requests.total,
    requestsFailed: stats.requests.failed,
    assertions: stats.assertions.total,
    assertionsFailed: stats.assertions.failed,
  })
}

// ---- classification ------------------------------------------------------------------------
const fresh = [...occurred.entries()].filter(([k]) => !knownKeys.has(k)).map(([, v]) => v)
const tolerated = [...occurred.entries()].filter(([k]) => knownKeys.has(k)).map(([, v]) => v)
// Stale only where the report was READ. A collection whose report is missing or unparsable is
// already a failure above, and calling its listed failures "did not occur" would be advice to
// delete entries nobody observed either way.
const read = new Set(perCollection.map((p) => p.collection))
const stale = known.filter((f) => read.has(f.collection) && !occurred.has(keyOf(f)))

// ---- report --------------------------------------------------------------------------------
summary.push('### Newman results', '')
summary.push('| collection | requests | failed | assertions | failed |', '|---|---:|---:|---:|---:|')
for (const p of perCollection) {
  summary.push(`| ${md(p.collection)} | ${p.requests} | ${p.requestsFailed} | ${p.assertions} | ${p.assertionsFailed} |`)
}
const table = (title, rows, withMessage) => {
  summary.push('', `**${title}: ${rows.length}**`)
  if (rows.length === 0) return
  summary.push('', `| collection | request | assertion |${withMessage ? ' message |' : ''}`)
  summary.push(`|---|---|---|${withMessage ? '---|' : ''}`)
  for (const r of rows) {
    const times = r.count > 1 ? ` (x${r.count})` : ''
    summary.push(
      `| ${md(r.collection)} | ${md(r.request)} | ${md(r.assertion)}${times} |${withMessage ? ` ${md(r.message)} |` : ''}`,
    )
  }
}
table('New failures, not on the known list', fresh, true)
table('Known failures, tolerated', tolerated, false)
table('Stale known failures, listed but did not occur (delete them)', stale, false)
if (errors.length > 0) {
  summary.push('', `**Could not verify: ${errors.length}**`, '')
  for (const e of errors) summary.push(`- ${md(e)}`)
}

const text = summary.join('\n')
console.log(text)
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)

for (const e of errors) console.log(`::error::${e}`)
for (const f of fresh) console.log(`::error::new newman failure in ${f.collection}: ${f.request} / ${f.assertion}`)
for (const f of stale) console.log(`::warning::stale known failure in ${f.collection}: ${f.request} / ${f.assertion}`)

process.exit(errors.length > 0 || fresh.length > 0 ? 1 : 0)
