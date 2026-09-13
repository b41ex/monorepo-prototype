#!/usr/bin/env node
// The published Storybook site, assembled from the store in ghcr, and the store's cleanup.
//
//   storybook-site.js slug <branch>        the folder and pointer name for a branch
//   storybook-site.js assemble <out-dir>   lay out the whole site from the live branches' pointers
//   storybook-site.js gc                   delete what no live branch needs any more
//
// A GitHub Pages deploy REPLACES THE WHOLE SITE. So a deploy never works from the files of the
// run that triggered it: it reads every live branch's pointer and rebuilds the full layout, which
// is what makes two branches deploying at once safe once pages.yml queues them.
//
// Environment: OWNER (the ghcr namespace), GITHUB_STEP_SUMMARY (optional), DRY_RUN=true for gc.
'use strict'

const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const COMPONENTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'storybooks.json'), 'utf8')).map(
  (c) => c.component,
)
const CONTENT_KEY = 'com.b41ex.storybook.content'

// A branch sharing content with one of these redirects to it rather than carrying a copy, and
// the canonical copy lives in the first of these that has it. Stable names first, so a link to a
// feature branch's folder keeps working when the feature branch goes.
const PREFERRED = ['develop', 'main', 'release']

// GitHub Pages: "Published GitHub Pages sites may be no larger than 1 GB."
const SITE_LIMIT = 1024 ** 3
const SITE_WARN = 800 * 1024 ** 2

// Content and untagged versions are only collected once they are this old. A CI leg pushes the
// content and then the pointer, so there is a window in which fresh content is referenced by
// nothing. A cleanup that ran inside that window would delete a build a pointer is about to name.
const GC_MIN_AGE_MS = 24 * 60 * 60 * 1000

// ---- naming -----------------------------------------------------------------------------------

// ci.yml's image tags map `/` to `-`, and the folders follow the same rule so a folder name and a
// tag name agree. Anything else an OCI tag cannot hold also becomes `-`: git allows `+`, `@`, `&`
// and more in a branch name. The pointer tag is `branch-<slug>` and a tag is at most 128
// characters, so a slug longer than 120 keeps a readable prefix and a hash of the full name.
function slug(branch) {
  const s = branch.replace(/[^A-Za-z0-9._-]/g, '-')
  if (s.length <= 120) return s
  return `${s.slice(0, 103)}-${crypto.createHash('sha256').update(branch).digest('hex').slice(0, 16)}`
}

const html = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// ---- processes --------------------------------------------------------------------------------

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 })
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

// A registry answer of "does not exist" is a result. Any other failure is not, and is retried
// and then fatal: reading a transient error as "this component has no pointers" would deploy a
// site with that component's folders silently gone.
function registry(cmd, args) {
  let last
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return run(cmd, args)
    } catch (e) {
      const stderr = String(e.stderr || e.message)
      const err = new Error(`${cmd} ${args.join(' ')}: ${stderr.trim()}`)
      err.notFound = /name unknown|NAME_UNKNOWN|MANIFEST_UNKNOWN|not found|HTTP 404/i.test(stderr)
      if (err.notFound) throw err
      last = err
      sleep(2000 * attempt)
    }
  }
  throw last
}

function owner() {
  const o = (process.env.OWNER || '').toLowerCase()
  if (!o) throw new Error('OWNER is not set')
  return o
}

const repoOf = (component) => `ghcr.io/${owner()}/storybook-${component}`

// Every branch on the remote. Never empty in a real repository, so empty is treated as a failed
// read rather than as "delete everything".
function liveBranches() {
  const out = run('git', ['ls-remote', '--heads', 'origin'])
  const branches = out
    .split('\n')
    .map((l) => l.match(/\trefs\/heads\/(.+)$/))
    .filter(Boolean)
    .map((m) => m[1])
  if (branches.length === 0) throw new Error('git ls-remote --heads returned no branches; refusing to treat that as none')
  return branches.sort()
}

