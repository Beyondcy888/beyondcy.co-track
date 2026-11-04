import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../data/ApiContext.js';
import { useAppData } from '../data/AppDataProvider.jsx';
import { useMonth } from '../data/MonthContext.jsx';
import { PageHeader } from '../layout/PageHeader.jsx';
import { friendlyError } from '../lib/errors.js';
import { sumTargets } from '../lib/progress.js';
import { isValidMonth, monthName, monthStart, shiftMonth } from '../lib/time.js';
import { useConfirm } from '../ui/Confirm.jsx';
import { useToast } from '../ui/Toast.jsx';
import { Spinner, TypeIcon } from '../ui/bits.jsx';
import { IconCheck } from '../ui/icons.jsx';

const digits = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 3);
const toInt = (v) => (v === '' || v == null ? 0 : Number(v));
const byName = (a, b) => a.display_name.localeCompare(b.display_name);
const sameMonth = (row, iso) => String(row.month).slice(0, 10) === iso;

/** "Total 122 · ▶ 67 Reels · ▦ 55 Feed" */
function Sum({ label, sum }) {
  return (
    <p className="tsum">
      {label} <b className="mono">{sum?.total ?? 0}</b>
      <span className="tsum-split">
        <span>
          <TypeIcon type="reels" size={11} /> <span className="mono">{sum?.reels ?? 0}</span> Reels
        </span>
        <span>
          <TypeIcon type="feed" size={11} /> <span className="mono">{sum?.feed ?? 0}</span> Feed
        </span>
      </span>
    </p>
  );
}

/**
 * One person × brand. Total always equals Reels + Feed: typing Reels or Feed updates Total;
 * typing Total sets Feed = Total − Reels (if Reels is bigger, Reels = Total and Feed = 0).
 * Only Reels and Feed are saved, when focus leaves the row.
 */
