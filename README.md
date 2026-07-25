# Page Pulse

Audits any URL — fetches the page and reports HTTP status, response time,
title, meta description, H1 count, images missing `alt` text, and word
count. Built for the Digital Heroes SDE qualification task.

**Live URL:** https://page-pulse-j2et.onrender.com
**Repo:** https://github.com/sameeksharawat7/Page-pulse

## Setup

Requires Node.js 18+.

```bash
npm install
npm start      
npm test
```

## Project structure

```
server.js             Express app, routes errors to HTTP status codes
src/audit.js           URL validation, fetch, timeout, content-type checks
src/parse.js            Pure HTML → metrics (no network) — unit tested
public/index.html       Frontend, single file, no build step
tests/                  Jest unit tests
```

## API

### `POST /api/audit`

Request:
```json
{ "url": "https://example.com" }
```

Response — `200 OK`:
```json
{
  "url": "https://example.com/",
  "httpStatus": 200,
  "responseTimeMs": 184,
  "title": "Example Domain",
  "metaDescription": null,
  "h1Count": 1,
  "totalImages": 0,
  "imagesMissingAlt": 0,
  "wordCount": 28
}
```

Errors — `{ "error": "<CODE>", "message": "..." }`:

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_URL` | Missing, malformed, or non-http(s) URL |
| 415 | `NOT_HTML` | Response isn't `text/html` |
| 502 | `FETCH_FAILED` | DNS/connection failure |
| 504 | `TIMEOUT` | No response within 8s |
| 500 | `INTERNAL_ERROR` | Unexpected error, caught so the server never crashes |

A target page returning its own error (e.g. a 404) is still a valid report
— these codes only cover cases where *this* API couldn't produce one.

### `GET /api/health`
Returns `{ "status": "ok" }`.

## Design decisions

**Split parsing from fetching.** `src/parse.js` is a pure function — HTML
in, metrics out, no network. `src/audit.js` handles fetch/timeout/validation
and calls it. This lets the parsing edge cases (malformed HTML, missing
tags) get unit tested directly, with no `fetch` mocking needed.

**Empty `alt=""` counts as missing.** It's valid a11y practice for
decorative images, but this is a content audit, not an a11y checker — the
metric is more useful if it answers "how many images have no descriptive
text."

**Native `fetch` + `AbortController` over axios.** Node 18+ already ships
both; no need for an extra dependency for something the runtime provides.



- Report the full redirect chain, not just the final URL
- Sniff content-type from the body when the header is ambiguous
- Flag the gap between raw-HTML word count and rendered word count for JS-heavy pages
- Add rate limiting before leaving this public long-term


