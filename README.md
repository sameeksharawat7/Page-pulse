# Page Pulse

A small tool that audits any URL: fetches the page and reports HTTP status,
response time, title, meta description, H1 count, images missing `alt` text,
and word count. Built for the Digital Heroes SDE qualification task.

**Live URL:** _add your deployed link here before submitting_
**Repo:** _add your GitHub link here before submitting_

---

## Setup

Requires Node.js 18+ (uses the built-in `fetch`/`AbortController`).

```bash
npm install
npm start          # runs on http://localhost:3000
```

Open `http://localhost:3000`, type a URL, click **Take pulse**.

Run the tests:

```bash
npm test
```

### Project structure

```
server.js          Express app: routes + error → HTTP status mapping
src/audit.js        URL validation, fetch, timeout, content-type checks
src/parse.js         Pure HTML → metrics logic (no network) — the tested core
public/index.html    Frontend (single file, no build step)
tests/parse.test.js  Unit tests for the parsing logic
tests/audit.test.js  Unit tests for URL validation + fetch orchestration
```

---

## API contract

### `POST /api/audit`

**Request body**

```json
{ "url": "https://example.com" }
```

**Success — `200 OK`**

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

**Errors** — always `{ "error": "<CODE>", "message": "<human-readable>" }`

| Status | `error` code    | When |
|-------:|------------------|------|
| 400 | `INVALID_URL`    | Missing, malformed, or non-http(s) URL |
| 415 | `NOT_HTML`       | Response `content-type` isn't `text/html` (e.g. a PDF or JSON API) |
| 502 | `FETCH_FAILED`   | DNS failure, connection refused, TLS error, etc. |
| 502 | `READ_FAILED`    | Connected fine but the body stream broke while reading |
| 504 | `TIMEOUT`        | Target didn't respond within 8 seconds |
| 500 | `INTERNAL_ERROR` | Anything unexpected — caught so the process never crashes |

Note: a target page returning its own error (e.g. a `404` page) is **not**
an error for this API — that's a valid report with `httpStatus: 404`. This
endpoint only returns a non-2xx status when *it* couldn't produce a report.

### `GET /api/health`

Returns `{ "status": "ok" }`. Used for uptime checks on the free-tier host.

---

## Design decisions

**1. Split parsing (`src/parse.js`) from fetching (`src/audit.js`).**
`parseHtml()` is a pure function: HTML string in, metrics object out, zero
network calls. `auditUrl()` handles everything network-related (validation,
timeout, content-type) and calls `parseHtml()` once it has a body. This
means the parsing logic — the part with the most edge cases (missing tags,
malformed HTML, empty pages) — can be unit tested instantly and
deterministically, with no mocking of `fetch` required. The network-heavy
edge cases (timeouts, DNS failures) live in a separate test file that mocks
`fetch` directly instead.

**2. An empty `alt=""` counts as "missing" for this audit, even though it's
sometimes intentional.** In accessibility terms, `alt=""` is the correct
choice for a purely decorative image — it tells screen readers to skip it.
But this tool's job is a *content/SEO* audit, not a strict a11y audit, and a
content owner scanning this report wants to know "how many images have no
descriptive text," not "how many images are a11y-compliant." Treating empty
and missing `alt` the same keeps the metric meaningful for that audience. I
call this out explicitly in the code comment so a future reader doesn't
"fix" it into an a11y checker by accident.

**3. Used the native `fetch` + `AbortController` instead of a library like
`axios`.** Node 18+ ships a spec-compliant `fetch`, and `AbortController` is
the standard way to time it out. Reaching for `axios` here would add a
dependency for something the runtime already does, and it keeps the audit
logic portable to any modern JS runtime (Deno, Bun, edge functions) without
changes.

---

## What I'd change with another day

- **Redirect chain reporting.** Right now `fetch` silently follows redirects
  and I only report the final URL/status. I'd surface the redirect chain
  (e.g. "3 redirects, ending at https://...") since redirect chains are a
  real SEO/performance signal.
- **Content-type sniffing beyond the header.** Some misconfigured servers
  serve HTML with the wrong `content-type` header (or vice versa). I'd add
  a fallback that sniffs the first bytes of the body when the header is
  ambiguous, instead of trusting it outright.
- **Word count on rendered vs. raw HTML.** This audits the raw server
  response. Client-rendered (JS-heavy) pages will report a near-zero word
  count even though a browser would show plenty of text. A more complete
  version would optionally render with something like Playwright and
  compare the two counts — that gap is itself a useful signal.
- **Rate limiting / abuse protection** on the public endpoint before
  leaving this on a free-tier host long-term, since right now anyone can
  point it at arbitrary URLs.

---

## Loom walkthrough — script

*(Record 3–5 min screen capture following this outline.)*

1. **Show it working (∼90s).** Load the live URL. Audit a real site (e.g.
   your own portfolio or a news homepage). Point out the vitals grid and
   call out one interesting finding (e.g. "this page has 12 images and 4
   are missing alt text").
2. **Audit a failure case live (∼30s).** Try a bad URL (`not-a-url`) and a
   non-HTML URL (a direct link to a PDF) to show the error states, not just
   the happy path.
3. **Walk through the code (∼90s).** Open `src/parse.js` and `src/audit.js`
   side by side. Explain the split from Design Decision 1 above, and run
   `npm test` on screen to show it passing.
4. **Self-critique (∼60s).** Pick one item from "What I'd change with
   another day" above (redirect chains is a good one — it's concrete and
   easy to show in the code) and explain, in the code, exactly where that
   change would go and why it's not in scope for this pass.
