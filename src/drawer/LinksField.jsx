// "Links" (update v4, file 01): up to 5 links to any website, one input each, "+ Add link"
// until there are 5, a remove button on each, and "I posted this myself" under them.
//   - locked until every required field is filled (the hint names what's missing)
//   - each link must start with http:// or https:// (the database checks it too)
//   - not ticked → Done (Admin reviews it) · ticked → Uploaded right away
// The list saves as a whole when focus leaves the Links field (Enter too, and when the drawer
// closes), never on every keystroke. Moving between its own inputs, buttons and the checkbox
// doesn't save yet, so ticking "I posted this myself" right after typing the first link saves
// both together.
import { useEffect, useId, useRef, useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { friendlyError } from '../lib/errors.js';
import { lockHint, LINK_INVALID, LINKS_TOO_MANY, MAX_LINKS } from '../lib/fields.js';
import { cleanLinks, isWebLink, safeHref, shortLink } from '../lib/links.js';
import { IconExternal, IconPlus, IconX } from '../ui/icons.jsx';

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export function LinksField({ item, missing, onSaved }) {
  const t = useTracker();
  const id = useId();
  const server = item.links ?? [];
  const serverKey = server.join('\n');
  const [drafts, setDrafts] = useState(() => (server.length ? [...server] : ['']));
  const [selfDraft, setSelfDraft] = useState(Boolean(item.self_posted));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const focused = useRef(false);
  const fieldRef = useRef(null);
  const listRef = useRef(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const selfRef = useRef(selfDraft);
  selfRef.current = selfDraft;

  // a save of ours or a teammate's change: follow the server unless the person is typing here
  useEffect(() => {
    if (focused.current) return;
    setDrafts(serverKey ? serverKey.split('\n') : ['']);
    setError(null);
  }, [serverKey]);
  useEffect(() => setSelfDraft(Boolean(item.self_posted)), [item.self_posted]);

  const locked = server.length === 0 && missing.length > 0;
  const typed = cleanLinks(drafts);
  const showSelf = server.length > 0 || typed.length > 0;

  const serverRef = useRef(server);
  serverRef.current = server;
  const serverSelfRef = useRef(Boolean(item.self_posted));
  serverSelfRef.current = Boolean(item.self_posted);
  const savingRef = useRef(false);

  /**
   * Save what differs from the database: the links, and the "I posted this myself" choice
   * when it was just ticked (`withSelf`) or when the first links go in (they carry it).
   * Returns false when nothing was saved because of an error.
   */
  async function save(list = draftsRef.current, selfPosted = selfRef.current, withSelf = false) {
    const current = serverRef.current;
    const clean = cleanLinks(list);
    const linksChanged = !same(clean, current);
    const selfChanged = withSelf && selfPosted !== serverSelfRef.current;
    if (!linksChanged && !selfChanged) {
      setError(null);
      return true;
    }
    if (linksChanged && clean.some((l) => !isWebLink(l))) {
      setError(LINK_INVALID);
      return false;
    }
    if (linksChanged && clean.length > MAX_LINKS) {
      setError(LINKS_TOO_MANY);
      return false;
    }
    if (savingRef.current) return true;
    savingRef.current = true;
    setBusy(true);
    const patch = {};
    if (linksChanged) patch.links = clean;
    if (selfChanged || (linksChanged && current.length === 0 && clean.length > 0)) patch.self_posted = selfPosted;
    const r = await t.updateItem(item.id, patch);
    savingRef.current = false;
    setBusy(false);
    if (r.error) {
      setError(friendlyError(r.error));
      return false;
    }
    setError(null);
    onSaved?.();
    return true;
  }

  // closing the drawer (Esc) or maintenance taking over unmounts without a blur: save anyway
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(
    () => () => {
      if (!same(cleanLinks(draftsRef.current), serverRef.current)) saveRef.current();
    },
    [],
  );

  // focus anywhere in the field (inputs, buttons, the checkbox) counts as "editing the links";
  // leaving the field saves
  const enterField = () => {
    focused.current = true;
  };
  const leaveField = (e) => {
    if (fieldRef.current?.contains(e.relatedTarget)) return; // still inside the Links field
    focused.current = false;
    save();
  };

  async function toggleSelf(next) {
    setSelfDraft(next);
    // nothing typed and nothing saved: the choice waits for the first link
    if (serverRef.current.length === 0 && !cleanLinks(draftsRef.current).length) return;
    // otherwise save it now, together with any link that was being edited
    const ok = await save(draftsRef.current, next, true);
    if (!ok) setSelfDraft(serverSelfRef.current);
  }

  const addRow = () => {
    setDrafts((d) => [...d, '']);
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll('input[type="url"]');
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  const removeRow = (i) => {
    const next = drafts.filter((_, j) => j !== i);
    setDrafts(next.length ? next : ['']);
    save(next);
  };

  const hint = locked
    ? lockHint(missing)
    : server.length === 0
      ? 'Add the post or file link once it’s ready (Instagram, TikTok, YouTube, Drive…). Admin reviews it, unless you posted it yourself.'
      : null;

  return (
    <div ref={fieldRef} className={`field links-field${locked ? ' is-locked' : ''}`} onFocus={enterField} onBlur={leaveField}>
      <div className="field-top">
        <p className="field-label" id={`${id}-label`}>
          Links
        </p>
        {!locked && <span className="links-count mono">{Math.min(typed.length, MAX_LINKS)}/{MAX_LINKS}</span>}
      </div>
      <ul ref={listRef} className="links-list" aria-labelledby={`${id}-label`}>
        {drafts.map((value, i) => {
          const href = server.includes(value.trim()) ? safeHref(value) : null;
          return (
            <li key={i} className="links-row">
              <input
                className="input links-input"
                type="url"
                inputMode="url"
                value={value}
                disabled={locked || busy}
                placeholder={i === 0 ? 'https://…' : 'Another link'}
                aria-label={`Link ${i + 1}`}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
                onChange={(e) => setDrafts((d) => d.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
              {href && (
                <a className="icon-btn links-open" href={href} target="_blank" rel="noopener noreferrer" title={`Open ${shortLink(value)}`}>
                  <IconExternal width={14} height={14} />
                  <span className="sr-only">Open link {i + 1}</span>
                </a>
              )}
              {(drafts.length > 1 || value) && !locked && (
                <button type="button" className="icon-btn links-remove" onClick={() => removeRow(i)} disabled={busy} title="Remove this link">
                  <IconX width={14} height={14} />
                  <span className="sr-only">Remove link {i + 1}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {!locked && drafts.length < MAX_LINKS && (
        <button type="button" className="link-btn links-add" onClick={addRow} disabled={busy}>
          <IconPlus width={14} height={14} /> Add link
        </button>
      )}
      {showSelf && !locked && (
        <label className="check links-self">
          <input type="checkbox" checked={selfDraft} disabled={busy} onChange={(e) => toggleSelf(e.target.checked)} />
          <span className="check-box" aria-hidden="true" />
          <span>
            I posted this myself
            <span className="check-hint">{selfDraft ? 'Uploaded right away, no review needed.' : 'Not ticked: it goes to Admin as Done for review.'}</span>
          </span>
        </label>
      )}
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
