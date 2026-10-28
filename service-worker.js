const CACHE_NAME = "qg-cockpit-shell-v3";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./tasks.js", "./tasks.css", "./icon.svg"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (key) {
          return key.indexOf("qg-cockpit-shell-") === 0 && key !== CACHE_NAME;
        }).map(function (key) { return caches.delete(key); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always check the network first so a published update is visible immediately.
  event.respondWith(
    fetch(request).then(function (response) {
      if (response.ok && response.type === "basic") {
        return caches.open(CACHE_NAME).then(function (cache) {
          return cache.put(request, response.clone()).then(function () { return response; });
        });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
