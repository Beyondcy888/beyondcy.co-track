// The status board (update v3, 05 §4): Not started · Planned · Uploaded.
// Display only: it shows where every piece of content stands. No dragging between columns
// (status changes by itself when fields and the Instagram link are filled); clicking a card
// opens the item. It shows the same items as the table on the page (same month, same filters).
import { useMemo, useState } from 'react';
import { useTracker } from '../data/TrackerProvider.jsx';
import { useToday } from '../data/useNow.js';
import { STATUS_LABELS, TYPE_LABELS } from '../lib/fields.js';
import { safeHref } from '../lib/links.js';
import { formatWeekdayDate } from '../lib/time.js';
import { boardColumns, isOverdueItem } from '../lib/week.js';
import { Person } from '../people/Avatar.jsx';
import { NeedsPicBadge, TypeIcon, TypePill } from '../ui/bits.jsx';
import { IconCalendar, IconComment, IconInstagram } from '../ui/icons.jsx';

const FIRST = 8;

const EMPTY_TEXT = {
  not_started: 'Nothing waiting to be filled in.',
  planned: 'Nothing ready to post yet.',
  uploaded: 'Nothing uploaded yet.',
};

function Card({ item, showBrand, onOpen, today, brandName }) {
  const title = item.content || 'Untitled';
  const overdue = isOverdueItem(item, today);
  const missing = item.missing_fields?.length ?? 0;
  const comments = item.comment_count ?? 0;
  const ig = item.status === 'uploaded' ? safeHref(item.instagram_url) : null;
  return (
    <li className={`bcard${overdue ? ' is-overdue' : ''}`}>
      {showBrand && <span className="bcard-brand truncate">{brandName(item.brand_id)}</span>}
      <button type="button" className="bcard-open" onClick={() => onOpen(item.id)}>
        <span className={`bcard-title${item.content ? '' : ' dim'}`}>{title}</span>
        <span className="sr-only">
          , {STATUS_LABELS[item.status]}
          {item.type ? `, ${TYPE_LABELS[item.type]}` : ''}
        </span>
      </button>
      <span className="bcard-mid">
        <span className="bcard-tags">
          {item.type ? <TypePill type={item.type} /> : <span className="bcard-notype">No type yet</span>}
          {overdue && <span className="bcard-tag bcard-tag--late">Overdue</span>}
        </span>
        <span className="bcard-who">{item.pic_id ? <Person id={item.pic_id} size={20} /> : <NeedsPicBadge />}</span>
      </span>
      <span className="bcard-foot">
        <span className={`bcard-date${item.publish_date ? '' : ' is-none'}`}>
          <IconCalendar width={13} height={13} />
          {item.publish_date ? <span className="mono">{formatWeekdayDate(item.publish_date)}</span> : 'No date'}
        </span>
        {item.status === 'not_started' && missing > 0 && (
          <span className="bcard-left">
            {missing} {missing === 1 ? 'field' : 'fields'} left
          </span>
        )}
        {comments > 0 && (
          <span className="bcard-comments" aria-label={`${comments} comment${comments === 1 ? '' : 's'}`}>
            <IconComment width={13} height={13} />
            <span className="mono">{comments}</span>
          </span>
        )}
        {ig && (
          <a className="bcard-ig" href={ig} target="_blank" rel="noopener noreferrer" title="Open the Instagram post">
            <IconInstagram width={15} height={15} />
            <span className="sr-only">Open the Instagram post for {title}</span>
          </a>
        )}
      </span>
    </li>
  );
}

function Column({ col, showBrand, onOpen, today, brandName, hint }) {
  const [all, setAll] = useState(false);
  const shown = all ? col.items : col.items.slice(0, FIRST);
  const rest = col.items.length - shown.length;
  const id = `bcol-${col.key}`;
  return (
    <section className={`bcol bcol--${col.key}`} aria-labelledby={id}>
      <header className="bcol-head">
        <h3 id={id} className="bcol-name">
          <span className="bcol-mark" aria-hidden="true" />
          {STATUS_LABELS[col.key]}
        </h3>
        <p className="bcol-count mono" aria-label={`${col.total} ${col.total === 1 ? 'item' : 'items'}`}>
          {col.total}
        </p>
        <p className="bcol-split">
          <span className="bcol-type">
            <TypeIcon type="reels" size={11} /> <span className="mono">{col.reels}</span> Reels
          </span>
          <span aria-hidden="true">·</span>
          <span className="bcol-type">
            <TypeIcon type="feed" size={11} /> <span className="mono">{col.feed}</span> Feed
          </span>
          {col.untyped > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="bcol-type bcol-type--none">
                <span className="mono">{col.untyped}</span> no type
              </span>
            </>
          )}
        </p>
        {hint}
      </header>

      {col.items.length ? (
        <ul className="bcol-cards">
          {shown.map((item) => (
            <Card key={item.id} item={item} showBrand={showBrand} onOpen={onOpen} today={today} brandName={brandName} />
          ))}
        </ul>
      ) : (
        <p className="bcol-empty">{EMPTY_TEXT[col.key]}</p>
      )}

      {(rest > 0 || all) && col.items.length > FIRST && (
        <button type="button" className="bcol-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show fewer' : `Show all ${col.items.length}`}
        </button>
      )}
    </section>
  );
}

/**
 * `items`: exactly what the table shows (month scope + filters). `progress`: the page's
 * { uploaded, target } for the month (the same numbers as the boxes), for the small
 * "12 of 20 target" hint on the Uploaded column; null while filters narrow the board.
 */
export function StatusBoard({ view, items, onOpen, filtersOn = false, onClearFilters, progress = null, scopeText }) {
  const t = useTracker();
  const today = useToday();
  const [mine, setMine] = useState(false);
  // "Mine only" on a team Master page, for the staff who have content of their own
  const canMine = view.showPic && !t.isAdmin;
  const list = useMemo(() => (canMine && mine ? items.filter((i) => i.pic_id === t.me) : items), [items, canMine, mine, t.me]);
  const columns = useMemo(() => boardColumns(list), [list]);
  const brandName = (id) => t.brandsById[id]?.name ?? id;

  return (
    <section className="board-section" aria-labelledby="board-title">
      <div className="section-head board-head">
        <h2 id="board-title">Status board</h2>
        <p className="section-meta">
          {scopeText} · <span className="mono">{list.length}</span> {list.length === 1 ? 'item' : 'items'}
          {filtersOn && (
            <>
              {' · filtered like the table · '}
              <button type="button" className="link-btn" onClick={onClearFilters}>
                Clear filters
              </button>
            </>
          )}
        </p>
        {canMine && (
          <label className="switch board-mine">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            Mine only
          </label>
        )}
      </div>

      <div className="board" role="group" aria-label="Content by status">
        {columns.map((col) => (
          <Column
            key={col.key}
            col={col}
            showBrand={view.showBrand}
            onOpen={onOpen}
            today={today}
            brandName={brandName}
            hint={
              col.key === 'uploaded' && progress && !(canMine && mine) ? (
                <p className="bcol-hint">
                  <span className="bcol-bar" aria-hidden="true">
                    <span style={{ width: `${Math.min((progress.uploaded / progress.target) * 100, 100)}%` }} />
                  </span>
                  <span>
                    <span className="mono">{progress.uploaded}</span> of <span className="mono">{progress.target}</span> target
                  </span>
                </p>
              ) : null
            }
          />
        ))}
      </div>
    </section>
  );
}
