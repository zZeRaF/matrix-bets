// Service Worker minimal — Matrix Bets
// Stratégie : network-first pour les JSON data (toujours fresh),
// cache-first pour les assets statiques (HTML/CSS/JS/icons).

const CACHE_NAME = "matrix-bets-v4";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles/matrix.css",
  "./js/app.js",
  "./js/three-scene.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/robot-portrait-600.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache.add individuel + catch par asset : si un fichier 404,
      // on ignore juste celui-là (au lieu de bloquer toute l'install).
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
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Network-first pour data/*.json (toujours fresh à l'ouverture)
  if (url.pathname.includes("/data/") && url.pathname.endsWith(".json")) {
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
  // Cache-first pour le reste (assets statiques)
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
