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
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
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
          return Response.redirect('/?share_processing=true', 303);
        } catch (err) {
          console.error('Erro no Share Target:', err);
          return Response.redirect('/?error=share_failed', 303);
        }
      })()
    );
    return;
  }

  // 2. Lógica de Cache para o App (GET) - Stale-While-Revalidate
  // Isso permite que o app carregue offline, requisito para instalação PWA
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Apenas cacheia respostas válidas e do mesmo domínio (ou scripts/estilos críticos)
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
           // Se falhar a rede e não tiver cache, pode retornar uma página offline aqui se desejar
        });
        return cachedResponse || fetchPromise;
      })
    );
  }
});