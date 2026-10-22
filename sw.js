/* Only caches this reader's own files. No tracking or external requests. */
const VERSION = 'quality4';
const SHELL = 'midnight-reader-shell-' + VERSION;
const PAGES = 'midnight-reader-pages';
const ROOT = new URL('./', self.location.href);
const FILES = ['index.html', 'reader.css?v=quality4', 'reader.js?v=quality4',
  'reader-core.js?v=quality4', 'reader-pagination.js?v=quality4', 'gesture-math.js?v=1',
  'book-text.js?v=2', 'vendor/page-flip.browser.js?v=reader2', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'pages/001.webp'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(FILES.map(file => new Request(new URL(file, ROOT), { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('midnight-reader-shell-') && key !== SHELL).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL), cached = await cache.match(new URL('index.html', ROOT));
      const controller = new AbortController(), timeout = cached ? setTimeout(() => controller.abort(), 2500) : null;
      try {
        const response = await fetch(request, { signal: controller.signal });
        if (!response.ok) throw new Error('Navigation unavailable');
        await cache.put(new URL('index.html', ROOT), response.clone()); return response;
      } catch { return cached || new Response('This reader is not saved offline yet. Reconnect once to load it.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
      finally { clearTimeout(timeout); }
    })()); return;
  }
  const images = /\/pages\/\d{3}\.webp$/.test(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(images ? PAGES : SHELL);
    const cached = await cache.match(request, { ignoreSearch: images }) || (images ? await (await caches.open(SHELL)).match(request, { ignoreSearch: true }) : undefined);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) { try { await cache.put(request, response.clone()); } catch {} }
    return response;
  })());
});
