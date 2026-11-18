// Admin's review buttons (update v4, file 01). Wherever a Done item appears (drawer, table,
// status board card, calendar day list) Admin gets "Mark as Uploaded" and "Request revision".
// The database decides; these only send the step (see TrackerProvider: approveItem …).
import { useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { IconCheck, IconUndo } from '../ui/icons.jsx';

const stop = (e) => e.stopPropagation();

/** Nothing unless the person is Admin and the item is Done. `size`: 'sm' (cells, cards) or 'md'. */
export function ReviewButtons({ item, size = 'sm', className = '' }) {
  const t = useTracker();
  const [busy, setBusy] = useState(false);
  if (!t.isAdmin || item.status !== 'done') return null;
  const approve = async () => {
    setBusy(true);
    await t.approveItem(item);
    setBusy(false);
  };
  return (
    // a row or a card around these opens the item on click: keep these clicks to themselves
    <span className={`review-btns review-btns--${size} ${className}`} onClick={stop} onKeyDown={stop} onPointerDown={stop}>
      <button type="button" className="btn btn-sm btn-approve" onClick={approve} disabled={busy}>
        <IconCheck width={13} height={13} />
        {busy ? 'Saving…' : 'Mark as Uploaded'}
      </button>
      <button type="button" className="btn btn-sm btn-revise" onClick={() => t.requestRevision(item)} disabled={busy}>
        <IconUndo width={13} height={13} />
        Request revision
      </button>
    </span>
  );
}

/** Staff (or Admin) on a Revision item, after fixing it: back to Done for Admin. */
export function MarkDoneButton({ item, className = '' }) {
  const t = useTracker();
  const [busy, setBusy] = useState(false);
  if (item.status !== 'revision') return null;
  return (
    <button
      type="button"
      className={`btn btn-sm btn-revision ${className}`}
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        await t.markItemDone(item);
        setBusy(false);
      }}
    >
      <IconCheck width={13} height={13} />
      {busy ? 'Saving…' : 'Mark as Done'}
    </button>
  );
}
