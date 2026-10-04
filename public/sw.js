// ==============================================================================
// SERVICE WORKER PWA MYPRESSING (v2) - GESTION HORS-LIGNE ET NETWORK-FIRST
// ==============================================================================

const CACHE_NAME = 'mypressing-cache-v2';
const PRECACHE_ASSETS = [
  '/',
  '/atelier',
  '/caisse',
  '/parametres',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// 1. Installation immédiate
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW v2] Pré-mise en cache des routes PWA');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activation : purge immédiate de TOUS les anciens caches (notamment v1)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW v2] Purge du cache obsolète:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Stratégie réseau : Network-First avec repli cache pour navigation et offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes non-GET ou de hot reload dev
  if (request.method !== 'GET') return;
  if (
    url.pathname.includes('/_next/webpack-hmr') ||
    url.pathname.includes('/__nextjs') ||
    url.pathname.includes('/api/')
  ) {
    return;
  }

  // Network-First pour garantir que les scripts et pages à jour sont toujours prioritaires
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Mettre en cache les pages navigables réussies
        if (
          networkResponse.status === 200 &&
          (request.mode === 'navigate' ||
            url.pathname.startsWith('/icons/') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.png'))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Repli hors-ligne en cas de perte de connexion
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Hors ligne', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
