// The only orchestrated motion in the app (03 §4, 09 §8): on load the dots fill in sequence
// and the rings draw once; a newly uploaded dot pulses once. Nothing runs under
// prefers-reduced-motion (everything renders final).
import { gsap } from 'gsap';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Fill the coloured dots inside `root` in sequence (~600ms) and draw the rings (~700ms). Returns a cleanup. */
export function animateTrack(root) {
  if (!root || prefersReducedMotion()) return () => {};
  const ctx = gsap.context(() => {
    const dots = root.querySelectorAll('.dot--filled > i, .dot--ring > i, .dot--bonus > i');
    if (dots.length) {
      gsap.from(dots, {
        scale: 0,
        opacity: 0,
        duration: 0.28,
        ease: 'back.out(2.2)',
        stagger: { amount: 0.34 },
      });
    }
    root.querySelectorAll('.ring-arc').forEach((arc, i) => {
      gsap.from(arc, { attr: { 'stroke-dashoffset': Number(arc.dataset.circ) }, duration: 0.7, delay: i * 0.08, ease: 'power2.out' });
    });
    const badges = root.querySelectorAll('.ring-badge');
    if (badges.length) gsap.from(badges, { opacity: 0, duration: 0.25, delay: 0.6 });
  }, root);
  return () => ctx.revert();
}

/** One short pulse on a dot that just filled. */
export function pulseDot(el) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(el, { scale: 1.9 }, { scale: 1, duration: 0.55, ease: 'elastic.out(1, 0.55)', clearProps: 'transform' });
}
