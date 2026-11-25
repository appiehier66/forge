// Offline: eerst netwerk (zodat updates direct binnenkomen), anders de cache.
const CACHE = "forge-v7";
const IMG_CACHE = "forge-img-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "data.js", "coach.js", "ai.js", "howto.js", "exercises-db.js", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Oefenfoto's: uit de cache als we ze al eens gezien hebben (werkt dan ook offline)
  if (url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("/free-exercise-db@")) {
    e.respondWith(caches.open(IMG_CACHE).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
