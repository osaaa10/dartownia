import { describe, expect, it } from "vitest";
import { sound } from "./audio";

const roll = (n: number) => Array.from({ length: n }, () => sound.rollSurprise());

describe("niespodzianki", () => {
  it("wyłączone: nigdy", () => {
    sound.surpriseChance = 0;
    expect(roll(20).some(Boolean)).toBe(false);
  });
  it("1 z 5: w każdej piątce kolejek dokładnie jedna niespodzianka", () => {
    sound.surpriseChance = 0.2;
    for (let block = 0; block < 20; block++) {
      expect(roll(5).filter(Boolean).length).toBe(1);
    }
  });
  it("1 z 3 i 1 z 10", () => {
    sound.surpriseChance = 1 / 3;
    expect(roll(30).filter(Boolean).length).toBe(10);
    sound.surpriseChance = 0.1;
    expect(roll(30).filter(Boolean).length).toBe(3);
  });
  it("zmiana ustawienia zaczyna nową pulę", () => {
    sound.surpriseChance = 0.2;
    roll(2);
    sound.surpriseChance = 1 / 3;
    expect(roll(3).filter(Boolean).length).toBe(1);
  });
});

import { nickSlug } from "./speech";

describe("nicki lektora", () => {
  it("zamienia nick na nazwę pliku", () => {
    expect(nickSlug("Oleś")).toBe("oles");
    expect(nickSlug("KMP")).toBe("kmp");
    expect(nickSlug(" Podczar ")).toBe("podczar");
    expect(nickSlug("Łukasz Żółć")).toBe("lukaszzolc");
  });
});

import { similarNick } from "./speech";

describe("literówki w nickach", () => {
  const rec = ["Pitek", "Osa", "KMP", "Parzy", "Oleś", "Dawid", "Podczar"];
  it("podpowiada nagrany nick", () => {
    expect(similarNick("Pitke", rec)).toBe("Pitek");
    expect(similarNick("Podczr", rec)).toBe("Podczar");
    expect(similarNick("Oles", rec)).toBeNull(); // to ten sam nick (bez ogonka) — już działa
    expect(similarNick("Osa", rec)).toBeNull();
    expect(similarNick("Kasia", rec)).toBeNull();
  });
});
