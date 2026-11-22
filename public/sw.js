const CACHE = "mayi-v100";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./art/logo-wordmark-v2.webp",
  "./art/suit-tile.webp",
  "./art/card-back.webp",
  "./art/card-back-hi.webp",
  "./art/crown.webp",
  "./art/suits/heart.webp",
  "./art/suits/diamond.webp",
  "./art/suits/spade.webp",
  "./art/suits/club.webp",
  "./art/icons/play.webp",
  "./art/icons/rules.webp",
  "./art/icons/trophy.webp",
  "./art/icons/settings.webp",
  "./art/icons/mayi.webp",
  "./art/icons/out.webp",
  "./art/icons/medal1.webp",
  "./art/icons/medal2.webp",
  "./art/icons/medal3.webp",
  "./art/icons/crown.webp",
  "./art/avatars/heart-k.webp",
  "./art/avatars/heart-q.webp",
  "./art/avatars/heart-j.webp",
  "./art/avatars/diamond-k.webp",
  "./art/avatars/diamond-q.webp",
  "./art/avatars/diamond-j.webp",
  "./art/avatars/spade-k.webp",
  "./art/avatars/spade-q.webp",
  "./art/avatars/spade-j.webp",
  "./art/avatars/club-k.webp",
  "./art/avatars/club-q.webp",
  "./art/avatars/club-j.webp",
  "./art/avatars/joker.webp",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isSame = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!isSame && !isFont) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
