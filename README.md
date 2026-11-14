# paved-road-demo

A small guestbook app: a web frontend and a backend API backed by a
SQLite database.

- **`web/`** - serves the UI (`public/`) and forwards `/api/entries`
  requests to the backend.
- **`api/`** - validates and stores guestbook entries (`node:sqlite`,
  no external database required).

## Requirements

- Node.js (see `.nvmrc`)

## Getting started

```sh
nvm use
npm install
npm test
npm run build
```

`npm test` runs both services' unit tests. `npm run build` writes each
service's runtime files to `dist/<service>/` - that's the build
artifact; what happens to it after that is outside this repo.

## Running it locally

```sh
DB_PATH=./demo.db node api/server.js        # PORT=8080 by default
API_URL=http://127.0.0.1:8080/api/entries PORT=8081 node web/server.js
```

Then open `http://127.0.0.1:8081`.

---

_Verified end-to-end on the paved-road platform (DEL-720)._
