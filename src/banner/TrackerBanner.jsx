import { useRef, useState } from 'react';
import { Popover } from '../ui/Popover.jsx';
import { Spinner } from '../ui/bits.jsx';
import { IconImage, IconMore, IconMove, IconTrash } from '../ui/icons.jsx';
import { BANNER_TYPES } from './useBanner.js';

const clamp = (v) => Math.min(100, Math.max(0, v));

/** How many px the image overflows the box vertically (object-fit: cover), or 0. */
function verticalOverflow(img) {
  if (!img?.naturalWidth) return 0;
  const box = img.getBoundingClientRect();
  const rendered = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight) * img.naturalHeight;
  return Math.max(0, rendered - box.height);
}

/**
 * The banner, edge to edge above the greeting (like Notion's cover). Without one, a quiet
 * "Add banner" appears when hovering the top of the page (and in the "⋯" menu for touch).
 * `ctl` comes from useBanner().
 */
export function TrackerBanner({ ctl }) {
  const imgRef = useRef(null);
  const drag = useRef(null);
  const { banner, url, busy, repositioning, positionY } = ctl;

  const input = (
    <input
      ref={ctl.inputRef}
      type="file"
      accept={BANNER_TYPES.join(',')}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={ctl.onFile}
    />
  );

  if (banner === undefined) return input; // still loading

  if (!banner) {
    return (
      <div className="banner-add-row">
        {input}
        <button type="button" className="btn btn-ghost btn-sm banner-add" onClick={ctl.pickFile} disabled={Boolean(busy)}>
          {busy === 'upload' ? <Spinner label="Uploading the banner" /> : <IconImage width={15} height={15} />}
          {busy === 'upload' ? 'Uploading…' : 'Add banner'}
        </button>
        <span className="banner-add-hint">Best size: 1500 × 600 px</span>
      </div>
    );
  }

  const onPointerDown = (e) => {
    if (!repositioning || e.button !== 0) return;
    e.preventDefault();
    drag.current = { y: e.clientY, start: positionY, overflow: verticalOverflow(imgRef.current) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || !d.overflow) return;
    // dragging down shows more of the top: the position moves toward 0%
    ctl.setDraftY(clamp(d.start - ((e.clientY - d.y) / d.overflow) * 100));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (e) => {
    if (!repositioning) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      ctl.setDraftY(clamp(positionY + (e.key === 'ArrowUp' ? 2 : -2)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ctl.savePosition();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      ctl.cancelReposition();
    }
  };

  return (
    <div className={`banner${repositioning ? ' is-repositioning' : ''}`}>
      {input}
      {url ? (
        <img
          ref={imgRef}
          className="banner-img"
          src={url}
          alt=""
          draggable={false}
          style={{ objectPosition: `50% ${positionY}%` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          tabIndex={repositioning ? 0 : undefined}
          aria-label={repositioning ? 'Banner position: use the up and down arrow keys, Enter to save' : undefined}
          onKeyDown={onKeyDown}
        />
      ) : (
        <div className="banner-img banner-loading" aria-hidden="true" />
      )}

      {repositioning ? (
        <>
          <p className="banner-hint" aria-hidden="true">
            <IconMove width={14} height={14} /> Drag the image up or down
          </p>
          <div className="banner-actions is-visible">
            <button type="button" className="banner-btn banner-btn--primary" onClick={ctl.savePosition} disabled={busy === 'position'}>
              {busy === 'position' ? 'Saving…' : 'Save position'}
            </button>
            <button type="button" className="banner-btn" onClick={ctl.cancelReposition}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="banner-actions">
          <button type="button" className="banner-btn" onClick={ctl.pickFile} disabled={Boolean(busy)}>
            Change banner
          </button>
          <button type="button" className="banner-btn" onClick={ctl.startReposition} disabled={Boolean(busy) || !url}>
            Reposition
          </button>
          <button type="button" className="banner-btn" onClick={ctl.remove} disabled={Boolean(busy)}>
            Remove
          </button>
        </div>
      )}

      {(busy === 'upload' || busy === 'remove') && (
        <div className="banner-busy">
          <Spinner label={busy === 'upload' ? 'Uploading the banner' : 'Removing the banner'} />
          {busy === 'upload' ? 'Uploading…' : 'Removing…'}
        </div>
      )}
    </div>
  );
}

/** The page's "⋯" menu: the banner actions, always reachable (touch has no hover). */
export function PageMenu({ ctl }) {
  const [anchor, setAnchor] = useState(null);
  const run = (fn) => () => {
    setAnchor(null);
    fn();
  };
  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="true"
        aria-expanded={Boolean(anchor)}
        title="More options"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <IconMore width={18} height={18} />
        <span className="sr-only">More options</span>
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} label="Page options" width={230} className="page-menu">
          {ctl.banner ? (
            <>
              <button type="button" className="menu-item" onClick={run(ctl.pickFile)} disabled={Boolean(ctl.busy)}>
                <IconImage /> Change banner
              </button>
              <button type="button" className="menu-item" onClick={run(ctl.startReposition)} disabled={Boolean(ctl.busy) || !ctl.url}>
                <IconMove /> Reposition banner
              </button>
              <button type="button" className="menu-item" onClick={run(ctl.remove)} disabled={Boolean(ctl.busy)}>
                <IconTrash /> Remove banner
              </button>
            </>
          ) : (
            <button type="button" className="menu-item" onClick={run(ctl.pickFile)} disabled={Boolean(ctl.busy) || ctl.banner === undefined}>
              <IconImage /> Add banner
              <span className="dim">1500 × 600</span>
            </button>
          )}
        </Popover>
      )}
    </>
  );
}
