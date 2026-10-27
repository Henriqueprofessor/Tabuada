const CACHE_VERSION = 'copa-v10.13.20';
const CACHE_ESTATICOS = [
  // ⚠️ Removemos './' e './index.html' daqui para evitar o download duplo (LCP lento)
  // O HTML será salvo automaticamente no cache pelo evento 'fetch' abaixo.
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

  // Ignora requisições do Firebase
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebase.com')) {
    return;
  }

  // Network First para navegação (Garante a versão mais nova)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copia)).catch(() => {});
          return resp;
        })
        .catch(() => {
          // O ignoreSearch: true é o pulo do gato para achar o cache mesmo se a URL tiver ?v=
          return caches.match('./index.html', { ignoreSearch: true }).then((r) => r || caches.match('./', { ignoreSearch: true }));
        })
    );
    return;
  }

  // Cache First para CSS, JS, Imagens e CDNs
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
