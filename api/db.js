'use strict';

const { DatabaseSync } = require('node:sqlite');

// A single SQLite file is enough for a demo this small - no separate
// database service to run or configure.
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