// slug -> branch for branches whose slug is unique, and the collisions, which publish nothing.
// `feature/a-b` and `feature-a/b` both map to `feature-a-b`; choosing one would publish a folder
// whose content depends on which branch pushed last, so neither is published and both are named.
function bySlug(branches) {
  const groups = new Map()
  for (const b of branches) groups.set(slug(b), [...(groups.get(slug(b)) || []), b])
  const live = new Map()
  const collisions = []
  for (const [s, bs] of groups) {
    if (bs.length === 1) live.set(s, bs[0])
    else collisions.push({ slug: s, branches: bs })
  }
  return { live, collisions, allSlugs: new Set(groups.keys()) }
}

function readPointer(component, s) {
  const manifest = JSON.parse(registry('oras', ['manifest', 'fetch', `${repoOf(component)}:branch-${s}`]))
  const a = manifest.annotations || {}
  const src = a[CONTENT_KEY]
  if (!/^src-[0-9a-f]{16}$/.test(src || '')) {
    throw new Error(`${repoOf(component)}:branch-${s} carries no valid ${CONTENT_KEY} (read '${src}')`)
  }
  return { src, revision: a['org.opencontainers.image.revision'] || '' }
}

function listTags(component) {
  try {
    return registry('oras', ['repo', 'tags', repoOf(component)]).split('\n').filter(Boolean)
  } catch (e) {
    if (e.notFound) return []
    throw e
  }
}

function measure(dir) {
  let bytes = 0
  let files = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const m = measure(p)
      bytes += m.bytes
      files += m.files
    } else {
      bytes += fs.statSync(p).size
      files += 1
    }
  }
  return { bytes, files }
}

const kib = (n) => `${(n / 1024 / 1024).toFixed(1)} MiB`

// ---- assemble ---------------------------------------------------------------------------------

function pull(component, src, dir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'storybook-'))
  try {
    registry('oras', ['pull', `${repoOf(component)}:${src}`, '-o', tmp])
    const tarball = path.join(tmp, 'storybook.tar.gz')
    if (!fs.existsSync(tarball)) throw new Error(`${component}:${src} pulled without storybook.tar.gz`)
    fs.mkdirSync(dir, { recursive: true })
    run('tar', ['xzf', tarball, '-C', dir])
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  // Validate what was unpacked, not that tar exited 0.
  for (const f of ['index.html', 'iframe.html', 'index.json']) {
    const p = path.join(dir, f)
    if (!fs.existsSync(p) || fs.statSync(p).size === 0) throw new Error(`${component}/${path.basename(dir)}: ${f} missing or empty`)
  }
}

// A branch whose content is identical to another branch's gets a redirect, not a copy. That is
// what keeps the site under 1 GB: its size follows the number of DISTINCT builds, not branches.
// The redirect is rebuilt on every deploy, so it only ever exists while the two really are the
// same content. It keeps the query and fragment, which is where Storybook keeps the story.
function stub(dir, component, canonical) {
  fs.mkdirSync(dir, { recursive: true })
  for (const file of ['index.html', 'iframe.html']) {
    const target = `../${canonical}/${file}`
    fs.writeFileSync(
      path.join(dir, file),
      `<!doctype html>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>${html(component)} Storybook</title>
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
<noscript><meta http-equiv="refresh" content="0; url=${html(target)}"></noscript>
<p>This branch's ${html(component)} Storybook is identical to <a href="${html(target)}">${html(canonical)}</a>'s.</p>
`,
    )
  }
}

