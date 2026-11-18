/*
 * Beyondcy maintenance page: one self-contained module, shared by the Tracker (wrapped in a
 * React component) and the Dashboard (static site, loaded with <script type="module">).
 * The two copies must stay byte-identical. Pair it with maintenance.css (the host loads that).
 *
 *   const page = mountMaintenance(container, {
 *     site: 'Tracker' | 'Dashboard',
 *     endsAt,                 // ISO string | ms number | Date | null (null hides the countdown)
 *     state: 'counting',      // 'counting' | 'finishing' | 'back'
 *     logoSrc,                // URL of the Beyondcy logo (white/green wordmark)
 *     signIn: null,           // { href, onClick? } (Tracker only)
 *     onCountdownEnd() {},    // once per endsAt value, when the countdown reaches 00:00:00
 *   });
 *   page.update({ endsAt }); // merges options and re-renders only what changed
 *   page.destroy();          // removes everything it added (the shared font link stays)
 *
 * No imports, no framework. The animation is CSS keyframes (13.5 s loop); this file only
 * builds the DOM, runs the countdown, pauses the animation while the tab is hidden and
 * switches the countdown states.
 */

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Instrument+Sans:wght@400;500;600&family=Martian+Mono:wght@400;700&display=swap';

const STATE_TEXT = { finishing: 'Finishing up\u2026', back: "We're back!" };
const WINDOW_PATH =
  'M70 70C120 18 220 30 300 22C390 13 470 2 540 40C596 70 600 150 592 230C586 300 596 360 540 392C480 424 380 404 300 410C210 417 110 424 52 380C4 344 14 270 18 200C22 140 30 108 70 70Z';
const VISOR_PATH = 'M454 128Q498 150 542 128Q550 128 550 136V192Q550 200 542 200Q498 222 454 200Q446 200 446 192V136Q446 128 454 128Z';
const BODY_PATH = 'M440 80V338A58 12 0 0 0 556 338V80A58 12 0 0 0 440 80Z';
const BANDS_PATH = 'M440 102A58 12 0 0 0 556 102M440 236A58 12 0 0 0 556 236M440 300A58 12 0 0 0 556 300';

let instanceCount = 0;
let wibFormatter = null;

/** "HH:MM:SS" for a remaining time in ms. Rounds up to whole seconds, so it reads 00:00:00
 *  exactly when the time is up. Hours keep counting past 24. */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  return pad2(Math.floor(total / 3600)) + ':' + pad2(Math.floor((total % 3600) / 60)) + ':' + pad2(total % 60);
}

