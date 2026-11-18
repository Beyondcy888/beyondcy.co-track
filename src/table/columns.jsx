import { createColumnHelper } from '@tanstack/react-table';
import { STATUS_ORDER } from '../lib/fields.js';
import { referenceLines, safeHref, shortLink } from '../lib/links.js';
import { NoteThumbs } from '../notes/NotePictures.jsx';
import { Person } from '../people/Avatar.jsx';
import { ReviewButtons } from '../review/ReviewActions.jsx';
import { NeedsPicBadge, RelativeTime, StatusPill, TypePill } from '../ui/bits.jsx';
import { DateInput } from '../ui/DateInput.jsx';
import { IconComment, IconImage } from '../ui/icons.jsx';

const col = createColumnHelper();
const stop = (e) => e.stopPropagation();
const titleOf = (item) => item.content || 'Untitled';

function Empty() {
  return <span className="dim">—</span>;
}

/** Text wraps and keeps the line breaks people typed (v4, 02 §1): rows grow like Google Sheets. */
function TextCell({ getValue }) {
  const v = getValue();
  return v ? <span className="cell-text cell-wrap">{v}</span> : <Empty />;
}

function ContentCell({ row, table }) {
  const item = row.original;
  const { onOpen, showPic } = table.options.meta;
  return (
    <button
      type="button"
      className="row-open"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item.id);
      }}
    >
      <span className={`cell-text cell-wrap${item.content ? '' : ' dim'}`}>{titleOf(item)}</span>
      {!item.pic_id && !showPic && <NeedsPicBadge />}
    </button>
  );
}

/** The status pill; on Done content Admin also gets the two review buttons (v4, file 01). */
function StatusCell({ row, table }) {
  const item = row.original;
  const { isAdmin } = table.options.meta;
  return (
    <span className="status-cell">
      <StatusPill status={item.status} />
      {item.status === 'done' && !isAdmin && <span className="status-sub">Waiting for review</span>}
      {item.status === 'revision' && item.revision_note && (
        <span className="status-sub status-sub--revision" title={item.revision_note}>
          {item.revision_note}
        </span>
      )}
      {isAdmin && <ReviewButtons item={item} size="sm" className="status-review" />}
    </span>
  );
}

/** ▶ Reels / ▦ Feed as a pill; the native select sits invisibly on top for the inline edit. */
function TypeCell({ row, table }) {
  const item = row.original;
  const { inlineSave } = table.options.meta;
  return (
    <span className="type-cell" onClick={stop}>
      <span className="type-cell-face" aria-hidden="true">
        <TypePill type={item.type} />
      </span>
      <select
        className="type-cell-select"
        value={item.type ?? ''}
        aria-label={`Type for ${titleOf(item)}`}
        onClick={stop}
        onKeyDown={stop}
        onChange={(e) => inlineSave(item, { type: e.target.value || null })}
      >
        {!item.type && <option value="">—</option>}
        <option value="reels">▶ Reels</option>
        <option value="feed">▦ Feed</option>
      </select>
    </span>
  );
}

function DateCell({ row, table }) {
  const item = row.original;
  const { inlineSave } = table.options.meta;
  return (
    <DateInput
      variant="cell"
      value={item.publish_date}
      label={`Publish date for ${titleOf(item)}`}
      onCommit={(v) => inlineSave(item, { publish_date: v })}
    />
  );
}

/** Text and pictures (v4, 02 §2). A click opens the small Notes editor; a thumbnail opens the lightbox. */
function NotesCell({ row, table }) {
  const item = row.original;
  const { onEditNotes } = table.options.meta;
  const pictures = item.note_images?.length ?? 0;
  return (
    <div className="notes-cell">
      <button
        type="button"
        className="notes-cell-open"
        onClick={(e) => {
          e.stopPropagation();
          onEditNotes(item.id, e.currentTarget);
        }}
        aria-label={`Edit Notes for ${titleOf(item)}${pictures ? `, ${pictures} picture${pictures === 1 ? '' : 's'}` : ''}`}
      >
        {item.notes ? <span className="cell-text cell-wrap">{item.notes}</span> : !pictures ? <Empty /> : null}
        {!item.notes && pictures > 0 && (
          <span className="notes-cell-pics-only">
            <IconImage width={13} height={13} />
            {pictures === 1 ? '1 picture' : `${pictures} pictures`}
          </span>
        )}
      </button>
      {pictures > 0 && <NoteThumbs item={item} size={36} />}
    </div>
  );
}

