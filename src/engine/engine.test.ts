import { describe, expect, it } from "vitest";
import {
  ALL_DARTS,
  canFinish,
  dartValue,
  doubleOutTable,
  isAchievable,
  isValidFinishDart,
  finishHint,
  suggestCheckout,
} from "./darts";
import { addTurn, createGame, endEarly, evaluateTurn, legsNeeded, rematch, replaceLastTurn, replay, resumeEarly, undoTurn } from "./game";
import { careerStats, failedFinishStreak, gameStats } from "./stats";
import type { Game, MatchSettings, Player, TurnInput } from "./types";

const P = (id: string): Player => ({ id, name: id.toUpperCase(), color: "0 0% 50%" });
const S = (over: Partial<MatchSettings> = {}): MatchSettings => ({
  startingScore: 501, outMode: "double", format: "firstTo", legsTarget: 1, rotateStarter: true, ...over,
});
const t = (total: number, extra: Partial<TurnInput> = {}): TurnInput => ({ total, at: 1, ...extra });
const d = (...darts: string[]): TurnInput => ({ darts, at: 1 });
const play = (g: Game, ...turns: TurnInput[]) => turns.reduce(addTurn, g);

describe("tabela checkoutów", () => {
  it("każda droga sumuje się i kończy doublem", () => {
    for (const [score, route] of Object.entries(doubleOutTable)) {
      expect(route.reduce((s, l) => s + dartValue(l), 0), `wynik ${score}`).toBe(Number(score));
      expect(isValidFinishDart(route[route.length - 1], "double"), `wynik ${score}`).toBe(true);
    }
  });
  it("ma każdy wynik 2–170 poza bogey", () => {
    const bogey = [169, 168, 166, 165, 163, 162, 159];
    for (let s = 2; s <= 170; s++) {
      expect(canFinish(s, "double"), `wynik ${s}`).toBe(!bogey.includes(s));
    }
  });
  it("podpowiedź uwzględnia pozostałe lotki", () => {
    expect(suggestCheckout(100, "double", 1)).toBeNull();
    expect(suggestCheckout(40, "double", 1)).toEqual(["D20"]);
    expect(suggestCheckout(60, "master", 1)).toEqual(["T20"]);
    expect(suggestCheckout(180, "master")).toEqual(["T20", "T20", "T20"]);
    expect(suggestCheckout(171, "double")).toBeNull();
  });
});

describe("walidacja sum", () => {
  it("180 osiągalne, 179 i 163 nie", () => {
    expect(isAchievable(180)).toBe(true);
    expect(isAchievable(179)).toBe(false);
    expect(isAchievable(163)).toBe(false);
    expect(isAchievable(0)).toBe(true);
  });
  it("wszystkie lotki mają poprawne wartości", () => {
    expect(ALL_DARTS).toHaveLength(62);
    expect(dartValue("BULL")).toBe(50);
    expect(dartValue("T19")).toBe(57);
  });
});

describe("zasady kolejki", () => {
  it("bust poniżej zera i na 1 w double out", () => {
    expect(evaluateTurn(40, t(41), "double").isBust).toBe(true);
    expect(evaluateTurn(40, t(39), "double").isBust).toBe(true);
    expect(evaluateTurn(40, t(39), "single").isBust).toBe(false);
  });
  it("numpad: checkout wymaga potwierdzenia doubla", () => {
    expect(evaluateTurn(40, t(40), "double").isBust).toBe(true);
    const ok = evaluateTurn(40, t(40, { validFinish: true, dartsUsed: 1 }), "double");
    expect(ok.isCheckout).toBe(true);
    expect(ok.dartsUsed).toBe(1);
  });
  it("lotki: checkout tylko doublem, reszta lotek odrzucona", () => {
    expect(evaluateTurn(40, d("S20", "S20"), "double").isBust).toBe(true);
    const r = evaluateTurn(40, d("D20", "T20", "T20"), "double");
    expect(r.isCheckout).toBe(true);
    expect(r.darts).toEqual(["D20"]);
    expect(r.dartsUsed).toBe(1);
  });
  it("master out: treble zamyka, single nie", () => {
    expect(evaluateTurn(60, d("T20"), "master").isCheckout).toBe(true);
    expect(evaluateTurn(20, d("S20"), "master").isBust).toBe(true);
    expect(evaluateTurn(50, d("BULL"), "master").isCheckout).toBe(true);
  });
  it("bust liczy 3 lotki i 0 punktów", () => {
    const r = evaluateTurn(32, d("T20"), "double");
    expect(r).toMatchObject({ isBust: true, scored: 0, dartsUsed: 3, scoreAfter: 32 });
  });
});

