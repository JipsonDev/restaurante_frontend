const CACHE_NAME = 'morena-mia-webapp-v6';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-192.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  // Solo cachea la propia app: extensiones (chrome-extension://), otros dominios y el backend quedan fuera.
  if (!url.protocol.startsWith('http')) return;
  if (self.location && url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.includes('/socket.io')) return;
  // Metro reuses bundle URLs between edits; an offline fallback can show old UI.
  if (url.searchParams.get('dev') === 'true' || url.pathname.endsWith('.bundle') || url.pathname.startsWith('/@')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Al tocar un aviso («Mesa 4 lista») se abre o se trae al frente la app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => 'focus' in client);
      return open ? open.focus() : self.clients.openWindow(event.notification.data?.url || '/');
    })
  );
});

// Aviso del servidor (Web Push): llega aunque el teléfono esté bloqueado o la app cerrada.
// Si la app está abierta y a la vista, ya sonó dentro de la app: no se repite el aviso.
const PUSH_VIBRATION = { ready: [0, 320, 120, 320, 120, 520], call: [0, 500, 150, 500], reserve: [0, 200, 100, 200], stock: [0, 200] };
self.addEventListener('push', (event) => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; } catch { message = { title: 'Morena Mía', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const watching = clients.some((client) => client.visibilityState === 'visible' && client.focused);
      if (watching && message.tag !== 'prueba') return undefined;
      return self.registration.showNotification(message.title || 'Morena Mía', {
        body: message.body || '',
        tag: message.tag || 'aviso',
        renotify: true,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: PUSH_VIBRATION[message.kind] || PUSH_VIBRATION.ready,
        requireInteraction: message.kind === 'ready' || message.kind === 'call',
        data: message.data || { url: '/' },
      });
    })
  );
});

// El navegador renovó la suscripción por su cuenta: la app la vuelve a registrar al abrirse.
self.addEventListener('pushsubscriptionchange', () => {});
