import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { useMonth } from '../data/MonthContext.jsx';
import { useToday } from '../data/useNow.js';
import { useMediaQuery } from '../data/useMediaQuery.js';
import { brandShort, STATUS_LABELS, TYPE_LABELS } from '../lib/fields.js';
import { prefersReducedMotion } from '../lib/motion.js';
import { calendarWeeks, formatLongDate, isInMonth, monthLabel, monthName, shiftMonth, WEEKDAYS_SHORT } from '../lib/time.js';
import { Avatar, AvatarStack, namesOf } from '../people/Avatar.jsx';
import { useAppDataOptional } from '../data/AppDataProvider.jsx';
import { Popover } from '../ui/Popover.jsx';
import { StatusMark, TypeIcon } from '../ui/bits.jsx';
import { IconCheck, IconChevronLeft, IconChevronRight, IconFlag, IconLock, IconPlus } from '../ui/icons.jsx';
import { LOCKED_HINT } from './useCalendarMoves.js';

const MAX_CHIPS = 3;
const DRAG_HINT = 'Drag with a mouse, or press and hold with a finger, then drop on another day to change the date. With a keyboard, open the item and change its date there.';

// ------------------------------------------------------------------ chips
/** What a content chip shows (also used for the lifted copy while dragging). */
function ItemChipFace({ item, brandName, showPic, locked = false }) {
  const brand = brandName?.(item.brand_id);
  return (
    <>
      <StatusMark status={item.status} />
      {item.type ? <TypeIcon type={item.type} size={11} /> : <span className="chip-notype" aria-hidden="true" />}
      <span className="chip-text">
        {brand && <span className="chip-brand">{brand} · </span>}
        {item.content || 'Untitled'}
      </span>
      {locked && <IconLock className="chip-lock" width={11} height={11} />}
      {showPic && item.pic_id && <Avatar id={item.pic_id} size={18} className="chip-pic" labelled />}
    </>
  );
}

/** "⚑ Project · Company profile shoot": outlined, so it never looks like content. */
function ProjectChipFace({ project }) {
  const done = project.status === 'done';
  return (
    <>
      {done ? <IconCheck className="chip-flag" width={12} height={12} /> : <IconFlag className="chip-flag" width={12} height={12} />}
      <span className="chip-text">
        <span className="chip-kind">Project · </span>
        {project.name}
      </span>
      <AvatarStack ids={project.assignees} size={18} max={3} className="chip-pic" />
    </>
  );
}

/** A press-and-move on something that can't be dragged tells the person why (once per press). */
function useDenied(active, onDenied) {
  const press = useRef(null);
  const flag = useRef(0);
  if (!active) return { handlers: {}, wasDenied: () => false };
  return {
    handlers: {
      onPointerDown: (e) => {
        if (e.button > 0) return;
        press.current = { x: e.clientX, y: e.clientY, told: false };
        // keep receiving the moves even when a quick flick leaves the chip at once
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e) => {
        const p = press.current;
        if (!p || p.told) return;
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
          p.told = true;
          flag.current = Date.now();
          onDenied?.();
        }
      },
      onPointerUp: () => {
        // the click that follows a refused drag must not open the item
        if (press.current?.told) flag.current = Date.now();
        press.current = null;
      },
      onPointerCancel: () => {
        press.current = null;
      },
    },
    wasDenied: () => Date.now() - flag.current < 400,
  };
}

