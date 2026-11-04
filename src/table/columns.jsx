import { createColumnHelper } from '@tanstack/react-table';
import { STATUS_ORDER } from '../lib/fields.js';
import { firstLink, referenceLines, safeHref, shortUrl } from '../lib/links.js';
import { NeedsPicBadge, RelativeTime, StatusPill, TypePill } from '../ui/bits.jsx';
import { DateInput } from '../ui/DateInput.jsx';
import { IconComment, IconExternal } from '../ui/icons.jsx';

const col = createColumnHelper();
const stop = (e) => e.stopPropagation();
const titleOf = (item) => item.content || 'Untitled';

function Empty() {
  return <span className="dim">—</span>;
}

function TextCell({ getValue }) {
  const v = getValue();
  return v ? <span className="cell-text">{v}</span> : <Empty />;
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
      <span className={`cell-text${item.content ? '' : ' dim'}`}>{titleOf(item)}</span>
      {!item.pic_id && !showPic && <NeedsPicBadge />}
    </button>
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

function ReferenceCell({ row }) {
  const text = row.original.reference;
  if (!text) return <Empty />;
  const link = firstLink(text);
  const more = referenceLines(text).length - 1;
  return (
    <span className="cell-ref">
      {link ? (
        <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={stop} className="cell-text">
          {shortUrl(link.value)}
        </a>
      ) : (
        <span className="cell-text">{referenceLines(text)[0]?.line}</span>
      )}
      {more > 0 && <span className="dim cell-more">+{more}</span>}
    </span>
  );
}

function InstagramCell({ row }) {
  const href = safeHref(row.original.instagram_url);
  if (!href) return <Empty />;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={stop} className="cell-ig">
      <span className="cell-text">{shortUrl(href)}</span>
      <IconExternal width={13} height={13} />
    </a>
  );
}

function PicCell({ row, getValue }) {
  if (!row.original.pic_id) return <NeedsPicBadge />;
  return <span className="cell-text">{getValue()}</span>;
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
 * widths from 09 §3 (Content 260, Brief/Caption/Notes 280, Reference/Uploaded 220, others 110–160);
 * the table grows to the full width and scrolls sideways below that.
 */
export function buildColumns({ showBrand, showPic, showPillars, brandName, personName }) {
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
    col.accessor('status', { id: 'status', header: 'Status', cell: ({ getValue }) => <StatusPill status={getValue()} />, sortingFn: statusSort, size: 124 }),
    col.accessor((r) => r.type ?? undefined, { id: 'type', header: 'Type', cell: TypeCell, sortUndefined: 'last', size: 116 }),
    col.accessor('brief', { id: 'brief', header: 'Brief', cell: TextCell, enableSorting: false, size: 280 }),
    col.accessor('caption', { id: 'caption', header: 'Caption', cell: TextCell, enableSorting: false, size: 280 }),
    col.accessor('notes', { id: 'notes', header: 'Notes', cell: TextCell, enableSorting: false, size: 280 }),
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
    col.accessor('instagram_url', { id: 'instagram', header: 'Uploaded content', cell: InstagramCell, enableSorting: false, size: 220 }),
    showPic &&
      col.accessor((r) => (r.pic_id ? personName(r.pic_id) : undefined), {
        id: 'pic',
        header: 'PIC',
        cell: PicCell,
        sortUndefined: 'last',
        size: 140,
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
