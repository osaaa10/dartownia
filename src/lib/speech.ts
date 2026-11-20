// Lektor. Dwa tryby:
// 1. Nagrany lektor: pliki public/voice/*.mp3 w repozytorium (wszyscy słyszą ten sam głos).
// 2. Głos telefonu (Web Speech API): gdy nagrań brak albo brakuje konkretnej liczby.

import { audioCtx, loadClip } from "./audio";

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
  /** Czy znaleziono nagranego lektora (public/voice/180.mp3). */
  packFound = false;

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
    this.packFound = !!(await loadClip("voice/180.mp3"));
    if (this.packFound) {
      // Wczytaj resztę w tle, żeby była gotowa (i zapisana do pracy offline).
      const names = [...Array.from({ length: 181 }, (_, i) => String(i)), "bust", "gameshot", "match", "zostaje"];
      void (async () => {
        for (let i = 0; i < names.length; i += 12) {
          await Promise.all(names.slice(i, i + 12).map((n) => loadClip(`voice/${n}.mp3`)));
        }
      })();
    }
    return this.packFound;
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

  /** Mówi tekst głosem telefonu. */
  say(text: string, force = false) {
    if ((!this.enabled && !force) || !this.supported) return;
    this.stop();
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = this.voice();
      if (v) u.voice = v;
      u.lang = v?.lang ?? "pl-PL";
      u.volume = this.volume;
      u.rate = this.rate;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignoruj */
    }
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
      let names: string[];
      if (a.kind === "bust") names = ["bust"];
      else if (a.kind === "leg") names = ["gameshot"];
      else if (a.kind === "match") names = ["match"];
      else {
        names = [String(a.scored)];
        if (this.callRemaining && a.remaining > 0 && a.remaining <= 180) names.push("zostaje", String(a.remaining));
      }
      let ok = await this.playPack(names);
      if (!ok && a.kind === "match") ok = await this.playPack(["gameshot"]);
      if (!ok && a.kind === "turn" && names.length > 1) ok = await this.playPack([String(a.scored)]);
      if (ok) return;
    }

    const then = this.announceNext && a.nextName ? ` Teraz ${a.nextName}, ${a.nextScore}.` : "";
    if (a.kind === "bust") this.say(`Bust!${then}`, force);
    else if (a.kind === "match") this.say(`Checkout ${a.scored}! Mecz wygrywa ${a.player}!`, force);
    else if (a.kind === "leg") this.say(`Checkout ${a.scored}! Leg wygrywa ${a.player}.${then}`, force);
    else this.say(`${a.scored === 180 ? "Sto osiemdziesiąt!" : a.scored}. Zostaje ${a.remaining}.${then}`, force);
  }
}

export const speech = new Speech();
