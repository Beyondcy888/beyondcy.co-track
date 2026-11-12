// Changing a profile photo (update v3, file 03): click the photo → Upload photo / Adjust /
// Remove. Upload and Adjust open a centred dialog with a round crop (zoom + drag); the
// result is a 512 × 512 WebP made in the browser.
//   save:   upload to avatars/<profile_id>/<uuid>.webp → set_profile_avatar → delete the old file
//   remove: set_profile_avatar(null) → delete the file
// People change their own photo; Admin changes anyone's. The database enforces it, and its
// message is shown as-is ("You can only change your own photo.").
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { useApi } from '../data/ApiContext.js';
import { useAppData } from '../data/AppDataProvider.jsx';
import {
  AVATAR_INPUT_TYPES,
  AVATAR_MAX_ZOOM,
  AVATAR_QUALITY,
  AVATAR_SIZE,
  checkPhotoFile,
  clampCrop,
  cropRect,
  cropScale,
  zoomAt,
} from '../lib/avatar.js';
import { friendlyError, ONLY_ADMIN } from '../lib/errors.js';
import { useConfirm } from '../ui/Confirm.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Popover } from '../ui/Popover.jsx';
import { useToast } from '../ui/Toast.jsx';
import { IconCamera, IconCrop, IconTrash, IconX } from '../ui/icons.jsx';
import { Avatar } from './Avatar.jsx';

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob); // respects EXIF orientation
    } catch {
      /* fall back to an <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draw the chosen square at 512 × 512 and encode it as WebP (JPEG where WebP can't be encoded). */
async function renderCrop(image, rect) {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, rect.sx, rect.sy, rect.size, rect.size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  let blob = await toBlob(canvas, 'image/webp', AVATAR_QUALITY);
  if (blob?.type === 'image/webp') return { blob, ext: 'webp' };
  blob = await toBlob(canvas, 'image/jpeg', AVATAR_QUALITY); // e.g. older Safari: no WebP encoder
  if (!blob) throw new Error("This image couldn't be read. Try another file.");
  return { blob, ext: 'jpg' };
}

// ------------------------------------------------------------------ the crop dialog
function CropDialog({ source, title, personName, onCancel, onSave }) {
  const titleId = useId();
  const stageRef = useRef(null);
  const [image, setImage] = useState(null); // decoded bitmap (for the export)
  const [previewUrl, setPreviewUrl] = useState(null);
  const [view, setView] = useState(280);
  const [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0 });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  // decode once; the <img> preview uses an object URL of the same file
  useEffect(() => {
    let alive = true;
    const url = URL.createObjectURL(source);
    setPreviewUrl(url);
    decode(source)
      .then((img) => {
        if (alive) setImage(img);
        else img.close?.();
      })
      .catch(() => alive && setError("This image couldn't be read. Try another file."));
    return () => {
      alive = false;
      URL.revokeObjectURL(url);
    };
  }, [source]);

  useEffect(() => () => image?.close?.(), [image]);

  // the stage is a square whose size follows the dialog (smaller on phones)
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setView(el.clientWidth || 280));
    ro.observe(el);
    setView(el.clientWidth || 280);
    return () => ro.disconnect();
  }, []);

  const dims = useMemo(() => (image ? { imgW: image.width, imgH: image.height, view } : null), [image, view]);
  const safe = dims ? clampCrop({ ...dims, ...crop }) : crop;
  const scale = dims ? cropScale({ ...dims, zoom: safe.zoom }) : 1;

  const update = (fn) => {
    if (!dims) return;
    setCrop((c) => clampCrop({ ...dims, ...fn(clampCrop({ ...dims, ...c })) }));
  };

  const onPointerDown = (e) => {
    if (!dims || busy) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: safe.zoom };
    }
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !dims) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const target = pinch.current.zoom * (dist / Math.max(pinch.current.dist, 1));
      update((c) => zoomAt({ ...dims, ...c }, target));
      return;
    }
    update((c) => ({ ...c, x: c.x + (now.x - prev.x), y: c.y + (now.y - prev.y) }));
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onWheel = (e) => {
    if (!dims) return;
    const box = stageRef.current.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * 0.0015);
    update((c) => zoomAt({ ...dims, ...c }, c.zoom * factor, e.clientX - box.left, e.clientY - box.top));
  };
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 24 : 8;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      update((c) => ({ ...c, x: c.x + moves[e.key][0], y: c.y + moves[e.key][1] }));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      update((c) => zoomAt({ ...dims, ...c }, c.zoom + 0.1));
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      update((c) => zoomAt({ ...dims, ...c }, c.zoom - 0.1));
    }
  };

  // wheel must be non-passive to stop the page from scrolling behind the dialog
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const stop = (e) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);

  const save = async () => {
    if (!dims || busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await renderCrop(image, cropRect({ ...dims, ...safe }));
      const problem = await onSave(out);
      if (problem) {
        setError(problem);
        setBusy(false);
      }
    } catch (err) {
      setError(friendlyError(err, { refused: ONLY_ADMIN }));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onCancel} labelledBy={titleId} className="crop" dismissable={!busy}>
      <header className="modal-head">
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        <button type="button" className="icon-btn modal-close" onClick={onCancel} disabled={busy}>
          <IconX width={18} height={18} />
          <span className="sr-only">Cancel</span>
        </button>
      </header>
      <p className="crop-for">{personName}</p>

      <div
        ref={stageRef}
        className={`crop-stage${dims ? '' : ' is-loading'}`}
        tabIndex={0}
        role="application"
        aria-label="Photo position. Drag, or use the arrow keys to move and plus or minus to zoom."
        data-autofocus
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        {previewUrl && dims && (
          <img
            className="crop-img"
            src={previewUrl}
            alt=""
            draggable={false}
            style={{
              width: dims.imgW * scale,
              height: dims.imgH * scale,
              transform: `translate(calc(-50% + ${safe.x}px), calc(-50% + ${safe.y}px))`,
            }}
          />
        )}
        <span className="crop-ring" aria-hidden="true" />
      </div>

      <label className="crop-zoom">
        <span className="crop-zoom-label">Zoom</span>
        <input
          type="range"
          min="1"
          max={AVATAR_MAX_ZOOM}
          step="0.01"
          value={safe.zoom}
          disabled={!dims || busy}
          onChange={(e) => update((c) => zoomAt({ ...dims, ...c }, Number(e.target.value)))}
          aria-valuetext={`${Math.round(safe.zoom * 100)}%`}
        />
        <span className="crop-zoom-value mono">{Math.round(safe.zoom * 100)}%</span>
      </label>
      <p className="crop-hint">Drag the photo to reposition it.</p>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <footer className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dims || busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </Modal>
  );
}

