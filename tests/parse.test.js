const { parseHtml } = require('../src/parse');

describe('parseHtml — happy path', () => {
  test('extracts title, meta description, headings, images, and word count from a normal page', () => {
    const html = `
      <html>
        <head>
          <title>  Acme Corp — Widgets & More  </title>
          <meta name="description" content="We make the finest widgets in town.">
        </head>
        <body>
          <h1>Welcome to Acme</h1>
          <p>Acme has been making widgets since 1990.</p>
          <img src="hero.jpg" alt="Acme factory floor">
          <img src="logo.png" alt="">
          <img src="banner.png">
          <script>var x = "this should not count as words";</script>
        </body>
      </html>
    `;

    const result = parseHtml(html);

    expect(result.title).toBe('Acme Corp — Widgets & More');
    expect(result.metaDescription).toBe('We make the finest widgets in town.');
    expect(result.h1Count).toBe(1);
    expect(result.totalImages).toBe(3);
    // logo.png has alt="" (empty) and banner.png has no alt attribute -> both count as missing
    expect(result.imagesMissingAlt).toBe(2);
    expect(result.wordCount).toBeGreaterThan(0);
    // script contents must be excluded from the word count.
    // Visible text collapses to: "Welcome to Acme Acme has been making widgets since 1990."
    expect(result.wordCount).toBe(10);
  });
});

describe('parseHtml — failure / edge cases', () => {
  test('throws a TypeError when given non-string input', () => {
    expect(() => parseHtml(null)).toThrow(TypeError);
    expect(() => parseHtml(undefined)).toThrow(TypeError);
    expect(() => parseHtml({ not: 'html' })).toThrow(TypeError);
  });

  test('returns nulls/zeros instead of crashing on a page missing title, description, and images', () => {
    const html = '<html><body><p>Just some text, nothing else here.</p></body></html>';

    const result = parseHtml(html);

    expect(result.title).toBeNull();
    expect(result.metaDescription).toBeNull();
    expect(result.h1Count).toBe(0);
    expect(result.totalImages).toBe(0);
    expect(result.imagesMissingAlt).toBe(0);
    expect(result.wordCount).toBe(6);
  });

  test('handles malformed/truncated HTML without throwing', () => {
    // Note: <title> is an RCDATA element per the HTML spec — an unclosed
    // <title> swallows everything after it (including "<body>...") as plain
    // text until a literal "</title>" is found. With no closing tag at all,
    // the whole remainder of the document becomes the title's text. That's
    // correct parser behavior, not a bug — so we assert on that, not on a
    // clean "Broken".
    const html = '<html><head><title>Broken<body><h1>Oops <img src="a.png"';

    expect(() => parseHtml(html)).not.toThrow();
    const result = parseHtml(html);
    expect(result.title).toContain('Broken');
    expect(typeof result.title).toBe('string');
  });

  test('a properly closed but otherwise malformed page still parses cleanly', () => {
    const html = '<html><head><title>Broken</title></head><body><h1>Oops<img src="a.png"></body></html>';

    const result = parseHtml(html);
    expect(result.title).toBe('Broken');
    expect(result.h1Count).toBe(1);
    expect(result.totalImages).toBe(1);
    expect(result.imagesMissingAlt).toBe(1);
  });

  test('treats an empty document as zero words, not an error', () => {
    const result = parseHtml('');
    expect(result.wordCount).toBe(0);
    expect(result.title).toBeNull();
  });
});
