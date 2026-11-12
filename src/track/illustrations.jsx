// Original illustrations for the dashboard's summary boxes (09 §9.1): panel greys with a
// touch of the type or accent colour. Decorative (aria-hidden); the box text carries the meaning.
const C = {
  ink: '#131218',
  panel: '#1b1a21',
  raised: '#25242d',
  hi: '#2d2c37',
  line: '#3a3944',
  edge: '#55545f',
  dim: '#4b4959',
  text: '#eeecf4',
  reels: '#ff8a3d',
  feed: '#8f7cf7',
  green: '#9ecd59',
};

const svgProps = { viewBox: '0 0 128 128', fill: 'none', 'aria-hidden': true, focusable: 'false' };

/** Total target: a stack of content cards (a Reel in front, a Feed post behind). */
export function IllusCards() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="dash-card-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b3a46" />
          <stop offset="1" stopColor="#212028" />
        </linearGradient>
      </defs>
      <rect x="46" y="10" width="62" height="84" rx="10" fill={C.raised} stroke={C.line} />
      <rect x="32" y="20" width="62" height="84" rx="10" fill={C.hi} stroke="#45444f" />
      <g transform="translate(42 28)" fill={C.feed}>
        <rect width="9" height="9" rx="2" opacity="0.7" />
        <rect x="11" width="9" height="9" rx="2" opacity="0.45" />
        <rect y="11" width="9" height="9" rx="2" opacity="0.45" />
        <rect x="11" y="11" width="9" height="9" rx="2" opacity="0.7" />
      </g>
      <rect x="16" y="32" width="62" height="86" rx="10" fill="url(#dash-card-front)" stroke={C.edge} />
      <rect x="24" y="40" width="46" height="34" rx="6" fill={C.panel} />
      <path d="M43 50v14l12-7z" fill={C.reels} stroke={C.reels} strokeWidth="2" strokeLinejoin="round" />
      <rect x="24" y="82" width="38" height="4" rx="2" fill="#6c6a78" />
      <rect x="24" y="91" width="28" height="4" rx="2" fill={C.dim} />
      <rect x="24" y="100" width="34" height="4" rx="2" fill={C.dim} />
    </svg>
  );
}

/** Uploaded: a phone with a play button and a feed grid. */
export function IllusPhone() {
  const grid = [0.65, 0.22, 0.45, 0.22, 0.55, 0.3];
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="dash-phone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#403f4b" />
          <stop offset="1" stopColor="#24232b" />
        </linearGradient>
      </defs>
      <rect x="32" y="6" width="64" height="118" rx="15" fill="url(#dash-phone)" stroke={C.edge} />
      <rect x="38" y="16" width="52" height="100" rx="9" fill="#16151b" />
      <rect x="57" y="10" width="14" height="3" rx="1.5" fill={C.line} />
      <rect x="42" y="21" width="44" height="34" rx="6" fill={C.raised} />
      <circle cx="64" cy="38" r="10" fill={C.reels} />
      <path d="M61 33.5v9l7.5-4.5z" fill={C.ink} />
      {grid.map((o, i) => (
        <rect
          key={i}
          x={42 + (i % 3) * 15}
          y={61 + Math.floor(i / 3) * 15}
          width="13"
          height="13"
          rx="3"
          fill={o > 0.25 ? C.feed : C.hi}
          opacity={o > 0.25 ? o : 1}
        />
      ))}
      <rect x="42" y="95" width="30" height="4" rx="2" fill={C.dim} />
      <rect x="42" y="104" width="20" height="4" rx="2" fill={C.hi} />
    </svg>
  );
}

/** Remaining: an hourglass running in the brand green. */
export function IllusHourglass() {
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="dash-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4955" />
          <stop offset="1" stopColor="#2b2a33" />
        </linearGradient>
      </defs>
      <rect x="35" y="20" width="4" height="90" rx="2" fill={C.hi} />
      <rect x="89" y="20" width="4" height="90" rx="2" fill={C.hi} />
      <path
        d="M42 20h44c0 21-15 30-19 44 4 14 19 23 19 44H42c0-21 15-30 19-44-4-14-19-23-19-44z"
        fill="#1e1d24"
        stroke={C.dim}
        strokeWidth="1.5"
      />
      <path d="M49 36h30c-3 8-10 13-15 19-5-6-12-11-15-19z" fill={C.green} opacity="0.9" />
      <path d="M64 62v30" stroke={C.green} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 4" />
      <path d="M46 108c4-9 10-14 18-15 8 1 14 6 18 15z" fill={C.green} />
      <rect x="28" y="10" width="72" height="11" rx="5.5" fill="url(#dash-cap)" stroke={C.edge} />
      <rect x="28" y="107" width="72" height="11" rx="5.5" fill="url(#dash-cap)" stroke={C.edge} />
    </svg>
  );
}

/**
 * Achievement: a real half-gauge drawn from the actual percentage (0–100% across the arc;
 * above 100% the arc is full and a small notch marks the overshoot).
 */
export function Gauge({ value }) {
  const cx = 64;
  const cy = 84;
  const r = 46;
  const pct = value == null ? 0 : Math.min(Math.max(value, 0), 100) / 100;
  const angle = Math.PI * (1 - pct);
  const end = [cx + r * Math.cos(angle), cy - r * Math.sin(angle)];
  const needle = [cx + (r - 15) * Math.cos(angle), cy - (r - 15) * Math.sin(angle)];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const a = Math.PI * (1 - p);
    return [cx + (r + 9) * Math.cos(a), cy - (r + 9) * Math.sin(a), cx + (r + 4) * Math.cos(a), cy - (r + 4) * Math.sin(a)];
  });
  return (
    <svg {...svgProps}>
      <path d={`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke={C.hi} strokeWidth="13" strokeLinecap="round" />
      {pct > 0 && (
        <path
          d={`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${end[0].toFixed(2)} ${end[1].toFixed(2)}`}
          stroke={C.green}
          strokeWidth="13"
          strokeLinecap="round"
        />
      )}
      {ticks.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.dim} strokeWidth="2" strokeLinecap="round" />
      ))}
      {value != null && value > 100 && <circle cx={cx + r} cy={cy - 13} r="3.5" fill={C.green} />}
      <line x1={cx} y1={cy} x2={needle[0]} y2={needle[1]} stroke={C.text} strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="7" fill={C.raised} stroke={C.text} strokeWidth="2" />
    </svg>
  );
}
