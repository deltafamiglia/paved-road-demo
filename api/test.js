'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { openDb } = require('./db');
const { validateEntryInput, createEntry, listEntries } = require('./lib');
const { createRequestHandler } = require('./server');

test('validateEntryInput rejects a missing author', () => {
  const result = validateEntryInput({ message: 'hi' });
  assert.equal(result.ok, false);
  assert.match(result.error, /author/);
});

test('validateEntryInput rejects a missing message', () => {
  const result = validateEntryInput({ author: 'Neil' });
  assert.equal(result.ok, false);
  assert.match(result.error, /message/);
});

test('validateEntryInput trims whitespace and accepts valid input', () => {
  const result = validateEntryInput({ author: '  Neil  ', message: '  Hello  ' });
  assert.deepEqual(result, { ok: true, value: { author: 'Neil', message: 'Hello' } });
});

test('validateEntryInput rejects an overlong author', () => {
  const result = validateEntryInput({ author: 'x'.repeat(81), message: 'hi' });
  assert.equal(result.ok, false);
  assert.match(result.error, /80 characters/);
});

test('createEntry persists a row and listEntries returns newest first', () => {
  const db = openDb(':memory:');
  const first = createEntry(db, { author: 'Alice', message: 'First' });
  const second = createEntry(db, { author: 'Bob', message: 'Second' });

  const entries = listEntries(db);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, second.id);
  assert.equal(entries[1].id, first.id);
  assert.equal(entries[0].author, 'Bob');
});

test('listEntries respects the limit', () => {
  const db = openDb(':memory:');
  for (let i = 0; i < 5; i += 1) {
    createEntry(db, { author: `user-${i}`, message: 'hi' });
  }
  assert.equal(listEntries(db, 2).length, 2);
});

function startServer(db) {
  return new Promise((resolve) => {
    const server = http.createServer(createRequestHandler(db));
    server.listen(0, () => resolve(server));
  });
}

function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers: payload ? { 'Content-Type': 'application/json' } : {} },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null });
        });
      },
    );
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

test('server GET /healthz returns 200 without touching the database', async () => {
  const db = openDb(':memory:');
  const server = await startServer(db);
  try {
    const res = await request(server, 'GET', '/healthz');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  } finally {
    server.close();
  }
});

test('server POST /api/entries then GET /api/entries round-trips', async () => {
  const db = openDb(':memory:');
  const server = await startServer(db);
  try {
    const created = await request(server, 'POST', '/api/entries', { author: 'Neil', message: 'Great platform' });
    assert.equal(created.status, 201);
    assert.equal(created.body.author, 'Neil');

    const listed = await request(server, 'GET', '/api/entries');
    assert.equal(listed.status, 200);
    assert.equal(listed.body.entries.length, 1);
    assert.equal(listed.body.entries[0].message, 'Great platform');
  } finally {
    server.close();
  }
});

test('server POST /api/entries rejects invalid input with 400', async () => {
  const db = openDb(':memory:');
  const server = await startServer(db);
  try {
    const res = await request(server, 'POST', '/api/entries', { author: '', message: 'hi' });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('server returns 404 for unknown routes', async () => {
  const db = openDb(':memory:');
  const server = await startServer(db);
  try {
    const res = await request(server, 'GET', '/nope');
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