/** Every reference line, links clickable, wrapped (v4, 02 §1: nothing cut off). */
function ReferenceCell({ row }) {
  const lines = referenceLines(row.original.reference);
  if (!lines.length) return <Empty />;
  return (
    <span className="cell-ref cell-wrap">
      {lines.map((l, i) => (
        <span key={i} className="cell-ref-line">
          {l.parts.map((p, j) =>
            p.type === 'link' ? (
              <a key={j} href={p.href} target="_blank" rel="noopener noreferrer" onClick={stop}>
                {shortLink(p.value, 40)}
              </a>
            ) : (
              <span key={j}>{p.value}</span>
            ),
          )}
        </span>
      ))}
    </span>
  );
}

/** Up to 5 links, each on its own line as a short label (domain + start of path), new tab. */
function LinksCell({ row }) {
  const links = row.original.links ?? [];
  if (!links.length) return <Empty />;
  return (
    <span className="cell-links">
      {links.map((link) => {
        const href = safeHref(link);
        return href ? (
          <a key={link} href={href} target="_blank" rel="noopener noreferrer" onClick={stop} title={link}>
            {shortLink(link)}
          </a>
        ) : null;
      })}
    </span>
  );
}

function PicCell({ row, getValue }) {
  if (!row.original.pic_id) return <NeedsPicBadge />;
  return <Person id={row.original.pic_id} name={getValue()} size={20} className="cell-person" />;
}

function EditedCell({ row, table }) {
  const item = row.original;
  const { me } = table.options.meta;
  const who = item.updated_by && item.updated_by === me ? 'you' : item.updated_by_name || 'someone';
  return (
    <span className="cell-text cell-edited">
      {who} · <RelativeTime value={item.updated_at} />
    </span>
  );
}

function CommentsCell({ row }) {
  const n = row.original.comment_count ?? 0;
  if (!n) return <span className="sr-only">No comments</span>;
  return (
    <span className="badge" aria-label={`${n} comment${n === 1 ? '' : 's'}`}>
      <IconComment width={12} height={12} />
      <span className="mono">{n}</span>
    </span>
  );
}

const statusSort = (a, b, id) => STATUS_ORDER.indexOf(a.getValue(id)) - STATUS_ORDER.indexOf(b.getValue(id));

/**
 * Columns in the spec's order (02 §2); some only on certain pages. Sizes are the minimum
 * widths from 09 §3 (Content 260, Brief/Caption/Notes 280, Reference/Links 220, others 110–160);
 * the table grows to the full width and scrolls sideways below that. Admin's Status column is
 * wider: it holds the review buttons on Done content (v4).
 */
export function buildColumns({ showBrand, showPic, showPillars, brandName, personName, isAdmin = false }) {
  return [
    col.accessor((r) => (r.content ?? '').toLocaleLowerCase(), {
      id: 'content',
      header: 'Content',
      cell: ContentCell,
      size: 260,
    }),
    showBrand &&
      col.accessor((r) => brandName(r.brand_id), {
        id: 'brand',
        header: 'Brand',
        cell: TextCell,
        size: 140,
      }),
    col.accessor('status', { id: 'status', header: 'Status', cell: StatusCell, sortingFn: statusSort, size: isAdmin ? 176 : 150 }),
    col.accessor((r) => r.type ?? undefined, { id: 'type', header: 'Type', cell: TypeCell, sortUndefined: 'last', size: 116 }),
    col.accessor('brief', { id: 'brief', header: 'Brief', cell: TextCell, enableSorting: false, size: 280 }),
    col.accessor('caption', { id: 'caption', header: 'Caption', cell: TextCell, enableSorting: false, size: 280 }),
    col.accessor('notes', { id: 'notes', header: 'Notes', cell: NotesCell, enableSorting: false, size: 280 }),
    col.accessor((r) => r.publish_date ?? undefined, {
      id: 'publish_date',
      header: 'Publish date',
      cell: DateCell,
      sortUndefined: 'last',
      size: 136,
    }),
    col.accessor('reference', { id: 'reference', header: 'Reference', cell: ReferenceCell, enableSorting: false, size: 220 }),
    showPillars &&
      col.accessor((r) => (r.content_pillars ?? []).join(', '), {
        id: 'pillars',
        header: 'Content pillar',
        cell: TextCell,
        enableSorting: false,
        size: 160,
      }),
    col.accessor((r) => r.links ?? [], { id: 'links', header: 'Links', cell: LinksCell, enableSorting: false, size: 220 }),
    showPic &&
      col.accessor((r) => (r.pic_id ? personName(r.pic_id) : undefined), {
        id: 'pic',
        header: 'PIC',
        cell: PicCell,
        sortUndefined: 'last',
        size: 156,
      }),
    col.accessor((r) => r.updated_at, { id: 'updated', header: 'Last edited', cell: EditedCell, size: 160 }),
    col.accessor((r) => r.comment_count ?? 0, {
      id: 'comments',
      header: () => (
        <span title="Comments">
          <IconComment width={14} height={14} />
          <span className="sr-only">Comments</span>
        </span>
      ),
      cell: CommentsCell,
      size: 72,
    }),
  ].filter(Boolean);
}
