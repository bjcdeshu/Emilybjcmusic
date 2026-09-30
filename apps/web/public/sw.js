/* Static shell only. Never store API, cookies, QR, covers, or any audio. */
const CACHE = "emily-public-shell-v1";
const SHELL = ["/index.html", "/manifest.webmanifest", "/icon.svg", "/icons/emily-192.png", "/icons/emily-512.png", "/icons/emily-maskable-512.png"];
const STATIC_ASSET = /^\/assets\/[A-Za-z0-9_-]+\.(?:js|css)$/;
const eligible = (url) => url.origin === self.location.origin && !url.search && (SHELL.includes(url.pathname) || STATIC_ASSET.test(url.pathname));
const publicRequest = (url) => new Request(url.href, { credentials: "omit", cache: "no-cache" });

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of SHELL) {
      const url = new URL(path, self.location.origin);
      const response = await fetch(publicRequest(url));
      if (!response.ok || response.type === "opaque") throw new Error("Shell unavailable");
      await cache.put(publicRequest(url), response);
    }
    // Pre-cache only the build's public JS/CSS so the offline shell can boot.
    const html = await (await cache.match("/index.html")).text();
    const paths = [...html.matchAll(/(?:src|href)="(\/assets\/[A-Za-z0-9_-]+\.(?:js|css))"/g)].map((match) => match[1]);
    for (const path of paths) {
      const url = new URL(path, self.location.origin);
      const response = await fetch(publicRequest(url));
      if (response.ok && response.type !== "opaque") await cache.put(publicRequest(url), response);
    }
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("emily-public-shell-") && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Navigation is the static Vite shell, not server-rendered private content.
  if (request.mode === "navigate" && url.origin === self.location.origin && !url.pathname.startsWith("/api/") && (url.pathname === "/" || url.pathname === "/index.html")) {
    event.respondWith((async () => {
      try { return await fetch(publicRequest(new URL("/index.html", self.location.origin))); }
      catch { return (await caches.match("/index.html")) || new Response("Emily is offline", { status: 503 }); }
    })());
    return;
  }
  if (!eligible(url)) return;
  event.respondWith((async () => {
    const cleanRequest = publicRequest(url);
    const cached = await caches.match(cleanRequest);
    if (cached) return cached;
    const response = await fetch(cleanRequest);
    if (response.ok && response.type !== "opaque") (await caches.open(CACHE)).put(cleanRequest, response.clone());
    return response;
  })());
});
