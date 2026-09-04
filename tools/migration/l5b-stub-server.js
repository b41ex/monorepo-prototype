#!/usr/bin/env node
/**
 * TESTING-PROCEDURE L5b: serve a built front end with a stub that answers enough of the API
 * for the component tree to mount.
 *
 * Serving `dist` from a plain static server is NOT enough: the app stops at its loading state
 * when nothing answers /api/v2/system/configuration, the tree never mounts, and a render-time
 * failure cannot appear. Reading that as "it loads" is what let a React error #130 ship.
 *
 * Two instances are started, on two ports, from the same code — the workspace build and the
 * fleet's pre-migration build — because the record is explicit that a stub produces its own
 * errors and the only way to tell those from findings is to load the pre-change artifact
 * through the same stub and compare.
 *
 *   node stub-server.js <port> <distDir> [basePath]
 *
 * `basePath` exists for ui-agents, which is built with `base: '/agents/'`. Its index.html
 * asks for `/agents/assets/app-*.js` while the file is at `dist/assets/app-*.js`, so the
 * prefix has to be stripped. It ALSO asks for `/agents/monacoeditorwork/*.js` while those
 * four files are at `dist/agents/monacoeditorwork/`, which the same strip does not satisfy —
 * the two are inconsistent inside one deployment root. That inconsistency is **identical in
 * the fleet build and the workspace build** (the directory structures diff clean), so it is
 * pre-existing and not a migration effect; this server resolves a stripped path first and
 * falls back to the unstripped one so that both builds mount, and both are treated the same
 * way. It is a harness accommodation, and it is stated rather than hidden.
 *
 * Paths must be Windows-style (C:/...), not /c/... — Node cannot resolve the latter.
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const port = Number(process.argv[2])
const root = process.argv[3]
const base = process.argv[4] || ''
if (!port || !root) {
  console.error('usage: stub-server.js <port> <distDir> [basePath]')
  process.exit(2)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
}

// Exactly the payload TESTING-PROCEDURE L5b prescribes: enough of an API for the tree to
// mount. Everything else under /api/ answers {} — and the record warns that answering {}
// where the app wants an array is itself a source of console errors, which is precisely why
// both builds are served by this same stub.
const CONFIG = {
  defaultWorkspaceId: 'workspace',
  authConfig: {
    autoRedirect: false,
    identityProviders: [
      { id: 'internal', displayName: 'Internal', imageSvg: '', loginStartEndpoint: '/login' },
    ],
  },
  extensions: [],
}

/** Candidate files for a request path, in the order they should be tried. */
function candidates(rel) {
  const out = []
  if (base && (rel === base.replace(/^\/|\/$/g, '') || rel.startsWith(base.replace(/^\//, '')))) {
    out.push(path.join(root, rel.slice(base.replace(/^\//, '').length).replace(/^\/+/, '')))
  }
  out.push(path.join(root, rel))
  return out.filter(Boolean)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  const pathname = decodeURIComponent(url.pathname)

  if (pathname.startsWith('/api/') || /\/api\//.test(pathname)) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    if (/\/system\/configuration$/.test(pathname)) return res.end(JSON.stringify(CONFIG))
    // Array-shaped where the app calls .find/.map directly on the response. Returning {}
    // for these is what the record means by "a stub backend produces its own errors": the
    // agents app fails with `o?.find is not a function` and mounts 1 node behind its error
    // boundary. Both builds are served by this same stub, so the shaping is applied equally
    // and cannot favour either one.
    if (/\/v2\/agents$/.test(pathname)) return res.end('[]')
    if (/\/v2\/packages$/.test(pathname)) return res.end(JSON.stringify({ packages: [] }))
    if (/\/v2\/packages\/[^/]+$/.test(pathname)) {
      return res.end(
        JSON.stringify({ packageId: 'workspace', kind: 'workspace', name: 'workspace', parents: [], versions: [] }),
      )
    }
    if (/\/v1\/user$/.test(pathname)) return res.end(JSON.stringify({ id: 'u', name: 'Unnamed User', email: '' }))
    return res.end('{}')
  }

  const rel = pathname.replace(/^\/+/, '')
  let target = null
  for (const c of candidates(rel)) {
    if (c && fs.existsSync(c) && fs.statSync(c).isFile()) {
      target = c
      break
    }
  }
  // SPA fallback: any path that is not a real file serves index.html, which is what the
  // static server the screenshot suites use (`ws --spa index.html`) does.
  if (!target) target = path.join(root, 'index.html')

  fs.readFile(target, (err, buf) => {
    if (err) {
      res.writeHead(404)
      return res.end('not found')
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream' })
    res.end(buf)
  })
})

server.listen(port, '127.0.0.1', () =>
  console.log(`serving ${root}${base ? ` at base ${base}` : ''} on http://localhost:${port}`),
)
