// Banners belong to people (update v4, file 04): one per person, shown at the top of every
// tracker page they open (My work, Master, brand pages), and it follows them to any tracker.
//   - staff: add, change, reposition and remove their own (1500×600 recommended, JPG/PNG/WebP,
//     max 5 MB, converted to WebP ≤ 1500 px wide before upload)
//   - Admin has no banner. On a tracker with exactly one active person, Admin sees that
//     person's banner, read-only, and may remove it (with a confirmation). Behomy Master
//     (several people) shows none (default chosen by Claude).
// Files live in the private bucket user-banners at <profile_id>/<uuid>.webp and are shown
// through signed URLs (1 hour), cached and refreshed before they expire. Saving = upload →
// upsert the row → delete the old file; removing = delete the row, then the file.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../data/ApiContext.js';
import { BANNER_TOO_BIG, BANNER_WRONG_TYPE, friendlyError } from '../lib/errors.js';
import { useConfirm } from '../ui/Confirm.jsx';
import { useToast } from '../ui/Toast.jsx';

export const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const BANNER_MAX_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 1500;
const URL_TTL = 3600 * 1000;
const REFRESH_EARLY = 5 * 60 * 1000;

/** null when the file is fine, else the message to show. */
export function checkBannerFile(file) {
  if (!BANNER_TYPES.includes(file.type)) return BANNER_WRONG_TYPE;
  if (file.size > BANNER_MAX_BYTES) return BANNER_TOO_BIG;
  return null;
}

