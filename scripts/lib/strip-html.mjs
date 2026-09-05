// ============================================================
// Turn source HTML into the plain text a jsonb/text column should hold.
//
// The Biosash copy is authored as HTML — `<p>`, `<span>`, and named entities.
// Storing it raw and letting React render it escaped puts literal "<p>" on
// the page, which is what 50 of 122 ingested descriptions were doing.
//
// Stripping at INGEST rather than at render is deliberate: the column is
// described as text, every consumer (PDP, quick view, admin editor, a future
// export) would otherwise need to know it might be markup, and rendering it
// as HTML instead would mean trusting a third-party site's markup enough to
// inject it into the page.
//
// Paragraph boundaries survive as blank lines so the structure the author
// intended is still readable; the PDP renders the result with
// `white-space: pre-line`.
// ============================================================

const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', deg: '°',
};

export function stripHtml(input) {
  let s = String(input ?? '');
  if (!s) return '';

  // Anything inside these never belongs in body copy.
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');

  // Block boundaries become line breaks BEFORE tags are removed, otherwise
  // two paragraphs run together into one sentence.
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|li|h[1-6]|tr)\s*>/gi, '\n\n');
  s = s.replace(/<li[^>]*>/gi, '\n• ');

  s = s.replace(/<[^>]+>/g, '');

  s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    const key = code.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : whole;
  });

  // Tidy inside lines, keep at most one blank line between paragraphs.
  s = s.split('\n').map((line) => line.replace(/[ \t ]+/g, ' ').trim()).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  // The source frequently writes " ," and " ." — an artifact of stripped
  // inline markup, and it reads as a typo once the tags are gone.
  s = s.replace(/\s+([,.;:!?])/g, '$1');

  return s;
}

/** True when the value still looks like markup — used by the cleanup pass. */
export function looksLikeHtml(value) {
  const s = String(value ?? '');
  return /<[a-z!/][^>]*>/i.test(s) || /&(nbsp|amp|lt|gt|quot|#\d+);/i.test(s);
}
