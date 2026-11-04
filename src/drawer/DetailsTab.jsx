import { useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { useConfirm } from '../ui/Confirm.jsx';
import { useToast } from '../ui/Toast.jsx';
import { useNow } from '../data/useNow.js';
import { friendlyError } from '../lib/errors.js';
import { fieldLabel, lockHint, requiredFields } from '../lib/fields.js';
import { referenceLines, safeHref } from '../lib/links.js';
import { dateOfTimestampWIB, formatDate, relativeTime } from '../lib/time.js';
import { DateField, PicField, PillarChips, SelectField, TextDraftField, TypeField } from './FieldEditors.jsx';
import { IconExternal, IconTrash } from '../ui/icons.jsx';

function SaveState({ item, me, savedHere }) {
  const now = useNow(30000);
  const who = item.updated_by && item.updated_by === me ? 'you' : item.updated_by_name || 'someone';
  const rel = relativeTime(item.updated_at, now);
  const saved = savedHere && item.updated_by === me;
  return (
    <p className="save-state" aria-live="polite">
      {saved && <span className="save-ok">Saved · </span>}
      Edited by {who}
      {rel === 'just now' ? ' just now' : ` · ${rel}`}
    </p>
  );
}

function Checklist({ required, missing, status }) {
  const done = required.length - missing.length;
  let title;
  if (status === 'uploaded') title = 'Uploaded. Every field is filled and the post is live.';
  else if (!missing.length) title = 'Planned. Everything is filled; add the Instagram link once it’s posted.';
  else title = `Needed for Planned · ${done} of ${required.length}`;
  return (
    <div className={`checklist checklist-${status}`}>
      <p className="checklist-title">{title}</p>
      {status !== 'uploaded' && missing.length > 0 && (
        <ul className="checklist-items">
          {required.map((f) => {
            const isMissing = missing.includes(f);
            return (
              <li key={f} className={isMissing ? 'is-missing' : 'is-done'}>
                <span className="cl-dot" aria-hidden="true" />
                {fieldLabel(f)}
                <span className="sr-only">{isMissing ? ' (missing)' : ' (filled)'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReferenceLinks({ text }) {
  const lines = referenceLines(text);
  if (!lines.length) return null;
  return (
    <ul className="ref-links">
      {lines.map((l, i) => (
        <li key={i}>
          {l.parts.map((p, j) =>
            p.type === 'link' ? (
              <a key={j} href={p.href} target="_blank" rel="noopener noreferrer">
                {p.value}
              </a>
            ) : (
              <span key={j}>{p.value}</span>
            ),
          )}
        </li>
      ))}
    </ul>
  );
}

export function DetailsTab({ item, view, focusContent, onDeleted }) {
  const t = useTracker();
  const confirm = useConfirm();
  const toast = useToast();
  const [savedHere, setSavedHere] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const markSaved = () => setSavedHere(true);

  const pillars = t.pillarsByBrand[item.brand_id] ?? [];
  const required = requiredFields(pillars.length > 0);
  const missing = item.missing_fields ?? [];
  const locked = !item.instagram_url && missing.length > 0;
  // delete: the creator, the PIC or Admin (09 §6)
  const canDelete = t.isAdmin || item.owner_id === t.me || item.pic_id === t.me;
  // brand choices: the page's (a brand page keeps its brand), or the item's tracker (dashboard)
  const brandChoices = view.brandChoices ?? t.brandsForRole(item.role_id);
  const owner =
    item.owner_id === t.me ? 'you' : t.peopleById[item.owner_id]?.display_name ?? 'a former member';
  const igHref = safeHref(item.instagram_url);

  async function remove() {
    setDeleteError(null);
    const ok = await confirm({
      title: 'Delete this content?',
      body: 'It disappears from the tracker for everyone. A full copy stays in the activity log.',
      confirmLabel: 'Delete content',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await t.deleteItem(item.id);
    if (result.error) {
      setDeleteError(friendlyError(result.error));
      return;
    }
    onDeleted();
    toast('Content deleted');
  }

  return (
    <div className="details">
      <SaveState item={item} me={t.me} savedHere={savedHere} />
      <Checklist required={required} missing={missing} status={item.status} />

      <TextDraftField
        item={item}
        field="content"
        label="Content"
        placeholder="A short title"
        autoFocus={focusContent}
        onSaved={markSaved}
      />
      {view.showBrand && brandChoices.length > 1 && (
        <SelectField
          item={item}
          field="brand_id"
          label="Brand"
          options={brandChoices.map((b) => [b.id, b.name])}
          onSaved={markSaved}
        />
      )}
      <PicField item={item} onSaved={markSaved} />
      <TypeField item={item} onSaved={markSaved} />
      <TextDraftField item={item} field="brief" label="Brief" multiline placeholder="What is this post about?" onSaved={markSaved} />
      <TextDraftField item={item} field="caption" label="Caption" multiline placeholder="The caption as it will be posted" onSaved={markSaved} />
      <TextDraftField item={item} field="notes" label="Notes" multiline placeholder="Anything the team should know" onSaved={markSaved} />
      <DateField item={item} label="Publish date" onSaved={markSaved} />
      <TextDraftField
        item={item}
        field="reference"
        label="Reference"
        multiline
        placeholder="One link per line (Pinterest, Google Maps, …)"
        onSaved={markSaved}
      >
        <ReferenceLinks text={item.reference} />
      </TextDraftField>
      {pillars.length > 0 && <PillarChips item={item} options={pillars} onSaved={markSaved} />}
      <TextDraftField
        item={item}
        field="instagram_url"
        label="Uploaded content"
        type="url"
        inputMode="url"
        placeholder="https://www.instagram.com/p/…"
        disabled={locked}
        hint={locked ? lockHint(missing) : item.instagram_url ? null : 'Paste the Instagram post link once it’s live. Removing it moves the item back to Planned.'}
        onSaved={markSaved}
      >
        {igHref && (
          <a className="field-link" href={igHref} target="_blank" rel="noopener noreferrer">
            Open on Instagram <IconExternal width={13} height={13} />
          </a>
        )}
      </TextDraftField>

      <footer className="details-foot">
        <p className="dim">
          Created by {owner} on {formatDate(dateOfTimestampWIB(item.created_at))}
        </p>
        {canDelete && (
          <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
            <IconTrash width={14} height={14} />
            Delete content
          </button>
        )}
      </footer>
      {deleteError && (
        <p className="field-error" role="alert">
          {deleteError}
        </p>
      )}
    </div>
  );
}
