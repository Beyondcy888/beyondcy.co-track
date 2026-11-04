// The login art: a black field with a dim green dot grid, where a handful of
// dots carry the status colours, including one tiny "track" row. Same language as the app.
const TRACK_ROW = ['u', 'u', 'u', 'u', 'u', 'u', 'p', 'p', 'n', 'n'];
const SCATTER = [
  { x: 2, y: 2, k: 'u' },
  { x: 9, y: 3, k: 'p' },
  { x: 5, y: 5, k: 'n' },
  { x: 12, y: 1, k: 'u' },
  { x: 1, y: 13, k: 'p' },
  { x: 11, y: 12, k: 'u' },
  { x: 7, y: 15, k: 'v' },
  { x: 13, y: 16, k: 'p' },
  { x: 3, y: 18, k: 'u' },
];

export function DotField() {
  return (
    <div className="dotfield" aria-hidden="true">
      {SCATTER.map((d) => (
        <i key={`${d.x}-${d.y}`} className={`df df-${d.k}`} style={{ '--x': d.x, '--y': d.y }} />
      ))}
      {TRACK_ROW.map((k, i) => (
        <i key={`t${i}`} className={`df df-${k}`} style={{ '--x': 2 + i, '--y': 9 }} />
      ))}
    </div>
  );
}
