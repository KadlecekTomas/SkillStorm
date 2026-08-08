/* SkillStorm PWA worker.
 * Privacy invariant: never cache API/authenticated document responses. Only
 * same-origin static assets are cached opportunistically.
 */
const CACHE_NAME = "skillstorm-static-v1";
const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/images/"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("skillstorm-static-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Authenticated/business data must always remain network-only.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/app/") ||
    url.pathname === "/app"
  ) {
    return;
  }

  const isStatic = STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  if (!isStatic) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