function page(title, body) {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(title)}</title>
<style>
  :root { color-scheme: light dark; font: 15px/1.5 system-ui, sans-serif; }
  body { max-width: 60rem; margin: 2rem auto; padding: 0 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: .35rem .6rem; border-bottom: 1px solid #8884; }
  .muted { opacity: .65; }
</style>
<h1>${html(title)}</h1>
${body}
`
}

function assemble(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })

  const branches = liveBranches()
  const { live, collisions } = bySlug(branches)
  const rows = []

  for (const component of COMPONENTS) {
    const tags = new Set(listTags(component))
    const groups = new Map() // src -> [slug]
    const revisions = new Map()
    for (const s of live.keys()) {
      if (!tags.has(`branch-${s}`)) {
        rows.push({ component, slug: s, branch: live.get(s), state: 'missing' })
        continue
      }
      const { src, revision } = readPointer(component, s)
      groups.set(src, [...(groups.get(src) || []), s])
      revisions.set(s, revision)
    }

    for (const [src, slugs] of groups) {
      const rank = (s) => {
        const i = PREFERRED.indexOf(live.get(s))
        return i === -1 ? PREFERRED.length : i
      }
      const [canonical, ...rest] = [...slugs].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      const dir = path.join(outDir, component, canonical)
      pull(component, src, dir)
      const m = measure(dir)
      rows.push({ component, slug: canonical, branch: live.get(canonical), state: 'built', src, ...m, revision: revisions.get(canonical) })
      for (const s of rest) {
        stub(path.join(outDir, component, s), component, canonical)
        rows.push({ component, slug: s, branch: live.get(s), state: 'redirect', src, canonical, revision: revisions.get(s) })
      }
    }

    const mine = rows.filter((r) => r.component === component).sort((a, b) => a.slug.localeCompare(b.slug))
    if (mine.some((r) => r.state !== 'missing')) {
      fs.writeFileSync(
        path.join(outDir, component, 'index.html'),
        page(
          `${component} Storybooks`,
          `<p><a href="../">All components</a></p><table><tr><th>branch</th><th>Storybook</th></tr>${mine
            .map((r) => `<tr><td>${html(r.branch)}</td><td>${cell(r, '')}</td></tr>`)
            .join('')}</table>`,
        ),
      )
    }
  }

  function cell(r, prefix) {
    if (r.state === 'missing') return '<span class="muted">not built yet</span>'
    const link = `<a href="${html(prefix)}${html(r.slug)}/">${html(r.slug)}/</a>`
    return r.state === 'redirect' ? `${link} <span class="muted">same as ${html(r.canonical)}</span>` : link
  }

  const index = COMPONENTS.map((component) => {
    const mine = rows.filter((r) => r.component === component && r.state !== 'missing')
    return `<h2><a href="${html(component)}/">${html(component)}</a></h2><ul>${mine
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((r) => `<li>${html(r.branch)}: ${cell(r, `${component}/`)}</li>`)
      .join('')}</ul>`
  }).join('')
  const clash = collisions.length
    ? `<h2>Not published</h2><p>These branches map to the same folder, so neither is published:</p><ul>${collisions
        .map((c) => `<li><code>${html(c.slug)}</code>: ${c.branches.map(html).join(', ')}</li>`)
        .join('')}</ul>`
    : ''
  fs.writeFileSync(path.join(outDir, 'index.html'), page('Storybooks', index + clash))

  const total = measure(outDir)
  summarize(branches, collisions, rows, total)

  if (total.bytes > SITE_LIMIT) {
    console.log(`::error::the assembled site is ${kib(total.bytes)}, over GitHub Pages' 1 GB limit; not deploying it`)
    process.exit(1)
  }
  if (total.bytes > SITE_WARN) console.log(`::warning::the assembled site is ${kib(total.bytes)}, approaching the 1 GB limit`)
}

