// A dropdown that can show people's photos (PIC filters and the PIC field: file 03).
// A native <select> can't show images, so this is a button + listbox with the same
// keyboard behaviour people expect: Enter/Space/↓ opens, ↑↓ Home End move, typing a
// letter jumps to a name, Enter picks, Esc closes and returns focus.
import { useCallback, useId, useRef, useState } from 'react';
import { Popover } from '../ui/Popover.jsx';
import { IconCheck } from '../ui/icons.jsx';
import { Avatar } from './Avatar.jsx';

/**
 * options: [{ value, label, personId?, tone?: 'warn', disabled?, hint? }]
 * `variant="filter"` looks like the toolbar's filter pills; "field" like a form select.
 */
export function PersonSelect({
  label,
  value,
  onChange,
  options,
  variant = 'filter',
  id,
  disabled = false,
  invalid = false,
  describedBy,
  className = '',
  width = 240,
}) {
  const listId = useId();
  const [anchor, setAnchor] = useState(null);
  const buttonRef = useRef(null);
  const typed = useRef({ text: '', at: 0 });
  const current = options.find((o) => o.value === value) ?? options[0];
  const close = useCallback(() => setAnchor(null), []);

  const pick = (option) => {
    if (option.disabled) return;
    close();
    buttonRef.current?.focus();
    if (option.value !== value) onChange(option.value);
  };

  const onListKey = (e) => {
    const items = [...e.currentTarget.querySelectorAll('[role="option"]:not(:disabled)')];
    const i = items.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = items[Math.min(i + 1, items.length - 1)];
    else if (e.key === 'ArrowUp') next = items[Math.max(i - 1, 0)];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    else if (e.key === 'Tab') {
      close();
      return;
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      typed.current = { text: now - typed.current.at > 700 ? e.key : typed.current.text + e.key, at: now };
      const q = typed.current.text.toLocaleLowerCase();
      next = items.find((el) => el.dataset.label?.toLocaleLowerCase().startsWith(q));
    }
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={`select pselect pselect--${variant}${value ? ' is-set' : ''}${current?.tone === 'warn' ? ' is-warn' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? listId : undefined}
        aria-label={`${label}: ${current?.label ?? ''}`}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !anchor) {
            e.preventDefault();
            setAnchor(e.currentTarget);
          }
        }}
      >
        {current?.personId && <Avatar id={current.personId} size={20} />}
        <span className="pselect-label truncate">{current?.label}</span>
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={close} label={label} width={Math.max(width, anchor.offsetWidth)} className="pselect-pop" role="presentation">
          <ul id={listId} className="pselect-list" role="listbox" aria-label={label} onKeyDown={onListKey}>
            {options.map((o) => (
              <li key={o.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  className={`menu-item pselect-option${o.tone === 'warn' ? ' is-warn' : ''}`}
                  aria-selected={o.value === value}
                  data-label={o.label}
                  data-autofocus={o.value === value ? '' : undefined}
                  disabled={o.disabled}
                  onClick={() => pick(o)}
                >
                  {o.personId ? <Avatar id={o.personId} size={20} /> : <span className="pselect-noavatar" aria-hidden="true" />}
                  <span className="pselect-option-text truncate">
                    {o.label}
                    {o.hint && <span className="pselect-hint"> {o.hint}</span>}
                  </span>
                  {o.value === value && <IconCheck width={14} height={14} className="pselect-tick" />}
                </button>
              </li>
            ))}
          </ul>
        </Popover>
      )}
    </>
  );
}
