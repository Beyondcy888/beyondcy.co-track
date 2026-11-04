import { useEffect, useRef, useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { formatWeekdayDate } from '../lib/time.js';
import { NeedsPicBadge, StatusPill } from '../ui/bits.jsx';
import { IconX } from '../ui/icons.jsx';
import { DetailsTab } from './DetailsTab.jsx';
import { CommentsTab } from './CommentsTab.jsx';
import { HistoryTab } from './HistoryTab.jsx';

const TABS = [
  ['details', 'Details'],
  ['comments', 'Comments'],
  ['history', 'History'],
];

/** Opens from the right (full screen on mobile): Details, Comments, History. */
export function ItemDrawer({ itemId, view, onClose, focusContent = false }) {
  const t = useTracker();
  const item = t.itemsById.get(itemId);
  const ref = useRef(null);
  // where focus goes back to on close: captured once, at first render, before the dialog takes focus
  const returnTo = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    if (focusContent) dialog?.querySelector('[data-autofocus]')?.focus();
    return () => {
      const el = returnTo.current;
      if (el && el.isConnected) el.focus?.({ preventScroll: true });
    };
    // open once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTabKey = (e) => {
    const i = TABS.findIndex(([k]) => k === tab);
    let next = null;
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length][0];
    if (e.key === 'ArrowLeft') next = TABS[(i + TABS.length - 1) % TABS.length][0];
    if (e.key === 'Home') next = TABS[0][0];
    if (e.key === 'End') next = TABS[TABS.length - 1][0];
    if (next) {
      e.preventDefault();
      setTab(next);
      requestAnimationFrame(() => ref.current?.querySelector(`#drawer-tab-${next}`)?.focus());
    }
  };

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby="drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose(); // the backdrop
      }}
    >
      <div className="drawer-inner">
        {!item ? (
          <div className="drawer-gone">
            <h2 id="drawer-title" className="drawer-title">
              Not available
            </h2>
            <p className="dim">This item is no longer available. It may have been deleted.</p>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <header className="drawer-head">
              <div className="drawer-top">
                <span className="drawer-badges">
                  <StatusPill status={item.status} />
                  {!item.pic_id && <NeedsPicBadge />}
                </span>
                <button type="button" className="icon-btn drawer-close" onClick={onClose}>
                  <IconX width={18} height={18} />
                  <span className="sr-only">Close</span>
                </button>
              </div>
              <h2 id="drawer-title" className={`drawer-title${item.content ? '' : ' dim'}`}>
                {item.content || 'Untitled'}
              </h2>
              <p className="drawer-sub">
                {t.brandsById[item.brand_id]?.name}
                {' · '}
                {item.publish_date ? <span className="mono">{formatWeekdayDate(item.publish_date)}</span> : 'No date'}
              </p>
              <div className="tabs" role="tablist" aria-label="Item sections">
                {TABS.map(([key, label]) => (
                  <button
                    key={key}
                    id={`drawer-tab-${key}`}
                    type="button"
                    role="tab"
                    className="tab"
                    aria-selected={tab === key}
                    aria-controls={`drawer-panel-${key}`}
                    tabIndex={tab === key ? 0 : -1}
                    onClick={() => setTab(key)}
                    onKeyDown={onTabKey}
                  >
                    {label}
                    {key === 'comments' && item.comment_count > 0 && (
                      <span className="badge tab-badge mono">{item.comment_count}</span>
                    )}
                  </button>
                ))}
              </div>
            </header>
            <div
              className="drawer-body"
              role="tabpanel"
              id={`drawer-panel-${tab}`}
              aria-labelledby={`drawer-tab-${tab}`}
            >
              {tab === 'details' && (
                <DetailsTab item={item} view={view} focusContent={focusContent} onDeleted={onClose} />
              )}
              {tab === 'comments' && <CommentsTab item={item} />}
              {tab === 'history' && <HistoryTab item={item} />}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
