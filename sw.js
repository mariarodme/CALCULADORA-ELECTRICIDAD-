const CACHE = 'mc-electricity-v1';
const ASSETS = [
  '/calculadora-electricidad-residencial/',
  '/calculadora-electricidad-residencial/index.html',
  '/calculadora-electricidad-residencial/manifest.json'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(response) {
      return response || fetch(e.request);
    })
  );
});
