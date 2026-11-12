// Profile photos (update v3, file 03): the letter fallback and the crop maths.
// Pure functions only; tested in avatar.test.js.

/** How many muted tones the letter avatars use (see .avatar[data-tone] in avatar.css). */
export const AVATAR_TONES = 6;

export const AVATAR_SIZE = 512; // the saved photo is 512 × 512
export const AVATAR_QUALITY = 0.85;
export const AVATAR_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_INPUT_MAX_BYTES = 10 * 1024 * 1024; // before cropping
export const AVATAR_MAX_ZOOM = 4;
export const PHOTO_TOO_BIG = 'Photo must be 10 MB or smaller.';
export const PHOTO_WRONG_TYPE = 'Use a JPG, PNG or WebP image.';

/** The same person always gets the same tone: a small stable hash of their id. */
export function toneIndex(id, tones = AVATAR_TONES) {
  const s = String(id ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % tones;
}

/** First letter of the display name, uppercase ('?' when there is no name). */
export function initialOf(name) {
  const first = Array.from(String(name ?? '').trim())[0];
  return first ? first.toLocaleUpperCase() : '?';
}

/** null when the picked file is fine, else the message to show. */
export function checkPhotoFile(file) {
  if (!AVATAR_INPUT_TYPES.includes(file.type)) return PHOTO_WRONG_TYPE;
  if (file.size > AVATAR_INPUT_MAX_BYTES) return PHOTO_TOO_BIG;
  return null;
}

// ------------------------------------------------------------------ crop
// The preview is a square of `view` px. At zoom 1 the image just covers it (its short
// side = view). `x`, `y` move the image's centre away from the square's centre, in preview px.

/** Preview px per image px. */
export function cropScale({ imgW, imgH, view, zoom }) {
  return (view / Math.min(imgW, imgH)) * zoom;
}

/** Keep zoom in range and the image covering the whole square. */
export function clampCrop({ imgW, imgH, view, zoom, x, y }) {
  const z = Math.min(Math.max(zoom, 1), AVATAR_MAX_ZOOM);
  const scale = cropScale({ imgW, imgH, view, zoom: z });
  const maxX = Math.max(0, (imgW * scale - view) / 2);
  const maxY = Math.max(0, (imgH * scale - view) / 2);
  // "+ 0" turns a negative zero into a plain 0
  return { zoom: z, x: Math.min(Math.max(x, -maxX), maxX) + 0, y: Math.min(Math.max(y, -maxY), maxY) + 0 };
}

/** The square of the source image that the preview shows: { sx, sy, size } in image px. */
export function cropRect({ imgW, imgH, view, zoom, x, y }) {
  const scale = cropScale({ imgW, imgH, view, zoom });
  const size = view / scale;
  const sx = imgW / 2 - x / scale - size / 2;
  const sy = imgH / 2 - y / scale - size / 2;
  // rounding can push the square a hair outside the image
  return {
    sx: Math.min(Math.max(sx, 0), Math.max(imgW - size, 0)),
    sy: Math.min(Math.max(sy, 0), Math.max(imgH - size, 0)),
    size,
  };
}

/** Zoom toward a point of the preview (the cursor), keeping what is under it in place. */
export function zoomAt({ imgW, imgH, view, zoom, x, y }, nextZoom, px = view / 2, py = view / 2) {
  const z = Math.min(Math.max(nextZoom, 1), AVATAR_MAX_ZOOM);
  const ratio = z / zoom;
  const cx = px - view / 2;
  const cy = py - view / 2;
  return clampCrop({ imgW, imgH, view, zoom: z, x: cx - (cx - x) * ratio, y: cy - (cy - y) * ratio });
}
