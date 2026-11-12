import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(() => () => {});
let seq = 0;

/**
 * Small toasts ("Content deleted"). The container is a manual popover so it sits
 * in the top layer, above an open drawer (a modal <dialog>) as well.
 *
 * toast(message, { tone, duration, action: { label, onClick } }) → dismiss()
 * A toast with an action (e.g. Undo after a calendar drag) stays clickable.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const ref = useRef(null);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, { tone = 'default', duration = 3500, action = null } = {}) => {
      const id = ++seq;
      setToasts((list) => [...list.slice(-3), { id, message, tone, action }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
      return () => dismiss(id);
    },
    [dismiss],
  );

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => clearTimeout(t));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== 'function') return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (toasts.length) el.showPopover(); // re-show so it stacks above anything opened since
    } catch {
      /* popover not supported: the fixed container still shows */
    }
  }, [toasts]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div ref={ref} popover="manual" className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}${t.action ? ' has-action' : ''}`}>
            <span className="toast-msg">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  dismiss(t.id);
                  t.action.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
