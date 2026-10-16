// Service worker for the installed app. Deliberately caches nothing but
// the offline page and its icon: patient data never gets stored on the
// device, so a lost or shared phone holds no records.
const CACHE = "offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Page loads go to the network as usual; only when that fails (no
// connection) show the offline page. Everything else is untouched.
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
