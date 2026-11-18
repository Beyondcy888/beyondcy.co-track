// Notes pictures on screen (update v4, file 02 §2).
//   <NoteThumbs>   the table's small thumbnails (~36 px); a click opens the lightbox
//   <NotesField>   the Notes editor: text + up to 3 pictures (paste, drop or "Add picture"),
//                  each with a remove (×); used in the drawer and in the table's Notes popover
import { useCallback, useId, useRef, useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { MAX_NOTE_IMAGES, NOTE_IMAGE_TYPES } from '../lib/fields.js';
import { TextDraftField } from '../drawer/FieldEditors.jsx';
import { SkeletonBlock } from '../components/skeleton/Skeleton.jsx';
import { IconImage, IconX } from '../ui/icons.jsx';
import { Lightbox } from './Lightbox.jsx';
import { addNotePictures, imageFiles, removeNotePicture, useNoteImageUrls } from './noteImages.js';

/** One picture frame at its final size: a shimmer until the image has loaded, then it fades in. */
function Frame({ url, size, alt = '', onClick, children, className = '' }) {
  const [loaded, setLoaded] = useState(false);
  const style = { width: size, height: size };
  const img = url ? (
    <img className={`np-img${loaded ? ' is-loaded' : ''}`} src={url} alt={alt} decoding="async" draggable={false} onLoad={() => setLoaded(true)} />
  ) : null;
  return (
    <span className={`np-frame ${className}`} style={style}>
      {!loaded && <SkeletonBlock width={size} height={size} radius={8} className="np-sk" />}
      {onClick ? (
        <button type="button" className="np-open" onClick={onClick}>
          {img}
          <span className="sr-only">{alt || 'Open picture'}</span>
        </button>
      ) : (
        img
      )}
      {children}
    </span>
  );
}

/** The table's thumbnails: small, clickable, read-only. */
export function NoteThumbs({ item, size = 36 }) {
  const { api } = useTracker();
  const paths = item.note_images ?? [];
  const { urls } = useNoteImageUrls(api, paths);
  const [open, setOpen] = useState(null);
  if (!paths.length) return null;
  const list = paths.map((p) => urls[p]).filter(Boolean);
  return (
    <span className="np-thumbs" onClick={(e) => e.stopPropagation()}>
      {paths.map((p, i) => (
        <Frame key={p} url={urls[p]} size={size} alt={`Notes picture ${i + 1} of ${paths.length}`} onClick={() => setOpen(Math.max(list.indexOf(urls[p]), 0))} />
      ))}
      {open != null && list.length > 0 && <Lightbox urls={list} start={open} onClose={() => setOpen(null)} />}
    </span>
  );
}

/**
 * Text + pictures together. The text saves on blur like every text field; pictures are added
 * by pasting into the text box (Ctrl/Cmd+V), dropping files on the field, or "Add picture".
 */
export function NotesField({ item, onSaved, autoFocus = false, label = 'Notes', compact = false }) {
  const t = useTracker();
  const id = useId();
  const inputRef = useRef(null);
  const paths = item.note_images ?? [];
  const { urls } = useNoteImageUrls(t.api, paths);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState(null);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState(null);
  const itemRef = useRef(item);
  itemRef.current = item;
  const size = compact ? 64 : 76;
  const room = MAX_NOTE_IMAGES - paths.length - uploading;

  const add = useCallback(
    async (files) => {
      if (!files.length) return;
      setError(null);
      const r = await addNotePictures({ t, api: t.api, item: itemRef.current, files, onProgress: (d) => setUploading((n) => Math.max(0, n + d)) });
      if (r.error) setError(r.error);
      else onSaved?.();
    },
    [t, onSaved],
  );

  const remove = async (path) => {
    setError(null);
    const problem = await removeNotePicture({ t, api: t.api, item: itemRef.current, path });
    if (problem) setError(problem);
    else onSaved?.();
  };

  const onPaste = (e) => {
    const files = imageFiles(e.clipboardData);
    if (!files.length) return; // plain text pastes as usual
    e.preventDefault();
    add(files);
  };

  const list = paths.map((p) => urls[p]).filter(Boolean);

  return (
    <div
      className={`notes-field${over ? ' is-over' : ''}${compact ? ' is-compact' : ''}`}
      onDragOver={(e) => {
        if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
      }}
      onDrop={(e) => {
        const files = imageFiles(e.dataTransfer);
        setOver(false);
        if (!files.length) return;
        e.preventDefault();
        add(files);
      }}
    >
      <TextDraftField
        item={item}
        field="notes"
        label={label}
        multiline
        autoFocus={autoFocus}
        placeholder="Anything the team should know. Paste a picture here too."
        onSaved={onSaved}
        onPaste={onPaste}
      >
        <div className="np-grid" aria-label="Notes pictures">
          {paths.map((p, i) => (
            <Frame key={p} url={urls[p]} size={size} alt={`Notes picture ${i + 1} of ${paths.length}`} onClick={() => setOpen(Math.max(list.indexOf(urls[p]), 0))}>
              <button type="button" className="np-remove" onClick={() => remove(p)} title="Remove picture">
                <IconX width={12} height={12} />
                <span className="sr-only">Remove picture {i + 1}</span>
              </button>
            </Frame>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <span key={`u${i}`} className="np-frame" style={{ width: size, height: size }} aria-hidden="true">
              <SkeletonBlock width={size} height={size} radius={8} />
            </span>
          ))}
          {room > 0 && (
            <button type="button" className="np-add" style={{ height: size }} onClick={() => inputRef.current?.click()} aria-describedby={`${id}-np-hint`}>
              <IconImage width={16} height={16} />
              <span>Add picture</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={NOTE_IMAGE_TYPES.join(',')}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              add(files);
            }}
          />
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="field-hint" id={`${id}-np-hint`}>
            {paths.length ? `${paths.length} of ${MAX_NOTE_IMAGES} pictures.` : `Up to ${MAX_NOTE_IMAGES} pictures, 2 MB each (JPG, PNG, WebP or GIF).`} A picture alone counts as filled.
          </p>
        )}
        {over && <p className="np-drop" aria-hidden="true">Drop to add the picture</p>}
      </TextDraftField>
      {open != null && list.length > 0 && <Lightbox urls={list} start={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
