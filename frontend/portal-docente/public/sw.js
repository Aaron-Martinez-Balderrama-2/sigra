const CACHE_NAME = 'sigra-docente-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icono.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET dentro del mismo origen
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // No cachear llamadas a APIs de microservicios backend (:8081, :8001, :3000)
  if (url.port === '8081' || url.port === '8001' || url.port === '3000') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Retornar caché y actualizar en segundo plano
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).catch(async () => {
        // Si no hay red y es navegación HTML, retornar index.html
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
        }
        return new Response('Network offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
