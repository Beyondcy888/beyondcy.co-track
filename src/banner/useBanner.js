// The tracker banner (09 §5): one per tracker, shared by its members and Admin.
// Files live in the private bucket at tracker-banners/<role_id>/<uuid>.webp and are shown
// through signed URLs (1 hour), cached and refreshed before they expire.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
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
      const r = await api.bannerUrl(path);
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

// ------------------------------------------------------------------ actions
export function useBanner() {
  const t = useTracker();
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(null); // 'upload' | 'remove' | 'position'
  const [draftY, setDraftY] = useState(null); // number while repositioning
  const banner = t.banner;
  const url = useSignedUrl(t.api, banner?.image_path);

  // a teammate removed it while we were repositioning
  useEffect(() => {
    if (!banner) setDraftY(null);
  }, [banner]);

  const pickFile = useCallback(() => inputRef.current?.click(), []);

  const onFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // picking the same file again still fires
      if (!file) return;
      const problem = checkBannerFile(file);
      if (problem) {
        toast(problem, { tone: 'danger', duration: 6000 });
        return;
      }
      setBusy('upload');
      const oldPath = banner?.image_path ?? null;
      try {
        const { blob, ext } = await prepareBanner(file);
        const up = await t.api.uploadBannerFile(t.roleId, blob, ext);
        if (up.error) throw up.error;
        const saved = await t.api.saveBanner({ roleId: t.roleId, imagePath: up.data.path, positionY: 50 });
        if (saved.error) {
          t.api.removeBannerFile(up.data.path);
          throw saved.error;
        }
        t.setBanner(saved.data);
        setDraftY(null);
        if (oldPath && oldPath !== up.data.path) t.api.removeBannerFile(oldPath); // the previous file
        toast(oldPath ? 'Banner changed' : 'Banner added');
      } catch (err) {
        toast(friendlyError(err), { tone: 'danger', duration: 6500 });
      } finally {
        setBusy(null);
      }
    },
    [banner, t, toast],
  );

  const remove = useCallback(async () => {
    if (!banner) return;
    const ok = await confirm({
      title: 'Remove the banner?',
      body: 'It disappears for everyone in this tracker.',
      confirmLabel: 'Remove banner',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy('remove');
    const path = banner.image_path;
    const r = await t.api.deleteBanner(t.roleId);
    setBusy(null);
    if (r.error) {
      toast(friendlyError(r.error), { tone: 'danger', duration: 6000 });
      return;
    }
    t.setBanner(null);
    t.api.removeBannerFile(path);
    toast('Banner removed');
  }, [banner, confirm, t, toast]);

  const startReposition = useCallback(() => {
    if (banner) setDraftY(Number(banner.position_y ?? 50));
  }, [banner]);

  const cancelReposition = useCallback(() => setDraftY(null), []);

  const savePosition = useCallback(async () => {
    if (draftY == null) return;
    const y = Math.round(draftY * 100) / 100;
    setBusy('position');
    const r = await t.api.setBannerPosition(t.roleId, y);
    setBusy(null);
    if (r.error) {
      toast(friendlyError(r.error), { tone: 'danger', duration: 6000 });
      return;
    }
    t.setBanner(r.data);
    setDraftY(null);
  }, [draftY, t, toast]);

  return {
    banner,
    url,
    busy,
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
