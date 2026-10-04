'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker actif (Production):', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Erreur enregistrement Service Worker:', err);
          });
      } else {
        // En développement, nettoyer les workers enregistrés pour éviter les caches de build stale
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
      }
    }
  }, []);

  return null;
}
