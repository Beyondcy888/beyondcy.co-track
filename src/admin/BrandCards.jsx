// Brand cards on the Admin Dashboard (update v3, 04 §2): one card per brand with its logo,
// a soft glow in the brand's colour, and the content uploaded for it in the selected month.
// Clicking a card opens that brand's tracker page.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { brandHref, brandStyle, orderBrands } from '../config/brandStyle.js';
import { useAppData } from '../data/AppDataProvider.jsx';
import { isInMonth, monthLabel } from '../lib/time.js';
import { IconArrowUpRight } from '../ui/icons.jsx';

const BASE = import.meta.env.BASE_URL;

function BrandCard({ brand, count, period, href }) {
  const style = brandStyle(brand.id);
  const logoUrl = style.logo ? `${BASE}${style.logo}` : null;
  const shape = style.ratio >= 2.2 ? 'wide' : style.ratio >= 1.35 ? 'mid' : 'compact';
  const vars = { '--brand': style.glow, '--brand-true': style.color, ...(logoUrl ? { '--logo': `url("${logoUrl}")`, '--logo-ratio': style.ratio } : {}) };
  const body = (
    <>
      <span className="bc-glow" aria-hidden="true" />
      {logoUrl && <span className="bc-ghost" aria-hidden="true" />}
      <span className={`bc-logo bc-logo--${shape}`} aria-hidden="true">
        {logoUrl ? <img src={logoUrl} alt="" decoding="async" draggable={false} /> : <span className="bc-initial">{brand.name.charAt(0).toUpperCase()}</span>}
      </span>
      {href && (
        <span className="bc-open" aria-hidden="true">
          <IconArrowUpRight width={14} height={14} />
        </span>
      )}
      <span className="bc-text">
        <span className="bc-name">{brand.name}</span>
        <span className="bc-count">
          <span className="bc-num mono">{count.toLocaleString('en-US')}</span>
          <span className="bc-unit">uploaded</span>
        </span>
      </span>
    </>
  );
  const label = `${brand.name}: ${count} uploaded in ${period}`;
  return (
    <li className="brand-cards-item">
      {href ? (
        <Link to={href} className="brand-card" style={vars} aria-label={`${label}. Open its tracker.`} title={`Open ${brand.name}`}>
          {body}
        </Link>
      ) : (
        <div className="brand-card is-static" style={vars} role="img" aria-label={label}>
          {body}
        </div>
      )}
    </li>
  );
}

/** `items` are the dashboard's items for the selected month (every tracker). */
export function BrandCards({ items, month }) {
  const app = useAppData();
  const period = monthLabel(month);

  // Reels and Feed both count; so does an upload that still needs a PIC (it is on the brand's page)
  const counts = useMemo(() => {
    const map = {};
    for (const item of items) {
      if (item.status !== 'uploaded' || !isInMonth(item.publish_date, month)) continue;
      map[item.brand_id] = (map[item.brand_id] ?? 0) + 1;
    }
    return map;
  }, [items, month]);

  const brands = useMemo(() => orderBrands(app.brands), [app.brands]);

  // on narrower screens the row scrolls sideways: fade the edge where more cards are waiting
  const rowRef = useRef(null);
  const [edges, setEdges] = useState({ before: false, more: false });
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    const update = () => {
      const before = row.scrollLeft > 2;
      const more = row.scrollLeft + row.clientWidth < row.scrollWidth - 2;
      setEdges((e) => (e.before === before && e.more === more ? e : { before, more }));
    };
    update();
    row.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(row);
    return () => {
      row.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [brands.length]);

  if (!brands.length) return null;

  return (
    <section className="dash-section brands" aria-labelledby="brands-title">
      <div className="section-head">
        <h2 id="brands-title">Brands</h2>
        <p className="section-meta">
          Content uploaded in {period}
          {(edges.more || edges.before) && <span className="brands-scroll-hint"> · scroll sideways for all {brands.length}</span>}
        </p>
      </div>
      <ul ref={rowRef} className="brand-cards" style={{ '--count': brands.length }} data-before={edges.before} data-more={edges.more}>
        {brands.map((brand) => (
          <BrandCard
            key={brand.id}
            brand={brand}
            count={counts[brand.id] ?? 0}
            period={period}
            href={brandHref(brand.id, app.rolesById[app.roleOfBrand[brand.id]])}
          />
        ))}
      </ul>
    </section>
  );
}