function summarize(branches, collisions, rows, total) {
  const built = rows.filter((r) => r.state === 'built')
  const out = [
    '### Storybook site',
    '',
    `${branches.length} live branches, ${built.length} distinct builds, ${rows.filter((r) => r.state === 'redirect').length} redirects, ` +
      `${rows.filter((r) => r.state === 'missing').length} not built yet. Site: **${kib(total.bytes)}**, ${total.files} files, ` +
      `${((total.bytes / SITE_LIMIT) * 100).toFixed(1)}% of the 1 GB limit.`,
    '',
    '| component | folder | branch | state | content | size | files |',
    '|---|---|---|---|---|---:|---:|',
    ...rows
      .sort((a, b) => a.component.localeCompare(b.component) || a.slug.localeCompare(b.slug))
      .map(
        (r) =>
          `| ${r.component} | \`${r.slug}/\` | \`${r.branch}\` | ${r.state === 'redirect' ? `redirect → \`${r.canonical}/\`` : r.state} | ` +
          `${r.src ? `\`${r.src}\`` : ''} | ${r.bytes ? kib(r.bytes) : ''} | ${r.files || ''} |`,
      ),
  ]
  if (collisions.length) {
    out.push('', '**Not published, folder name collision:**', '')
    for (const c of collisions) out.push(`- \`${c.slug}\`: ${c.branches.map((b) => `\`${b}\``).join(', ')}`)
  }
  write(out)
}

function write(lines) {
  const text = lines.join('\n') + '\n'
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text)
  process.stdout.write(text)
}

// ---- gc ---------------------------------------------------------------------------------------

// Three kinds of version are deleted, and nothing else:
//
//   a pointer whose branch no longer exists       what makes a deleted branch leave the store
//   content no live pointer names, over 24h old   builds of commits no branch is at any more
//   an untagged version, over 24h old             superseded pointers: re-pointing a branch
//                                                 moves its tag and orphans the old manifest
//
// ghcr refuses to delete a package's LAST version, with a message about "more than 5000
// downloads" that has nothing to do with downloads; storybook-probe.yml measured it. So the last
// version is always kept, and reported rather than attempted.
function gc() {
  const dry = process.env.DRY_RUN === 'true'
  const { allSlugs } = bySlug(liveBranches())
  const now = Date.now()
  const lines = [`### Storybook store cleanup${dry ? ' (dry run)' : ''}`, '', '| component | version | tags | action |', '|---|---|---|---|']
  let failures = 0

  for (const component of COMPONENTS) {
    const pkg = `storybook-${component}`
    let versions
    try {
      versions = registry('gh', [
        'api',
        '--paginate',
        `users/${owner()}/packages/container/${pkg}/versions`,
        '--jq',
        '.[] | {id, created_at, tags: .metadata.container.tags}',
      ])
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    } catch (e) {
      if (e.notFound) continue
      throw e
    }

    // Content still named by the pointer of a branch that exists. Colliding branches count as
    // live here: their folder is unpublished, but their builds are not garbage.
    const referenced = new Set()
    for (const v of versions) {
      for (const t of v.tags) {
        if (t.startsWith('branch-') && allSlugs.has(t.slice('branch-'.length))) referenced.add(readPointer(component, t.slice('branch-'.length)).src)
      }
    }

    let remaining = versions.length
    for (const v of versions) {
      const old = now - Date.parse(v.created_at) > GC_MIN_AGE_MS
      const pointers = v.tags.filter((t) => t.startsWith('branch-'))
      const contents = v.tags.filter((t) => t.startsWith('src-'))
      let why = null
      if (v.tags.length === 0) {
        if (old) why = 'untagged, over 24h old'
      } else if (pointers.length === v.tags.length && pointers.every((t) => !allSlugs.has(t.slice('branch-'.length)))) {
        why = 'pointer for a branch that no longer exists'
      } else if (contents.length === v.tags.length && contents.every((t) => !referenced.has(t)) && old) {
        why = 'content no live branch points at, over 24h old'
      }
      if (!why) continue

      const tags = v.tags.length ? v.tags.map((t) => `\`${t}\``).join(' ') : '_none_'
      if (remaining === 1) {
        lines.push(`| ${component} | ${v.id} | ${tags} | kept: the package's last version cannot be deleted (${why}) |`)
        continue
      }
      if (dry) {
        remaining--
        lines.push(`| ${component} | ${v.id} | ${tags} | would delete: ${why} |`)
        continue
      }
      try {
        registry('gh', ['api', '-X', 'DELETE', `users/${owner()}/packages/container/${pkg}/versions/${v.id}`])
        remaining--
        lines.push(`| ${component} | ${v.id} | ${tags} | deleted: ${why} |`)
      } catch (e) {
        failures++
        lines.push(`| ${component} | ${v.id} | ${tags} | **FAILED** to delete (${why}): ${String(e.message).split('\n')[0].slice(0, 160)} |`)
      }
    }
  }

  if (lines.length === 4) lines.push('| | | | nothing to delete |')
  write(lines)
  if (failures) process.exit(1)
}

// ---- main -------------------------------------------------------------------------------------

const [mode, arg] = process.argv.slice(2)
if (mode === 'slug' && arg) console.log(slug(arg))
else if (mode === 'assemble' && arg) assemble(path.resolve(arg))
else if (mode === 'gc') gc()
else {
  console.error('usage: storybook-site.js slug <branch> | assemble <out-dir> | gc')
  process.exit(2)
}
