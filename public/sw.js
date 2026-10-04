// ==============================================================================
// SERVICE WORKER PWA MYPRESSING - CACHE ROBUSTE & RÉSISTANCE HORS-LIGNE
// ==============================================================================

const CACHE_NAME = 'mypressing-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/atelier',
  '/caisse',
  '/parametres',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// 1. Installation du Service Worker et pré-mise en cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-mise en cache des routes d’encaissement et de l’atelier');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Nettoyage ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Stratégie réseau : Network-first avec repli sur le cache pour les pages,
// et Cache-first pour les ressources statiques
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes non GET ou externes aux APIs non supportées
  if (request.method !== 'GET') {
    return;
  }

  // Si c'est une requête de navigation HTML (routes /caisse, /atelier, /...)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Copier dans le cache pour usage ultérieur hors-ligne
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Si hors-ligne, renvoyer la version en cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('/');
          });
        })
    );
    return;
  }

  // Pour les assets statiques (_next/static, images, styles)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, resClone);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // Stratégie par défaut : Réseau d'abord, secours cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
