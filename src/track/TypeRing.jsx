import { TYPE_LABELS } from '../lib/fields.js';
import { formatAchievement } from '../lib/progress.js';

const C = 84; // centre of the 168 × 168 viewBox
const RINGS = [
  { type: 'reels', r: 71 }, // outer ring = Reels (orange)
  { type: 'feed', r: 52 }, // inner ring = Feed (violet)
];

function describe(type, u, t) {
  const name = TYPE_LABELS[type];
  if (t == null || t === 0) return `${name}: ${u} uploaded, no ${name} target`;
  return `${name}: ${u} of ${t}${u > t ? `, ${u - t} over` : ''}`;
}

/**
 * The double ring (09 §8): each ring is uploaded ÷ that type's target over a faint track.
 * Full above 100%, with a "+N" badge at the top; a dashed track when the type has no target.
 * The centre shows the total achievement. Drawn once with GSAP on load (motion.js).
 */
export function TypeRing({ target, uploaded, achievement, size = 168 }) {
  const label = `${formatAchievement(achievement)} of the target. ${RINGS.map(({ type }) =>
    describe(type, uploaded[type], target ? target[type] : null),
  ).join('. ')}.`;

  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 168 168" width={size} height={size} aria-hidden="true" focusable="false">
        {RINGS.map(({ type, r }) => {
          const t = target ? target[type] : 0;
          const u = uploaded[type];
          const circ = 2 * Math.PI * r;
          const ratio = t > 0 ? Math.min(u / t, 1) : 0;
          const offset = circ * (1 - ratio);
          const over = t > 0 ? u - t : 0;
          return (
            <g key={type} className={`ring-${type}`}>
              <circle cx={C} cy={C} r={r} className={`ring-track${t > 0 ? '' : ' is-none'}`} />
              {ratio > 0 && (
                <circle
                  cx={C}
                  cy={C}
                  r={r}
                  className="ring-arc"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  data-circ={circ}
                  transform={`rotate(-90 ${C} ${C})`}
                />
              )}
              {over > 0 && (
                <g className="ring-badge" transform={`translate(${C} ${C - r})`}>
                  <rect x={-15} y={-8} width={30} height={16} rx={8} />
                  <text x={0} y={0.5} textAnchor="middle" dominantBaseline="middle">
                    +{over}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <span className="ring-center" aria-hidden="true">
        <span className="ring-pct mono">{formatAchievement(achievement)}</span>
        <span className="ring-cap">{achievement == null ? 'no target' : 'of target'}</span>
      </span>
    </div>
  );
}
