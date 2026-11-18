// Push notifications in the browser (update v4, file 06 Part A).
//   - the service worker (public/sw.js) is registered at BASE_URL + 'sw.js' with scope BASE_URL
//   - turning on is always a person's click: permission → pushManager.subscribe → save_push_subscription
//   - turning off: unsubscribe + remove_push_subscription
//   - when the app opens with permission granted, the device's subscription is saved again
//     silently (it may have changed, or someone else signed in on this device: it moves to them)
//   - no VAPID public key configured → "Not available here"
// No how-to text in the app: the owner explains installing to the home screen.

const BASE = import.meta.env.BASE_URL;
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
// `npm run mock`: no push service there, so the switch works against the mock API only
const FAKE = import.meta.env.MODE === 'mock';
const WANT = 'byc.push.want'; // this device's person wants notifications (to re-subscribe silently)

const fake = { on: false };

function remember(on) {
  try {
    if (on) localStorage.setItem(WANT, '1');
    else localStorage.removeItem(WANT);
  } catch {
    /* storage blocked: re-subscribing silently just won't happen */
  }
}

function wanted() {
  try {
    return localStorage.getItem(WANT) === '1';
  } catch {
    return false;
  }
}

/** 'ok' · 'unsupported' (no service workers / push here, e.g. iPhone outside the home-screen app, or no key) */
export function pushSupport() {
  if (FAKE) return 'ok';
  if (typeof window === 'undefined' || !window.isSecureContext) return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (!VAPID) return 'unsupported';
  return 'ok';
}

/** 'default' · 'granted' · 'denied' */
export function permission() {
  if (FAKE) return fake.on ? 'granted' : 'default';
  return typeof Notification === 'undefined' ? 'denied' : Notification.permission;
}

function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function registerWorker() {
  if (FAKE || pushSupport() !== 'ok') return null;
  try {
    return await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });
  } catch {
    return null;
  }
}

async function subscription() {
  if (FAKE) return fake.on ? { endpoint: 'https://push.example.test/mock-device' } : null;
  const reg = (await navigator.serviceWorker.getRegistration(BASE)) ?? (await registerWorker());
  return reg ? reg.pushManager.getSubscription() : null;
}

function keysOf(sub) {
  if (FAKE) return { p256dh: 'mock-p256dh', auth: 'mock-auth' };
  const json = sub.toJSON();
  return { p256dh: json.keys?.p256dh, auth: json.keys?.auth };
}

async function save(api, sub) {
  const { p256dh, auth } = keysOf(sub);
  return api.savePushSubscription({ endpoint: sub.endpoint, p256dh, auth, userAgent: navigator.userAgent });
}

/** The switch's state: 'on' · 'off' · 'blocked' · 'unsupported'. */
export async function pushState() {
  if (pushSupport() !== 'ok') return 'unsupported';
  const perm = permission();
  if (perm === 'denied') return 'blocked';
  if (perm !== 'granted') return 'off';
  const sub = await subscription();
  return sub ? 'on' : 'off';
}

/** Turn on (call from a click). Returns { state, error? }. */
export async function turnOn(api) {
  if (FAKE) {
    fake.on = true;
    const r = await save(api, await subscription());
    return r.error ? { state: 'off', error: r.error } : { state: 'on' };
  }
  const answer = await Notification.requestPermission();
  if (answer === 'denied') return { state: 'blocked' };
  if (answer !== 'granted') return { state: 'off' };
  const reg = await registerWorker();
  if (!reg) return { state: 'unsupported' };
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  try {
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
  } catch (error) {
    return { state: 'off', error };
  }
  const r = await save(api, sub);
  if (r.error) {
    await sub.unsubscribe().catch(() => {});
    return { state: 'off', error: r.error };
  }
  remember(true);
  return { state: 'on' };
}

/** Turn off: this device stops getting notifications. */
export async function turnOff(api) {
  const sub = await subscription();
  remember(false);
  if (FAKE) fake.on = false;
  if (!sub) return { state: 'off' };
  const endpoint = sub.endpoint;
  if (!FAKE) await sub.unsubscribe().catch(() => {});
  const r = await api.removePushSubscription(endpoint);
  return r.error ? { state: 'off', error: r.error } : { state: 'off' };
}

/**
 * When the app opens (signed in): with permission granted, save this device's subscription
 * again (silently); if the browser dropped it but this device wanted notifications, subscribe again.
 */
export async function resync(api) {
  if (FAKE || pushSupport() !== 'ok' || permission() !== 'granted') return;
  try {
    const reg = await registerWorker();
    if (!reg) return;
    let sub = await reg.pushManager.getSubscription();
    if (!sub && wanted()) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
    if (sub) await save(api, sub);
  } catch {
    /* silent: the switch shows the real state when opened */
  }
}

/** The service worker asks an open tab to go to a notification's page (when it can't navigate it itself). */
export function listenForNavigation(navigate) {
  if (FAKE || typeof navigator === 'undefined' || !navigator.serviceWorker) return () => {};
  const onMessage = (e) => {
    if (e.data?.type !== 'navigate' || typeof e.data.url !== 'string') return;
    const url = new URL(e.data.url, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith(BASE)) return;
    navigate(`/${url.pathname.slice(BASE.length)}${url.search}`);
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
