// Service Worker — Matrix Bets / BeTime
// Stratégie :
//   - HTML / index : NETWORK-FIRST (toujours frais, fallback cache)
//   - data/*.json : NETWORK-FIRST
//   - reste (CSS/JS/icons) : CACHE-FIRST avec bumping de version

const CACHE_NAME = "betime-v10";
const STATIC_ASSETS = [
  "./manifest.webmanifest",
  "./styles/matrix.css",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/robot-portrait-600.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((e) => {
            console.warn("[sw] skip cache for", url, e.message);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      ),
      self.clients.claim(),
    ])
    // PAS de reload forcé des clients : le fetch handler network-first sur le HTML
    // suffit à servir la dernière version au prochain chargement naturel.
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // HTML root + index.html : NETWORK-FIRST (jamais de cache servi en priorité)
  const isHtml =
    url.pathname === "/" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html");
  if (isHtml) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // data/*.json + audio/* : NETWORK-FIRST (toujours frais)
  if (
    (url.pathname.includes("/data/") && url.pathname.endsWith(".json")) ||
    url.pathname.includes("/audio/")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Reste (CSS/JS/icons) : CACHE-FIRST
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
