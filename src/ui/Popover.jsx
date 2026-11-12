import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MARGIN = 8;

/**
 * A small panel anchored to an element (brand picker, "+N more", day list, menus).
 * Closes on Esc, outside click or resize; returns focus to the anchor on Esc.
 *
 * It renders into <body>, or into the modal <dialog> the anchor sits in (everything
 * outside an open modal dialog is inert, so a panel in <body> couldn't be used there).
 * `align="end"` lines its right edge up with the anchor's. `autoFocus={false}` leaves
 * focus where it is (a search box that owns the keyboard).
 */
export function Popover({ anchor, onClose, label, className = '', children, width = 260, align = 'start', autoFocus = true, role = 'dialog' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const host = anchor?.closest?.('dialog[open]') ?? document.body;

  const place = useCallback(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const h = ref.current.offsetHeight;
    const w = Math.min(width, window.innerWidth - MARGIN * 2);
    const wanted = align === 'end' ? a.right - w : a.left;
    const left = Math.min(Math.max(MARGIN, wanted), window.innerWidth - w - MARGIN);
    let top = a.bottom + 6;
    if (top + h > window.innerHeight - MARGIN && a.top - h - 6 > MARGIN) top = a.top - h - 6;
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - h - MARGIN));
    setPos({ top, left, width: w });
  }, [anchor, width, align]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  // content that loads or changes height (search results) keeps the panel on screen
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(place);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [place]);

  useEffect(() => {
    if (!autoFocus) return;
    const first = ref.current?.querySelector('[data-autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    first?.focus({ preventScroll: true });
    // focus once, when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault(); // inside a modal dialog: close this panel, not the dialog
        onClose();
        anchor?.focus?.();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, onClose, place]);

  return createPortal(
    <div
      ref={ref}
      className={`popover ${className}`}
      role={role}
      aria-label={label}
      style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden', top: 0, left: 0, width }}
    >
      {children}
    </div>,
    host,
  );
}
