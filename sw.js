const CACHE_VERSION = 'copa-v10.13.21'; // ⚠️ Subi a versão para forçar a atualização
const CACHE_ESTATICOS = [
  './',
  './index.html',
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

  // Ignora requisições do Firebase (o banco de dados precisa ser sempre online)
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebase.com')) {
    return;
  }

  // Se for navegação (carregar a página HTML)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copia)).catch(() => {});
          return resp;
        })
        .catch(async () => {
          // Se a rede falhar, busca no cache
          const cached = await caches.match('./index.html') || await caches.match('./');
          if (cached) return cached;
          
          // Se não tiver no cache, devolve uma página de erro VÁLIDA (evita o crash)
          return new Response('<h1>Você está offline</h1><p>O aplicativo não pôde ser carregado. Verifique sua internet.</p>', {
            status: 503,
            headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' })
          });
        })
    );
    return;
  }

  // Para outros arquivos (CSS, JS, imagens)
  event.respondWith(
    caches.match(req).then((cacheado) => {
      // Se achou no cache, retorna
      if (cacheado) return cacheado;

      // Se não achou, tenta na rede
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copia)).catch(() => {});
        }
        return resp;
      }).catch(() => {
        // Se a rede falhar e não tiver cache, devolve uma resposta vazia (evita o crash)
        return new Response('', { status: 404, statusText: 'Not Found' });
      });
    })
  );
});
