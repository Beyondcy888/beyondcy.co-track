// Links typed by staff. User text is never rendered as HTML: we split it into
// text and link segments, and only http(s) URLs ever become an href.

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;
const TRAILING = /[).,;:!?\]]+$/;

/** Only http(s) URLs pass; anything else (javascript:, data:, …) returns null. */
export function safeHref(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  if (/^www\.\S+$/i.test(v)) return `https://${v}`;
  return null;
}

/** Split one line into [{ type: 'text', value } | { type: 'link', value, href }]. */
export function linkifyLine(line) {
  const parts = [];
  let last = 0;
  for (const match of line.matchAll(URL_RE)) {
    let raw = match[0];
    const trail = raw.match(TRAILING);
    if (trail) raw = raw.slice(0, -trail[0].length);
    const start = match.index;
    if (start > last) parts.push({ type: 'text', value: line.slice(last, start) });
    const href = safeHref(raw);
    parts.push(href ? { type: 'link', value: raw, href } : { type: 'text', value: raw });
    last = start + raw.length;
  }
  if (last < line.length) parts.push({ type: 'text', value: line.slice(last) });
  return parts;
}

/** Reference text → one entry per non-empty line. */
export function referenceLines(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ line, parts: linkifyLine(line) }));
}

/** The first link in a reference text (for the one-line table cell). */
export function firstLink(text) {
  for (const { parts } of referenceLines(text)) {
    const link = parts.find((p) => p.type === 'link');
    if (link) return link;
  }
  return null;
}

/** 'https://www.instagram.com/p/abc/' → 'instagram.com/p/abc' */
export function shortUrl(url) {
  return String(url)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

/** Mirrors the database rule, used only for a friendly early hint. */
export function isInstagramUrl(value) {
  return /^https?:\/\/([a-z0-9-]+\.)?instagram\.com\/.+/i.test(String(value || '').trim());
}
