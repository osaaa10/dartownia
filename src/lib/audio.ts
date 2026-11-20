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

/** Ile wariantów jednego dźwięku sprawdzamy (180.mp3, 180-2.mp3 … 180-5.mp3). */
export const MAX_VARIANTS = 5;
/** Niespodzianek może być więcej: surprise.mp3, surprise-2.mp3 … surprise-10.mp3. */
export const MAX_SURPRISES = 10;

export function variantPath(e: string, n: number): string {
  return n === 1 ? `sounds/${e}.mp3` : `sounds/${e}-${n}.mp3`;
}

/** Najmniejsza „pula”, w której szansa wychodzi w całych kolejkach (0.2 → 1 z 5). */
function bagSize(chance: number): number {
  for (let n = 1; n <= 10; n++) if (Math.abs(chance * n - Math.round(chance * n)) < 1e-6) return n;
  return 10;
}

async function countVariants(name: string, max: number): Promise<number> {
  let n = 0;
  while (n < max && (await loadClip(variantPath(name, n + 1)))) n++;
  return n;
}

class Sound {
  enabled = true;
  volume = 0.5;
  /** Jak często zamiast/po wyniku gra niespodzianka (0 = nigdy, 0.2 = 1 z 5). */
  surpriseChance = 0;
  /** Ile wariantów każdego dźwięku znaleziono w public/sounds/ (0 = brak, gra sygnał). */
  variants: Partial<Record<SoundEvent, number>> = {};
  /** Ile plików niespodzianek znaleziono (0 = wbudowane). */
  surprises = 0;

  get found(): Partial<Record<SoundEvent, boolean>> {
    const f: Partial<Record<SoundEvent, boolean>> = {};
    for (const e of SOUND_EVENTS) f[e.id] = (this.variants[e.id] ?? 0) > 0;
    return f;
  }

  private bag: boolean[] = [];
  private bagChance = 0;
  private last = new Map<string, number>();

  /** Sprawdza pliki dźwięków, ich warianty i niespodzianki (wywoływane przy starcie). */
  async detect(): Promise<number> {
    await Promise.all([
      ...SOUND_EVENTS.map(async (e) => {
        this.variants[e.id] = await countVariants(e.id, MAX_VARIANTS);
      }),
      countVariants("surprise", MAX_SURPRISES).then((n) => (this.surprises = n)),
    ]);
    return SOUND_EVENTS.filter((e) => (this.variants[e.id] ?? 0) > 0).length;
  }

  /**
   * Czy w tej kolejce ma być niespodzianka. Losowanie „z puli”: przy 1 z 5 w każdej
   * piątce kolejek jest dokładnie jedna niespodzianka, w losowym miejscu.
   */
  rollSurprise(): boolean {
    if (this.surpriseChance <= 0) return false;
    if (this.bagChance !== this.surpriseChance || this.bag.length === 0) {
      if (this.bagChance !== this.surpriseChance) this.bag = [];
      this.bagChance = this.surpriseChance;
      const n = bagSize(this.surpriseChance);
      const hits = Math.round(this.surpriseChance * n);
      this.bag = Array.from({ length: n }, (_, i) => i < hits);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop()!;
  }

  /** Losuje numer wariantu 1..n, bez powtórzenia tego samego dwa razy z rzędu. */
  private pick(name: string, n: number): number {
    if (n <= 1) return 1;
    let v = 1 + Math.floor(Math.random() * n);
    if (v === this.last.get(name)) v = (v % n) + 1;
    this.last.set(name, v);
    return v;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 1, delay = 0, endFreq?: number) {
    const c = audioCtx();
    if (!c) return;
    const start = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
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

  /** Wbudowane niespodzianki, gdy w repozytorium nie ma plików surprise*.mp3. */
  private builtinSurprise(n: number): number {
    switch (n) {
      case 1: // „boing”
        this.tone(120, 0.45, "sine", 1.4, 0, 520);
        return 500;
      case 2: // smutna trąbka „wa-wa-wa-waaa”
        [392, 370, 349].forEach((f, i) => this.tone(f, 0.28, "sawtooth", 0.7, i * 0.32));
        this.tone(330, 0.9, "sawtooth", 0.7, 0.96, 300);
        return 1900;
      default: // laser
        this.tone(1800, 0.35, "square", 0.5, 0, 150);
        this.tone(1800, 0.35, "square", 0.5, 0.4, 150);
        return 800;
    }
  }

  /** Gra losową niespodziankę; obietnica kończy się, gdy dźwięk ucichnie. */
  async playSurprise(force = false): Promise<void> {
    if ((!this.enabled && !force) || this.volume <= 0) return;
    if (this.surprises > 0) {
      const b = await loadClip(variantPath("surprise", this.pick("surprise", this.surprises)));
      if (b) return playBuffer(b, this.volume);
    }
    const ms = this.builtinSurprise(this.pick("builtin", 3));
    await new Promise((r) => setTimeout(r, ms));
  }

  play(e: SoundEvent, force = false) {
    if ((!this.enabled && !force) || this.volume <= 0) return;
    const n = this.variants[e] ?? 0;
    if (n > 0) {
      void loadClip(variantPath(e, this.pick(e, n))).then((b) => (b ? playBuffer(b, this.volume) : this.beep(e)));
    } else {
      this.beep(e);
    }
  }
}

export const sound = new Sound();
