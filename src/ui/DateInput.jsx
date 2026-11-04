import { useEffect, useRef, useState } from 'react';
import { formatWeekdayDate } from '../lib/time.js';

const plausible = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '2000-01-01' && v <= '2100-12-31';

/**
 * A date field that saves "immediately" without saving on every keystroke:
 * a picked (or fully typed) date saves after a short pause; blur or Enter saves at once.
 * Half-typed years (0002, 0020, …) never reach the database.
 *
 * variant="cell": compact table cell showing "Thu 5 Nov"; the native input sits on top
 * (invisible until keyboard-focused) so clicking opens the browser's date picker.
 */
export function DateInput({ value, onCommit, label, id, variant = 'field', invalid = false, describedBy }) {
  const [draft, setDraft] = useState(value ?? '');
  const timer = useRef(null);
  const committed = useRef(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
    committed.current = value ?? '';
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = async (v) => {
    clearTimeout(timer.current);
    if (v === committed.current) return;
    if (v && !plausible(v)) return;
    const before = committed.current;
    committed.current = v;
    const result = await onCommit(v || null);
    if (result?.error) {
      // the database said no: show the saved value again
      committed.current = before;
      setDraft(before);
    }
  };

  const input = (
    <input
      id={id}
      type="date"
      className={variant === 'field' ? 'input date-input mono' : 'date-cell-input'}
      value={draft}
      aria-label={label}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedBy}
      min="2000-01-01"
      max="2100-12-31"
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        clearTimeout(timer.current);
        if (plausible(v)) timer.current = setTimeout(() => commit(v), 650);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (variant === 'cell') e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(e.currentTarget.value);
        }
      }}
      onClick={(e) => {
        if (variant !== 'cell') return;
        e.stopPropagation();
        try {
          e.currentTarget.showPicker?.();
        } catch {
          /* not supported: the native control still works */
        }
      }}
    />
  );

  if (variant !== 'cell') return input;

  return (
    <span className="date-cell" onClick={(e) => e.stopPropagation()}>
      <span className="date-cell-text" aria-hidden="true">
        {draft ? <span className="mono">{formatWeekdayDate(draft)}</span> : <span className="dim">No date</span>}
      </span>
      {input}
    </span>
  );
}
