import { useCallback, useMemo, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { useTracker } from '../data/TrackerProvider.jsx';
import { useMonth } from '../data/MonthContext.jsx';
import { useToast } from '../ui/Toast.jsx';
import { friendlyError } from '../lib/errors.js';
import { STATUS_LABELS, STATUS_ORDER, TYPE_LABELS } from '../lib/fields.js';
import { isInMonth, monthName } from '../lib/time.js';
import { buildColumns } from './columns.jsx';
import { IconPlus, IconSearch } from '../ui/icons.jsx';

const NO_PIC = '__none';

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

/** The content table (02 §2): month-scoped, filterable, sortable; click a row for the drawer. */
export function ContentTable({ view, items, onOpen, onCreate, openId }) {
  const t = useTracker();
  const toast = useToast();
  const { month } = useMonth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [brand, setBrand] = useState('');
  const [pic, setPic] = useState(''); // '' every PIC · NO_PIC needs a PIC · a person's id
  const [allMonths, setAllMonths] = useState(false);
  const [sorting, setSorting] = useState([{ id: 'publish_date', desc: false }]);

  const scoped = useMemo(
    () => (allMonths ? items : items.filter((i) => !i.publish_date || isInMonth(i.publish_date, month))),
    [items, allMonths, month],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return scoped.filter((i) => {
      if (status && i.status !== status) return false;
      if (type === 'none' ? i.type : type && i.type !== type) return false;
      if (brand && i.brand_id !== brand) return false;
      if (pic === NO_PIC ? i.pic_id : pic && i.pic_id !== pic) return false;
      if (q && !`${i.content ?? ''}\n${i.caption ?? ''}`.toLocaleLowerCase().includes(q)) return false;
      return true;
    });
  }, [scoped, query, status, type, brand, pic]);

  const filtersOn = Boolean(query || status || type || brand || pic);

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

  const picOptions = useMemo(() => {
    if (!view.showPic) return [];
    const ids = new Set([...t.team.filter((p) => p.is_active).map((p) => p.id), ...items.filter((i) => i.pic_id).map((i) => i.pic_id)]);
    const people = [...ids]
      .map((id) => [id, t.peopleById[id]?.display_name ?? 'Former member'])
      .sort((a, b) => a[1].localeCompare(b[1]));
    return items.some((i) => !i.pic_id) ? [...people, [NO_PIC, 'Needs a PIC']] : people;
  }, [view.showPic, t.team, t.peopleById, items]);

  const inlineSave = async (item, patch) => {
    const result = await t.updateItem(item.id, patch);
    if (result.error) toast(friendlyError(result.error), { tone: 'danger', duration: 6500 });
    return result;
  };

  const table = useReactTable({
    data: filtered,
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
  const clearFilters = () => {
    setQuery('');
    setStatus('');
    setType('');
    setBrand('');
    setPic('');
  };

  let empty = null;
  if (!rows.length) {
    if (filtersOn) {
      empty = (
        <div className="empty">
          <strong>Nothing matches these filters.</strong>
          <button type="button" className="link-btn" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      );
    } else if (allMonths) {
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
          {allMonths ? 'All months' : `${monthName(month)}, plus items with no date`} ·{' '}
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search content or caption"
          />
        </label>
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[['', 'All statuses'], ...STATUS_ORDER.map((s) => [s, STATUS_LABELS[s]])]}
        />
        <FilterSelect
          label="Type"
          value={type}
          onChange={setType}
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
            value={brand}
            onChange={setBrand}
            options={[['', 'All brands'], ...view.brandChoices.map((b) => [b.id, b.name])]}
          />
        )}
        {view.showPic && (
          <FilterSelect label="PIC" value={pic} onChange={setPic} options={[['', 'Every PIC'], ...picOptions]} />
        )}
        <label className="switch toolbar-switch">
          <input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} />
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
