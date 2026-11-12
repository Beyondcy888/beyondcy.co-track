// Profile photos everywhere a person is shown (update v3, file 03).
// One shared <Avatar>: the photo when there is one, else the first letter of the display
// name on a muted tone that is always the same for the same person. Never a broken image:
// the letter stays underneath until the photo has loaded, and comes back if it fails.
import { useEffect, useState } from 'react';
import { useAppDataOptional } from '../data/AppDataProvider.jsx';
import { initialOf, toneIndex } from '../lib/avatar.js';

/** Sizes used across the app: 20 (chips, tables), 28 (rows), 40 (lists), 64 (dialogs). */
export const AVATAR_SIZES = [20, 28, 40, 64];

const FORMER = 'Former member';

/**
 * `id` looks the person up in the directory (name + photo). `name` is the fallback when the
 * id is unknown (e.g. a comment's stored author name). With `labelled`, the avatar carries
 * the name itself (tooltip + aria-label) for places where only photos fit.
 */
export function Avatar({ id = null, name = null, size = 28, className = '', labelled = false, src = undefined }) {
  const app = useAppDataOptional();
  const person = id ? app?.peopleById?.[id] : null;
  const displayName = person?.display_name ?? name ?? FORMER;
  const url = src !== undefined ? src : id ? app?.photoUrls?.[id] ?? null : null;
  const [state, setState] = useState({ url: null, status: 'idle' }); // 'loaded' | 'failed' for this url

  useEffect(() => {
    setState((s) => (s.url === url ? s : { url, status: 'idle' }));
  }, [url]);

  const status = state.url === url ? state.status : 'idle';
  const showImg = Boolean(url) && status !== 'failed';
  const a11y = labelled ? { role: 'img', 'aria-label': displayName, title: displayName } : { 'aria-hidden': true };

  return (
    <span
      className={`avatar${status === 'loaded' && showImg ? ' has-photo' : ''} ${className}`}
      data-tone={toneIndex(id ?? displayName)}
      style={{ '--av': `${size}px` }}
      {...a11y}
    >
      <span className="avatar-letter">{initialOf(displayName)}</span>
      {showImg && (
        <img
          className="avatar-img"
          src={url}
          alt=""
          decoding="async"
          draggable={false}
          onLoad={() => setState({ url, status: 'loaded' })}
          onError={() => setState({ url, status: 'failed' })}
        />
      )}
    </span>
  );
}

/** Photo + name on one line ("[A] Arum"). `suffix` adds dim text after the name. */
export function Person({ id, name = null, size = 20, className = '', suffix = null, truncate = true }) {
  const app = useAppDataOptional();
  const displayName = (id ? app?.peopleById?.[id]?.display_name : null) ?? name ?? FORMER;
  return (
    <span className={`person ${className}`}>
      <Avatar id={id} name={displayName} size={size} />
      <span className={`person-name${truncate ? ' truncate' : ''}`}>
        {displayName}
        {suffix}
      </span>
    </span>
  );
}

/**
 * Overlapping photos for tight places (calendar chips, project rows). Each one has a
 * tooltip and an aria-label with the display name; "+N" names the rest.
 */
export function AvatarStack({ ids, size = 20, max = 3, className = '' }) {
  const app = useAppDataOptional();
  if (!ids?.length) return null;
  const shown = ids.length > max ? ids.slice(0, max - 1) : ids;
  const rest = ids.slice(shown.length);
  const nameOf = (id) => app?.peopleById?.[id]?.display_name ?? FORMER;
  return (
    <span className={`avatar-stack ${className}`} style={{ '--av': `${size}px` }}>
      {shown.map((id) => (
        <Avatar key={id} id={id} size={size} labelled />
      ))}
      {rest.length > 0 && (
        <span className="avatar avatar-more" role="img" aria-label={rest.map(nameOf).join(', ')} title={rest.map(nameOf).join(', ')}>
          <span className="avatar-letter">+{rest.length}</span>
        </span>
      )}
    </span>
  );
}

/** "Arum, Ilyas and Anne" for tooltips and screen readers. */
export function namesOf(app, ids) {
  const names = ids.map((id) => app?.peopleById?.[id]?.display_name ?? FORMER);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
