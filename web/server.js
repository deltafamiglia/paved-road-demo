'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { isApiPath, staticPathFor } = require('./lib');

const PORT = process.env.PORT || 8080;
// demo-api's address (DEL-720) - the backend tier isn't reachable from
// the internet (networking.tf's VLAN isolation), so this server does the
// server-side hop, the same Web -> Backend path
// docs/service-discovery-design.md's recommendation and DEL-719's
// df.protected zone both exist for. `demo-api` is the Host header Guide
// pushed into the backend zone's Caddy once demo-api self-placed - this
// never hardcodes an IP.
const API_URL = process.env.API_URL || 'http://demo-api.df.protected/api/entries';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const PUBLIC_DIR = path.join(__dirname, 'public');

function send(res, status, body, contentType) {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function serveStatic(req, res) {
  const requestedPath = staticPathFor(req.url.split('?')[0]);
  // path.join + the PUBLIC_DIR prefix check below is the path-traversal
  // guard - without it a request like `/../../etc/passwd` would resolve
  // outside PUBLIC_DIR before fs.readFile ever sees it.
  const resolved = path.join(PUBLIC_DIR, requestedPath);
  if (!resolved.startsWith(PUBLIC_DIR)) {
    send(res, 403, JSON.stringify({ error: 'forbidden' }), 'application/json');
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      send(res, 404, JSON.stringify({ error: 'not found' }), 'application/json');
      return;
    }
    const ext = path.extname(resolved);
    send(res, 200, data, CONTENT_TYPES[ext] || 'application/octet-stream');
  });
}

function proxyToApi(req, res) {
  const target = new URL(API_URL);
  const proxyReq = http.request(
    {
      host: target.hostname,
      port: target.port || 80,
      path: target.pathname,
      method: req.method,
      headers: { ...req.headers, host: target.hostname },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    send(res, 502, JSON.stringify({ error: 'demo-api unreachable' }), 'application/json');
  });
  req.pipe(proxyReq);
}

function handleRequest(req, res) {
  if (req.url === '/healthz') {
    send(res, 200, JSON.stringify({ status: 'ok' }), 'application/json');
    return;
  }
  if (isApiPath(req.url.split('?')[0])) {
    proxyToApi(req, res);
    return;
  }
  serveStatic(req, res);
}

function main() {
  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`demo-web listening on :${PORT}, api=${API_URL}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { handleRequest };
