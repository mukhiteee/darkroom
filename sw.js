const SHELL_CACHE = 'darkroom-shell-v3';
const AI_MODEL_CACHE = 'darkroom-ai-weights-v1';

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './favicon.svg',
  './og-image.png',
  './js/app.js',
  './js/core/engine.js',
  './js/core/exporter.js',
  './js/tools/convert.js',
  './js/tools/transform.js',
  './js/tools/slicer.js',
  './js/tools/watermark.js',
  './js/tools/color-redact.js',
  './js/tools/cutout.js',
  './js/tools/utilities.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== AI_MODEL_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cache-first for on-demand AI segmentation weights / WASM from jsDelivr
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('staticimgly.com')) {
    event.respondWith(
      caches.open(AI_MODEL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      })
    );
    return;
  }

  // Cache-first with network fallback for local app shell
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
