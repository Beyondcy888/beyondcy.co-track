// The content table's filters, held by the page so the status board below the calendar
// shows exactly the same items as the table (update v3, 05 §4: "same month scope, same filters").
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isInMonth } from '../lib/time.js';

export const NO_PIC = '__none';

/**
 * `items` are the page's items. The Brand filter lives in the URL (?brand=<id>), so the
 * Admin Dashboard's brand cards can open Behomy Master with a brand already chosen.
 */
export function useContentFilters({ items, month, view }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [pic, setPic] = useState(''); // '' every PIC · NO_PIC needs a PIC · a person's id
  const [allMonths, setAllMonths] = useState(false);

  const brandParam = searchParams.get('brand') ?? '';
  // only where the page has a Brand filter, and only one of its brands
  const brand = view.showBrand && view.brandChoices?.some((b) => b.id === brandParam) ? brandParam : '';

  const setBrand = useCallback(
    (value) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set('brand', value);
          else next.delete('brand');
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

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

  const clear = useCallback(() => {
    setQuery('');
    setStatus('');
    setType('');
    setPic('');
    setBrand('');
  }, [setBrand]);

  return {
    query, setQuery,
    status, setStatus,
    type, setType,
    brand, setBrand,
    pic, setPic,
    allMonths, setAllMonths,
    filtered,
    on: Boolean(query || status || type || brand || pic),
    clear,
  };
}
