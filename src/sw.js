/* eslint-disable no-restricted-globals */
/*
 * Service worker for the web version: the whole game is cached on the first visit, so it
 * starts instantly and works without internet afterwards. The build injects the list of
 * files and a version hash; a new build gets a new cache and old caches are removed.
 */
const CACHE = 'theos-balloner-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Build files carry a content hash in their name and never change: serve from cache.
  // Everything else (the page itself, manifest, icons) is fetched fresh when online so updates arrive.
  event.respondWith(url.pathname.includes('/assets/') ? cacheFirst(request) : networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    if (cached) return cached;
    throw error;
  }
}
