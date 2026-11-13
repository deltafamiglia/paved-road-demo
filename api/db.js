'use strict';

const { DatabaseSync } = require('node:sqlite');

// Backend tier's own persistent store (DEL-720) - a single SQLite file on
// this container's disk, same pattern curator/docs/design.md's "Floor
// plan" section uses for Curator itself rather than a dedicated database
// service: every workload in this lab is small and single-instance, so a
// managed DB engine would be the "speculative scale"
// docs/service-discovery-design.md already warns against building ahead
// of need.
function openDb(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

module.exports = { openDb };
