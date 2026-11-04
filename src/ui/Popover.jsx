import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MARGIN = 8;

/**
 * A small panel anchored to an element (brand picker, "+N more", day list).
 * Closes on Esc, outside click or resize; returns focus to the anchor on Esc.
 */
export function Popover({ anchor, onClose, label, className = '', children, width = 260 }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const h = ref.current.offsetHeight;
    const w = Math.min(width, window.innerWidth - MARGIN * 2);
    let left = Math.min(Math.max(MARGIN, a.left), window.innerWidth - w - MARGIN);
    let top = a.bottom + 6;
    if (top + h > window.innerHeight - MARGIN && a.top - h - 6 > MARGIN) top = a.top - h - 6;
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - h - MARGIN));
    setPos({ top, left, width: w });
  }, [anchor, width]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    const first = ref.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    first?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        anchor?.focus?.();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, onClose, place]);

  return createPortal(
    <div
      ref={ref}
      className={`popover ${className}`}
      role="dialog"
      aria-label={label}
      style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden', top: 0, left: 0, width }}
    >
      {children}
    </div>,
    document.body,
  );
}
