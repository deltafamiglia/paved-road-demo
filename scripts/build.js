'use strict';

// Produces the build artifact `npm run build` hands off: a copy of each
// service's runtime files only (no tests, no dev tooling) under
// dist/<service>/. What happens to that artifact after this - packaging
// it into a container, deploying it anywhere - isn't this repo's
// concern.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Both services are dependency-free at runtime (node:http/fs/sqlite only -
// see package.json's devDependencies, which are lint-only) - so there's
// no package.json/node_modules to carry into the artifact, just the
// files each server actually requires.
const SERVICES = {
  api: ['db.js', 'lib.js', 'server.js'],
  web: ['lib.js', 'server.js', 'public'],
};

function buildService(name, files) {
  const outDir = path.join(DIST, name);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of files) {
    const src = path.join(ROOT, name, file);
    const dest = path.join(outDir, file);
    fs.cpSync(src, dest, { recursive: true });
  }
  return outDir;
}

function build() {
  const built = Object.entries(SERVICES).map(([name, files]) => buildService(name, files));
  for (const dir of built) {
    console.log(`built ${path.relative(ROOT, dir)}`);
  }
  return built;
}

if (require.main === module) {
  build();
}

module.exports = { build, SERVICES };