function TargetRow({ row, monthIso, onSaved, onCleared }) {
  const api = useApi();
  const confirm = useConfirm();
  const t = row.target;
  const fromServer = useCallback(
    () => ({ reels: t ? String(t.target_reels) : '', feed: t ? String(t.target_feed) : '', note: t?.note ?? '' }),
    [t],
  );
  const [draft, setDraft] = useState(fromServer);
  const [dirty, setDirty] = useState(false);
  const [totalText, setTotalText] = useState(null); // while the Total box is being typed in
  const [state, setState] = useState(null); // 'saving' | 'saved'
  const [error, setError] = useState(null);
  const baseReels = useRef(0);
  const busy = useRef(false);
  const savedTimer = useRef(null);

  // a saved change (here, a copy, or another tab) refreshes the row unless it's being edited
  useEffect(() => {
    if (!dirty) setDraft(fromServer());
  }, [fromServer, dirty]);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const edit = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
    setError(null);
  };

  const hasNumbers = draft.reels !== '' || draft.feed !== '';
  const total = hasNumbers ? toInt(draft.reels) + toInt(draft.feed) : '';
  const label = `${row.person.display_name}, ${row.brand?.name ?? row.brandId}`;

  const onTotal = (raw) => {
    const v = digits(raw);
    setTotalText(v);
    if (v === '') return; // mid-typing: leave Reels and Feed alone
    const tot = Number(v);
    const reels = baseReels.current;
    if (reels > tot) edit({ reels: String(tot), feed: '0' });
    else edit({ reels: String(reels), feed: String(tot - reels) });
  };

  const flashSaved = () => {
    setState('saved');
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setState(null), 2500);
  };

  const clear = async ({ asked = false } = {}) => {
    if (!t) return;
    if (!asked) {
      const ok = await confirm({
        title: `Clear ${label}'s target?`,
        body: `The ${monthName(monthIso.slice(0, 7))} target${t.note ? ' and its note' : ''} will be removed.`,
        confirmLabel: 'Clear target',
        tone: 'danger',
      });
      if (!ok) return;
    }
    busy.current = true;
    setState('saving');
    const r = await api.deleteTarget(t.id);
    busy.current = false;
    setState(null);
    if (r.error) {
      setError(friendlyError(r.error));
      return;
    }
    setDirty(false);
    onCleared(t.id);
  };

  const save = async () => {
    if (!dirty || busy.current || row.readOnly) return;
    const reels = toInt(draft.reels);
    const feed = toInt(draft.feed);
    if (![reels, feed].every((n) => Number.isInteger(n) && n >= 0 && n <= 500)) {
      setError('Use a whole number from 0 to 500 for Reels and Feed.');
      return;
    }
    if (reels + feed === 0) {
      if (!t) {
        setDraft(fromServer());
        setDirty(false);
        return;
      }
      // emptying the numbers clears the target
      busy.current = true;
      const ok = await confirm({
        title: `Clear ${label}'s target?`,
        body: 'Reels and Feed are both empty, so the target will be removed.',
        confirmLabel: 'Clear target',
        tone: 'danger',
      });
      busy.current = false;
      if (!ok) {
        setDraft(fromServer());
        setDirty(false);
        return;
      }
      await clear({ asked: true });
      return;
    }
    busy.current = true;
    setState('saving');
    const r = await api.saveTarget({
      month: monthIso,
      brandId: row.brand.id,
      profileId: row.person.id,
      reels,
      feed,
      note: draft.note.trim() || null,
    });
    busy.current = false;
    if (r.error) {
      setState(null);
      setError(friendlyError(r.error));
      return;
    }
    setDirty(false);
    onSaved(r.data);
    flashSaved();
  };

  const onRowBlur = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return; // still inside this row
    save();
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape' && dirty) {
      e.preventDefault();
      setDraft(fromServer());
      setDirty(false);
      setError(null);
    }
  };

  const empty = !t && !hasNumbers;

  if (row.readOnly) {
    return (
      <tr className="trow is-readonly">
        <th scope="row">
          <span className="truncate">{row.person.display_name}</span>
          <span className="badge tbadge">No longer in this tracker</span>
        </th>
        <td>{row.brand?.name ?? row.brandId}</td>
        <td className="mono">{t.target_reels}</td>
        <td className="mono">{t.target_feed}</td>
        <td className="mono">{t.target_total}</td>
        <td className="dim tnote-text">{t.note || '—'}</td>
        <td className="tactions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => clear()}>
            Clear
          </button>
          {error && <span className="field-error">{error}</span>}
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className={`trow${empty ? ' is-empty' : ''}${dirty ? ' is-dirty' : ''}`} onBlur={onRowBlur} onKeyDown={onKeyDown}>
        <th scope="row">
          <span className="truncate">{row.person.display_name}</span>
        </th>
        <td>{row.brand.name}</td>
        <td>
          <input
            className="input tnum mono tnum--reels"
            inputMode="numeric"
            value={draft.reels}
            placeholder="–"
            aria-label={`${label}: Reels target`}
            onChange={(e) => edit({ reels: digits(e.target.value) })}
          />
        </td>
        <td>
          <input
            className="input tnum mono tnum--feed"
            inputMode="numeric"
            value={draft.feed}
            placeholder="–"
            aria-label={`${label}: Feed target`}
            onChange={(e) => edit({ feed: digits(e.target.value) })}
          />
        </td>
        <td>
          <input
            className="input tnum mono tnum--total"
            inputMode="numeric"
            value={totalText ?? String(total)}
            placeholder="–"
            aria-label={`${label}: total target (Reels + Feed)`}
            onFocus={() => {
              baseReels.current = toInt(draft.reels);
              setTotalText(hasNumbers ? String(total) : '');
            }}
            onBlur={() => setTotalText(null)}
            onChange={(e) => onTotal(e.target.value)}
          />
        </td>
        <td>
          <input
            className="input tnote"
            value={draft.note}
            maxLength={500}
            disabled={!t && !hasNumbers}
            placeholder={!t && !hasNumbers ? 'Set a target first' : 'Status & notes'}
            aria-label={`${label}: status and notes`}
            onChange={(e) => edit({ note: e.target.value })}
          />
        </td>
        <td className="tactions" aria-live="polite">
          {state === 'saving' && <Spinner label="Saving" />}
          {state === 'saved' && (
            <span className="saved-tick">
              <IconCheck width={13} height={13} /> Saved
            </span>
          )}
          {!state && t && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => clear()}>
              Clear
            </button>
          )}
        </td>
      </tr>
      {error && (
        <tr className="trow-error">
          <td colSpan={7}>
            <p className="field-error" role="alert">
              {label}: {error}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

/** /admin/targets (09 §10): every active staff member × each brand in their tracker. */
export function TargetsPage() {
  const api = useApi();
  const app = useAppData();
  const { month, setMonth } = useMonth();
  const [searchParams] = useSearchParams();
  const confirm = useConfirm();
  const toast = useToast();
  const prevMonth = shiftMonth(month, -1);
  const monthIso = monthStart(month);
  const prevIso = monthStart(prevMonth);
  const [data, setData] = useState({ status: 'loading', rows: [], error: null });

  // a lane's "Targets" link carries ?month=YYYY-MM
  const asked = searchParams.get('month');
  useEffect(() => {
    if (isValidMonth(asked)) setMonth(asked);
  }, [asked, setMonth]);

  const load = useCallback(async () => {
    setData((d) => ({ ...d, status: d.rows.length ? 'refreshing' : 'loading' }));
    const r = await api.listTargetsForMonths([monthIso, prevIso]);
    if (r.error) setData({ status: 'error', rows: [], error: friendlyError(r.error) });
    else setData({ status: 'ready', rows: r.data ?? [], error: null, for: monthIso });
  }, [api, monthIso, prevIso]);

  useEffect(() => {
    load();
  }, [load]);

  const current = useMemo(() => data.rows.filter((r) => sameMonth(r, monthIso)), [data.rows, monthIso]);
  const previous = useMemo(() => data.rows.filter((r) => sameMonth(r, prevIso)), [data.rows, prevIso]);

  const groups = useMemo(
    () =>
      app.trackers.map((role) => {
        const brands = app.brandsForRole(role.id);
        const members = app.people.filter((p) => p.role_id === role.id && p.is_active).sort(byName);
        const rows = [];
        for (const person of members) {
          for (const brand of brands) {
            const target = current.find((r) => r.profile_id === person.id && r.brand_id === brand.id) ?? null;
            rows.push({ key: `${person.id}|${brand.id}`, person, brand, target, readOnly: false });
          }
        }
        // targets of people who left (or brands that moved): read-only
        const keys = new Set(rows.map((r) => r.key));
        current
          .filter((r) => r.role_id === role.id && !keys.has(`${r.profile_id}|${r.brand_id}`))
          .forEach((r) =>
            rows.push({
              key: `${r.profile_id}|${r.brand_id}`,
              person: app.peopleById[r.profile_id] ?? { id: r.profile_id, display_name: 'Former member' },
              brand: app.brandsById[r.brand_id],
              brandId: r.brand_id,
              target: r,
              readOnly: true,
            }),
          );
        return { role, rows, sum: sumTargets(current.filter((r) => r.role_id === role.id)), members };
      }),
    [app, current],
  );

  const grand = sumTargets(current);

  const onSaved = useCallback((row) => {
    setData((d) => ({ ...d, rows: [...d.rows.filter((r) => r.id !== row.id), row] }));
  }, []);
  const onCleared = useCallback((id) => {
    setData((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }));
  }, []);

  const candidates = groups
    .flatMap((g) => g.rows)
    .filter((r) => !r.readOnly && !r.target)
    .map((r) => ({ r, prev: previous.find((p) => p.profile_id === r.person.id && p.brand_id === r.brand.id) }))
    .filter((x) => x.prev && x.prev.target_reels + x.prev.target_feed > 0);

  async function copyFromPrevious() {
    const prevName = monthName(prevMonth);
    if (!candidates.length) {
      toast(`Nothing to copy: no empty row had a target in ${prevName}.`);
      return;
    }
    const n = candidates.length;
    const ok = await confirm({
      title: `Copy ${n} ${n === 1 ? 'target' : 'targets'} from ${prevName}?`,
      body: `Only rows that are empty in ${monthName(month)} get ${prevName}'s Reels and Feed. Rows that already have a target, and notes, are left as they are.`,
      confirmLabel: `Copy ${n} ${n === 1 ? 'target' : 'targets'}`,
    });
    if (!ok) return;
    const r = await api.saveTargets(
      candidates.map(({ r: row, prev }) => ({
        month: monthIso,
        brandId: row.brand.id,
        profileId: row.person.id,
        reels: prev.target_reels,
        feed: prev.target_feed,
      })),
    );
    if (r.error) {
      toast(friendlyError(r.error), { tone: 'danger', duration: 6500 });
      return;
    }
    setData((d) => {
      const ids = new Set((r.data ?? []).map((x) => x.id));
      return { ...d, rows: [...d.rows.filter((x) => !ids.has(x.id)), ...(r.data ?? [])] };
    });
    toast(`Copied ${n} ${n === 1 ? 'target' : 'targets'} from ${prevName}`);
  }

  return (
    <div className="targets-page">
      <PageHeader title="Targets" showMonth />

      <div className="targets-top">
        <Sum label="Total" sum={grand} />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={copyFromPrevious}
          disabled={data.status !== 'ready'}
          title={`Fill empty rows with ${monthName(prevMonth)}'s Reels and Feed`}
        >
          Copy from {monthName(prevMonth)}
        </button>
      </div>
      <p className="targets-help">
        One row per person and brand. Type Reels and Feed (0–500); Total is always their sum, and typing a Total sets Feed to
        Total − Reels. A row saves when you leave it; Esc undoes. Staff see their own tracker's targets but can't change them.
      </p>

      {data.status === 'loading' && (
        <div className="loading-block">
          <Spinner label="Loading targets" /> Loading targets
        </div>
      )}
      {data.status === 'error' && (
        <div className="notice notice-danger" role="alert">
          <div>
            <p>{data.error}</p>
            <button type="button" className="link-btn" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      )}

      {(data.status === 'ready' || data.status === 'refreshing') &&
        groups.map((g) => (
          <section key={g.role.id} className="tgroup" aria-labelledby={`tg-${g.role.id}`}>
            <div className="tgroup-head">
              <h2 id={`tg-${g.role.id}`}>{g.role.name}</h2>
              <Sum label="Subtotal" sum={g.sum} />
            </div>
            {g.rows.length === 0 ? (
              <p className="empty-line">No one is in this tracker yet. Give someone this role on the People page.</p>
            ) : (
              <div className="table-wrap twrap">
                <table className="table ttable">
                  <colgroup>
                    <col style={{ width: 170 }} />
                    <col style={{ width: 170 }} />
                    <col style={{ width: 104 }} />
                    <col style={{ width: 104 }} />
                    <col style={{ width: 104 }} />
                    <col style={{ width: 320 }} />
                    <col style={{ width: 130 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Brand</th>
                      <th scope="col" className="th-type th-type--reels">
                        <TypeIcon type="reels" size={10} /> Reels
                      </th>
                      <th scope="col" className="th-type th-type--feed">
                        <TypeIcon type="feed" size={10} /> Feed
                      </th>
                      <th scope="col">Total</th>
                      <th scope="col">Status &amp; notes</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((row) => (
                      <TargetRow key={`${monthIso}|${row.key}`} row={row} monthIso={monthIso} onSaved={onSaved} onCleared={onCleared} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
    </div>
  );
}
