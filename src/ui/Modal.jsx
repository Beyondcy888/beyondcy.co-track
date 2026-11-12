import { useEffect, useRef } from 'react';

/**
 * A centred modal on a native <dialog>: focus moves in and is kept inside while it is open,
 * Esc / the backdrop / the close button close it, and focus returns to where it was.
 * It stacks above an open drawer or another modal (the browser's top layer).
 *
 * `sheet` makes it a full-screen sheet on phones (the project popup, file 06).
 * `dismissable={false}` ignores Esc and backdrop clicks (while saving).
 */
export function Modal({ onClose, labelledBy, describedBy, className = '', sheet = false, dismissable = true, children }) {
  const ref = useRef(null);
  const returnTo = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const canClose = useRef(dismissable);
  canClose.current = dismissable;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const focusFirst = dialog?.querySelector('[data-autofocus]');
    focusFirst?.focus({ preventScroll: true });
    return () => {
      const el = returnTo.current;
      if (el && el.isConnected) el.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal${sheet ? ' modal--sheet' : ''} ${className}`}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        if (canClose.current) onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current && canClose.current) onClose(); // the backdrop
      }}
    >
      <div className="modal-inner">{children}</div>
    </dialog>
  );
}
