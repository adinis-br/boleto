const CACHE_NAME = 'leitor-img-v2'; // Incrementado para v2 para limpar caches antigos
const SHARE_CACHE = 'share-target-cache';

// Arquivos para cachear imediatamente
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força o novo SW a assumir imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // Controla a página imediatamente
  
  // Limpa caches antigos (v1) para evitar conflitos
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== SHARE_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Lógica Especial para Share Target (POST)
  // ACEITA AMBOS: O endereço antigo (/share-target) E o novo (/?share_target=true)
  const isShareRequest = event.request.method === 'POST' && (
    url.pathname === '/share-target' || 
    url.searchParams.get('share_target') === 'true'
  );

  if (isShareRequest) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('file');

          if (file) {
            const cache = await caches.open(SHARE_CACHE);
            // Salva a imagem no cache
            await cache.put('shared-image', new Response(file, {
              headers: { 'content-type': file.type }
            }));
          }
          
          // Redireciona SEMPRE para a raiz limpa com a flag de processamento
          // Usamos 303 See Other para transformar o POST em GET
          return Response.redirect('/?share_processing=true', 303);
        } catch (err) {
          console.error('Erro no Share Target:', err);
          return Response.redirect('/?error=share_failed', 303);
        }
      })()
    );
    return;
  }

  // 2. Lógica de Cache para o App (GET) - Network First para HTML, Cache First para estáticos
  if (event.request.method === 'GET') {
    // Para HTML (navegação), tenta rede primeiro para garantir versão nova, depois cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(event.request);
            })
        );
        return;
    }

    // Para outros arquivos (CSS, JS, Imagens), Stale-While-Revalidate
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
           // Silêncio é ouro
        });
        return cachedResponse || fetchPromise;
      })
    );
  }
});