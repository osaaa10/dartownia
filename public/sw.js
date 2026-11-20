// Service worker: zapisuje stronę w pamięci urządzenia, żeby działała bez internetu.
// Strategia: sieć najpierw dla HTML (żeby dostać nową wersję), cache najpierw dla plików
// z hashem w nazwie (assets/), a dla reszty (dźwięki, lektor, ikony) — z pamięci,
// z odświeżeniem w tle, żeby podmienione pliki dźwięków trafiły do wszystkich.
const CACHE = "kanciapa-dart-v8";

const SOUND_NAMES = ["dart", "turn", "ton", "ton40", "180", "bust", "leg", "match"];
const NUMBERS = Array.from({ length: 181 }, (_, i) => String(i));
const PHRASES = ["zostaje", "bust", "gameshot", "match", "teraz", "do-konca", "zakonczenie", "treble", "double", "bull"];
// Domyślny podział stylów lektora — te nagrania zapisujemy od razu do pracy offline.
// Inne style aplikacja dociąga w tle po wybraniu ich w ustawieniach.
const DEFAULT_STYLE_FOR = (n) => (n < 50 ? "calm" : n < 100 ? "confident" : n < 150 ? "energetic" : n < 180 ? "enthusiastic" : "ecstatic");

async function cacheIfExists(c, path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    const type = res.headers.get("content-type") || "";
    if (res.ok && !type.includes("text/html")) await c.put(path, res);
    return res.ok;
  } catch {
    return false;
  }
}

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
  // Własne dźwięki i nagrany lektor (jeśli są w repozytorium).
  // Każdy dźwięk może mieć warianty: 180.mp3, 180-2.mp3 … 180-5.mp3.
  await Promise.all(
    SOUND_NAMES.map(async (n) => {
      if (!(await cacheIfExists(c, `./sounds/${n}.mp3`))) return;
      for (let v = 2; v <= 5; v++) if (!(await cacheIfExists(c, `./sounds/${n}-${v}.mp3`))) break;
    }),
  );
  // Niespodzianki: surprise.mp3, surprise-2.mp3 … surprise-10.mp3.
  if (await cacheIfExists(c, "./sounds/surprise.mp3")) {
    for (let v = 2; v <= 10; v++) if (!(await cacheIfExists(c, `./sounds/surprise-${v}.mp3`))) break;
  }
  // Zwroty lektora i ich warianty (bust.mp3, bust-2.mp3…).
  await Promise.all(
    PHRASES.map(async (p) => {
      if (!(await cacheIfExists(c, `./voice/${p}.mp3`))) return;
      for (let v = 2; v <= 5; v++) if (!(await cacheIfExists(c, `./voice/${p}-${v}.mp3`))) break;
    }),
  );
  // Liczby w domyślnych stylach (calm/0.mp3 …) oraz spokojne do „zostaje …”.
  const nums = [...new Set([...NUMBERS.map((n) => `${DEFAULT_STYLE_FOR(Number(n))}/${n}`), ...NUMBERS.map((n) => `calm/${n}`)])];
  if (await cacheIfExists(c, "./voice/calm/0.mp3")) {
    for (let i = 0; i < nums.length; i += 12) {
      await Promise.all(nums.slice(i, i + 12).map((n) => cacheIfExists(c, `./voice/${n}.mp3`)));
    }
  }
  // Stary układ bez stylów (voice/180.mp3).
  if (await cacheIfExists(c, "./voice/180.mp3")) {
    for (let i = 0; i < NUMBERS.length; i += 12) {
      await Promise.all(NUMBERS.slice(i, i + 12).map((n) => cacheIfExists(c, `./voice/${n}.mp3`)));
    }
  }

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

  const hashed = new URL(req.url).pathname.includes("/assets/");
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          const type = res.headers.get("content-type") || "";
          if (res.ok && !type.includes("text/html")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          } else if (res.status === 404) {
            caches.open(CACHE).then((c) => c.delete(req, { ignoreVary: true }));
          }
          return res;
        })
        .catch(() => hit || Response.error());
      if (hit && hashed) return hit;
      if (hit) {
        event.waitUntil(network.catch(() => {}));
        return hit;
      }
      return network;
    }),
  );
});
