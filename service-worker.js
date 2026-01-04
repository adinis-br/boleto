const CACHE_NAME = 'leitor-img-v1';
const SHARE_CACHE = 'share-target-cache';

// Arquivos para cachear imediatamente
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Lógica Especial para Share Target (POST)
  // Agora verifica se é um POST na raiz com o parâmetro share_target=true
  if (event.request.method === 'POST' && url.searchParams.get('share_target') === 'true') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('file');

          if (file) {
            const cache = await caches.open(SHARE_CACHE);
            await cache.put('shared-image', new Response(file, {
              headers: { 'content-type': file.type }
            }));
          }
          // Redireciona para limpar o POST e processar a imagem via GET
          return Response.redirect('/?share_processing=true', 303);
        } catch (err) {
          console.error('Erro no Share Target:', err);
          // Em caso de erro, redireciona para a home normalmente para não quebrar a UX
          return Response.redirect('/?error=share_failed', 303);
        }
      })()
    );
    return;
  }

  // 2. Lógica de Cache para o App (GET) - Stale-While-Revalidate
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
           // Fallback offline se necessário
        });
        return cachedResponse || fetchPromise;
      })
    );
  }
});