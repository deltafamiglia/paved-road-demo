'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { isApiPath, staticPathFor } = require('./lib');
const { handleRequest } = require('./server');

test('isApiPath matches /api/entries with or without a query string', () => {
  assert.equal(isApiPath('/api/entries'), true);
  assert.equal(isApiPath('/api/entries?limit=5'), true);
  assert.equal(isApiPath('/api/other'), false);
});

test('staticPathFor maps root to index.html and leaves other paths alone', () => {
  assert.equal(staticPathFor('/'), '/index.html');
  assert.equal(staticPathFor(''), '/index.html');
  assert.equal(staticPathFor('/app.js'), '/app.js');
});

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(handleRequest);
    server.listen(0, () => resolve(server));
  });
}

function get(server, urlPath) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http
      .get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      })
      .on('error', reject);
  });
}

test('server GET /healthz returns 200', async () => {
  const server = await startServer();
  try {
    const res = await get(server, '/healthz');
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), { status: 'ok' });
  } finally {
    server.close();
  }
});

test('server serves index.html for /', async () => {
  const server = await startServer();
  try {
    const res = await get(server, '/');
    assert.equal(res.status, 200);
    assert.match(res.body, /Paved Road Demo/);
  } finally {
    server.close();
  }
});

test('server returns 404 for an unknown static asset', async () => {
  const server = await startServer();
  try {
    const res = await get(server, '/does-not-exist.js');
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test('server rejects path traversal attempts', async () => {
  const server = await startServer();
  try {
    const res = await get(server, '/../../../etc/passwd');
    // Node's HTTP client normalises '..' out of the URL before it ever
    // reaches handleRequest, so the realistic outcome here is a 404
    // (normalised to a path that doesn't exist under public/), not a
    // leaked file - the 403 guard in server.js is defence in depth for a
    // path arriving pre-normalised another way.
    assert.ok([403, 404].includes(res.status));
  } finally {
    server.close();
  }
});

test('server proxies /api/entries to the backend API and reports 502 when unreachable', async () => {
  process.env.API_URL = 'http://127.0.0.1:1/api/entries';
  delete require.cache[require.resolve('./server')];
  const { handleRequest: freshHandler } = require('./server');
  const server = await new Promise((resolve) => {
    const s = http.createServer(freshHandler);
    s.listen(0, () => resolve(s));
  });
  try {
    const res = await get(server, '/api/entries');
    assert.equal(res.status, 502);
  } finally {
    server.close();
    delete process.env.API_URL;
  }
});
