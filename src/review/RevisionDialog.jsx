// "Request revision" (update v4, file 01): a small centred dialog with a REQUIRED note.
// On save the item goes from Done to Revision, and the note shows at the top of its drawer.
import { useId, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { IconX } from '../ui/icons.jsx';

const MAX = 2000;

/** `onSubmit(note)` resolves to null (saved) or the message to show. */
export function RevisionDialog({ item, picName, onSubmit, onClose }) {
  const id = useId();
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const title = item.content || 'Untitled';

  async function submit(e) {
    e.preventDefault();
    const text = note.trim();
    if (!text) {
      setError('Write what needs to change before asking for a revision.');
      return;
    }
    setBusy(true);
    const problem = await onSubmit(text);
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy={`${id}-title`} describedBy={`${id}-sub`} className="rv-dialog" dismissable={!busy}>
      <form onSubmit={submit} noValidate>
        <header className="modal-head">
          <h2 id={`${id}-title`} className="modal-title">
            Request a revision
          </h2>
          <button type="button" className="icon-btn modal-close" onClick={onClose} disabled={busy}>
            <IconX width={18} height={18} />
            <span className="sr-only">Cancel</span>
          </button>
        </header>
        <div className="rv-body">
          <p id={`${id}-sub`} className="rv-sub">
            <span className="rv-item">{title}</span> goes back to {picName || 'its PIC'} with your note. It shows at the top of the item.
          </p>
          <label className="field-label" htmlFor={`${id}-note`}>
            What needs to change?
          </label>
          <textarea
            id={`${id}-note`}
            className="textarea rv-note"
            rows={4}
            maxLength={MAX}
            required
            aria-required="true"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            data-autofocus
            value={note}
            placeholder="e.g. Cut the first 3 seconds, and show the logo at the end"
            onChange={(e) => {
              setNote(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
            }}
          />
          {error && (
            <p className="field-error" id={`${id}-error`} role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-revision" disabled={busy || !note.trim()}>
            {busy ? 'Sending…' : 'Request revision'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
