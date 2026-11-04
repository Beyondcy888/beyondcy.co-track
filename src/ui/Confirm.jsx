import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

/**
 * confirm({ title, body, confirmLabel, tone }) → Promise<boolean>
 * A native modal <dialog>: focus is trapped, Esc cancels, and it stacks above an open drawer.
 */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const ref = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setRequest({ confirmLabel: 'Confirm', tone: 'default', ...options, resolve });
      }),
    [],
  );

  useEffect(() => {
    const dialog = ref.current;
    if (request && dialog && !dialog.open) dialog.showModal();
  }, [request]);

  const settle = (answer) => {
    request?.resolve(answer);
    ref.current?.close();
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <dialog
          ref={ref}
          className="confirm"
          aria-labelledby="confirm-title"
          aria-describedby={request.body ? 'confirm-body' : undefined}
          onCancel={(e) => {
            e.preventDefault();
            settle(false);
          }}
        >
          <h2 id="confirm-title" className="confirm-title">
            {request.title}
          </h2>
          {request.body && (
            <p id="confirm-body" className="confirm-body">
              {request.body}
            </p>
          )}
          <div className="confirm-actions">
            <button type="button" className="btn btn-secondary" onClick={() => settle(false)} autoFocus>
              Cancel
            </button>
            <button
              type="button"
              className={request.tone === 'danger' ? 'btn btn-danger-solid' : 'btn btn-primary'}
              onClick={() => settle(true)}
            >
              {request.confirmLabel}
            </button>
          </div>
        </dialog>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
