// Lektor po polsku (Web Speech API — działa w przeglądarce, zwykle też offline).

class Speech {
  enabled = true;
  volume = 0.9;
  private voice: SpeechSynthesisVoice | null = null;

  get supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private pick() {
    if (!this.supported || this.voice) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.voice = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pl")) ?? null;
      };
      return;
    }
    this.voice = voices.find((v) => v.lang?.toLowerCase().startsWith("pl")) ?? null;
  }

  say(text: string) {
    if (!this.enabled || !this.supported) return;
    this.pick();
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = "pl-PL";
      u.volume = this.volume;
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignoruj */
    }
  }
}

export const speech = new Speech();
