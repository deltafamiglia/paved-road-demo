'use strict';

const form = document.getElementById('entry-form');
const errorEl = document.getElementById('error');
const entriesEl = document.getElementById('entries');

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
}

function renderEntries(entries) {
  entriesEl.innerHTML = '';
  for (const entry of entries) {
    const li = document.createElement('li');
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${entry.author} - ${new Date(entry.created_at).toLocaleString()}`;
    const message = document.createElement('div');
    message.textContent = entry.message;
    li.append(meta, message);
    entriesEl.append(li);
  }
}

async function loadEntries() {
  try {
    const res = await fetch('/api/entries');
    if (!res.ok) {
      throw new Error(`demo API returned ${res.status}`);
    }
    const data = await res.json();
    renderEntries(data.entries);
    clearError();
  } catch {
    showError('Could not reach the demo API - platform unreachable.');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const author = document.getElementById('author').value;
  const message = document.getElementById('message').value;
  try {
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, message }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `request failed with ${res.status}`);
    }
    form.reset();
    clearError();
    await loadEntries();
  } catch (err) {
    showError(err.message);
  }
});

loadEntries();
