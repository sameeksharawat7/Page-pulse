const { parseHtml } = require('./parse');

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS_NOTE = 'follows redirects via fetch default (follow)';

class AuditError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'AuditError';
    this.statusCode = statusCode; // HTTP status WE respond with to our client
    this.code = code; // machine-readable error code for the frontend
  }
}

/**
 * Validate that a string is a well-formed, fetchable http(s) URL.
 * Throws AuditError(400) if not.
 */
function validateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new AuditError('A URL is required.', 400, 'INVALID_URL');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new AuditError(
      `"${rawUrl}" is not a valid URL. Include the protocol, e.g. https://example.com`,
      400,
      'INVALID_URL'
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AuditError(
      `Unsupported protocol "${parsed.protocol}". Only http and https are allowed.`,
      400,
      'INVALID_URL'
    );
  }

  return parsed;
}

/**
 * Fetch a URL and return the full audit report.
 * Never throws for "the target site errored" (that's a valid report: e.g. a 404
 * page still has a title/body to audit). Only throws AuditError for cases we
 * cannot produce a report at all: bad input, timeout, network failure, or
 * non-HTML content.
 */
async function auditUrl(rawUrl) {
  const parsedUrl = validateUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const started = Date.now();
  let response;
  try {
    response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'PagePulse/1.0 (+https://digitalheroesco.com) audit-bot',
      },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AuditError(
        `Request to ${parsedUrl.href} timed out after ${FETCH_TIMEOUT_MS / 1000}s.`,
        504,
        'TIMEOUT'
      );
    }
    throw new AuditError(
      `Could not reach ${parsedUrl.href}: ${err.message}`,
      502,
      'FETCH_FAILED'
    );
  } finally {
    clearTimeout(timeout);
  }
  const responseTimeMs = Date.now() - started;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new AuditError(
      `Expected an HTML page but got content-type "${contentType || 'unknown'}". ` +
        `This tool audits HTML pages, not files or APIs.`,
      415,
      'NOT_HTML'
    );
  }

  let html;
  try {
    html = await response.text();
  } catch (err) {
    throw new AuditError(
      `Fetched ${parsedUrl.href} but could not read the response body: ${err.message}`,
      502,
      'READ_FAILED'
    );
  }

  const metrics = parseHtml(html);

  return {
    url: parsedUrl.href,
    httpStatus: response.status,
    responseTimeMs,
    ...metrics,
  };
}

module.exports = { auditUrl, validateUrl, AuditError };
