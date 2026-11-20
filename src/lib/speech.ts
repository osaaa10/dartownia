// Lektor. Dwa tryby:
// 1. Nagrany lektor: pliki w public/voice/ w repozytorium (wszyscy słyszą ten sam głos).
//    Liczby w kilku stylach: public/voice/<styl>/<liczba>.mp3, zwroty: public/voice/<zwrot>[-N].mp3.
//    Każdy gracz wybiera styl dla przedziałów wyników (np. 0–49 spokojnie, 180 ekstatycznie).
// 2. Głos telefonu (Web Speech API): gdy nagrań brak albo brakuje konkretnej liczby.

import { audioCtx, loadClip } from "./audio";

export const VOICE_STYLES = [
  { id: "calm", label: "Spokojny" },
  { id: "confident", label: "Pewny" },
  { id: "energetic", label: "Energiczny" },
  { id: "enthusiastic", label: "Entuzjastyczny" },
  { id: "ecstatic", label: "Ekstatyczny" },
] as const;
export type VoiceStyle = (typeof VOICE_STYLES)[number]["id"];

export const VOICE_RANGES = [
  { key: "r0", from: 0, to: 49, label: "0–49" },
  { key: "r50", from: 50, to: 99, label: "50–99" },
  { key: "r100", from: 100, to: 149, label: "100–149" },
  { key: "r150", from: 150, to: 179, label: "150–179" },
  { key: "r180", from: 180, to: 180, label: "180" },
] as const;
export type RangeKey = (typeof VOICE_RANGES)[number]["key"];

/** Domyślny podział stylów — wspólny dla wszystkich, dopóki ktoś go nie zmieni. */
export const DEFAULT_VOICE_STYLES: Record<RangeKey, VoiceStyle> = {
  r0: "calm",
  r50: "confident",
  r100: "energetic",
  r150: "enthusiastic",
  r180: "ecstatic",
};

const PHRASES = ["zostaje", "bust", "gameshot", "match"] as const;
type Phrase = (typeof PHRASES)[number];
const MAX_PHRASE_VARIANTS = 5;

export function rangeOf(n: number) {
  return VOICE_RANGES.find((r) => n >= r.from && n <= r.to) ?? VOICE_RANGES[0];
}

export interface Announcement {
  kind: "turn" | "bust" | "leg" | "match";
  scored: number;
  remaining: number;
  player: string;
  nextName?: string;
  nextScore?: number;
}

class Speech {
  enabled = true;
  volume = 0.9;
  rate = 1.05;
  voiceURI: string | null = null;
  usePack = true;
  announceNext = true;
  callRemaining = true;
  /** Czy znaleziono nagranego lektora. */
  packFound = false;
  /** Wybrany styl dla każdego przedziału. */
  styles: Record<RangeKey, VoiceStyle> = { ...DEFAULT_VOICE_STYLES };
  /** Jakie style są nagrane dla danego przedziału. */
  available: Record<RangeKey, VoiceStyle[]> = { r0: [], r50: [], r100: [], r150: [], r180: [] };
  /** Stary układ: liczby bez stylu w public/voice/<liczba>.mp3. */
  flat = false;
  phraseVariants: Record<Phrase, number> = { zostaje: 0, bust: 0, gameshot: 0, match: 0 };
  private lastPhrase = new Map<Phrase, number>();

  private sources: AudioBufferSourceNode[] = [];
  private token = 0;

  get supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Polskie głosy dostępne na tym urządzeniu (najpierw polskie, potem reszta). */
  voices(): SpeechSynthesisVoice[] {
    if (!this.supported) return [];
    const all = window.speechSynthesis.getVoices();
    const pl = all.filter((v) => v.lang?.toLowerCase().startsWith("pl"));
    return pl.length ? pl : all;
  }

  private voice(): SpeechSynthesisVoice | null {
    const list = this.voices();
    if (this.voiceURI) {
      const v = list.find((x) => x.voiceURI === this.voiceURI);
      if (v) return v;
    }
    // Domyślnie: głos „naturalny/online”, jeśli jest (zwykle brzmi najlepiej).
    return (
      list.find((v) => /natural|online|neural|premium|enhanced/i.test(v.name) && v.lang.toLowerCase().startsWith("pl")) ??
      list.find((v) => v.lang?.toLowerCase().startsWith("pl")) ??
      null
    );
  }

  async detectPack(): Promise<boolean> {
    const checks = await Promise.all(
      VOICE_STYLES.flatMap((st) =>
        VOICE_RANGES.map(async (r) => ({ st: st.id, r: r.key, ok: !!(await loadClip(`voice/${st.id}/${r.from}.mp3`)) })),
      ),
    );
    const avail: Record<RangeKey, VoiceStyle[]> = { r0: [], r50: [], r100: [], r150: [], r180: [] };
    for (const c of checks) if (c.ok) avail[c.r].push(c.st);
    this.available = avail;
    this.flat = !!(await loadClip("voice/180.mp3"));
    await Promise.all(
      PHRASES.map(async (p) => {
        let n = 0;
        while (n < MAX_PHRASE_VARIANTS && (await loadClip(`voice/${n === 0 ? p : `${p}-${n + 1}`}.mp3`))) n++;
        this.phraseVariants[p] = n;
      }),
    );
    this.packFound = this.flat || Object.values(avail).some((a) => a.length > 0);
    if (this.packFound) this.preload();
    return this.packFound;
  }

