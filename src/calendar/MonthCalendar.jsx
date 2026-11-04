import { useMemo, useState } from 'react';
import { useMonth } from '../data/MonthContext.jsx';
import { useToday } from '../data/useNow.js';
import { useMediaQuery } from '../data/useMediaQuery.js';
import { brandShort, STATUS_LABELS, TYPE_LABELS } from '../lib/fields.js';
import { calendarWeeks, formatLongDate, isInMonth, monthLabel, WEEKDAYS_SHORT } from '../lib/time.js';
import { Popover } from '../ui/Popover.jsx';
import { StatusMark, TypeIcon } from '../ui/bits.jsx';
import { IconPlus } from '../ui/icons.jsx';

const MAX_CHIPS = 3;

/** "▶ Beefix · Promo video" with its status marker (shape + colour) and the type icon. */
function Chip({ item, onOpen, brandName }) {
  const brand = brandName?.(item.brand_id);
  const words = [item.type ? TYPE_LABELS[item.type] : 'No type', brand, item.content || 'Untitled'].filter(Boolean);
  return (
    <button type="button" className="chip" onClick={() => onOpen(item.id)} title={words.join(' · ')}>
      <StatusMark status={item.status} />
      {item.type ? <TypeIcon type={item.type} size={11} /> : <span className="chip-notype" aria-hidden="true" />}
      <span className="chip-text">
        {brand && <span className="chip-brand">{brand} · </span>}
        {item.content || 'Untitled'}
      </span>
      <span className="sr-only">
        , {item.type ? TYPE_LABELS[item.type] : 'no type'}, {STATUS_LABELS[item.status]}
      </span>
    </button>
  );
}

