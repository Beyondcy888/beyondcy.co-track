import { useEffect, useMemo, useRef } from 'react';
import { dotPlan } from '../lib/progress.js';
import { pulseDot } from '../lib/motion.js';

/**
 * One dot per unit of target: uploaded (filled green) → planned (blue ring) →
 * remaining (small dim dot); uploads past the target continue, after a gap, as green
 * "bonus" dots with a thin outer ring. A thin tick (in --text) marks where today's pace says you should be.
 */
export function Dots({ target, uploaded, planned, pace, label, size = 'lg', showPaceLabel = false }) {
  const plan = dotPlan({ target, uploaded, planned });
  const ref = useRef(null);
  const prevDone = useRef(null);

  const paceIndex = pace?.phase === 'current' && plan.total > 0 ? Math.min(Math.max(pace.expected ?? 0, 0), plan.total) : null;

  const cells = useMemo(() => {
    const list = [];
    for (let i = 0; i < plan.filled; i += 1) list.push('filled');
    for (let i = 0; i < plan.ring; i += 1) list.push('ring');
    for (let i = 0; i < plan.empty; i += 1) list.push('empty');
    if (plan.bonus) {
      list.push('gap');
      for (let i = 0; i < plan.bonus; i += 1) list.push('bonus');
    }
    return list;
  }, [plan.filled, plan.ring, plan.empty, plan.bonus]);

  // a dot that fills while the page is open pulses once
  useEffect(() => {
    const done = plan.filled + plan.bonus;
    if (prevDone.current != null && done > prevDone.current) {
      const fills = ref.current?.querySelectorAll('.dot--filled > i, .dot--bonus > i');
      pulseDot(fills?.[fills.length - 1]);
    }
    prevDone.current = done;
  }, [plan.filled, plan.bonus]);

  return (
    <div ref={ref} className={`dots dots--${size}`} role="img" aria-label={label}>
      {cells.map((kind, i) => {
        let cls = `dot dot--${kind}`;
        if (paceIndex != null && paceIndex < plan.total && i === paceIndex) cls += ' is-pace';
        if (paceIndex != null && paceIndex === plan.total && i === plan.total - 1) cls += ' is-pace-end';
        const showLabel = showPaceLabel && cls.includes('is-pace');
        return (
          <span key={i} className={cls}>
            <i />
            {showLabel && <span className="pace-label">pace</span>}
          </span>
        );
      })}
    </div>
  );
}
