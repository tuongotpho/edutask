/**
 * EduTask service worker.
 *
 * Goal: let the app *open* without a network connection and load instantly on
 * repeat visits. Data still comes from Firestore (or the localStorage snapshot
 * the app already keeps) — this worker deliberately does not cache any API
 * response.
 *
 * Bump CACHE_VERSION to force every client onto a fresh shell.
 */
// Both lines below are rewritten by scripts/build-sw-precache.mjs after
// `next build`. The build id changes every deploy so old caches are discarded,
// and the URL list is the real, content-hashed asset list from `out/`.
const CACHE_VERSION = 'edutask-__BUILD_ID__';
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest']; /* __PRECACHE_URLS__ */

const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      // Build output goes in the ASSET cache and the HTML shell in the SHELL
      // cache, because that is where each is looked up again on fetch.
      //
      // Everything used to be written to SHELL_CACHE, including every
      // `/_next/static/**` chunk — while `cacheFirst`, the only reader for those
      // URLs, opens ASSET_CACHE. The two never met, so the precache was dead
      // weight: it cost a full download on install and served nothing. The app
      // looked fine because every request simply fell through to the network,
      // which is also why it was invisible until the network was not fine.
      const [shellCache, assetCache] = await Promise.all([
        caches.open(SHELL_CACHE),
        caches.open(ASSET_CACHE),
      ]);

      // Individually, so one 404 cannot abort the whole install.
      await Promise.all(
        SHELL_URLS.map(url => {
          const target = url.startsWith('/_next/static/') ? assetCache : shellCache;
          return target.add(url).catch(() => undefined);
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(name => !name.startsWith(CACHE_VERSION))
          .map(name => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

/**
 * Only same-origin GETs are handled. Everything cross-origin — Firestore,
 * Firebase Auth, Cloud Storage, the Telegram API — passes straight through, so
 * the worker can never serve a stale or partial API response, and can never
 * interfere with an auth redirect.
 */
function shouldHandle(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  // Never cache the worker or its registration checks.
  if (url.pathname === '/sw.js') return false;

  return true;
}

/** Build assets carry a content hash, so they are safe to keep forever. */
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

/**
 * Every tab in this app is a `next/dynamic` chunk, and a rejected chunk request
 * is not a recoverable error: React never mounts the component, nothing is
 * rendered, and the tab sits blank until the user reloads the whole app. To the
 * person using it that is not "a network blip", it is the tab being broken.
 *
 * So this must not reject on a failed fetch while a usable copy exists. It
 * previously did — one `await fetch()` with no catch — which turned any momentary
 * network fault into a permanently dead tab. `caches.match` is the global lookup
 * across every cache, so a copy still counts whichever cache holds it.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const cache = await caches.open(ASSET_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (first) {
    // One retry. These URLs are content-hashed and immutable, so re-requesting
    // is always safe, and the cost of not retrying is out of all proportion to
    // the cost of one extra request: a chunk that fails twice in a row is a real
    // outage, a chunk that fails once is a dropped packet that just bricked a
    // tab until the user thinks to reload.
    try {
      const retry = await fetch(request);
      if (retry.ok) cache.put(request, retry.clone());
      return retry;
    } catch {
      throw first;
    }
  }
}

/**
 * Network first so a deploy is picked up immediately; the cached copy is only
 * used when the network genuinely fails.
 */
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!shouldHandle(request)) return;

  const url = new URL(request.url);

  // The app is a single-page static export: any navigation resolves to the
  // same document, so that is the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, '/index.html'));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request, ASSET_CACHE));
});

// Lets the page trigger an immediate update instead of waiting for a reload.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
