// Service Worker — Matrix Bets / BeTime
// Stratégie :
//   - HTML / index : NETWORK-FIRST (toujours frais, fallback cache)
//   - data/*.json : NETWORK-FIRST
//   - reste (CSS/JS/icons) : CACHE-FIRST avec bumping de version

const CACHE_NAME = "betime-v7";
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
      // Supprime tous les anciens caches
      caches.keys().then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      ),
      // Prend immédiatement le contrôle des clients (onglets ouverts)
      self.clients.claim(),
    ]).then(() => {
      // Si un SW remplaçait un ancien SW actif, on notifie les clients de reload
      // pour qu'ils prennent la nouvelle version sans attendre un refresh manuel
      return self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "RELOAD_FOR_UPDATE", cache: CACHE_NAME });
        });
      });
    })
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

  // data/*.json : NETWORK-FIRST
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

  // Reste (CSS/JS/icons) : CACHE-FIRST
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