function DayList({ date, items, onOpen, onCreate, anchor, onClose, brandName }) {
  return (
    <Popover anchor={anchor} onClose={onClose} label={formatLongDate(date)} className="day-pop" width={300}>
      <p className="popover-title">{formatLongDate(date)}</p>
      {items.length ? (
        <ul className="day-pop-list">
          {items.map((item) => (
            <li key={item.id}>
              <Chip
                item={item}
                brandName={brandName}
                onOpen={(id) => {
                  onClose();
                  onOpen(id);
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="day-pop-empty">Nothing planned on this day.</p>
      )}
      {onCreate && (
        <button
          type="button"
          className="menu-item day-pop-new"
          onClick={() => {
            onClose();
            onCreate(anchor, date);
          }}
        >
          <IconPlus /> New content on this day
        </button>
      )}
    </Popover>
  );
}

/** The calendar's legend: status markers and type icons, so nothing relies on colour alone. */
export function CalendarLegend() {
  return (
    <ul className="cal-legend" aria-label="Legend">
      <li>
        <TypeIcon type="reels" /> Reels
      </li>
      <li>
        <TypeIcon type="feed" /> Feed
      </li>
      <li>
        <StatusMark status="uploaded" /> Uploaded
      </li>
      <li>
        <StatusMark status="planned" /> Planned
      </li>
      <li>
        <StatusMark status="not_started" /> Not started
      </li>
    </ul>
  );
}

/**
 * Month grid (weeks start Monday, WIB "today" highlighted), items on their publish date,
 * and the No date list beside it (below under 1100px). Shares the month with the track and table.
 * Without `onCreate` (the dashboard's all-brands calendar), days are not clickable for new content.
 * `brandName(id)` puts the brand's short name on each chip.
 */
export function MonthCalendar({ items, onOpen, onCreate = null, brandName = null, title = 'Calendar', tools = null }) {
  const { month } = useMonth();
  const today = useToday();
  const compact = useMediaQuery('(max-width: 720px)');
  const [pop, setPop] = useState(null); // { date, anchor }

  const weeks = useMemo(() => calendarWeeks(month), [month]);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (!isInMonth(item.publish_date, month)) continue;
      if (!map.has(item.publish_date)) map.set(item.publish_date, []);
      map.get(item.publish_date).push(item);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    }
    return map;
  }, [items, month]);

  const noDate = useMemo(
    () => items.filter((i) => !i.publish_date).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    [items],
  );

  return (
    <section className="cal-section" aria-labelledby="cal-title">
      <div className="section-head">
        <h2 id="cal-title">{title}</h2>
        <p className="section-meta">{monthLabel(month)}</p>
      </div>
      {tools}

      <div className="cal-layout">
        <table className={`cal${compact ? ' cal--compact' : ''}${onCreate ? '' : ' cal--readonly'}`}>
          <thead>
            <tr>
              {WEEKDAYS_SHORT.map((d) => (
                <th key={d} scope="col">
                  <span aria-hidden="true">{compact ? d.charAt(0) : d}</span>
                  <span className="sr-only">{d}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].date}>
                {week.map(({ date, inMonth }) => {
                  const dayItems = byDate.get(date) ?? [];
                  const isToday = date === today;
                  const day = Number(date.slice(8));
                  const cls = `cal-day${inMonth ? '' : ' is-out'}${isToday ? ' is-today' : ''}`;

                  if (!inMonth) {
                    return (
                      <td key={date} className={cls}>
                        <span className="cal-num mono" aria-hidden="true">
                          {day}
                        </span>
                      </td>
                    );
                  }

                  if (compact) {
                    return (
                      <td key={date} className={cls} aria-current={isToday ? 'date' : undefined}>
                        <button
                          type="button"
                          className="cal-tap"
                          onClick={(e) => setPop({ date, anchor: e.currentTarget })}
                          aria-label={`${formatLongDate(date)}: ${dayItems.length} ${dayItems.length === 1 ? 'item' : 'items'}`}
                        >
                          <span className="cal-num mono">{day}</span>
                          <span className="cal-marks" aria-hidden="true">
                            {dayItems.slice(0, MAX_CHIPS).map((i) => (
                              <StatusMark key={i.id} status={i.status} />
                            ))}
                            {dayItems.length > MAX_CHIPS && <span className="cal-plus mono">+{dayItems.length - MAX_CHIPS}</span>}
                          </span>
                        </button>
                      </td>
                    );
                  }

                  return (
                    <td key={date} className={cls} aria-current={isToday ? 'date' : undefined}>
                      <div className="cal-cell">
                        {onCreate ? (
                          <button
                            type="button"
                            className="cal-add"
                            onClick={(e) => onCreate(e.currentTarget, date)}
                            aria-label={`New content on ${formatLongDate(date)}`}
                          >
                            <span className="cal-num mono">{day}</span>
                            <span className="cal-add-hint" aria-hidden="true">
                              <IconPlus width={13} height={13} />
                            </span>
                          </button>
                        ) : (
                          <span className="cal-num cal-num--static mono">{day}</span>
                        )}
                        {dayItems.length > 0 && (
                          <ul className="cal-chips">
                            {dayItems.slice(0, MAX_CHIPS).map((item) => (
                              <li key={item.id}>
                                <Chip item={item} onOpen={onOpen} brandName={brandName} />
                              </li>
                            ))}
                            {dayItems.length > MAX_CHIPS && (
                              <li>
                                <button
                                  type="button"
                                  className="cal-more"
                                  onClick={(e) => setPop({ date, anchor: e.currentTarget })}
                                >
                                  +{dayItems.length - MAX_CHIPS} more
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <aside className="nodate" aria-labelledby="nodate-title">
          <h3 id="nodate-title" className="nodate-title">
            No date <span className="mono dim">({noDate.length})</span>
          </h3>
          {noDate.length ? (
            <ul className="nodate-list">
              {noDate.map((item) => (
                <li key={item.id}>
                  <Chip item={item} onOpen={onOpen} brandName={brandName} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="nodate-empty">Every item has a publish date.</p>
          )}
        </aside>
      </div>

      {pop && (
        <DayList
          date={pop.date}
          anchor={pop.anchor}
          items={byDate.get(pop.date) ?? []}
          onOpen={onOpen}
          onCreate={onCreate}
          brandName={brandName}
          onClose={() => setPop(null)}
        />
      )}
    </section>
  );
}

/** For chips: a brand's short name ("Makmoer"), from the brands map. */
export function brandNamer(brandsById) {
  return (id) => brandShort(brandsById[id]) || id;
}