// ------------------------------------------------------------------ the photo button + menu
/**
 * The person's photo as a button that opens the photo menu. Shown as a plain avatar
 * when this viewer can't change it (staff looking at someone else).
 */
export function AvatarEditor({ personId, size = 32, className = '' }) {
  const api = useApi();
  const app = useAppData();
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef(null);
  const [menu, setMenu] = useState(null); // the anchor element
  const [crop, setCrop] = useState(null); // { source, mode }
  const [busy, setBusy] = useState(false);

  const person = app.peopleById[personId];
  const isSelf = personId === profile?.id;
  const canEdit = isSelf || Boolean(profile?.role?.is_admin);
  const hasPhoto = Boolean(person?.avatar_path);
  const whose = isSelf ? 'your' : `${person?.display_name ?? 'this person'}'s`;
  const closeMenu = useCallback(() => setMenu(null), []);

  if (!person || !canEdit) return <Avatar id={personId} size={size} className={className} labelled />;

  const fail = (err) => toast(friendlyError(err, { refused: ONLY_ADMIN }), { tone: 'danger', duration: 6500 });

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still fires
    if (!file) return;
    const problem = checkPhotoFile(file);
    if (problem) {
      toast(problem, { tone: 'danger', duration: 6000 });
      return;
    }
    setCrop({ source: file, mode: 'upload' });
  };

  const adjust = async () => {
    closeMenu();
    setBusy(true);
    const r = await api.downloadAvatar(person.avatar_path);
    setBusy(false);
    if (r.error || !r.data) {
      fail(r.error ?? { message: "The current photo couldn't be loaded. Upload it again." });
      return;
    }
    setCrop({ source: r.data, mode: 'adjust' });
  };

  /** Returns a message when something is refused (the dialog shows it and stays open). */
  const save = async ({ blob, ext }) => {
    const oldPath = person.avatar_path ?? null;
    const up = await api.uploadAvatar(personId, blob, ext);
    if (up.error) return friendlyError(up.error, { refused: ONLY_ADMIN });
    const set = await api.setAvatar(personId, up.data.path);
    if (set.error) {
      api.removeAvatarFile(up.data.path);
      return friendlyError(set.error, { refused: ONLY_ADMIN });
    }
    if (oldPath && oldPath !== up.data.path) api.removeAvatarFile(oldPath); // the previous file
    await app.reloadPeople();
    setCrop(null);
    toast(crop?.mode === 'adjust' ? 'Photo adjusted' : oldPath ? 'Photo changed' : 'Photo added');
    return null;
  };

  const remove = async () => {
    closeMenu();
    const ok = await confirm({
      title: isSelf ? 'Remove your photo?' : `Remove ${person.display_name}'s photo?`,
      body: 'The first letter of the name is shown instead.',
      confirmLabel: 'Remove photo',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const path = person.avatar_path;
    const r = await api.setAvatar(personId, null);
    if (r.error) {
      setBusy(false);
      fail(r.error);
      return;
    }
    if (path) api.removeAvatarFile(path);
    await app.reloadPeople();
    setBusy(false);
    toast('Photo removed');
  };

  return (
    <>
      <button
        type="button"
        className={`avatar-btn ${className}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        aria-busy={busy}
        title={isSelf ? 'Change your photo' : `Change ${person.display_name}'s photo`}
        onClick={(e) => setMenu(menu ? null : e.currentTarget)}
      >
        <Avatar id={personId} size={size} />
        <span className="avatar-btn-badge" aria-hidden="true">
          <IconCamera width={11} height={11} />
        </span>
        <span className="sr-only">
          Change {whose} photo
        </span>
      </button>
      <input ref={inputRef} type="file" accept={AVATAR_INPUT_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />

      {menu && (
        <Popover anchor={menu} onClose={closeMenu} label="Profile photo" width={210} role="menu" className="avatar-menu">
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              closeMenu();
              inputRef.current?.click();
            }}
          >
            <IconCamera /> {hasPhoto ? 'Upload a new photo' : 'Upload photo'}
          </button>
          {hasPhoto && (
            <button type="button" role="menuitem" className="menu-item" onClick={adjust}>
              <IconCrop /> Adjust
            </button>
          )}
          {hasPhoto && (
            <button type="button" role="menuitem" className="menu-item menu-item--danger" onClick={remove}>
              <IconTrash /> Remove
            </button>
          )}
        </Popover>
      )}

      {crop && (
        <CropDialog
          key={crop.mode}
          source={crop.source}
          title={crop.mode === 'adjust' ? 'Adjust photo' : 'Profile photo'}
          personName={isSelf ? 'This is how everyone will see you.' : `For ${person.display_name}`}
          onCancel={() => setCrop(null)}
          onSave={save}
        />
      )}
    </>
  );
}
