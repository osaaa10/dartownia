// Dźwięki gry. Jeśli w repozytorium są pliki public/sounds/<nazwa>.mp3, grają one
// (wszyscy słyszą to samo). Jeśli pliku nie ma, gra wbudowany sygnał.

export const SOUND_EVENTS = [
  { id: "dart", label: "Każda lotka" },
  { id: "turn", label: "Zwykła kolejka" },
  { id: "ton", label: "100+" },
  { id: "ton40", label: "140+" },
  { id: "180", label: "180" },
  { id: "bust", label: "Bust" },
  { id: "leg", label: "Wygrany leg" },
  { id: "match", label: "Wygrany mecz" },
] as const;

export type SoundEvent = (typeof SOUND_EVENTS)[number]["id"];

let ctx: AudioContext | null = null;

export function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

// Przeglądarki odblokowują dźwięk dopiero po pierwszym dotknięciu ekranu.
if (typeof window !== "undefined") {
  const unlock = () => {
    audioCtx();
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
}

const clipCache = new Map<string, Promise<AudioBuffer | null>>();

/** Wczytuje plik audio (np. "sounds/180.mp3"). Zwraca null, gdy go nie ma. */
export function loadClip(path: string): Promise<AudioBuffer | null> {
  let p = clipCache.get(path);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`./${path}`);
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || type.includes("text/html")) return null;
        const data = await res.arrayBuffer();
        const c = audioCtx();
        if (!c || data.byteLength === 0) return null;
        return await c.decodeAudioData(data);
      } catch {
        return null;
      }
    })();
    clipCache.set(path, p);
  }
  return p;
}

/** Odtwarza bufor; zwraca obietnicę zakończenia (do składania zapowiedzi). */
export function playBuffer(buf: AudioBuffer, volume: number): Promise<void> {
  const c = audioCtx();
  if (!c) return Promise.resolve();
  return new Promise((resolve) => {
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = volume;
    src.buffer = buf;
    src.connect(g).connect(c.destination);
    src.onended = () => resolve();
    src.start();
  });
}

class Sound {
  enabled = true;
  volume = 0.5;
  /** Które pliki z public/sounds/ znaleziono. */
  found: Partial<Record<SoundEvent, boolean>> = {};

  /** Sprawdza pliki dźwięków (wywoływane przy starcie). */
  async detect(): Promise<number> {
    const results = await Promise.all(SOUND_EVENTS.map(async (e) => [e.id, !!(await loadClip(`sounds/${e.id}.mp3`))] as const));
    for (const [id, ok] of results) this.found[id] = ok;
    return results.filter(([, ok]) => ok).length;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 1, delay = 0) {
    const c = audioCtx();
    if (!c) return;
    const start = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(this.volume * gain * 0.25, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private beep(e: SoundEvent) {
    switch (e) {
      case "dart": return this.tone(900, 0.04, "triangle", 0.4);
      case "turn": return this.tone(680, 0.06, "triangle", 0.6);
      case "ton": this.tone(720, 0.09); return this.tone(900, 0.11, "sine", 1, 0.09);
      case "ton40": this.tone(720, 0.08); this.tone(900, 0.08, "sine", 1, 0.08); return this.tone(1100, 0.13, "sine", 1, 0.16);
      case "180": return [600, 800, 1000, 1300].forEach((f, i) => this.tone(f, 0.12, "triangle", 1.1, i * 0.09));
      case "bust": this.tone(180, 0.18, "sawtooth", 0.8); return this.tone(120, 0.22, "sawtooth", 0.8, 0.08);
      case "leg": return [520, 660, 880].forEach((f, i) => this.tone(f, 0.15, "triangle", 1, i * 0.11));
      case "match": return [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, "triangle", 1.2, i * 0.13));
    }
  }

  play(e: SoundEvent, force = false) {
    if ((!this.enabled && !force) || this.volume <= 0) return;
    if (this.found[e]) {
      void loadClip(`sounds/${e}.mp3`).then((b) => (b ? playBuffer(b, this.volume) : this.beep(e)));
    } else {
      this.beep(e);
    }
  }
}

export const sound = new Sound();
