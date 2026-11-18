import { useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { useConfirm } from '../ui/Confirm.jsx';
import { useToast } from '../ui/Toast.jsx';
import { useNow } from '../data/useNow.js';
import { friendlyError } from '../lib/errors.js';
import { fieldLabel, requiredFields } from '../lib/fields.js';
import { referenceLines } from '../lib/links.js';
import { dateOfTimestampWIB, formatDate, relativeTime } from '../lib/time.js';
import { NotesField } from '../notes/NotePictures.jsx';
import { MarkDoneButton, ReviewButtons } from '../review/ReviewActions.jsx';
import { RelativeTime } from '../ui/bits.jsx';
import { DateField, PicField, PillarChips, SelectField, TextDraftField, TypeField } from './FieldEditors.jsx';
import { LinksField } from './LinksField.jsx';
import { IconTrash, IconUndo } from '../ui/icons.jsx';

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

function checklistTitle({ item, required, missing, isAdmin }) {
  const done = required.length - missing.length;
  switch (item.status) {
    case 'uploaded':
      if (item.review_state === 'approved' && !item.self_posted) {
        return `Uploaded. Approved by ${item.reviewed_by_name || 'Admin'}${item.reviewed_at ? `, ${formatDate(dateOfTimestampWIB(item.reviewed_at))}` : ''}.`;
      }
      return 'Uploaded. Posted without review ("I posted this myself").';
    case 'done':
      return isAdmin ? 'Done. Waiting for your review.' : 'Done. Waiting for Admin’s review: nothing to do for now.';
    case 'revision':
      return 'Revision. Fix what Admin asked for, then press Mark as Done.';
    case 'planned':
      return 'Planned. Everything is filled; add the links once it’s ready.';
    default:
      return `Needed for Planned · ${done} of ${required.length}`;
  }
}

function Checklist({ item, required, missing, isAdmin }) {
  return (
    <div className={`checklist checklist-${item.status}`}>
      <p className="checklist-title">{checklistTitle({ item, required, missing, isAdmin })}</p>
      {item.status === 'not_started' && missing.length > 0 && (
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

/** Admin's note at the top of a Revision item, in dark blue (v4, file 01). */
function RevisionNote({ item }) {
  return (
    <section className="rv-box" aria-labelledby={`rv-${item.id}`}>
      <p className="rv-box-head" id={`rv-${item.id}`}>
        <IconUndo width={14} height={14} />
        <span>
          {item.revision_requested_by_name || 'Admin'} asked for a revision
          {item.revision_requested_at && (
            <>
              {' · '}
              <RelativeTime value={item.revision_requested_at} />
            </>
          )}
        </span>
      </p>
      {item.revision_note && <p className="rv-box-note">{item.revision_note}</p>}
      <div className="rv-box-foot">
        <span className="rv-box-hint">Fields stay editable. When it’s fixed, send it back to Admin.</span>
        <MarkDoneButton item={item} />
      </div>
    </section>
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
  const [movingBack, setMovingBack] = useState(false);
  const markSaved = () => setSavedHere(true);

  const pillars = t.pillarsByBrand[item.brand_id] ?? [];
  const required = requiredFields(pillars.length > 0);
  const missing = item.missing_fields ?? [];
  // delete: the creator, the PIC or Admin (09 §6)
  const canDelete = t.isAdmin || item.owner_id === t.me || item.pic_id === t.me;
  // brand choices: the page's (a brand page keeps its brand), or the item's tracker (dashboard)
  const brandChoices = view.brandChoices ?? t.brandsForRole(item.role_id);
  const owner =
    item.owner_id === t.me ? 'you' : t.peopleById[item.owner_id]?.display_name ?? 'a former member';
  // Admin's quiet way back: an Uploaded item that went through review (not self-posted)
  const canMoveBack = t.isAdmin && item.status === 'uploaded' && !item.self_posted && (item.links?.length ?? 0) > 0;

  async function remove() {
    setDeleteError(null);
    const ok = await confirm({
      title: 'Delete this content?',
      body: 'It disappears from the tracker for everyone, with its Notes pictures. A full copy stays in the activity log.',
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

  async function moveBack() {
    const ok = await confirm({
      title: 'Move back to Done?',
      body: 'It stops counting as uploaded and waits for your review again.',
      confirmLabel: 'Move back to Done',
    });
    if (!ok) return;
    setMovingBack(true);
    await t.moveBackToDone(item);
    setMovingBack(false);
  }

  return (
    <div className="details">
      {item.status === 'revision' && <RevisionNote item={item} />}
      {item.status === 'done' && t.isAdmin && (
        <section className="review-bar" aria-label="Review">
          <p className="review-bar-text">
            <strong>Waiting for your review.</strong> Check the links, then approve it or ask for changes.
          </p>
          <ReviewButtons item={item} size="md" />
        </section>
      )}

      <SaveState item={item} me={t.me} savedHere={savedHere} />
      <Checklist item={item} required={required} missing={missing} isAdmin={t.isAdmin} />

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
      <NotesField item={item} onSaved={markSaved} />
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
      <LinksField item={item} missing={missing} onSaved={markSaved} />
      {canMoveBack && (
        <p className="move-back">
          <button type="button" className="link-btn" onClick={moveBack} disabled={movingBack}>
            {movingBack ? 'Moving…' : 'Move back to Done'}
          </button>
          <span className="dim"> · for another review</span>
        </p>
      )}

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
