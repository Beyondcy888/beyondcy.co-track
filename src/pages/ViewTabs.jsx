// The staff view switcher (update v4, file 03): one view at a time, like Notion's view tabs.
// Content plan · Calendar · Status board. Remembered per person and tracker page in
// localStorage (every read and write wrapped in try/catch). Admin keeps all three stacked.
import { useCallback, useRef, useState } from 'react';
import { IconCalendar, IconColumns, IconTable } from '../ui/icons.jsx';

export const VIEWS = [
  { key: 'table', label: 'Content plan', Icon: IconTable },
  { key: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { key: 'board', label: 'Status board', Icon: IconColumns },
];
const KEYS = VIEWS.map((v) => v.key);

function read(key) {
  try {
    const v = window.localStorage.getItem(key);
    return KEYS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: the choice just isn't remembered */
  }
}

/** [view, setView] remembered under `byc.view.<roleId>.<page>.<personId>`; default Content plan. */
export function useSavedView({ roleId, page, personId }) {
  const key = `byc.view.${roleId}.${page}.${personId}`;
  const [state, setState] = useState(() => ({ key, view: read(key) ?? 'table' }));
  // a different page or person: read that one's choice
  const view = state.key === key ? state.view : read(key) ?? 'table';
  const setView = useCallback(
    (next) => {
      setState({ key, view: next });
      write(key, next);
    },
    [key],
  );
  return [view, setView];
}

/** role="tablist" with arrow keys, Home and End; the active tab has a green underline. */
export function ViewTabs({ value, onChange, idBase = 'view' }) {
  const listRef = useRef(null);
  const focusTab = (key) => requestAnimationFrame(() => listRef.current?.querySelector(`#${idBase}-tab-${key}`)?.focus());
  const onKeyDown = (e) => {
    const i = KEYS.indexOf(value);
    let next = null;
    if (e.key === 'ArrowRight') next = KEYS[(i + 1) % KEYS.length];
    if (e.key === 'ArrowLeft') next = KEYS[(i + KEYS.length - 1) % KEYS.length];
    if (e.key === 'Home') next = KEYS[0];
    if (e.key === 'End') next = KEYS[KEYS.length - 1];
    if (next) {
      e.preventDefault();
      onChange(next);
      focusTab(next);
    }
  };
  return (
    <div ref={listRef} className="view-tabs" role="tablist" aria-label="View">
      {VIEWS.map(({ key, label, Icon }) => (
        <button
          key={key}
          id={`${idBase}-tab-${key}`}
          type="button"
          role="tab"
          className="view-tab"
          aria-selected={value === key}
          aria-controls={`${idBase}-panel-${key}`}
          tabIndex={value === key ? 0 : -1}
          onClick={() => onChange(key)}
          onKeyDown={onKeyDown}
        >
          <Icon width={16} height={16} />
          {label}
        </button>
      ))}
    </div>
  );
}