/** The new size when scaling down to at most `max` px wide (never up). */
export function scaledSize(width, height, max = MAX_WIDTH) {
  const scale = Math.min(1, max / width);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file); // respects EXIF orientation
    } catch {
      /* fall back to an <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/** Scale down to 1500px wide and encode as WebP (quality 0.85); JPEG where WebP encoding isn't supported. */
export async function prepareBanner(file) {
  const image = await decode(file);
  const { width, height } = scaledSize(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  image.close?.();
  let blob = await toBlob(canvas, 'image/webp', 0.85);
  if (blob?.type === 'image/webp') return { blob, ext: 'webp' };
  blob = await toBlob(canvas, 'image/jpeg', 0.85); // e.g. older Safari: no WebP encoder
  if (!blob) throw new Error("This image couldn't be read. Try another file.");
  return { blob, ext: 'jpg' };
}

// ------------------------------------------------------------------ signed URLs
const urlCache = new Map(); // path → { url, expires }

/** A signed URL for a private banner file, refreshed before it expires. */
export function useSignedUrl(api, path) {
  const [state, setState] = useState({ path: null, url: null });

  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    let timer = null;
    const schedule = (expires) => {
      clearTimeout(timer);
      timer = setTimeout(load, Math.max(expires - REFRESH_EARLY - Date.now(), 30000));
    };
    async function load() {
      const hit = urlCache.get(path);
      if (hit && hit.expires - REFRESH_EARLY > Date.now()) {
        setState({ path, url: hit.url });
        schedule(hit.expires);
        return;
      }
      const r = await api.userBannerUrl(path);
      if (!alive) return;
      if (r.error || !r.data) {
        setState({ path, url: null });
        return;
      }
      const entry = { url: r.data, expires: Date.now() + URL_TTL };
      urlCache.set(path, entry);
      setState({ path, url: entry.url });
      schedule(entry.expires);
    }
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [api, path]);

  return path && state.path === path ? state.url : null;
}

// ------------------------------------------------------------------ whose banner, and what you may do
/**
 * `profileId`: whose banner the page shows (null = none). `me`: the signed-in person.
 * `isAdmin`: Admin may remove anyone's (read-only otherwise). `ownerName`: for Admin's wording.
 */
export function useBanner({ profileId, me, isAdmin = false, ownerName = null }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef(null);
  const [banner, setBanner] = useState(undefined); // undefined = loading, null = none
  const [busy, setBusy] = useState(null); // 'upload' | 'remove' | 'position'
  const [draftY, setDraftY] = useState(null); // number while repositioning
  const editable = Boolean(profileId) && profileId === me && !isAdmin;
  const removable = Boolean(profileId) && (editable || isAdmin);
  const url = useSignedUrl(api, banner?.image_path);

  // load + live updates (the person's other open tabs, or Admin removing it)
  useEffect(() => {
    if (!profileId) {
      setBanner(null);
      return undefined;
    }
    let alive = true;
    setBanner(undefined);
    api.getUserBanner(profileId).then((r) => {
      if (alive) setBanner(r.error ? null : r.data ?? null); // a banner problem never blocks the page
    });
    const unsubscribe = api.subscribeUserBanners((event, row) => {
      if (!row || row.profile_id !== profileId) return;
      setBanner(event === 'DELETE' ? null : row);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [api, profileId]);

  // removed elsewhere while repositioning
  useEffect(() => {
    if (!banner) setDraftY(null);
  }, [banner]);

  const pickFile = useCallback(() => {
    if (editable) inputRef.current?.click();
  }, [editable]);

  const onFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // picking the same file again still fires
      if (!file || !editable) return;
      const problem = checkBannerFile(file);
      if (problem) {
        toast(problem, { tone: 'danger', duration: 6000 });
        return;
      }
      setBusy('upload');
      const oldPath = banner?.image_path ?? null;
      try {
        const { blob, ext } = await prepareBanner(file);
        const up = await api.uploadUserBannerFile(profileId, blob, ext);
        if (up.error) throw up.error;
        const saved = await api.saveUserBanner({ profileId, imagePath: up.data.path, positionY: 50 });
        if (saved.error) {
          api.removeUserBannerFile(up.data.path);
          throw saved.error;
        }
        setBanner(saved.data);
        setDraftY(null);
        if (oldPath && oldPath !== up.data.path) api.removeUserBannerFile(oldPath); // the previous file
        toast(oldPath ? 'Banner changed' : 'Banner added');
      } catch (err) {
        toast(friendlyError(err), { tone: 'danger', duration: 6500 });
      } finally {
        setBusy(null);
      }
    },
    [api, banner, editable, profileId, toast],
  );

  const remove = useCallback(async () => {
    if (!banner || !removable) return;
    const ok = await confirm(
      editable
        ? { title: 'Remove your banner?', body: 'It disappears from every tracker page you open.', confirmLabel: 'Remove banner', tone: 'danger' }
        : {
            title: `Remove ${ownerName ?? 'this person'}'s banner?`,
            body: 'It disappears from their tracker pages. They can add a new one any time.',
            confirmLabel: 'Remove banner',
            tone: 'danger',
          },
    );
    if (!ok) return;
    setBusy('remove');
    const path = banner.image_path;
    const r = await api.deleteUserBanner(profileId);
    setBusy(null);
    if (r.error) {
      toast(friendlyError(r.error), { tone: 'danger', duration: 6000 });
      return;
    }
    setBanner(null);
    api.removeUserBannerFile(path);
    toast('Banner removed');
  }, [api, banner, confirm, editable, ownerName, profileId, removable, toast]);

  const startReposition = useCallback(() => {
    if (banner && editable) setDraftY(Number(banner.position_y ?? 50));
  }, [banner, editable]);

  const cancelReposition = useCallback(() => setDraftY(null), []);

  const savePosition = useCallback(async () => {
    if (draftY == null) return;
    const y = Math.round(draftY * 100) / 100;
    setBusy('position');
    const r = await api.setUserBannerPosition(profileId, y);
    setBusy(null);
    if (r.error) {
      toast(friendlyError(r.error), { tone: 'danger', duration: 6000 });
      return;
    }
    setBanner(r.data);
    setDraftY(null);
  }, [api, draftY, profileId, toast]);

  return {
    banner,
    url,
    busy,
    editable,
    removable,
    ownerName,
    repositioning: draftY != null,
    positionY: draftY ?? Number(banner?.position_y ?? 50),
    setDraftY,
    inputRef,
    onFile,
    pickFile,
    remove,
    startReposition,
    cancelReposition,
    savePosition,
  };
}
