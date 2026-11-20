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