describe("mecz", () => {
  it("zmienia gracza i odejmuje punkty", () => {
    const g = play(createGame([P("a"), P("b")], S()), t(60));
    const v = replay(g);
    expect(v.legs[0].scores.a).toBe(441);
    expect(v.currentPlayerIndex).toBe(1);
  });

  it("best of 5 wymaga 3 legów", () => {
    expect(legsNeeded(S({ format: "bestOf", legsTarget: 5 }))).toBe(3);
    expect(legsNeeded(S({ format: "single" }))).toBe(1);
  });

  // 301 single out, A zamyka w 2 kolejkach
  const quickLeg = [t(180), t(10), t(121)];

  it("rotacja rozpoczynającego między legami", () => {
    const g = play(createGame([P("a"), P("b")], S({ startingScore: 301, outMode: "single", legsTarget: 3 })), ...quickLeg);
    const v = replay(g);
    expect(v.legWins.a).toBe(1);
    expect(v.currentLegIndex).toBe(1);
    expect(v.currentPlayerIndex).toBe(1); // w 2. legu zaczyna B
  });

  it("cofanie po wygranym legu odejmuje dokładnie jeden leg", () => {
    const s = S({ startingScore: 301, outMode: "single", legsTarget: 3 });
    // leg 1: A wygrywa; leg 2 (zaczyna B): B 10, A 180, B 10, A 121 -> A wygrywa
    let g = play(createGame([P("a"), P("b")], s), ...quickLeg, t(10), t(180), t(10), t(121));
    expect(replay(g).legWins.a).toBe(2);
    g = undoTurn(g);
    const v = replay(g);
    expect(v.legWins.a).toBe(1);
    expect(v.currentLegIndex).toBe(1);
    expect(v.legs[1].scores.a).toBe(121);
    expect(v.currentPlayerIndex).toBe(0); // A rzuca ponownie
  });

  it("koniec meczu, cofnięcie odblokowuje mecz", () => {
    let g = play(createGame([P("a"), P("b")], S({ startingScore: 301, outMode: "single" })), ...quickLeg);
    expect(replay(g).finished).toBe(true);
    expect(g.finishedAt).toBeDefined();
    expect(addTurn(g, t(10))).toBe(g); // po końcu nic się nie dopisuje
    g = undoTurn(g);
    expect(replay(g).finished).toBe(false);
    expect(g.finishedAt).toBeUndefined();
  });

  it("poprawa ostatniej kolejki", () => {
    let g = play(createGame([P("a"), P("b")], S()), t(60));
    g = replaceLastTurn(g, t(100));
    expect(replay(g).legs[0].scores.a).toBe(401);
  });

  it("rewanż: zaczyna kolejny gracz", () => {
    const g = createGame([P("a"), P("b"), P("c")], S());
    expect(rematch(g).players.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });
});

describe("statystyki", () => {
  it("średnia liczy busty jako 3 lotki za 0", () => {
    // A: 60, bust, 60 -> 120 pkt / 9 lotek = 40 avg
    const g = play(createGame([P("a")], S({ startingScore: 200 })), t(60), t(41, { bust: true }), t(60));
    const s = gameStats(g).a;
    expect(s.dartsThrown).toBe(9);
    expect(s.avg).toBeCloseTo(40, 5);
    expect(s.busts).toBe(1);
  });

  it("próby checkoutu obejmują nieudane i busty", () => {
    // 40 zostało: bust (S20,S20 bez doubla), potem D20
    const g = play(createGame([P("a")], S({ startingScore: 40 })), d("S20", "S20"), d("D20"));
    const s = gameStats(g).a;
    expect(s.checkoutAttempts).toBe(2);
    expect(s.checkoutHits).toBe(1);
    expect(s.checkoutPct).toBe(50);
    expect(s.bestLeg).toBe(4);
    expect(s.segmentHits).toEqual({ S20: 2, D20: 1 });
  });

  it("kariera łączy graczy po nazwie", () => {
    const mk = () => {
      const g = play(createGame([P("a"), P("b")], S({ startingScore: 301, outMode: "single" })), ...[t(180), t(10), t(121)]);
      return g;
    };
    const c = careerStats([mk(), mk()], { startingScore: "all", outMode: "all" });
    const a = c.find((x) => x.key === "a")!;
    expect(a.matches).toBe(2);
    expect(a.wins).toBe(2);
    expect(a.form).toHaveLength(2);
  });
});

describe("ulubione double", () => {
  it("wybiera drogę na ulubiony double przy tej samej liczbie lotek", () => {
    expect(finishHint(80, "double", 3)).toEqual({ kind: "checkout", route: ["T20", "D10"] });
    expect(finishHint(80, "double", 3, [16])).toEqual({ kind: "checkout", route: ["T16", "D16"] });
  });
  it("nie każe ustawiać na double: 121 z D16, D8 -> T20 T15 D8", () => {
    expect(finishHint(121, "double", 3, [16, 8])?.route).toEqual(["T20", "T15", "D8"]);
    expect(finishHint(121, "double", 3, [16])?.route).toEqual(["T20", "T11", "D14"]);
  });
  it("nie wydłuża zakończenia: 40 zostaje D20 mimo ulubionego D16", () => {
    expect(finishHint(40, "double", 3, [16])).toEqual({ kind: "checkout", route: ["D20"] });
  });
  it("kolejność ulubionych ma znaczenie", () => {
    expect(finishHint(84, "double", 3, [18, 12])?.route).toEqual(["T16", "D18"]);
    expect(finishHint(84, "double", 3, [12, 18])?.route).toEqual(["T20", "D12"]);
  });
  it("gdy nie da się zamknąć — ustawia wynik na ulubiony double", () => {
    const h = finishHint(200, "double", 3, [16]);
    expect(h?.kind).toBe("setup");
    if (h?.kind === "setup") {
      expect(h.leave).toBe(32);
      expect(h.route.reduce((s, l) => s + dartValue(l), 0)).toBe(168);
    }
    // jedna lotka zostala, 52 -> 20 zostawia 32
    expect(finishHint(52, "double", 1, [16])).toEqual({ kind: "setup", route: ["S20"], leave: 32, double: "D16" });
  });
  it("bez ulubionych ustawia na domyślne double", () => {
    const h = finishHint(210, "double", 3);
    expect(h).toMatchObject({ kind: "setup", route: ["T20", "T20", "T18"], leave: 36 });
    expect(finishHint(400, "double", 3)).toBeNull();
  });
  it("single out nie podpowiada ustawiania", () => {
    expect(finishHint(250, "single", 3)).toBeNull();
  });
});

describe("statystyki zakończeń", () => {
  it("liczy lotki na double i trafienia", () => {
    let g = createGame([P("a"), P("b")], S({ startingScore: 301 }));
    // a: 301 → 40; b gra w tle
    g = play(g, t(180), t(0), t(81), t(0));
    // a na 40: D20 pudło (S20 → 20), potem D10 pudło (S10 → 10), D5 trafione
    g = play(g, d("S20", "S10", "D5"));
    const s = gameStats(g).a;
    expect(s.dartsAtDouble).toBe(3);
    expect(s.doubleHits).toBe(1);
    expect(Math.round(s.doublePct!)).toBe(33);
    expect(s.finishes).toEqual({ D5: 1 });
    expect(s.legsWon).toBe(1);
    expect(s.dartsPerLeg).toBe(9);
  });

  it("mecz przerwany na double trafia do statystyk bez zwycięzcy", () => {
    let g = createGame([P("a"), P("b")], S({ startingScore: 301 }));
    g = play(g, t(180), t(100), t(119), t(100), d("S1", "S1", "MISS"), t(60));
    // a ma 2 (D1), b ma 41
    const empty = createGame([P("a")], S());
    expect(endEarly(empty)).toBe(empty); // pusty mecz się nie kończy
    const e = endEarly(g, 123);
    expect(e.finishedAt).toBe(123);
    expect(replay(e).winnerId).toBeNull();
    const s = gameStats(e);
    expect(s.a.legsUnfinished).toBe(1);
    expect(s.a.stuckOnFinish).toBe(1);
    expect(s.a.stuckScores).toEqual({ 2: 1 });
    expect(s.a.dartsAtDouble).toBe(1); // na 2 (D1) rzucił S1 → bust, dalsze lotki się nie liczą
    const c = careerStats([e], { startingScore: "all", outMode: "all" });
    const a = c.find((x) => x.key === "a")!;
    expect(a.matches).toBe(1);
    expect(a.unfinished).toBe(1);
    expect(a.wins).toBe(0);
    expect(resumeEarly(e).finishedAt).toBeUndefined();
  });
});

describe("trąbka na zakończeniu", () => {
  it("liczy nieudane kolejki z rzędu na zakończeniu", () => {
    let g = createGame([P("a"), P("b")], S({ startingScore: 301 }));
    g = play(g, t(180), t(0), t(81), t(0)); // a: 40
    const streak = () => {
      const v = replay(g);
      const last = [...v.turns].reverse().find((x) => x.playerId === "a")!;
      return failedFinishStreak(v, last, "double");
    };
    g = play(g, d("S20", "S10", "S2")); // 40 → 8, nie zamknął (1)
    expect(streak()).toBe(1);
    g = play(g, t(0), d("MISS", "MISS", "MISS")); // 8, nie zamknął (2)
    expect(streak()).toBe(2);
    g = play(g, t(0), d("S4", "S2", "MISS")); // 8 → 2 (3) — tu gra trąbka
    expect(streak()).toBe(3);
    g = play(g, t(0), d("D1")); // zamknął
    expect(streak()).toBe(0);
  });
});
