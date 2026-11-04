import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { friendlyError } from '../lib/errors.js';
import { fieldLabel, TYPE_LABELS, TYPE_ORDER } from '../lib/fields.js';
import { DateInput } from '../ui/DateInput.jsx';
import { NeedsPicBadge, TypeIcon } from '../ui/bits.jsx';
import { useToast } from '../ui/Toast.jsx';

const norm = (v) => (v == null ? '' : String(v)).trim();

/** Label above, control, then a hint or the database's error right next to the field. */
export function Field({ id, label, hint, error, children, action }) {
  return (
    <div className="field">
      <div className="field-top">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function useAutosize(ref, value) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 360)}px`;
  }, [ref, value]);
}

/**
 * A text field that saves on blur, never on every keystroke (each save writes a
 * history entry). If a teammate changes this field while you're typing in it,
 * you get "Arum just changed Caption. Load their version?" instead of losing your text.
 */
export function TextDraftField({
  item,
  field,
  label,
  multiline = false,
  placeholder,
  hint,
  disabled = false,
  autoFocus = false,
  onSaved,
  children,
  inputMode,
  type = 'text',
}) {
  const { updateItem, me } = useTracker();
  const toast = useToast();
  const id = useId();
  const server = item[field] ?? '';
  const [draft, setDraft] = useState(server);
  const [conflict, setConflict] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const draftRef = useRef(draft);
  const focusedRef = useRef(false);
  const prevServer = useRef(server);
  const conflictRef = useRef(null);
  const saving = useRef(false);
  draftRef.current = draft;
  conflictRef.current = conflict;

  useAutosize(ref, draft);

  // the server value changed (our save, or a teammate's edit arriving live)
  useEffect(() => {
    if (prevServer.current === server) return;
    const before = prevServer.current;
    prevServer.current = server;
    const typing = focusedRef.current && norm(draftRef.current) !== norm(before);
    if (typing && norm(draftRef.current) !== norm(server)) {
      if (item.updated_by && item.updated_by !== me) {
        setConflict({ value: server, by: item.updated_by_name || 'Someone' });
      }
      return; // never overwrite what the person is typing
    }
    setDraft(server);
    setConflict(null);
  }, [server, item.updated_by, item.updated_by_name, me]);

  const commit = useCallback(async () => {
    const value = draftRef.current;
    if (norm(value) === norm(prevServer.current)) {
      setError(null);
      return;
    }
    if (saving.current) return;
    saving.current = true;
    const result = await updateItem(item.id, { [field]: norm(value) === '' ? null : value });
    saving.current = false;
    if (result.error) {
      setError(friendlyError(result.error));
    } else {
      setError(null);
      setConflict(null);
      onSaved?.();
    }
  }, [updateItem, item.id, field, onSaved]);

  // Closing the drawer (Esc) or switching tabs unmounts without a blur: save anyway,
  // unless a teammate's change is still waiting for an answer (then say so, overwrite nothing).
  // Only on a real unmount, so refs hold the latest values.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(
    () => () => {
      if (norm(draftRef.current) === norm(prevServer.current)) return;
      if (conflictRef.current) {
        toastRef.current(`Your ${fieldLabel(field)} edit wasn't saved: ${conflictRef.current.by} changed it first.`, {
          duration: 6000,
        });
        return;
      }
      commitRef.current();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const restore = () => {
    setDraft(prevServer.current);
    setError(null);
  };

  const loadTheirs = () => {
    draftRef.current = conflict.value;
    setDraft(conflict.value);
    setConflict(null);
  };

  const keepMine = () => {
    conflictRef.current = null;
    setConflict(null);
    commit(); // the person chose their version: save it now
  };

  // the banner's buttons must not blur the field (blur would save before the choice is made)
  const keepFocus = (e) => e.preventDefault();

  const common = {
    id,
    ref,
    value: draft,
    disabled,
    placeholder,
    'data-autofocus': autoFocus || undefined, // the drawer focuses this after opening
    inputMode,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    onChange: (e) => setDraft(e.target.value),
    onFocus: () => {
      focusedRef.current = true;
    },
    onBlur: () => {
      focusedRef.current = false;
      if (!conflictRef.current) commit(); // with a pending conflict, wait for the person's choice
    },
  };

  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      action={
        error ? (
          <button type="button" className="link-btn field-restore" onClick={restore}>
            Restore saved
          </button>
        ) : null
      }
    >
      {conflict && (
        <div className="conflict" role="alert">
          <p>
            {conflict.by} just changed {fieldLabel(field)}. Load their version?
          </p>
          <div className="conflict-actions">
            <button type="button" className="btn btn-secondary btn-sm" onMouseDown={keepFocus} onClick={loadTheirs}>
              Load their version
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onMouseDown={keepFocus} onClick={keepMine}>
              Keep mine
            </button>
          </div>
        </div>
      )}
      {multiline ? (
        <textarea className="textarea" rows={2} {...common} />
      ) : (
        <input
          className="input"
          type={type}
          {...common}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      )}
      {children}
    </Field>
  );
}

