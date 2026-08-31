/*
 * Minimal offline shell. The app is useless if it won't open at 6am on a bad
 * connection, so the shell is cached and API calls always go to the network.
 */
// Bumped when the caching rules change, so an installed PWA drops what an
// older worker stored under the previous rules.
const CACHE = "discipline-v2";
const SHELL = [
  "/",
  "/week",
  "/grid",
  "/habits",
  "/settings",
  "/login",
  "/signup",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never serve stale data — a cached habit grid is a lie.
  if (url.origin !== self.location.origin) return;

  /*
   * The API is proxied under /api on this origin, so it is same-origin now and
   * would otherwise fall straight into the cache-on-success branch below. That
   * would put signed-in responses into a shared cache — the next account on
   * this device could be served the last one's day — and on a flaky connection
   * would answer an API call with a stale body, or with the "/" HTML shell that
   * the offline fallback returns, which is not JSON and blows up at the caller.
   *
   * Auth and data always go to the network, and fail honestly when it is gone.
   */
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("/"))),
  );
});
