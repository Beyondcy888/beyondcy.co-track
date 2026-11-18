// Skeleton loading (update v4, file 11): soft placeholder shapes that match the layout about to
// appear, so the page never jumps when data arrives.
//
//   - shapes are --raised on the normal surfaces, with the same corner radius as the real element
//   - a slow, gentle shimmer (about 1.4 s); under prefers-reduced-motion a calm static shape
//   - shown only if loading takes longer than ~150 ms (a CSS animation delay: no timers, and the
//     space is kept during those 150 ms, so nothing jumps)
//   - the region has aria-busy="true" + an aria-label; the shapes are hidden from screen readers
//   - real content fades in (~150 ms) in the same place with <FadeIn>
// Not for tiny "saving…" indicators on buttons and fields: those stay small.

const px = (v) => (typeof v === 'number' ? `${v}px` : v);

/** A text line. `size`: xs 8 · sm 10 · md 12 · lg 16 · xl 24 · num 40 (a big number). */
export function SkeletonLine({ width = '100%', size = 'md', className = '', style }) {
  return <span className={`sk sk-line sk-line--${size} ${className}`} style={{ width: px(width), ...style }} />;
}

/** A rectangle: boxes, cards, images, inputs. */
export function SkeletonBlock({ width = '100%', height = 40, radius, className = '', style, children }) {
  return (
    <span className={`sk sk-block ${className}`} style={{ width: px(width), height: px(height), ...(radius != null ? { borderRadius: px(radius) } : {}), ...style }}>
      {children}
    </span>
  );
}

/** A photo circle. */
export function SkeletonCircle({ size = 28, className = '' }) {
  return <span className={`sk sk-circle ${className}`} style={{ width: px(size), height: px(size) }} />;
}

/**
 * The loading region: announces loading to screen readers and holds the shapes.
 * `as` lets it stand in for the real element (e.g. 'section', 'li', 'tbody').
 */
export function SkeletonRegion({ label = 'Loading content', as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`sk-region ${className}`} aria-busy="true" aria-label={label} {...rest}>
      <span className="sr-only">{label}</span>
      <div className="sk-shapes" aria-hidden="true">
        {children}
      </div>
    </Tag>
  );
}

/** Real content that just replaced a skeleton: fades in once, in the same place. */
export function FadeIn({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`sk-fade-in ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** A list of rows: photo circle + two lines (Projects, Activity Logs, People, comments, history). */
export function SkeletonRows({ count = 3, circle = 28, widths = ['38%', '72%'], className = '' }) {
  return (
    <div className={`sk-rows ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sk-row">
          {circle ? <SkeletonCircle size={circle} /> : null}
          <div className="sk-row-lines">
            <SkeletonLine width={widths[0]} size="sm" />
            <SkeletonLine width={i % 2 ? `calc(${widths[1]} - 14%)` : widths[1]} size="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}
