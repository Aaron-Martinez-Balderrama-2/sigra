const CACHE_NAME = 'sigra-seguimiento-pwa-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icono.jpg',
  '/ai/cnn_tfjs/model.json',
  '/ai/cnn_tfjs/group1-shard1of1.bin',
  '/ai/cnn_tfjs/labels.json',
  '/ai/metricas_ml.json',
  '/ai/cluster_centroids.json',
  '/ai/muestras/doc_legible_080.png',
  '/ai/muestras/doc_ilegible_080.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
