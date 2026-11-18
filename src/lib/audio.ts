// Krótkie dźwięki generowane przez WebAudio (bez plików, działa offline).

class Sound {
  private ctx: AudioContext | null = null;
  enabled = true;
  volume = 0.5;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 1, delay = 0) {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(this.volume * gain * 0.25, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  click() { this.tone(680, 0.06, "triangle", 0.6); }
  dart() { this.tone(900, 0.04, "triangle", 0.4); }
  bust() { this.tone(180, 0.18, "sawtooth", 0.8); this.tone(120, 0.22, "sawtooth", 0.8, 0.08); }
  ton() { this.tone(720, 0.09); this.tone(900, 0.11, "sine", 1, 0.09); }
  ton40() { this.tone(720, 0.08); this.tone(900, 0.08, "sine", 1, 0.08); this.tone(1100, 0.13, "sine", 1, 0.16); }
  max() { [600, 800, 1000, 1300].forEach((f, i) => this.tone(f, 0.12, "triangle", 1.1, i * 0.09)); }
  leg() { [520, 660, 880].forEach((f, i) => this.tone(f, 0.15, "triangle", 1, i * 0.11)); }
  match() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, "triangle", 1.2, i * 0.13)); }
}

export const sound = new Sound();
