import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
registerRoute(/^\/api\/(shifts|oncall|teams|members)/, new NetworkFirst({ cacheName: 'api-cache' }), 'GET');

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'Shift On Call', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Shift On Call', {
      body: payload.body || '',
      icon: payload.icon || '/logo.svg',
      badge: '/logo.svg',
      vibrate: [200, 100, 200],
      data: { url: payload.url || '/' },
      requireInteraction: true,
      actions: [
        { action: 'open', title: '📋 Ver Detalhes' },
        { action: 'dismiss', title: '✕ Dispensar' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) { c.navigate(url); return c.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
