import { useEffect, useRef, useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { useConfirm } from '../ui/Confirm.jsx';
import { friendlyError } from '../lib/errors.js';
import { Initial, RelativeTime, Spinner } from '../ui/bits.jsx';
import { IconTrash } from '../ui/icons.jsx';

const MAX = 4000;

/** A thread, newest at the bottom. No notifications; the count shows on the table row. */
export function CommentsTab({ item }) {
  const { api, me, isAdmin, addComment, deleteComment, onCommentEvent } = useTracker();
  const confirm = useConfirm();
  const [list, setList] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api.listComments(item.id).then((r) => {
      if (!alive) return;
      if (r.error) setLoadError(friendlyError(r.error));
      else setList(r.data ?? []);
    });
    return () => {
      alive = false;
    };
  }, [api, item.id]);

  // live: teammates' comments appear, deleted ones disappear
  useEffect(
    () =>
      onCommentEvent((event, row) => {
        if (event === 'INSERT' && row?.item_id === item.id) {
          setList((prev) => (prev && !prev.some((c) => c.id === row.id) ? [...prev, row] : prev));
        }
        if (event === 'DELETE' && row?.id) {
          setList((prev) => (prev ? prev.filter((c) => c.id !== row.id) : prev));
        }
      }),
    [onCommentEvent, item.id],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [list?.length]);

  async function post(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (text.length > MAX) {
      setError('Keep a comment under 4,000 characters.');
      return;
    }
    setBusy(true);
    const result = await addComment(item.id, text);
    setBusy(false);
    if (result.error) setError(friendlyError(result.error));
    else {
      setBody('');
      setError(null);
    }
  }

  async function remove(comment) {
    const ok = await confirm({ title: 'Delete this comment?', confirmLabel: 'Delete comment', tone: 'danger' });
    if (!ok) return;
    const result = await deleteComment(comment);
    if (result.error) setError(friendlyError(result.error));
  }

  return (
    <div className="comments">
      {loadError && (
        <p className="field-error" role="alert">
          {loadError}
        </p>
      )}
      {!list && !loadError && (
        <div className="loading-block">
          <Spinner label="Loading comments" /> Loading comments
        </div>
      )}
      {list && list.length === 0 && <p className="empty-line">No comments yet. Start the thread below.</p>}
      {list && list.length > 0 && (
        <ol className="thread">
          {list.map((c) => (
            <li key={c.id} className="comment">
              <div className="comment-head">
                <Initial name={c.author_name} className="initial-sm" />
                <span className="comment-name">{c.author_id === me ? 'You' : c.author_name || 'Someone'}</span>
                <RelativeTime value={c.created_at} className="comment-time" />
                {(c.author_id === me || isAdmin) && (
                  <button type="button" className="icon-btn comment-del" onClick={() => remove(c)} title="Delete comment">
                    <IconTrash width={14} height={14} />
                    <span className="sr-only">Delete comment</span>
                  </button>
                )}
              </div>
              <p className="comment-body">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      <div ref={endRef} />

      <form className="composer" onSubmit={post}>
        <label className="sr-only" htmlFor="comment-box">
          Write a comment
        </label>
        <textarea
          id="comment-box"
          className="textarea"
          rows={3}
          value={body}
          maxLength={MAX}
          placeholder="Write a comment"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) post(e);
          }}
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="composer-actions">
          <span className="composer-hint">Ctrl + Enter to post</span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>
            {busy ? 'Posting…' : 'Comment'}
          </button>
        </div>
      </form>
    </div>
  );
}
