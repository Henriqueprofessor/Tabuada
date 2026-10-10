// ═══════════════════════════════════════════════════════════════════════
//  sw.js — Service Worker da Copa da Tabuada CEIB 2026
//  Coloque este arquivo na MESMA pasta do index.html
//  Estratégia: cache-first para assets estáticos + network-only para Firebase
// ═══════════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'copa-v10.4.0';
const CACHE_ESTATICOS = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.0/dist/confetti.browser.min.js',
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js'
];

// ─── install: pré-cacheia os assets estáticos ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.allSettled(
        CACHE_ESTATICOS.map((url) => cache.add(url).catch((e) => {
          console.warn('[SW] Falha ao pré-cachear:', url, e && e.message);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── activate: limpa caches antigos ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── fetch: estratégia por tipo de requisição ───
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase (Realtime Database) — sempre rede, nunca cache
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebase.com')) {
    return; // deixa passar direto
  }

  // Navegação (abrir o app) — network-first, fallback cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copia)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Demais assets — cache-first, com atualização em background
  event.respondWith(
    caches.match(req).then((cacheado) => {
      const fetchPromise = fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copia)).catch(() => {});
        }
        return resp;
      }).catch(() => null);

      return cacheado || fetchPromise;
    })
  );
});