/** "14:30": the clock time in Asia/Jakarta (WIB), 24-hour. Accepts a Date, ms or a date string. */
export function formatWib(date) {
  const ms = toMs(date);
  if (ms === null) return '';
  try {
    if (!wibFormatter) {
      wibFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return wibFormatter.format(ms);
  } catch (e) {
    const d = new Date(ms + 7 * 3600000); // WIB is UTC+7 all year (no daylight saving)
    return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
  }
}

export function mountMaintenance(container, options) {
  if (!container || typeof container.appendChild !== 'function') {
    throw new TypeError('mountMaintenance: container must be a DOM element');
  }
  const doc = container.ownerDocument || document;
  const uid = 'bym' + (++instanceCount).toString(36) + Math.random().toString(36).slice(2, 6);

  let opts = Object.assign({}, options);
  let destroyed = false;
  let site = null;
  let state = null;
  let endsMs = null;
  let firedFor; // the endsAt value onCountdownEnd last fired for
  let tickTimer = 0;
  let endTimer = 0;
  let signLink = null;
  let logoImg = null;

  ensureFontLink(doc);

  // ---------------------------------------------------------------- DOM
  const root = make(doc, 'div', 'bym');

  const bg = make(doc, 'div', 'bym-bg');
  bg.setAttribute('aria-hidden', 'true');
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((k) => bg.appendChild(make(doc, 'span', 'bym-blob bym-blob--' + k)));
  root.appendChild(bg);

  const wrap = make(doc, 'div', 'bym-wrap');
  const top = make(doc, 'div', 'bym-top');
  const brand = make(doc, 'div', 'bym-brand');
  top.appendChild(brand);
  wrap.appendChild(top);

  const card = make(doc, 'section', 'bym-card');
  const titleId = uid + '-title';
  card.setAttribute('aria-labelledby', titleId);

  const art = make(doc, 'div', 'bym-art');
  art.setAttribute('aria-hidden', 'true');
  art.innerHTML = sceneMarkup(uid); // static markup only; no option values go through innerHTML
  card.appendChild(art);

  const copy = make(doc, 'div', 'bym-copy');
  const title = make(doc, 'h1', 'bym-title');
  title.id = titleId;
  title.textContent = 'Maintenance';
  copy.appendChild(title);

  const text = make(doc, 'p', 'bym-text');
  const siteName = make(doc, 'span', 'bym-site');
  text.appendChild(doc.createTextNode('Excel and his Workers are currently working hard on updating the '));
  text.appendChild(siteName);
  text.appendChild(doc.createTextNode('.'));
  const later = make(doc, 'span', 'bym-later');
  later.textContent = 'Please come back again later.';
  text.appendChild(doc.createTextNode(' '));
  text.appendChild(later);
  copy.appendChild(text);

  // The ticking lines are hidden from screen readers (a live countdown would be read every
  // second); a static sentence and a polite live region for state changes stand in for them.
  const count = make(doc, 'div', 'bym-count');
  count.setAttribute('aria-hidden', 'true');
  const line = make(doc, 'p', 'bym-line');
  const dot = make(doc, 'span', 'bym-dot');
  dot.appendChild(make(doc, 'span', 'bym-dot-ping'));
  line.appendChild(dot);
  const run = make(doc, 'span', 'bym-run');
  const runLabel = make(doc, 'span', 'bym-run-label');
  runLabel.textContent = 'Back in';
  const digits = make(doc, 'span', 'bym-digits');
  run.appendChild(runLabel);
  run.appendChild(doc.createTextNode(' '));
  run.appendChild(digits);
  line.appendChild(run);
  const stateLine = make(doc, 'span', 'bym-state');
  line.appendChild(stateLine);
  count.appendChild(line);
  const sub = make(doc, 'p', 'bym-sub');
  const subTime = make(doc, 'span', 'bym-sub-time');
  sub.appendChild(doc.createTextNode('around '));
  sub.appendChild(subTime);
  sub.appendChild(doc.createTextNode(' WIB'));
  count.appendChild(sub);
  copy.appendChild(count);

  const srEnds = make(doc, 'p', 'bym-sr');
  copy.appendChild(srEnds);
  const live = make(doc, 'p', 'bym-sr');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  copy.appendChild(live);

  card.appendChild(copy);
  wrap.appendChild(card);
  root.appendChild(wrap);

  // ---------------------------------------------------------------- render
  function renderSite() {
    const next = normSite(opts.site);
    if (next === site) return;
    site = next;
    siteName.textContent = site;
    root.setAttribute('data-site', site.toLowerCase());
  }

  function renderLogo() {
    const src = typeof opts.logoSrc === 'string' && opts.logoSrc ? opts.logoSrc : null;
    if (!src) {
      if (logoImg) {
        logoImg.parentNode.removeChild(logoImg);
        logoImg = null;
      }
      return;
    }
    if (!logoImg) {
      logoImg = make(doc, 'img', 'bym-logo');
      logoImg.alt = 'Beyondcy';
      logoImg.width = 993;
      logoImg.height = 209;
      logoImg.decoding = 'async';
      brand.appendChild(logoImg);
    }
    if (logoImg.getAttribute('src') !== src) logoImg.setAttribute('src', src);
  }

  function renderSignIn() {
    const s = opts.signIn;
    if (!s || typeof s !== 'object') {
      if (signLink) {
        signLink.removeEventListener('click', onSignInClick);
        signLink.parentNode.removeChild(signLink);
        signLink = null;
      }
      return;
    }
    if (!signLink) {
      signLink = make(doc, 'a', 'bym-signin');
      signLink.textContent = 'Sign in';
      signLink.addEventListener('click', onSignInClick);
      top.appendChild(signLink);
    }
    const href = typeof s.href === 'string' && s.href ? s.href : '#';
    if (signLink.getAttribute('href') !== href) signLink.setAttribute('href', href);
  }

  function onSignInClick(event) {
    const s = opts.signIn;
    if (s && typeof s.onClick === 'function') s.onClick(event);
  }

  function setEnds(value) {
    const next = toMs(value);
    if (next === endsMs) return;
    endsMs = next;
    firedFor = undefined; // a new end time gets its own onCountdownEnd
    if (endsMs === null) {
      subTime.textContent = '';
      srEnds.textContent = '';
    } else {
      const wib = formatWib(endsMs);
      subTime.textContent = wib;
      srEnds.textContent = 'Back around ' + wib + ' WIB.';
    }
    renderCount();
    tick();
  }

  function setState(value) {
    const next = value === 'finishing' || value === 'back' ? value : 'counting';
    if (next === state) return;
    state = next;
    root.setAttribute('data-state', state);
    const message = STATE_TEXT[state] || '';
    stateLine.textContent = message;
    live.textContent = message; // announced politely; empty while counting
    renderCount();
  }

  // Which countdown lines show: the running clock, a state message, or nothing.
  function renderCount() {
    const mode = state !== 'counting' ? 'message' : endsMs !== null ? 'clock' : 'none';
    count.hidden = mode === 'none';
    run.hidden = mode !== 'clock';
    sub.hidden = mode !== 'clock';
    stateLine.hidden = mode !== 'message';
    srEnds.hidden = mode !== 'clock';
    root.setAttribute('data-count', mode);
    if (mode === 'clock') digits.textContent = formatCountdown(endsMs - Date.now());
  }

  // Re-reads Date.now() on every tick (never accumulates drift) and wakes just after the next
  // whole-second boundary of the remaining time.
  function tick() {
    clearTimeout(tickTimer);
    tickTimer = 0;
    if (destroyed || endsMs === null) return;
    const remaining = endsMs - Date.now();
    if (state === 'counting') digits.textContent = formatCountdown(remaining);
    if (remaining <= 0) {
      if (firedFor !== endsMs) {
        firedFor = endsMs;
        fireEnd(endsMs);
      }
      return;
    }
    tickTimer = setTimeout(tick, ((remaining - 1) % 1000) + 1 + 16);
  }

  // Called from a timer, never from inside mountMaintenance()/update(), so the host can safely
  // call update() or destroy() from its callback.
  function fireEnd(forEnds) {
    clearTimeout(endTimer);
    endTimer = setTimeout(() => {
      endTimer = 0;
      if (destroyed || endsMs !== forEnds) return;
      const cb = opts.onCountdownEnd;
      if (typeof cb === 'function') cb();
    }, 0);
  }

  function onVisibility() {
    const hidden = doc.visibilityState === 'hidden' || doc.hidden === true;
    if (hidden) root.classList.add('bym--paused');
    else {
      root.classList.remove('bym--paused');
      tick(); // timers are throttled in background tabs; catch up at once
    }
  }

  // ---------------------------------------------------------------- go
  renderSite();
  renderLogo();
  renderSignIn();
  setState(opts.state);
  setEnds(opts.endsAt);
  renderCount();
  onVisibility();
  doc.addEventListener('visibilitychange', onVisibility);
  container.appendChild(root);

  function update(partial) {
    if (destroyed || !partial || typeof partial !== 'object') return;
    opts = Object.assign({}, opts, partial);
    const has = (k) => Object.prototype.hasOwnProperty.call(partial, k);
    if (has('site')) renderSite();
    if (has('logoSrc')) renderLogo();
    if (has('signIn')) renderSignIn();
    if (has('state')) setState(opts.state);
    if (has('endsAt')) setEnds(opts.endsAt);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearTimeout(tickTimer);
    clearTimeout(endTimer);
    doc.removeEventListener('visibilitychange', onVisibility);
    if (signLink) signLink.removeEventListener('click', onSignInClick);
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return { update, destroy };
}

// ------------------------------------------------------------------ helpers

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function make(doc, tag, className) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  return node;
}

function normSite(value) {
  const s = value == null ? '' : String(value).trim();
  if (/^tracker$/i.test(s)) return 'Tracker';
  if (/^dashboard$/i.test(s)) return 'Dashboard';
  return s || 'site'; // never render "updating the ."
}

// ms since epoch, or null. Accepts Date, number, and ISO / Postgres timestamp strings
// ("2026-11-18T07:30:00.123456+00:00", "2026-11-18 07:30:00+00").
function toMs(value) {
  if (value === null || value === undefined || value === '') return null;
  let ms;
  if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'number') ms = value;
  else {
    const raw = String(value).trim();
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?(?:\.(\d+))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i.exec(raw);
    if (m) {
      let zone = m[5] || '';
      if (/^[+-]\d{2}$/.test(zone)) zone += ':00';
      else if (/^[+-]\d{4}$/.test(zone)) zone = zone.slice(0, 3) + ':' + zone.slice(3);
      const frac = m[4] ? '.' + (m[4] + '00').slice(0, 3) : '';
      ms = Date.parse(m[1] + 'T' + m[2] + (m[3] || ':00') + frac + zone.toUpperCase());
    } else {
      ms = Date.parse(raw);
    }
  }
  return typeof ms === 'number' && isFinite(ms) ? ms : null;
}

