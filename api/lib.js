'use strict';

const MAX_AUTHOR_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 2000;

// Pure validation - kept separate from the DB/HTTP layers so it's testable
// without a database or a real request.
function validateEntryInput(input) {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const author = typeof input.author === 'string' ? input.author.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';

  if (!author) {
    return { ok: false, error: 'author is required' };
  }
  if (!message) {
    return { ok: false, error: 'message is required' };
  }
  if (author.length > MAX_AUTHOR_LENGTH) {
    return { ok: false, error: `author must be ${MAX_AUTHOR_LENGTH} characters or fewer` };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` };
  }
  return { ok: true, value: { author, message } };
}

function createEntry(db, { author, message }) {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO entries (author, message, created_at) VALUES (?, ?, ?)')
    .run(author, message, createdAt);
  return { id: Number(result.lastInsertRowid), author, message, created_at: createdAt };
}

// Newest first, capped - this is a demo guestbook, not a paginated feed.
function listEntries(db, limit = 50) {
  return db
    .prepare('SELECT id, author, message, created_at FROM entries ORDER BY id DESC LIMIT ?')
    .all(limit);
}

module.exports = { validateEntryInput, createEntry, listEntries };