  /** Ścieżka nagrania liczby (bez „voice/” i „.mp3”) albo null, gdy go nie ma. */
  pathFor(n: number, role: "score" | "remaining" = "score"): string | null {
    const r = rangeOf(n);
    const preferred = role === "remaining" ? this.styles.r0 : this.styles[r.key];
    const order = [preferred, DEFAULT_VOICE_STYLES[r.key], ...VOICE_STYLES.map((v) => v.id)];
    const style = order.find((st) => this.available[r.key].includes(st));
    if (style) return `${style}/${n}`;
    return this.flat ? String(n) : null;
  }

  /** Losowy wariant zwrotu (bust, bust-2…), bez powtórki dwa razy z rzędu. */
  private phrase(p: Phrase): string | null {
    const n = this.phraseVariants[p];
    if (!n) return null;
    let v = 1 + Math.floor(Math.random() * n);
    if (n > 1 && v === this.lastPhrase.get(p)) v = (v % n) + 1;
    this.lastPhrase.set(p, v);
    return v === 1 ? p : `${p}-${v}`;
  }

  /** Wczytuje w tle nagrania wybranych stylów (i zapisuje je do pracy offline). */
  preload() {
    if (!this.packFound) return;
    const names = new Set<string>();
    for (let n = 0; n <= 180; n++) {
      const a = this.pathFor(n, "score");
      const b = this.pathFor(n, "remaining");
      if (a) names.add(a);
      if (b) names.add(b);
    }
    for (const p of PHRASES) {
      for (let v = 1; v <= this.phraseVariants[p]; v++) names.add(v === 1 ? p : `${p}-${v}`);
    }
    const list = [...names];
    void (async () => {
      for (let i = 0; i < list.length; i += 12) {
        await Promise.all(list.slice(i, i + 12).map((n) => loadClip(`voice/${n}.mp3`)));
      }
    })();
  }

  stop() {
    this.token++;
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* już zakończone */
      }
    }
    this.sources = [];
    if (this.supported) window.speechSynthesis.cancel();
  }

  /** Mówi tekst głosem telefonu; obietnica kończy się po przeczytaniu (najpóźniej po 6 s). */
  say(text: string, force = false): Promise<void> {
    if ((!this.enabled && !force) || !this.supported) return Promise.resolve();
    this.stop();
    return new Promise((resolve) => {
      const done = () => resolve();
      window.setTimeout(done, 6000);
      try {
        const u = new SpeechSynthesisUtterance(text);
        const v = this.voice();
        if (v) u.voice = v;
        u.lang = v?.lang ?? "pl-PL";
        u.volume = this.volume;
        u.rate = this.rate;
        u.onend = done;
        u.onerror = done;
        window.speechSynthesis.speak(u);
      } catch {
        done();
      }
    });
  }

  /** Odtwarza po kolei nagrania; jeśli któregoś brakuje — zwraca false (wtedy mówi telefon). */
  private async playPack(names: string[]): Promise<boolean> {
    const my = ++this.token;
    const bufs = await Promise.all(names.map((n) => loadClip(`voice/${n}.mp3`)));
    if (bufs.some((b) => !b)) return false;
    if (my !== this.token) return true;
    this.stop();
    const mine = this.token;
    const c = audioCtx();
    if (!c) return false;
    for (const b of bufs) {
      if (mine !== this.token) return true;
      await new Promise<void>((resolve) => {
        const src = c.createBufferSource();
        const g = c.createGain();
        g.gain.value = this.volume;
        src.buffer = b!;
        src.connect(g).connect(c.destination);
        src.onended = () => resolve();
        this.sources.push(src);
        src.start();
      });
    }
    return true;
  }

  async announce(a: Announcement, force = false) {
    if (!this.enabled && !force) return;

    if (this.usePack && this.packFound) {
      let names: (string | null)[];
      if (a.kind === "bust") names = [this.phrase("bust")];
      else if (a.kind === "leg") names = [this.phrase("gameshot")];
      else if (a.kind === "match") names = [this.phrase("match") ?? this.phrase("gameshot")];
      else {
        names = [this.pathFor(a.scored, "score")];
        if (this.callRemaining && a.remaining > 0 && a.remaining <= 180) {
          const z = this.phrase("zostaje");
          const rem = this.pathFor(a.remaining, "remaining");
          if (z && rem) names.push(z, rem);
        }
      }
      if (names.every((n): n is string => !!n)) {
        let ok = await this.playPack(names);
        if (!ok && a.kind === "turn" && names.length > 1) ok = await this.playPack([names[0]]);
        if (ok) return;
      }
    }

    const then = this.announceNext && a.nextName ? ` Teraz ${a.nextName}, ${a.nextScore}.` : "";
    if (a.kind === "bust") return this.say(`Bust!${then}`, force);
    if (a.kind === "match") return this.say(`Checkout ${a.scored}! Mecz wygrywa ${a.player}!`, force);
    if (a.kind === "leg") return this.say(`Checkout ${a.scored}! Leg wygrywa ${a.player}.${then}`, force);
    return this.say(`${a.scored === 180 ? "Sto osiemdziesiąt!" : a.scored}. Zostaje ${a.remaining}.${then}`, force);
  }
}

export const speech = new Speech();
