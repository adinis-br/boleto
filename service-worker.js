const CACHE_NAME = 'leitor-img-v1';
const SHARE_CACHE = 'share-target-cache';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Intercepta requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Lógica Especial para Share Target (Compartilhamento de Arquivos)
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          // 1. Pega os dados do formulário enviado pelo Android/iOS
          const formData = await event.request.formData();
          const file = formData.get('file');

          if (file) {
            // 2. Salva o arquivo no Cache Storage para o App ler depois
            const cache = await caches.open(SHARE_CACHE);
            // Salvamos com uma chave fixa 'shared-image'
            await cache.put('shared-image', new Response(file, {
              headers: { 'content-type': file.type }
            }));
          }

          // 3. Redireciona o usuário para a home do app com uma flag
          return Response.redirect('/?share_processing=true', 303);
        } catch (err) {
          console.error('Erro no Share Target:', err);
          return Response.redirect('/?error=share_failed', 303);
        }
      })()
    );
  }
});