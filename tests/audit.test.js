const { validateUrl, auditUrl, AuditError } = require('../src/audit');

describe('validateUrl', () => {
  test('accepts a well-formed https URL', () => {
    const parsed = validateUrl('https://example.com/page');
    expect(parsed.href).toBe('https://example.com/page');
  });

  test('rejects an empty or missing URL', () => {
    expect(() => validateUrl('')).toThrow(AuditError);
    expect(() => validateUrl(undefined)).toThrow(AuditError);
    try {
      validateUrl('   ');
    } catch (e) {
      expect(e.statusCode).toBe(400);
      expect(e.code).toBe('INVALID_URL');
    }
  });

  test('rejects a malformed URL string', () => {
    expect(() => validateUrl('not a url at all')).toThrow(AuditError);
  });

  test('rejects non-http(s) protocols', () => {
    expect(() => validateUrl('ftp://example.com/file')).toThrow(AuditError);
    expect(() => validateUrl('javascript:alert(1)')).toThrow(AuditError);
  });
});

describe('auditUrl', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('happy path: returns a full report for a normal HTML response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => '<html><head><title>Hi</title></head><body><h1>Hi</h1></body></html>',
    });

    const report = await auditUrl('https://example.com');

    expect(report.httpStatus).toBe(200);
    expect(report.title).toBe('Hi');
    expect(typeof report.responseTimeMs).toBe('number');
  });

  test('rejects non-HTML responses with a 415-style AuditError', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => 'application/pdf' },
      text: async () => '%PDF-1.4 ...',
    });

    await expect(auditUrl('https://example.com/file.pdf')).rejects.toMatchObject({
      statusCode: 415,
      code: 'NOT_HTML',
    });
  });

  test('surfaces network failures as a 502 AuditError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    await expect(auditUrl('https://this-domain-does-not-exist.invalid')).rejects.toMatchObject({
      statusCode: 502,
      code: 'FETCH_FAILED',
    });
  });

  test('times out slow requests with a 504 AuditError', async () => {
    // fetch never resolves on its own; it only rejects once the AbortController fires.
    global.fetch = jest.fn().mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));

    jest.useFakeTimers();
    const promise = auditUrl('https://example.com/slow');

    // Attach the assertion BEFORE advancing timers, so the promise always
    // has a handler listening before it rejects. Otherwise there's a brief
    // window where the rejection is "unhandled," which Jest/Node flags as
    // a failure even though the rejection is the correct, expected outcome.
    const assertion = expect(promise).rejects.toMatchObject({
      statusCode: 504,
      code: 'TIMEOUT',
    });

    // Fast-forward past the 8s internal timeout so the AbortController fires.
    await jest.advanceTimersByTimeAsync(8001);
    await assertion;

    jest.useRealTimers();
  });
});
