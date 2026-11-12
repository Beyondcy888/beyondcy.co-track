import { useCallback, useMemo, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { useTracker } from '../data/TrackerProvider.jsx';
import { useMonth } from '../data/MonthContext.jsx';
import { useToast } from '../ui/Toast.jsx';
import { friendlyError } from '../lib/errors.js';
import { STATUS_LABELS, STATUS_ORDER, TYPE_LABELS } from '../lib/fields.js';
import { monthName } from '../lib/time.js';
import { PersonSelect } from '../people/PersonSelect.jsx';
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

/**
 * The content table (02 §2): month-scoped, filterable, sortable; click a row for the drawer.
 * `filters` comes from useContentFilters() on the page: the status board uses the same ones.
 * `items` are the page's items (for the PIC filter's list of people).
 */
export function ContentTable({ view, items, filters, onOpen, onCreate, openId }) {
  const t = useTracker();
  const toast = useToast();
  const { month } = useMonth();
  const f = filters;
  const [sorting, setSorting] = useState([{ id: 'publish_date', desc: false }]);

  const showPillars = view.brandChoices.some((b) => (t.pillarsByBrand[b.id] ?? []).length > 0);

  const columns = useMemo(
    () =>
      buildColumns({
        showBrand: view.showBrand,
        showPic: view.showPic,
        showPillars,
        brandName: (id) => t.brandsById[id]?.name ?? id,
        personName: (id) => t.peopleById[id]?.display_name ?? 'Former member',
      }),
    [view.showBrand, view.showPic, showPillars, t.brandsById, t.peopleById],
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
    meta: { onOpen, inlineSave, me: t.me, showPic: view.showPic },
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
    } else if (f.allMonths) {
      empty = (
        <div className="empty">
          <strong>No content yet.</strong>Add the first one with New content.
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
          {f.allMonths ? 'All months' : `${monthName(month)}, plus items with no date`} ·{' '}
          <span className="mono">{rows.length}</span> {rows.length === 1 ? 'item' : 'items'}
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
        <label className="switch toolbar-switch">
          <input type="checkbox" checked={f.allMonths} onChange={(e) => f.setAllMonths(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          Show all months
        </label>
      </div>

      <div className="table-wrap" ref={wrapRef} onScroll={onScroll} data-scrolled={scrolled}>
        <table className="table" style={{ minWidth: table.getTotalSize() }}>
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
                className={`row${row.id === openId ? ' is-open' : ''}`}
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
    </section>
  );
}