/** "▶ Beefix · Promo video" with its status marker (shape + colour) and the type icon. */
function ItemChip({ item, onOpen, brandName, showPic, drag, origin, justMoved, dragGuard }) {
  const movable = Boolean(drag?.canMoveItem(item));
  const locked = Boolean(drag) && !movable;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${item.id}:${origin}`, data: { kind: 'item', item }, disabled: !movable });
  const deny = useDenied(locked, drag?.denied);
  const brand = brandName?.(item.brand_id);
  const words = [item.type ? TYPE_LABELS[item.type] : 'No type', brand, item.content || 'Untitled'].filter(Boolean);
  if (locked) words.push(LOCKED_HINT);
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`chip${movable ? ' is-movable' : ''}${locked ? ' is-locked' : ''}${isDragging ? ' is-dragging' : ''}${justMoved === item.id ? ' is-landed' : ''}`}
      onClick={() => {
        if (dragGuard?.() || deny.wasDenied()) return;
        onOpen(item.id);
      }}
      title={words.join(' · ')}
      data-chip={`item:${item.id}`}
      {...(movable ? attributes : {})}
      {...(movable ? listeners : {})}
      {...deny.handlers}
    >
      <ItemChipFace item={item} brandName={brandName} showPic={showPic} locked={locked} />
      <span className="sr-only">
        , {item.type ? TYPE_LABELS[item.type] : 'no type'}, {STATUS_LABELS[item.status]}
        {locked ? `, ${LOCKED_HINT.toLowerCase()}` : ''}
      </span>
    </button>
  );
}

function ProjectChip({ project, onOpen, drag, origin, justMoved, dragGuard }) {
  const app = useAppDataOptional();
  const movable = Boolean(drag?.canMoveProject);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `project:${project.id}:${origin}`, data: { kind: 'project', project }, disabled: !movable });
  const done = project.status === 'done';
  const who = namesOf(app, project.assignees);
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`chip chip--project${done ? ' is-done' : ''}${movable ? ' is-movable' : ''}${isDragging ? ' is-dragging' : ''}${justMoved === project.id ? ' is-landed' : ''}`}
      onClick={() => {
        if (dragGuard?.()) return;
        onOpen?.(project.id);
      }}
      title={`Project · ${project.name}${who ? ` · ${who}` : ''}${done ? ' · Done' : ''}`}
      data-chip={`project:${project.id}`}
      {...(movable ? attributes : {})}
      {...(movable ? listeners : {})}
    >
      <ProjectChipFace project={project} />
      <span className="sr-only">
        , project deadline, {done ? 'done' : 'open'}
        {who ? `, assigned to ${who}` : ''}
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ day popover
function DayList({ date, items, projects, onOpen, onOpenProject, onCreate, anchor, onClose, brandName, showPic, drag, hidden, dragGuard }) {
  return (
    <Popover anchor={anchor} onClose={onClose} label={formatLongDate(date)} className={`day-pop${hidden ? ' is-hidden' : ''}`} width={320}>
      <p className="popover-title">{formatLongDate(date)}</p>
      {items.length + projects.length ? (
        <ul className="day-pop-list">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectChip
                project={project}
                drag={drag}
                origin="pop"
                dragGuard={dragGuard}
                onOpen={(id) => {
                  onClose();
                  onOpenProject?.(id);
                }}
              />
            </li>
          ))}
          {items.map((item) => (
            <li key={item.id}>
              <ItemChip
                item={item}
                brandName={brandName}
                showPic={showPic}
                drag={drag}
                origin="pop"
                dragGuard={dragGuard}
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
export function CalendarLegend({ projects = true }) {
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
      {projects && (
        <li>
          <IconFlag className="legend-flag" width={12} height={12} /> Project
        </li>
      )}
    </ul>
  );
}

// ------------------------------------------------------------------ drop targets
function DayCell({ date, className, isToday, dropHint, children }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `day:${date}`, data: { date } });
  const data = active?.data.current;
  const from = data?.kind === 'item' ? data.item.publish_date ?? null : data?.kind === 'project' ? data.project.due_date : undefined;
  const hot = isOver && from !== undefined && from !== date;
  return (
    <td ref={setNodeRef} className={`${className}${hot ? ' is-over' : ''}`} aria-current={isToday ? 'date' : undefined} data-date={date}>
      {children}
      {hot && dropHint}
    </td>
  );
}

function NoDate({ count, dragging, children }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: 'nodate', data: { nodate: true } });
  const data = active?.data.current;
  // only dated content can lose its date; a project always has a deadline
  const canTake = data?.kind === 'item' && Boolean(data.item.publish_date);
  return (
    <aside ref={setNodeRef} className={`nodate${dragging && canTake ? ' is-target' : ''}${isOver && canTake ? ' is-over' : ''}`} aria-labelledby="nodate-title">
      <h3 id="nodate-title" className="nodate-title">
        No date <span className="mono dim">({count})</span>
      </h3>
      {children}
      {dragging && canTake && <p className="nodate-drop">Drop here to remove the date</p>}
    </aside>
  );
}

/** While dragging: hold the chip over "‹ October" or "December ›" to turn the page. */
function MonthEdge({ dir, month }) {
  const { prev, next } = useMonth();
  const { setNodeRef, isOver } = useDroppable({ id: `month:${dir}`, data: { month: dir } });
  const turn = dir === 'prev' ? prev : next;
  const turnRef = useRef(turn);
  turnRef.current = turn;
  useEffect(() => {
    if (!isOver) return undefined;
    let timer = setTimeout(function tick() {
      turnRef.current();
      timer = setTimeout(tick, 1000);
    }, 650);
    return () => clearTimeout(timer);
  }, [isOver]);
  const label = monthName(shiftMonth(month, dir === 'prev' ? -1 : 1));
  return (
    <span ref={setNodeRef} className={`cal-edge cal-edge--${dir}${isOver ? ' is-over' : ''}`}>
      {dir === 'prev' && <IconChevronLeft width={14} height={14} />}
      {label}
      {dir === 'next' && <IconChevronRight width={14} height={14} />}
    </span>
  );
}

// ------------------------------------------------------------------ the calendar
/**
 * Month grid (weeks start Monday, WIB "today" highlighted), items on their publish date,
 * projects on their deadline, and the No date list beside it (below under 1100px).
 * Shares the month with the track and table.
 *
 *   onCreate         without it (the dashboard's all-brands calendar), days are not clickable for new content
 *   brandName(id)    puts the brand's short name on each chip
 *   showPic          puts the PIC's photo on each chip when there's room
 *   projects         shown on their deadline; onOpenProject(id) opens the popup
 *   drag             from useCalendarMoves(): dragging a chip to another day changes its date
 *   flashWeek        { start, key }: scroll here and highlight that week (from the this-week reminder)
 */
export function MonthCalendar({
  items,
  projects = [],
  onOpen,
  onOpenProject = null,
  onCreate = null,
  brandName = null,
  showPic = false,
  title = 'Calendar',
  tools = null,
  drag = null,
  flashWeek = null,
}) {
  const { month } = useMonth();
  const today = useToday();
  const compact = useMediaQuery('(max-width: 720px)');
  const [pop, setPop] = useState(null); // { date, anchor }
  const [active, setActive] = useState(null); // what is being dragged: { kind, item | project }
  const [justMoved, setJustMoved] = useState(null);
  const [flash, setFlash] = useState(null);
  const sectionRef = useRef(null);
  const lastDrag = useRef(0);
  const movedTimer = useRef(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // long-press on touch, so normal scrolling still works
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

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

  const projectsByDate = useMemo(() => {
    const map = new Map();
    for (const project of projects) {
      if (!isInMonth(project.due_date, month)) continue;
      if (!map.has(project.due_date)) map.set(project.due_date, []);
      map.get(project.due_date).push(project);
    }
    return map;
  }, [projects, month]);

  const noDate = useMemo(
    () => items.filter((i) => !i.publish_date).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    [items],
  );

  // from the reminder's "View in calendar": scroll here and flash this week's row
  useEffect(() => {
    if (!flashWeek) return undefined;
    setFlash(flashWeek.start);
    sectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    const timer = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(timer);
  }, [flashWeek]);

  useEffect(() => () => clearTimeout(movedTimer.current), []);

  const dragGuard = useCallback(() => Date.now() - lastDrag.current < 300, []);

  const onDragStart = ({ active: a }) => {
    setActive(a.data.current ?? null);
  };
  const finish = () => {
    lastDrag.current = Date.now();
    setActive(null);
  };
  const onDragEnd = ({ over }) => {
    const data = active; // captured at the start: the source chip may be gone by now (month turned)
    finish();
    const target = over?.data.current;
    if (!data || !target || target.month) return;
    setPop(null);
    const land = (id) => {
      setJustMoved(id);
      clearTimeout(movedTimer.current);
      movedTimer.current = setTimeout(() => setJustMoved(null), 900);
    };
    if (data.kind === 'item') {
      const date = target.nodate ? null : target.date;
      if ((data.item.publish_date ?? null) === date) return;
      land(data.item.id);
      drag.moveItem(data.item, date);
    } else if (data.kind === 'project') {
      if (target.nodate || data.project.due_date === target.date) return;
      land(data.project.id);
      drag.moveProject(data.project, target.date);
    }
  };

  const dragging = Boolean(active);
  const dropHint = <span className="cal-drop" aria-hidden="true" />;

  const grid = (
    <>
      <div className="section-head cal-head">
        <h2 id="cal-title">{title}</h2>
        <p className="section-meta">{monthLabel(month)}</p>
        {drag && !dragging && (
          <p className="section-meta cal-drag-hint">
            {compact ? 'Tap a day, then press and hold an item to move it' : 'Drag a chip to another day to change its date'}
          </p>
        )}
        {dragging && (
          <p className="cal-edges">
            <MonthEdge dir="prev" month={month} />
            <span className="cal-edges-hint">hold over a month to switch</span>
            <MonthEdge dir="next" month={month} />
          </p>
        )}
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
              <tr key={week[0].date} className={flash === week[0].date ? 'is-flash' : undefined}>
                {week.map(({ date, inMonth }) => {
                  const dayItems = byDate.get(date) ?? [];
                  const dayProjects = projectsByDate.get(date) ?? [];
                  const total = dayItems.length + dayProjects.length;
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
                      <DayCell key={date} date={date} className={cls} isToday={isToday} dropHint={dropHint}>
                        <button
                          type="button"
                          className="cal-tap"
                          onClick={(e) => setPop({ date, anchor: e.currentTarget })}
                          aria-label={`${formatLongDate(date)}: ${dayItems.length} ${dayItems.length === 1 ? 'item' : 'items'}${
                            dayProjects.length ? `, ${dayProjects.length} ${dayProjects.length === 1 ? 'project' : 'projects'}` : ''
                          }`}
                        >
                          <span className="cal-num mono">{day}</span>
                          <span className="cal-marks" aria-hidden="true">
                            {dayProjects.slice(0, MAX_CHIPS).map((p) => (
                              <span key={p.id} className={`mark mark-project${p.status === 'done' ? ' is-done' : ''}`} />
                            ))}
                            {dayItems.slice(0, Math.max(MAX_CHIPS - dayProjects.length, 0)).map((i) => (
                              <StatusMark key={i.id} status={i.status} />
                            ))}
                            {total > MAX_CHIPS && <span className="cal-plus mono">+{total - MAX_CHIPS}</span>}
                          </span>
                        </button>
                      </DayCell>
                    );
                  }

                  // projects first: a deadline is never hidden behind "+N more"
                  const shownProjects = dayProjects.slice(0, MAX_CHIPS);
                  const shownItems = dayItems.slice(0, Math.max(MAX_CHIPS - shownProjects.length, 0));
                  const hidden = total - shownProjects.length - shownItems.length;

                  return (
                    <DayCell key={date} date={date} className={cls} isToday={isToday} dropHint={dropHint}>
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
                        {total > 0 && (
                          <ul className="cal-chips">
                            {shownProjects.map((project) => (
                              <li key={project.id}>
                                <ProjectChip project={project} onOpen={onOpenProject} drag={drag} origin="cell" justMoved={justMoved} dragGuard={dragGuard} />
                              </li>
                            ))}
                            {shownItems.map((item) => (
                              <li key={item.id}>
                                <ItemChip item={item} onOpen={onOpen} brandName={brandName} showPic={showPic} drag={drag} origin="cell" justMoved={justMoved} dragGuard={dragGuard} />
                              </li>
                            ))}
                            {hidden > 0 && (
                              <li>
                                <button type="button" className="cal-more" onClick={(e) => setPop({ date, anchor: e.currentTarget })}>
                                  +{hidden} more
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    </DayCell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <NoDate count={noDate.length} dragging={dragging}>
          {noDate.length ? (
            <ul className="nodate-list">
              {noDate.map((item) => (
                <li key={item.id}>
                  <ItemChip item={item} onOpen={onOpen} brandName={brandName} showPic={showPic} drag={drag} origin="nodate" justMoved={justMoved} dragGuard={dragGuard} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="nodate-empty">Every item has a publish date.</p>
          )}
        </NoDate>
      </div>

      {pop && (
        <DayList
          date={pop.date}
          anchor={pop.anchor}
          items={byDate.get(pop.date) ?? []}
          projects={projectsByDate.get(pop.date) ?? []}
          onOpen={onOpen}
          onOpenProject={onOpenProject}
          onCreate={onCreate}
          brandName={brandName}
          showPic={showPic}
          drag={drag}
          hidden={dragging}
          dragGuard={dragGuard}
          onClose={() => setPop(null)}
        />
      )}
    </>
  );

  return (
    <section ref={sectionRef} className={`cal-section${dragging ? ' is-dragging' : ''}`} aria-labelledby="cal-title">
      {drag ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={finish}
          accessibility={{ screenReaderInstructions: { draggable: DRAG_HINT } }}
        >
          {grid}
          {createPortal(
            <DragOverlay dropAnimation={null} zIndex={90}>
              {active ? (
                <span className={`chip chip--lifted${active.kind === 'project' ? ' chip--project' : ''}`}>
                  {active.kind === 'project' ? <ProjectChipFace project={active.project} /> : <ItemChipFace item={active.item} brandName={brandName} showPic={showPic} />}
                </span>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      ) : (
        grid
      )}
    </section>
  );
}

/** For chips: a brand's short name ("Makmoer"), from the brands map. */
export function brandNamer(brandsById) {
  return (id) => brandShort(brandsById[id]) || id;
}
