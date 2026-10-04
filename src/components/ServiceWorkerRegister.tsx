'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker enregistré avec succès:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Erreur enregistrement Service Worker:', err);
        });
    }
  }, []);

  return null;
}
