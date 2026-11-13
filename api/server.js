'use strict';

const http = require('node:http');
const { openDb } = require('./db');
const { validateEntryInput, createEntry, listEntries } = require('./lib');

const PORT = process.env.PORT || 8080;
// Catalogue's resources.disk_gb (df-config/catalogue/demo-api.yaml) backs
// this path with a real persisted volume on the compute node - see that
// entry's comment for why the path lives under /data rather than the
// container's own ephemeral filesystem.
const DB_PATH = process.env.DB_PATH || '/data/demo.db';

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function createRequestHandler(db) {
  return async function handleRequest(req, res) {
    // Caddy's upstream health check hits this with no auth, same
    // unauthenticated-/healthz convention dfplatform-status/api uses -
    // this demo has no auth at all (it's a public guestbook), but keeping
    // /healthz as its own fast path means it never depends on the DB
    // query below.
    if (req.method === 'GET' && req.url === '/healthz') {
      send(res, 200, { status: 'ok' });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/entries') {
      send(res, 200, { entries: listEntries(db) });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/entries') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        send(res, 400, { error: 'invalid JSON body' });
        return;
      }
      const validated = validateEntryInput(body);
      if (!validated.ok) {
        send(res, 400, { error: validated.error });
        return;
      }
      send(res, 201, createEntry(db, validated.value));
      return;
    }

    send(res, 404, { error: 'not found' });
  };
}

function main() {
  const db = openDb(DB_PATH);
  const server = http.createServer(createRequestHandler(db));
  server.listen(PORT, () => {
    console.log(`demo-api listening on :${PORT}, db=${DB_PATH}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { createRequestHandler };
