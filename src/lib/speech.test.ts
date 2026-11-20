import { describe, expect, it } from "vitest";
import { speech } from "./speech";

describe("zapowiedź lektora", () => {
  const setup = () => {
    const sp = speech as unknown as Record<string, unknown>;
    let played: string[] = [];
    sp.playPack = async (names: string[]) => {
      played = names;
      return true;
    };
    sp.nickPath = async (n?: string) => (n ? `names/${n.toLowerCase()}` : null);
    speech.packFound = true;
    speech.usePack = true;
    speech.enabled = true;
    for (const k of Object.keys(speech.available)) (speech.available as Record<string, string[]>)[k] = ["calm", "confident", "energetic", "enthusiastic", "ecstatic"];
    for (const k of Object.keys(speech.phraseVariants)) (speech.phraseVariants as Record<string, number>)[k] = 1;
    return () => played;
  };

  it("wynik, następny gracz, do końca i zakończenie", async () => {
    const played = setup();
    await speech.announce({ kind: "turn", scored: 60, remaining: 241, player: "Osa", nextName: "Pitek", nextScore: 130, nextCheckout: ["T20", "T20", "D5"] });
    // 241 > 180, więc bez „zostaje”.
    expect(played()).toEqual([
      "confident/60", "teraz", "names/pitek", "do-konca", "calm/130",
      "zakonczenie", "potrojne", "calm/20", "potrojne", "calm/20", "podwojne", "calm/5",
    ]);
  });

  it("przełączniki wyłączają kawałki", async () => {
    const played = setup();
    speech.callBust = false;
    speech.callCheckout = false;
    await speech.announce({ kind: "bust", scored: 0, remaining: 40, player: "Osa", nextName: "KMP", nextScore: 501, nextCheckout: [] });
    expect(played()).toEqual(["teraz", "names/kmp"]);
    speech.callBust = true;
    speech.callCheckout = true;
    await speech.announce({ kind: "turn", scored: 26, remaining: 50, player: "Osa", nextName: "KMP", nextScore: 40, nextCheckout: ["D20"] });
    expect(played()).toEqual(["calm/26", "zostaje", "calm/50", "teraz", "names/kmp", "do-konca", "calm/40", "zakonczenie", "podwojne", "calm/20"]);
    await speech.announce({ kind: "turn", scored: 3, remaining: 50, player: "Osa", nextName: "KMP", nextScore: 50, nextCheckout: ["BULL"] });
    expect(played().slice(-2)).toEqual(["zakonczenie", "bull"]);
    speech.dartNaming = "tede";
    speech.bullName = "bullseye";
    await speech.announce({ kind: "turn", scored: 3, remaining: 50, player: "Osa", nextName: "KMP", nextScore: 100, nextCheckout: ["T20", "BULL"] });
    expect(played().slice(-4)).toEqual(["zakonczenie", "te", "calm/20", "bullseye"]);
  });
});