function ensureFontLink(doc) {
  const head = doc.head || doc.getElementsByTagName('head')[0];
  if (!head) return;
  const links = head.getElementsByTagName('link');
  for (let i = 0; i < links.length; i++) {
    if (links[i].getAttribute('href') === FONT_HREF) return;
  }
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  head.appendChild(link);
}

// An 8-tooth gear centred on 0,0 (symmetric, so it spins about its own box centre), with a hole.
function gearPath(outer, inner, hole, teeth) {
  const step = (Math.PI * 2) / teeth;
  const tip = step * 0.16;
  const base = step * 0.25;
  const pt = (a, r) => (r * Math.cos(a)).toFixed(2) + ' ' + (r * Math.sin(a)).toFixed(2);
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    d += (i ? 'L' : 'M') + pt(a - base, inner) + 'L' + pt(a - tip, outer) + 'L' + pt(a + tip, outer) + 'L' + pt(a + base, inner);
    d += 'A' + inner + ' ' + inner + ' 0 0 1 ' + pt(a + step - base, inner);
  }
  d += 'ZM' + hole + ' 0A' + hole + ' ' + hole + ' 0 1 0 ' + -hole + ' 0A' + hole + ' ' + hole + ' 0 1 0 ' + hole + ' 0Z';
  return d;
}

