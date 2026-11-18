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

/**
 * A link's short label for tight places (the Links column, cards): the domain plus the
 * start of the path, no query string.
 *   'https://drive.google.com/file/d/1AbCdEfGh/view?usp=sharing' → 'drive.google.com/file/d/1AbC…'
 */
export function shortLink(url, max = 32) {
  const s = String(url)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Mirrors the database's rule for a link: a web address starting with http:// or https:// (no spaces). */
export function isWebLink(value) {
  return /^https?:\/\/\S+$/i.test(String(value ?? '').trim());
}

/** What the database keeps of a list of links: trimmed, no blanks, no duplicates (order kept). */
export function cleanLinks(list) {
  const out = [];
  for (const raw of list ?? []) {
    const v = String(raw ?? '').trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}
