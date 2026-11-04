import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(() => {});
let seq = 0;

/**
 * Small toasts ("Content deleted"). The container is a manual popover so it sits
 * in the top layer, above an open drawer (a modal <dialog>) as well.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const ref = useRef(null);

  const toast = useCallback((message, { tone = 'default', duration = 3500 } = {}) => {
    const id = ++seq;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), duration);
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
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