// Code lines on the monitor: two identical blocks, so scrolling one block height loops seamlessly.
function codeLines() {
  const rows = [
    [0, 30, '#B7E27A'],
    [7, 46, '#D9D0FF'],
    [7, 26, '#FFB3D1'],
    [14, 38, '#EEF2FF'],
    [7, 20, '#D9D0FF'],
    [0, 36, '#B7E27A'],
  ];
  let out = '';
  for (let block = 0; block < 2; block++) {
    rows.forEach((r, i) => {
      out += '<rect x="' + (281 + r[0]) + '" y="' + (161 + block * 60 + i * 10) + '" width="' + r[1] + '" height="4" rx="2" fill="' + r[2] + '"/>';
    });
  }
  return out;
}

// The scene: original artwork. Everything that animates is an inner <g> without a transform
// attribute (a CSS transform would replace it); positioning lives on wrapper groups.
function sceneMarkup(u) {
  const id = (name) => 'bym-' + name + '-' + u;
  const url = (name) => 'url(#' + id(name) + ')';
  const lin = (name, x2, y2, stops) =>
    '<linearGradient id="' + id(name) + '" x1="0" y1="0" x2="' + x2 + '" y2="' + y2 + '">' + stops + '</linearGradient>';
  const rad = (name, attrs, stops) => '<radialGradient id="' + id(name) + '"' + attrs + '>' + stops + '</radialGradient>';
  const stop = (o, c, a) => '<stop offset="' + o + '" stop-color="' + c + '"' + (a === undefined ? '' : ' stop-opacity="' + a + '"') + '/>';
  const head = 'x="104" y="138" width="78" height="72" rx="18"';
  const torso = 'x="96" y="208" width="66" height="92" rx="16"';
  return (
    '<svg class="bym-scene" viewBox="0 0 600 420" width="600" height="420" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
    '<defs>' +
    '<clipPath id="' + id('win') + '"><path d="' + WINDOW_PATH + '"/></clipPath>' +
    '<clipPath id="' + id('code') + '"><rect x="275" y="157" width="90" height="48"/></clipPath>' +
    rad('wall', ' cx="42%" cy="40%" r="75%"', stop(0, '#2A2244') + stop(0.5, '#18141F') + stop(1, '#0D0B12')) +
    rad('spill', '', stop(0, '#8AA2FF', 0.36) + stop(0.55, '#6D7BFF', 0.12) + stop(1, '#6D7BFF', 0)) +
    lin('skin', 1, 1, stop(0, '#FFAD86') + stop(1, '#F47A9C')) +
    lin('torso', 1, 1, stop(0, '#F58A92') + stop(1, '#D85A88')) +
    lin('lit', 1, 0, stop(0.4, '#CFDBFF', 0) + stop(1, '#CFDBFF', 0.45)) +
    lin('shade', 1, 0, stop(0, '#2A1030', 0.4) + stop(0.55, '#2A1030', 0)) +
    '<pattern id="' + id('grid') + '" width="9" height="9" patternUnits="userSpaceOnUse">' +
    '<path d="M9 0H0V9" fill="none" stroke="#7A1E48" stroke-opacity=".22" stroke-width="1"/></pattern>' +
    '<pattern id="' + id('dots') + '" width="16" height="16" patternUnits="userSpaceOnUse">' +
    '<circle cx="8" cy="8" r="1.1" fill="#FFFFFF" fill-opacity=".07"/></pattern>' +
    lin('screen', 1, 1, stop(0, '#3653CC') + stop(1, '#5E84F4')) +
    lin('gear', 1, 1, stop(0, '#FFE3D0') + stop(1, '#FF9CC8')) +
    rad('gearglow', '', stop(0, '#FF9CC8', 0.55) + stop(0.6, '#FF8FB0', 0.13) + stop(1, '#FF8FB0', 0)) +
    lin('body', 1, 0, stop(0, '#110F17') + stop(0.45, '#1E1B28') + stop(1, '#100E15')) +
    lin('bodylit', 0, 1, stop(0, '#FF9A4A', 0.62) + stop(0.42, '#7357FF', 0.5) + stop(1, '#2F86FF', 0.78)) +
    lin('sheen', 1, 0, stop(0, '#FFFFFF', 0) + stop(0.42, '#FFFFFF', 0.16) + stop(0.6, '#FFFFFF', 0.05) + stop(1, '#FFFFFF', 0)) +
    rad('halo', '', stop(0, '#FF8A3D', 0.55) + stop(0.5, '#FF5FA2', 0.18) + stop(1, '#FF5FA2', 0)) +
    rad('core', '', stop(0, '#FFC27A', 0.9) + stop(0.6, '#FF8A3D', 0.35) + stop(1, '#FF8A3D', 0)) +
    lin('face', 0, 1, stop(0, '#FFBE6A') + stop(1, '#FF7A30')) +
    rad('iris', ' cx="40%" cy="38%" r="65%"', stop(0, '#A6DEFF') + stop(0.55, '#3C7BFF') + stop(1, '#2140C8')) +
    rad('floor', '', stop(0, '#FF9A4A', 0.5) + stop(0.5, '#4D7BFF', 0.22) + stop(1, '#4D7BFF', 0)) +
    '</defs>' +
    '<g clip-path="' + url('win') + '">' +
    // room
    '<rect width="600" height="420" fill="' + url('wall') + '"/>' +
    '<rect width="600" height="352" fill="' + url('dots') + '"/>' +
    '<rect y="352" width="600" height="68" fill="#0D0B12"/>' +
    '<path d="M0 352H600" stroke="#2A2536" stroke-width="1.5"/>' +
    // wall clock: the minute hand sweeps once per loop
    '<g transform="translate(146 86)">' +
    '<circle r="19" fill="#17141F" stroke="#3A3548" stroke-width="2"/>' +
    '<path d="M0-14.5V-11M14.5 0H11M0 14.5V11M-14.5 0H-11" stroke="#4A4460" stroke-width="1.6" stroke-linecap="round"/>' +
    '<path d="M0 0L-5.5-5.5" stroke="#8A82B4" stroke-width="2.4" stroke-linecap="round"/>' +
    '<g class="bym-clock"><circle r="14" fill="none"/><path d="M0 2V-12.5" stroke="#D6D0EC" stroke-width="1.8" stroke-linecap="round"/></g>' +
    '<circle r="2.1" fill="#D6D0EC"/>' +
    '</g>' +
    // server halo (wakes up)
    '<g class="bym-srv-halo"><circle cx="498" cy="190" r="180" fill="' + url('halo') + '"/>' +
    '<ellipse cx="498" cy="354" rx="124" ry="18" fill="' + url('floor') + '"/></g>' +
    // monitor light spill
    '<ellipse cx="290" cy="196" rx="205" ry="152" fill="' + url('spill') + '"/>' +
    // floor shadows
    '<ellipse cx="290" cy="356" rx="165" ry="7" fill="#07060A" opacity=".7"/>' +
    '<ellipse cx="498" cy="350" rx="74" ry="9" fill="#07060A" opacity=".8"/>' +
    // server, dormant: faint line-art
    '<g class="bym-srv">' +
    '<path d="' + BODY_PATH + '" fill="' + url('body') + '" stroke="#3A3548" stroke-width="1.5"/>' +
    '<ellipse cx="498" cy="80" rx="58" ry="12" fill="#1C1925" stroke="#3A3548" stroke-width="1.5"/>' +
    '<ellipse cx="498" cy="80" rx="42" ry="7.5" fill="none" stroke="#2C2838" stroke-width="1.5"/>' +
    '<path d="' + BANDS_PATH + '" fill="none" stroke="#2C2838" stroke-width="1.5"/>' +
    '<path d="' + VISOR_PATH + '" fill="#0F0D15" stroke="#36324A" stroke-width="1.5"/>' +
    '<path d="M476 254H520M476 262H520M476 270H520" stroke="#2C2838" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="482" cy="318" r="3" fill="#2A2635"/><circle cx="498" cy="318" r="3" fill="#2A2635"/><circle cx="514" cy="318" r="3" fill="#2A2635"/>' +
    '<path d="M446 346C430 362 384 364 362 354" fill="none" stroke="#24212E" stroke-width="3" stroke-linecap="round"/>' +
    '</g>' +
    // server lit from inside (wakes up)
    '<g class="bym-srv-on">' +
    '<path d="' + BODY_PATH + '" fill="' + url('bodylit') + '"/>' +
    '<path d="' + BODY_PATH + '" fill="' + url('sheen') + '"/>' +
    '<ellipse cx="498" cy="172" rx="78" ry="62" fill="' + url('core') + '"/>' +
    '<path d="' + BODY_PATH + '" fill="none" stroke="#A9C2FF" stroke-opacity=".85" stroke-width="1.5"/>' +
    '<ellipse cx="498" cy="80" rx="58" ry="12" fill="#3A2C55" stroke="#C4D3FF" stroke-opacity=".85" stroke-width="1.5"/>' +
    '<ellipse cx="498" cy="80" rx="42" ry="7.5" fill="none" stroke="#FFC27A" stroke-opacity=".6" stroke-width="1.5"/>' +
    '<path d="' + BANDS_PATH + '" fill="none" stroke="#A9C2FF" stroke-opacity=".6" stroke-width="1.5"/>' +
    '<path d="M476 254H520M476 262H520M476 270H520" stroke="#FFC98A" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="482" cy="318" r="3.3" fill="#FFB25C"/><circle cx="498" cy="318" r="3.3" fill="#8CCBFF"/><circle cx="514" cy="318" r="3.3" fill="#FFB25C"/>' +
    '</g>' +
    // the face: an orange visor with one big blue eye
    '<g class="bym-srv-face">' +
    '<path d="' + VISOR_PATH + '" fill="' + url('face') + '"/>' +
    '<path d="' + VISOR_PATH + '" fill="none" stroke="#FFE4BE" stroke-opacity=".75" stroke-width="1.5"/>' +
    '<g class="bym-eye">' +
    '<circle cx="498" cy="175" r="26" fill="#FFF5E8" stroke="#2D5BFF" stroke-width="4"/>' +
    '<g class="bym-iris">' +
    '<circle cx="498" cy="175" r="14.5" fill="' + url('iris') + '"/>' +
    '<circle cx="498" cy="175" r="6.8" fill="#0B1230"/>' +
    '<circle cx="493" cy="170" r="3.3" fill="#FFFFFF"/>' +
    '</g></g></g>' +
    // gear: floats and spins just above and behind the monitor
    '<g transform="translate(350 116)"><g class="bym-gear">' +
    '<circle r="64" fill="' + url('gearglow') + '"/>' +
    '<g class="bym-gear-spin">' +
    '<path d="' + gearPath(34, 26, 10, 8) + '" fill="' + url('gear') + '" fill-opacity=".6" fill-rule="evenodd" stroke="#FFEDE2" stroke-opacity=".9" stroke-width="1.5"/>' +
    '<circle r="17" fill="none" stroke="#FFEDE2" stroke-opacity=".5" stroke-width="1.5"/>' +
    '</g></g></g>' +
    // chair
    '<rect x="74" y="214" width="14" height="94" rx="6" fill="#2B2638"/>' +
    '<rect x="80" y="298" width="86" height="10" rx="4" fill="#332D41"/>' +
    '<rect x="117" y="308" width="9" height="30" fill="#221F2B"/>' +
    '<rect x="92" y="336" width="60" height="6" rx="3" fill="#27232F"/>' +
    '<circle cx="98" cy="348" r="5" fill="#1C1924"/><circle cx="146" cy="348" r="5" fill="#1C1924"/>' +
    // desk legs and drawer
    '<rect x="236" y="280" width="8" height="74" fill="#221F2B"/>' +
    '<rect x="398" y="280" width="8" height="74" fill="#221F2B"/>' +
    '<rect x="330" y="280" width="68" height="40" rx="3" fill="#25222E"/>' +
    '<path d="M352 300H376" stroke="#3E3850" stroke-width="2.5" stroke-linecap="round"/>' +
    // legs (in the shade under the desk) and shoes
    '<path d="M136 292H204" stroke="#C85A7E" stroke-width="22" stroke-linecap="round"/>' +
    '<path d="M207 296L211 334" stroke="#C85A7E" stroke-width="17" stroke-linecap="round"/>' +
    '<rect x="200" y="333" width="32" height="14" rx="7" fill="#3A2F4E"/>' +
    // desk top
    '<rect x="166" y="268" width="246" height="12" rx="4" fill="#2C2837"/>' +
    '<rect x="166" y="268" width="246" height="3" rx="1.5" fill="#4A4362"/>' +
    '<ellipse cx="302" cy="269" rx="84" ry="5" fill="#8CA4FF" opacity=".28"/>' +
    // far arm + hand (behind the body)
    '<path d="M144 228L198 254H250" fill="none" stroke="#C85A7E" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<g class="bym-hand bym-hand--far"><rect x="244" y="251" width="18" height="11" rx="5.5" fill="#D0668A"/></g>' +
    // body
    '<rect ' + torso + ' fill="' + url('torso') + '"/>' +
    '<rect ' + torso + ' fill="' + url('grid') + '"/>' +
    '<rect ' + torso + ' fill="' + url('shade') + '"/>' +
    // head (tilts up when the machine wakes)
    '<g class="bym-head">' +
    '<rect ' + head + ' fill="' + url('skin') + '"/>' +
    '<rect ' + head + ' fill="' + url('grid') + '"/>' +
    '<rect ' + head + ' fill="' + url('lit') + '"/>' +
    '<rect ' + head + ' fill="' + url('shade') + '"/>' +
    '<g class="bym-look">' +
    '<path d="M145 167L154 168.4M163 168.4L172 167" stroke="#4A1A38" stroke-width="2.6" stroke-linecap="round"/>' +
    '<g class="bym-blink"><rect x="146.5" y="174" width="5.5" height="8.5" rx="2.75" fill="#2A0F25"/><rect x="164.5" y="174" width="5.5" height="8.5" rx="2.75" fill="#2A0F25"/></g>' +
    '<path d="M153.5 194.5Q158.5 191.5 163.5 194.5" fill="none" stroke="#4A1A38" stroke-width="2.4" stroke-linecap="round"/>' +
    '<ellipse cx="176" cy="188" rx="4.5" ry="3" fill="#FF6F8E" opacity=".5"/>' +
    '</g></g>' +
    // "!" when the machine looks at him
    '<g transform="translate(190 116)"><g class="bym-alert">' +
    '<rect x="-3.2" y="-19" width="6.4" height="15" rx="3.2" fill="#FFC27A"/><circle cy="3" r="3.4" fill="#FFC27A"/>' +
    '</g></g>' +
    // keyboard
    '<rect x="198" y="261" width="86" height="7" rx="2.5" fill="#4A4360"/>' +
    '<rect x="198" y="261" width="86" height="2" rx="1" fill="#8A82B4"/>' +
    // near arm (outlined so it reads against the body) + hand
    '<path d="M138 230L174 262H218" fill="none" stroke="#B9497A" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M138 230L174 262H218" fill="none" stroke="#FF9C8E" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<g class="bym-hand bym-hand--near"><rect x="211" y="253" width="19" height="12" rx="6" fill="#FFB09A" stroke="#B9497A" stroke-width="1.5"/></g>' +
    // monitor
    '<rect x="300" y="263" width="50" height="5" rx="2.5" fill="#302B3D"/>' +
    '<rect x="320" y="226" width="10" height="38" fill="#26222F"/>' +
    '<rect x="268" y="150" width="104" height="78" rx="7" fill="#1E1B27" stroke="#3E3850" stroke-width="1.2"/>' +
    '<rect x="274" y="156" width="92" height="66" rx="3" fill="' + url('screen') + '"/>' +
    '<g clip-path="' + url('code') + '"><g class="bym-code">' + codeLines() + '</g></g>' +
    '<path d="M281 214l4 3-4 3" fill="none" stroke="#B7E27A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect class="bym-cursor" x="289" y="213" width="5" height="7" rx="1" fill="#EEF2FF"/>' +
    '<path d="M274 156H306L284 222H274Z" fill="#FFFFFF" opacity=".06"/>' +
    // coffee cup + steam
    '<g class="bym-steam bym-steam--a"><path d="M390 244q-4-6 0-12t0-12" fill="none" stroke="#CFC8E0" stroke-width="2" stroke-linecap="round"/></g>' +
    '<g class="bym-steam bym-steam--b"><path d="M398 242q4-6 0-12t0-12" fill="none" stroke="#CFC8E0" stroke-width="2" stroke-linecap="round"/></g>' +
    '<path d="M401 253h3a5 5 0 0 1 0 10h-3" fill="none" stroke="#D9D2E8" stroke-width="2.6"/>' +
    '<rect x="384" y="249" width="18" height="19" rx="3.5" fill="#D9D2E8"/>' +
    '<rect x="386" y="251" width="14" height="3" rx="1.5" fill="#5A3A30"/>' +
    '</g>' +
    '<path class="bym-win-edge" d="' + WINDOW_PATH + '" fill="none" stroke="#FFFFFF" stroke-opacity=".08" stroke-width="1.5"/>' +
    '</svg>'
  );
}
