const CACHE_NAME = "mc-electricity-v3";
const BASE = "/CALCULADORA-ELECTRICIDAD-";
const ASSETS = [BASE + "/", BASE + "/index.html", BASE + "/manifest.json",
  BASE + "/electricity-icon.svg", BASE + "/monte_carlo_hero.png",
  BASE + "/electricity-features.css", BASE + "/electricity-features.js",
  BASE + "/electricity-xlsx.js", BASE + "/electricity-config.js", BASE + "/electricity-cloud.js"];
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
    Promise.allSettled(ASSETS.map((url) => cache.add(url)))));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) =>
    Promise.all(names.filter((name) => name.startsWith("mc-electricity-") && name !== CACHE_NAME)
      .map((name) => caches.delete(name)))));
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(BASE + "/index.html")));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok && url.pathname.startsWith(BASE + "/")) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});