// Beyondcy Tracker service worker (update v4, file 06): push notifications only.
// No offline caching. The base path comes from this worker's own scope, never written here.
const SCOPE = self.registration.scope; // e.g. https://beyondcy888.github.io/beyondcy.co-track/

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// payload from the send-reminders Edge Function: { title, body, tag, url, icon, badge }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const icon = new URL('icon-192.png', SCOPE).href;
  event.waitUntil(
    self.registration.showNotification(data.title || 'Beyondcy Tracker', {
      body: data.body || '',
      icon: data.icon || icon,
      badge: data.badge || icon,
      // the same tag replaces the earlier notification instead of stacking (and still alerts)
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || SCOPE },
    }),
  );
});

// tapping it: focus an open tracker window and go to the page, or open a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || SCOPE, SCOPE).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => w.url.startsWith(SCOPE));
      if (open) {
        await open.focus();
        try {
          await open.navigate(target);
        } catch {
          open.postMessage({ type: 'navigate', url: target }); // the app navigates itself
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
