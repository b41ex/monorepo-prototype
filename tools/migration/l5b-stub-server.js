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
 *   node stub-server.js <port> <distDir>
 *
 * Paths must be Windows-style (C:/...), not /c/... — Node cannot resolve the latter.
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const port = Number(process.argv[2])
const root = process.argv[3]
if (!port || !root) {
  console.error('usage: stub-server.js <port> <distDir>')
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  const pathname = decodeURIComponent(url.pathname)

  if (pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    if (/\/system\/configuration$/.test(pathname)) return res.end(JSON.stringify(CONFIG))
    return res.end('{}')
  }

  const rel = pathname.replace(/^\/+/, '')
  const file = path.join(root, rel)
  // SPA fallback: any path that is not a real file serves index.html, which is what the
  // static server the screenshot suites use (`ws --spa index.html`) does.
  const target = rel && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html')
  fs.readFile(target, (err, buf) => {
    if (err) {
      res.writeHead(404)
      return res.end('not found')
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream' })
    res.end(buf)
  })
})

server.listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://localhost:${port}`))
