// Small presentational pieces shared across pages.
import { STATUS_LABELS, TYPE_LABELS } from '../lib/fields.js';
import { relativeTime } from '../lib/time.js';
import { useNow } from '../data/useNow.js';
import { IconAlert } from './icons.jsx';

const BASE = import.meta.env.BASE_URL;

export function StatusPill({ status }) {
  const s = status || 'not_started';
  return <span className={`pill pill-${s}`}>{STATUS_LABELS[s] ?? s}</span>;
}

/** Status marker (shape + colour) used in chips and lists. */
export function StatusMark({ status }) {
  return <span className={`mark mark-${status || 'not_started'}`} aria-hidden="true" />;
}

/**
 * The content type's icon: ▶ play for Reels (orange), a 2×2 grid for Feed (violet).
 * Always shown with a label or a screen-reader name, so type never relies on colour alone.
 */
export function TypeIcon({ type, size = 12, className = '' }) {
  if (type === 'reels') {
    return (
      <svg className={`type-icon type-icon--reels ${className}`} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d="M3.4 1.9v8.2L10.2 6z" fill="currentColor" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === 'feed') {
    return (
      <svg className={`type-icon type-icon--feed ${className}`} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <rect x="1" y="1" width="4.4" height="4.4" rx="1.1" fill="currentColor" />
        <rect x="6.6" y="1" width="4.4" height="4.4" rx="1.1" fill="currentColor" />
        <rect x="1" y="6.6" width="4.4" height="4.4" rx="1.1" fill="currentColor" />
        <rect x="6.6" y="6.6" width="4.4" height="4.4" rx="1.1" fill="currentColor" />
      </svg>
    );
  }
  return null;
}

/** "▶ Reels" / "▦ Feed" as a tinted pill. */
export function TypePill({ type }) {
  if (!type) return <span className="dim">—</span>;
  return (
    <span className={`type-pill type-pill--${type}`}>
      <TypeIcon type={type} />
      {TYPE_LABELS[type]}
    </span>
  );
}

/** "▶ 3/7  ▦ 5/12": uploaded (and target) per type. */
export function TypeCounts({ uploaded, target, className = '' }) {
  return (
    <span className={`type-counts ${className}`}>
      {['reels', 'feed'].map((type) => (
        <span key={type} className={`tc tc--${type}`}>
          <TypeIcon type={type} size={11} />
          <span className="sr-only">{TYPE_LABELS[type]} </span>
          <span className="mono">
            {uploaded[type]}
            {target && <span className="tc-of">/{target[type]}</span>}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Items without a PIC count toward no one until Admin picks one. */
export function NeedsPicBadge() {
  return (
    <span className="badge badge-warn">
      <IconAlert width={12} height={12} />
      Needs a PIC
    </span>
  );
}

/** "3 min ago", refreshed live from one shared timer. */
export function RelativeTime({ value, className }) {
  const now = useNow(30000);
  if (!value) return null;
  return (
    <time className={className} dateTime={value} title={new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' })}>
      {relativeTime(value, now)}
    </time>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="spinner" role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** The Beyondcy logo (made for dark backgrounds: green "beyond", white "cy" and ring). */
export function Logo({ height = 26, className = '' }) {
  return (
    <img
      className={`logo ${className}`}
      src={`${BASE}logo-beyondcy.png`}
      alt="Beyondcy"
      height={height}
      width={Math.round((height * 993) / 209)}
      decoding="async"
    />
  );
}

/** The ringed "b": for the collapsed sidebar, the top bar and other small spaces. */
export function LogoMark({ height = 24, className = '' }) {
  return (
    <img
      className={`logo-mark ${className}`}
      src={`${BASE}logo-mark.png`}
      alt="Beyondcy"
      height={height}
      width={Math.round((height * 1024) / 668)}
      decoding="async"
    />
  );
}

/** Avatar: the first letter of a display name in a quiet circle. */
export function Initial({ name, className = '' }) {
  return (
    <span className={`initial ${className}`} aria-hidden="true">
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}
