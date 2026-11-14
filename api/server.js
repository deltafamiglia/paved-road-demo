'use strict';

const http = require('node:http');
const { openDb } = require('./db');
const { validateEntryInput, createEntry, listEntries } = require('./lib');

const PORT = process.env.PORT || 8080;
// Wherever this runs, /data is expected to be a persistent volume -
// this path is deliberately outside the app's own directory so it
// survives a redeploy of the code around it.
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
    // Kept unauthenticated and independent of the DB query below, so
    // whatever is checking this service's liveness never depends on
    // the database being reachable.
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
