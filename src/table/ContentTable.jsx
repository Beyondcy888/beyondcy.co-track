import { useCallback, useMemo, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { useTracker } from '../data/TrackerProvider.jsx';
import { useMonth } from '../data/MonthContext.jsx';
import { useToast } from '../ui/Toast.jsx';
import { friendlyError } from '../lib/errors.js';
import { STATUS_LABELS, STATUS_ORDER, TYPE_LABELS } from '../lib/fields.js';
import { monthName } from '../lib/time.js';
import { NotesField } from '../notes/NotePictures.jsx';
import { PersonSelect } from '../people/PersonSelect.jsx';
import { Popover } from '../ui/Popover.jsx';
import { buildColumns } from './columns.jsx';
import { NO_PIC } from './useContentFilters.js';
import { IconPlus, IconSearch } from '../ui/icons.jsx';

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="filter">
      <span className="sr-only">{label}</span>
      <select className={`select filter-select${value ? ' is-set' : ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function HeaderCell({ header }) {
  const sortable = header.column.getCanSort();
  const dir = header.column.getIsSorted();
  const content = flexRender(header.column.columnDef.header, header.getContext());
  return (
    <th
      scope="col"
      className={`c-${header.column.id}`}
      aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {sortable ? (
        <button type="button" className="th-sort" onClick={header.column.getToggleSortingHandler()}>
          {content}
          <span className="sort-ind" aria-hidden="true">
            {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : ''}
          </span>
        </button>
      ) : (
        content
      )}
    </th>
  );
}

/** The small Notes editor a Notes cell opens (v4, 02 §2), so people don't have to open the drawer. */
function NotesPopover({ itemId, anchor, onClose }) {
  const t = useTracker();
  const item = t.itemsById.get(itemId);
  if (!item) return null;
  return (
    <Popover anchor={anchor} onClose={onClose} label={`Notes for ${item.content || 'Untitled'}`} width={380} className="notes-pop">
      <p className="popover-title notes-pop-title">{item.content || 'Untitled'}</p>
      <NotesField item={item} compact autoFocus />
    </Popover>
  );
}

/**
 * The content table (02 §2): the selected month plus items with no date, filterable,
 * sortable; click a row for the drawer. Text wraps and rows grow (v4, 02 §1).
 * `filters` comes from useContentFilters() on the page: the status board uses the same ones.
 * `items` are the page's items (for the PIC filter's list of people).
 */
export function ContentTable({ view, items, filters, onOpen, onCreate, openId }) {
  const t = useTracker();
  const toast = useToast();
  const { month } = useMonth();
  const f = filters;
  const [sorting, setSorting] = useState([{ id: 'publish_date', desc: false }]);
  const [notesPop, setNotesPop] = useState(null); // { itemId, anchor }

  const showPillars = view.brandChoices.some((b) => (t.pillarsByBrand[b.id] ?? []).length > 0);

  const columns = useMemo(
    () =>
      buildColumns({
        showBrand: view.showBrand,
        showPic: view.showPic,
        showPillars,
        isAdmin: t.isAdmin,
        brandName: (id) => t.brandsById[id]?.name ?? id,
        personName: (id) => t.peopleById[id]?.display_name ?? 'Former member',
      }),
    [view.showBrand, view.showPic, showPillars, t.isAdmin, t.brandsById, t.peopleById],
  );

  // PIC filter: photo + name for everyone active in the tracker or named on an item
  const picOptions = useMemo(() => {
    if (!view.showPic) return [];
    const ids = new Set([...t.team.filter((p) => p.is_active).map((p) => p.id), ...items.filter((i) => i.pic_id).map((i) => i.pic_id)]);
    const people = [...ids]
      .map((id) => ({ value: id, label: t.peopleById[id]?.display_name ?? 'Former member', personId: id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const options = [{ value: '', label: 'Every PIC' }, ...people];
    if (items.some((i) => !i.pic_id)) options.push({ value: NO_PIC, label: 'Needs a PIC', tone: 'warn' });
    return options;
  }, [view.showPic, t.team, t.peopleById, items]);

  const inlineSave = async (item, patch) => {
    const result = await t.updateItem(item.id, patch);
    if (result.error) toast(friendlyError(result.error), { tone: 'danger', duration: 6500 });
    return result;
  };

  const table = useReactTable({
    data: f.filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    meta: {
      onOpen,
      inlineSave,
      me: t.me,
      isAdmin: t.isAdmin,
      showPic: view.showPic,
      onEditNotes: (itemId, anchor) => setNotesPop({ itemId, anchor }),
    },
  });

  const rows = table.getRowModel().rows;

  // the sticky Content column gets an edge shadow once content scrolls under it
  const wrapRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback(() => setScrolled((wrapRef.current?.scrollLeft ?? 0) > 2), []);

  let empty = null;
  if (!rows.length) {
    if (f.on) {
      empty = (
        <div className="empty">
          <strong>Nothing matches these filters.</strong>
          <button type="button" className="link-btn" onClick={f.clear}>
            Clear filters
          </button>
        </div>
      );
    } else {
      empty = (
        <div className="empty">
          <strong>No content planned for {monthName(month)} yet.</strong>Add the first one with New content.
        </div>
      );
    }
  }

  return (
    <section className="content-section" aria-labelledby="content-title">
      <div className="section-head">
        <h2 id="content-title">Content</h2>
        <p className="section-meta">
          {monthName(month)}, plus items with no date · <span className="mono">{rows.length}</span> {rows.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      <div className="toolbar">
        <button type="button" className="btn btn-primary" onClick={(e) => onCreate(e.currentTarget)}>
          <IconPlus />
          New content
        </button>
        <label className="search">
          <IconSearch />
          <span className="sr-only">Search content or caption</span>
          <input
            type="search"
            value={f.query}
            onChange={(e) => f.setQuery(e.target.value)}
            placeholder="Search content or caption"
          />
        </label>
        <FilterSelect
          label="Status"
          value={f.status}
          onChange={f.setStatus}
          options={[['', 'All statuses'], ...STATUS_ORDER.map((s) => [s, STATUS_LABELS[s]])]}
        />
        <FilterSelect
          label="Type"
          value={f.type}
          onChange={f.setType}
          options={[
            ['', 'All types'],
            ['reels', `▶ ${TYPE_LABELS.reels}`],
            ['feed', `▦ ${TYPE_LABELS.feed}`],
            ['none', 'No type'],
          ]}
        />
        {view.showBrand && (
          <FilterSelect
            label="Brand"
            value={f.brand}
            onChange={f.setBrand}
            options={[['', 'All brands'], ...view.brandChoices.map((b) => [b.id, b.name])]}
          />
        )}
        {view.showPic && <PersonSelect label="PIC" value={f.pic} onChange={f.setPic} options={picOptions} />}
        {f.on && (
          <button type="button" className="link-btn toolbar-clear" onClick={f.clear}>
            Clear filters
          </button>
        )}
      </div>

      <div className="table-wrap content-table-wrap" ref={wrapRef} onScroll={onScroll} data-scrolled={scrolled}>
        <table className="table content-table" style={{ minWidth: table.getTotalSize() }}>
          <colgroup>
            {table.getVisibleLeafColumns().map((c) => (
              <col key={c.id} style={{ width: c.getSize() }} />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <HeaderCell key={header.id} header={header} />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                data-id={row.id}
                className={`row${row.id === openId ? ' is-open' : ''}${row.original.status === 'revision' ? ' is-revision' : ''}`}
                onClick={() => onOpen(row.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={`c-${cell.column.id}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {empty}
      </div>
      {notesPop && <NotesPopover itemId={notesPop.itemId} anchor={notesPop.anchor} onClose={() => setNotesPop(null)} />}
    </section>
  );
}
