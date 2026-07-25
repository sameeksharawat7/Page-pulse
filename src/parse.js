const cheerio = require('cheerio');

/**
 * Pure function: takes raw HTML text and returns the audit metrics.
 * No network access here on purpose — this is what Task B's tests target.
 *
 * @param {string} html - raw HTML body
 * @returns {{
 *   title: string|null,
 *   metaDescription: string|null,
 *   h1Count: number,
 *   totalImages: number,
 *   imagesMissingAlt: number,
 *   wordCount: number
 * }}
 */
function parseHtml(html) {
  if (typeof html !== 'string') {
    throw new TypeError('parseHtml expects an HTML string');
  }

  const $ = cheerio.load(html);

  // Title: trim, collapse whitespace, empty string -> null
  const rawTitle = $('title').first().text();
  const title = rawTitle && rawTitle.trim().length > 0
    ? rawTitle.trim().replace(/\s+/g, ' ')
    : null;

  // Meta description: look for <meta name="description" content="...">
  const rawDescription = $('meta[name="description"]').first().attr('content');
  const metaDescription = rawDescription && rawDescription.trim().length > 0
    ? rawDescription.trim()
    : null;

  const h1Count = $('h1').length;

  const images = $('img');
  const totalImages = images.length;
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    // Missing alt = attribute absent entirely, OR present but empty/whitespace-only.
    // (An explicit alt="" is a valid a11y pattern for decorative images, but for
    // an SEO/content audit we still want to surface it as "no descriptive text".)
    if (alt === undefined || alt.trim().length === 0) {
      imagesMissingAlt += 1;
    }
  });

  // Word count: strip script/style (their text isn't page content), then
  // count whitespace-separated tokens in the remaining visible text.
  const $body = $('body').length ? $('body') : $.root();
  $body.find('script, style, noscript').remove();
  const text = $body.text().replace(/\s+/g, ' ').trim();
  const wordCount = text.length === 0 ? 0 : text.split(' ').length;

  return {
    title,
    metaDescription,
    h1Count,
    totalImages,
    imagesMissingAlt,
    wordCount,
  };
}

module.exports = { parseHtml };
