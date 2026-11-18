// A Notes picture, large and centred on a dark backdrop (update v4, 02 §2): arrows between
// pictures (buttons and ← →), Esc or a click outside the picture closes it. A native modal
// <dialog>, so it stacks above an open drawer or popover and keeps focus inside.
import { useEffect, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconX } from '../ui/icons.jsx';

export function Lightbox({ urls, start = 0, onClose, label = 'Notes pictures' }) {
  const ref = useRef(null);
  const returnTo = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const [i, setI] = useState(Math.min(start, Math.max(urls.length - 1, 0)));
  const many = urls.length > 1;
  const go = (d) => setI((n) => (n + d + urls.length) % urls.length);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      const el = returnTo.current;
      if (el && el.isConnected) el.focus?.({ preventScroll: true });
    };
  }, []);

  if (!urls.length) return null;

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          go(1);
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(-1);
        }
      }}
      onClick={(e) => {
        // anywhere but the picture and the buttons closes it
        if (e.target === e.currentTarget || e.target.classList.contains('lightbox-stage')) onClose();
      }}
    >
      <div className="lightbox-stage">
        <img key={urls[i]} className="lightbox-img" src={urls[i]} alt={`Picture ${i + 1} of ${urls.length}`} />
      </div>
      <button type="button" className="lightbox-btn lightbox-close" onClick={onClose} autoFocus>
        <IconX width={20} height={20} />
        <span className="sr-only">Close</span>
      </button>
      {many && (
        <>
          <button type="button" className="lightbox-btn lightbox-prev" onClick={() => go(-1)}>
            <IconChevronLeft width={22} height={22} />
            <span className="sr-only">Previous picture</span>
          </button>
          <button type="button" className="lightbox-btn lightbox-next" onClick={() => go(1)}>
            <IconChevronRight width={22} height={22} />
            <span className="sr-only">Next picture</span>
          </button>
          <p className="lightbox-count mono" aria-live="polite">
            {i + 1} / {urls.length}
          </p>
        </>
      )}
    </dialog>
  );
}
