import { useCallback, useEffect, useRef, useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { friendlyError } from '../lib/errors.js';
import { describeActivity } from '../lib/history.js';
import { RelativeTime, Spinner } from '../ui/bits.jsx';

/** activity_log for this item, newest first, with expandable old → new values. */
export function HistoryTab({ item }) {
  const { api, brandsById, peopleById } = useTracker();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    const r = await api.listHistory(item.id);
    if (r.error) setError(friendlyError(r.error));
    else {
      setEntries(r.data ?? []);
      setError(null);
    }
    loaded.current = true;
  }, [api, item.id]);

  // reload when the item (or its comments) change; history is written by triggers
  useEffect(() => {
    const timer = setTimeout(load, loaded.current ? 500 : 0);
    return () => clearTimeout(timer);
  }, [load, item.updated_at, item.comment_count]);

  if (error) {
    return (
      <p className="field-error" role="alert">
        {error}
      </p>
    );
  }
  if (!entries) {
    return (
      <div className="loading-block">
        <Spinner label="Loading history" /> Loading history
      </div>
    );
  }
  if (!entries.length) return <p className="empty-line">No history yet.</p>;

  const ctx = {
    brandName: (id) => brandsById[id]?.name ?? id,
    personName: (id) => peopleById[id]?.display_name, // falls back to "Former member"
  };

  return (
    <ol className="history">
      {entries.map((entry) => {
        const d = describeActivity(entry, ctx);
        return (
          <li key={entry.id} className={`h-entry h-${entry.action}`}>
            <span className="h-dot" aria-hidden="true" />
            <div className="h-content">
              <p className="h-line">
                <strong>{d.actor}</strong> {d.text}
                <span className="h-time">
                  {' · '}
                  <RelativeTime value={entry.created_at} />
                </span>
              </p>
              {d.quote && <p className="h-quote">{d.quote}</p>}
              {entry.action === 'item_updated' && d.details.length > 0 && (
                <details className="h-details">
                  <summary>Show {d.details.length > 1 ? 'changes' : 'change'}</summary>
                  <dl>
                    {d.details.map((x) => (
                      <div key={x.field} className="h-change">
                        <dt>{x.label}</dt>
                        <dd>
                          <span className="h-old">{x.old}</span>
                          <span className="h-arrow" aria-label="changed to">
                            →
                          </span>
                          <span className="h-new">{x.new}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
