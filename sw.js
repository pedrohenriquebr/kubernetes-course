/* Service Worker — K8s para Devs .NET
 * Estratégia: precache do shell + cache-first p/ assets locais,
 * network-first p/ navegação, stale-while-revalidate p/ CDN (fontes/imagens).
 * Ao publicar uma nova versão do curso, incremente CACHE_VERSION. */
const CACHE_VERSION = 'k8sjourney-v3';
const CACHE = CACHE_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/helpers.js',
  './js/curso.js',
  './js/app.js',
  './js/modulos/mod0.js',
  './js/modulos/mod1.js',
  './js/modulos/mod2.js',
  './js/modulos/mod3.js',
  './js/modulos/mod4.js',
  './js/modulos/mod5.js',
  './js/modulos/mod6.js',
  './js/modulos/mod7.js',
  './js/modulos/mod8.js',
  './js/modulos/mod9.js',
  './js/modulos/mod10.js',
  // CDN críticos (jsdelivr envia CORS → podem entrar no precache)
  'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/400.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/600.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/700.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/800.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.1.0/400.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.1.0/600.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/material-icons@5.1.0/400.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/material-icons@5.1.0/files/material-icons-latin-400-normal.woff2',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-yaml.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-csharp.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-docker.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-json.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-go.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-powershell.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca servir o próprio sw.js do cache — senão o browser nunca detecta atualizações
  if (url.pathname.endsWith('/sw.js')) {
    event.respondWith(fetch(req));
    return;
  }

  // Navegação: network-first (sempre tenta a versão nova; cache como fallback offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Mesma origem (js, manifest, ícones): cache-first + atualização em background
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Cross-origin (CDN: fontes, PrismJS, imagens): stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
