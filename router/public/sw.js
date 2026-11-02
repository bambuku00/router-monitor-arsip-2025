/* Stub: hentikan GET /sw.js 404 (cache browser/PWA lama di localhost:3000). Tidak cache apa pun. */
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
