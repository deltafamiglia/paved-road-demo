'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('./build');

const ROOT = path.join(__dirname, '..');

test('build copies each service\'s runtime files into dist/<service>', () => {
  const [apiDir, webDir] = build();

  assert.equal(apiDir, path.join(ROOT, 'dist', 'api'));
  assert.ok(fs.existsSync(path.join(apiDir, 'server.js')));
  assert.ok(fs.existsSync(path.join(apiDir, 'db.js')));
  assert.ok(fs.existsSync(path.join(apiDir, 'lib.js')));
  assert.ok(!fs.existsSync(path.join(apiDir, 'test.js')), 'tests are not part of the build artifact');

  assert.equal(webDir, path.join(ROOT, 'dist', 'web'));
  assert.ok(fs.existsSync(path.join(webDir, 'server.js')));
  assert.ok(fs.existsSync(path.join(webDir, 'public', 'index.html')));
  assert.ok(!fs.existsSync(path.join(webDir, 'test.js')), 'tests are not part of the build artifact');
});

test('build is idempotent - running it twice leaves the same result', () => {
  build();
  const [apiDir] = build();
  assert.ok(fs.existsSync(path.join(apiDir, 'server.js')));
});
