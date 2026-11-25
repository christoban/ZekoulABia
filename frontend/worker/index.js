/**
 * Worker personnalisé fusionné dans le Service Worker généré par next-pwa (voir
 * customWorkerSrc dans next.config.ts — next-pwa cherche worker/index.js automatiquement,
 * le compile et l'importe dans le sw.js final via importScripts). Gère la réception des
 * notifications Web Push (Service Worker + VAPID, voir PLAN_NOTIFICATIONS_PUSH.md) —
 * distinct du cache/precaching hors-ligne que next-pwa génère lui-même dans le même fichier.
 */
self.addEventListener('push', function (event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try {
      payload = { body: event.data && event.data.text() };
    } catch {
      payload = {};
    }
  }
  const title =
    payload.title || payload.titre || (payload.data && (payload.data.title || payload.data.titre)) || 'ZekoulABia';
  const body =
    payload.body || payload.corps || (payload.data && (payload.data.body || payload.data.corps)) || '';
  const notificationId = payload.notificationId || (payload.data && payload.data.notificationId) || null;
  const data = {
    ...(payload.data || {}),
    notificationId,
    url: (payload.data && payload.data.url) || '/login',
  };
  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data,
    silent: false,
  };

  event.waitUntil(
    (async function () {
      await self.registration.showNotification(title, options);
      if (notificationId) {
        try {
          await fetch('/api/v2/notifications/' + notificationId + '/delivered', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {}
      }
    })(),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/login';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clients) {
        for (const client of clients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});
