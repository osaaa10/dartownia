// Service worker: zapisuje stronę w pamięci urządzenia, żeby działała bez internetu.
// Strategia: sieć najpierw dla HTML (żeby dostać nową wersję), cache najpierw dla reszty.
const CACHE = "kanciapa-dart-v3";

// Przy instalacji pobieramy stronę i wszystkie pliki, do których się odwołuje
// (skrypty, style, a z nich czcionki), żeby od razu działała bez internetu.
async function precache() {
  const c = await caches.open(CACHE);
  const base = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png"];
  await c.addAll(base);
  const html = await (await fetch("./index.html", { cache: "no-store" })).text();
  const assets = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => new URL(m[1], self.registration.scope).href);
  const extra = [];
  for (const url of assets) {
    if (!url.endsWith(".css")) continue;
    const css = await (await fetch(url)).text();
    for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
      const ref = m[1].replace(/["']/g, "");
      if (!ref.startsWith("data:")) extra.push(new URL(ref, url).href);
    }
  }
  await c.addAll([...new Set([...assets, ...extra])]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html", { ignoreVary: true })),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
