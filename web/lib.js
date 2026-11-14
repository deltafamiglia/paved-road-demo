'use strict';

// Only /api/* is ever proxied to the backend tier - everything else is a
// static asset. Kept as a pure function so the routing decision is
// testable without starting a real HTTP server.
function isApiPath(urlPath) {
  return urlPath === '/api/entries' || urlPath.startsWith('/api/entries?');
}

// Maps a request path to the file this server should serve from
// ./public, defaulting '/' to the SPA's index page - no router, this is
// a single-page demo.
function staticPathFor(urlPath) {
  if (urlPath === '/' || urlPath === '') {
    return '/index.html';
  }
  return urlPath;
}

module.exports = { isApiPath, staticPathFor };