/** Dropdowns save immediately. */
export function SelectField({ item, field, label, options, placeholder, onSaved }) {
  const t = useTracker();
  const id = useId();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const value = item[field] ?? '';

  async function change(e) {
    const next = e.target.value || null;
    setBusy(true);
    const result = await t.updateItem(item.id, { [field]: next });
    setBusy(false);
    if (result.error) setError(friendlyError(result.error));
    else {
      setError(null);
      onSaved?.();
    }
  }

  return (
    <Field id={id} label={label} error={error}>
      <select
        id={id}
        className="select"
        value={value}
        onChange={change}
        disabled={busy}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Type as two radio pills (▶ Reels / ▦ Feed, icon + colour); saves immediately. */
export function TypeField({ item, onSaved }) {
  const t = useTracker();
  const id = useId();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function pick(type) {
    if (type === item.type || busy) return;
    setBusy(true);
    const result = await t.updateItem(item.id, { type });
    setBusy(false);
    if (result.error) setError(friendlyError(result.error));
    else {
      setError(null);
      onSaved?.();
    }
  }

  return (
    <div className="field">
      <p className="field-label" id={`${id}-label`}>
        Type
      </p>
      <div className="type-choice" role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-error` : undefined}>
        {TYPE_ORDER.map((type) => (
          <label key={type} className={`type-option type-option--${type}${item.type === type ? ' is-on' : ''}`}>
            <input
              type="radio"
              name={`${id}-type`}
              value={type}
              checked={item.type === type}
              disabled={busy}
              onChange={() => pick(type)}
            />
            <TypeIcon type={type} size={13} />
            {TYPE_LABELS[type]}
          </label>
        ))}
      </div>
      {!item.type && !error && <p className="field-hint">Choose Reels or Feed.</p>}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The PIC decides whose target an item counts toward (09 §6).
 * Admin: a dropdown of the tracker's active members. Staff: read-only.
 */
export function PicField({ item, onSaved }) {
  const t = useTracker();
  const id = useId();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const current = item.pic_id ? t.peopleById[item.pic_id] : null;
  const currentName = item.pic_id === t.me ? `${current?.display_name ?? 'You'} (you)` : current?.display_name ?? 'Former member';

  if (!t.isAdmin) {
    return (
      <div className="field">
        <p className="field-label">PIC</p>
        <p className="field-static">
          {item.pic_id ? currentName : <NeedsPicBadge />}
        </p>
        <p className="field-hint">The PIC is who this content counts for. Only Admin Beyondcy changes it.</p>
      </div>
    );
  }

  const members = t.membersOf(item.role_id);
  const formerPic = item.pic_id && !members.some((m) => m.id === item.pic_id);

  async function change(e) {
    const next = e.target.value || null;
    if (!next) return;
    setBusy(true);
    const result = await t.updateItem(item.id, { pic_id: next });
    setBusy(false);
    if (result.error) setError(friendlyError(result.error));
    else {
      setError(null);
      onSaved?.();
    }
  }

  return (
    <Field
      id={id}
      label="PIC"
      error={error}
      hint={item.pic_id ? 'Whose target this content counts toward.' : 'Needs a PIC: it counts toward no one until you choose.'}
    >
      <select
        id={id}
        className={`select${item.pic_id ? '' : ' needs-pic'}`}
        value={item.pic_id ?? ''}
        onChange={change}
        disabled={busy}
        aria-invalid={error || !item.pic_id ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
      >
        {!item.pic_id && <option value="">Choose a PIC</option>}
        {formerPic && (
          <option value={item.pic_id} disabled>
            {currentName} (no longer in this tracker)
          </option>
        )}
        {members.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Dates save as soon as a full date is picked or typed. */
export function DateField({ item, label, onSaved }) {
  const t = useTracker();
  const id = useId();
  const [error, setError] = useState(null);

  async function save(value) {
    const result = await t.updateItem(item.id, { publish_date: value });
    if (result.error) setError(friendlyError(result.error));
    else {
      setError(null);
      onSaved?.();
    }
    return result;
  }

  return (
    <Field id={id} label={label} error={error} hint={item.publish_date ? null : 'Leave empty while drafting: the item waits in the No date list.'}>
      <DateInput
        id={id}
        value={item.publish_date}
        onCommit={save}
        invalid={Boolean(error)}
        describedBy={error ? `${id}-error` : `${id}-hint`}
      />
    </Field>
  );
}

/** Homy8's content pillars: toggle chips, saved immediately. */
export function PillarChips({ item, options, onSaved }) {
  const t = useTracker();
  const id = useId();
  const [selected, setSelected] = useState(item.content_pillars ?? []);
  const [error, setError] = useState(null);

  useEffect(() => setSelected(item.content_pillars ?? []), [item.content_pillars]);

  async function toggle(name) {
    const before = selected;
    const next = before.includes(name) ? before.filter((n) => n !== name) : [...before, name];
    setSelected(next);
    const result = await t.updateItem(item.id, { content_pillars: next });
    if (result.error) {
      setSelected(before);
      setError(friendlyError(result.error));
    } else {
      setError(null);
      onSaved?.();
    }
  }

  return (
    <div className="field">
      <p className="field-label" id={id}>
        Content pillar
      </p>
      <div className="chips" role="group" aria-labelledby={id}>
        {options.map((name) => {
          const on = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              className={`chip-toggle${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(name)}
            >
              {name}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
