const CACHE_NAME = "repmate-next-v9";
const STATIC_ASSETS = [
  "/manifest.json",
  "/assets/images/logo.png",
  "/assets/images/whitelogo.png",
  "/assets/images/repmate.png",
  "/assets/images/gorillamate.png",
  "/assets/images/fallback.webp",
  "/assets/vendor/body-muscles/body-muscles.umd.min.js",
  "/legacy/vendor/supabase.js",
  "/legacy/css/reset.css",
  "/legacy/css/variables.css",
  "/legacy/css/components.css",
  "/legacy/css/layout.css",
  "/legacy/css/responsive.css",
  "/legacy/css/numeric.css",
  "/legacy/css/landing.css",
  "/legacy/css/auth-page.css",
  "/legacy/js/app.js",
  "/legacy/js/auth.js",
  "/legacy/js/db.js",
  "/legacy/js/exercises.js",
  "/legacy/js/programs.js",
  "/legacy/js/progress.js",
  "/legacy/js/pwa.js",
  "/legacy/js/router.js",
  "/legacy/js/seed-data.js",
  "/legacy/js/supabase-config.js",
  "/legacy/js/supabase.js",
  "/legacy/js/timer.js",
  "/legacy/js/ui.js",
  "/legacy/js/workout.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request, { ignoreSearch: true });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isNextFile = url.pathname.startsWith("/_next/");
  const isAsset = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/legacy/");
  event.respondWith(isNextFile ? networkFirst(event.request) : isAsset ? cacheFirst(event.request) : networkFirst(event.request));
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
