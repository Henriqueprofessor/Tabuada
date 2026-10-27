const CACHE_VERSION = 'copa-v10.13.20';
const CACHE_ESTATICOS = [
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.0/dist/confetti.browser.min.js',
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js'
];

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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ignora Firebase
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebase.com')) {
    return;
  }

  // 🔥 A MÁGICA ACONTECE AQUI: Se tiver ?v=, ignora o Service Worker e busca na rede!
  if (req.mode === 'navigate' || url.searchParams.has('v')) {
    return; 
  }

  // Estratégia Cache First para o resto (CSS, JS, Imagens)
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
