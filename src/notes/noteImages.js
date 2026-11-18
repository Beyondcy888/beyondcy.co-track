// Notes pictures (update v4, file 02 §2): signed URLs and the add / remove steps.
//
//   - bucket note-images (private) at <role_id>/<item_id>/<uuid>.<ext>, ≤ 3 per item, ≤ 2 MB each,
//     JPG / PNG / WebP / GIF, uploaded as they are (never compressed: the owner's decision)
//   - signed URLs: every picture on screen is requested in ONE createSignedUrls batch per tick,
//     cached by path and renewed before they expire (like profile photos)
//   - add: upload, then update note_images; if the update is refused, delete the upload
//   - remove: update the row first, delete the file only if that worked (the database refuses
//     when that picture alone filled Notes on content that already has links)
import { useEffect, useState } from 'react';
import { MAX_NOTE_IMAGES, NOTE_IMAGE_MAX_BYTES, NOTE_IMAGE_TOO_BIG, NOTE_IMAGE_TOO_MANY, NOTE_IMAGE_TYPES, NOTE_IMAGE_WRONG_TYPE } from '../lib/fields.js';
import { friendlyError } from '../lib/errors.js';

const TTL = 3600 * 1000;
const EARLY = 5 * 60 * 1000;
const cache = new Map(); // path → { url, expires }
const listeners = new Set();
let pending = new Set();
let flushTimer = null;
let currentApi = null;

function fresh(path) {
  const hit = cache.get(path);
  return hit && hit.expires - EARLY > Date.now() ? hit.url : null;
}

async function flush() {
  flushTimer = null;
  const paths = [...pending];
  pending = new Set();
  if (!paths.length || !currentApi) return;
  const { data } = await currentApi.noteImageUrls(paths);
  const expires = Date.now() + TTL;
  for (const path of paths) {
    // a missing picture is remembered as "none" for a minute, so it isn't asked for again at once
    cache.set(path, data?.[path] ? { url: data[path], expires } : { url: null, expires: Date.now() + 60000 + EARLY });
  }
  listeners.forEach((fn) => fn());
}

function request(api, paths) {
  currentApi = api;
  let added = false;
  for (const p of paths) {
    if (!fresh(p) && !pending.has(p) && !(cache.has(p) && cache.get(p).url === null && cache.get(p).expires - EARLY > Date.now())) {
      pending.add(p);
      added = true;
    }
  }
  if (added && !flushTimer) flushTimer = setTimeout(flush, 0);
}

/**
 * Signed URLs for these paths: { urls: { [path]: url }, ready } where `ready` turns true once
 * every path has an answer (a URL, or "not found").
 */
export function useNoteImageUrls(api, paths) {
  const key = (paths ?? []).join('|');
  const [, bump] = useState(0);

  useEffect(() => {
    if (!key) return undefined;
    const list = key.split('|');
    const onChange = () => bump((n) => n + 1);
    listeners.add(onChange);
    request(api, list);
    // renew before they expire while they're on screen
    const timer = setInterval(() => request(api, list), 60000);
    return () => {
      listeners.delete(onChange);
      clearInterval(timer);
    };
  }, [api, key]);

  const urls = {};
  let ready = true;
  for (const p of paths ?? []) {
    const hit = cache.get(p);
    if (hit) {
      if (hit.url) urls[p] = hit.url;
    } else ready = false;
  }
  return { urls, ready };
}

/** null when the file can be added, else the message to show. */
export function checkNotePicture(file) {
  if (!NOTE_IMAGE_TYPES.includes(file.type)) return NOTE_IMAGE_WRONG_TYPE;
  if (file.size > NOTE_IMAGE_MAX_BYTES) return NOTE_IMAGE_TOO_BIG;
  return null;
}

/** The image files in a paste or drop (DataTransfer). */
export function imageFiles(dataTransfer) {
  if (!dataTransfer) return [];
  const files = [...(dataTransfer.files ?? [])];
  if (files.length) return files.filter((f) => f.type.startsWith('image/'));
  return [...(dataTransfer.items ?? [])]
    .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
    .map((i) => i.getAsFile())
    .filter(Boolean);
}

/**
 * Add pictures to an item's Notes, one by one. Returns { added, error } where error is the
 * first message to show (too big, wrong type, too many, or the database's own words).
 * `t` is the tracker context (updateItem) and `api` the data API.
 */
export async function addNotePictures({ t, api, item, files, onProgress }) {
  let current = [...(item.note_images ?? [])];
  let error = null;
  let added = 0;
  for (const file of files) {
    const problem = checkNotePicture(file);
    if (problem) {
      error ??= problem;
      continue;
    }
    if (current.length >= MAX_NOTE_IMAGES) {
      error ??= NOTE_IMAGE_TOO_MANY;
      break;
    }
    onProgress?.(1);
    const up = await api.uploadNoteImage(item.role_id, item.id, file);
    if (up.error || !up.data) {
      onProgress?.(-1);
      error ??= /exceeded the maximum allowed size|payload too large|entity too large/i.test(up.error?.message ?? '')
        ? NOTE_IMAGE_TOO_BIG
        : /mime type/i.test(up.error?.message ?? '')
          ? NOTE_IMAGE_WRONG_TYPE
          : friendlyError(up.error);
      continue;
    }
    const r = await t.updateItem(item.id, { note_images: [...current, up.data.path] });
    onProgress?.(-1);
    if (r.error) {
      api.removeNoteImages([up.data.path]); // the row didn't take it: don't leave the file behind
      error ??= friendlyError(r.error);
      break;
    }
    current = r.data?.note_images ?? [...current, up.data.path];
    added += 1;
  }
  return { added, error };
}

/** Remove one picture: the row first, then (only if that worked) the file. */
export async function removeNotePicture({ t, api, item, path }) {
  const r = await t.updateItem(item.id, { note_images: (item.note_images ?? []).filter((p) => p !== path) });
  if (r.error) return friendlyError(r.error);
  api.removeNoteImages([path]);
  cache.delete(path);
  return null;
}
