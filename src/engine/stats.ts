import { canFinish, dartValue, isValidFinishDart } from "./darts";
import { replay } from "./game";
import type { Game, GameView, TurnResult } from "./types";

export interface PlayerStats {
  dartsThrown: number;
  visits: number;
  totalScored: number;
  /** Średnia z 3 lotek. Busty liczą się jako 3 lotki za 0 pkt. */
  avg: number;
  first9Scored: number;
  first9Darts: number;
  first9Avg: number;
  highestTurn: number;
  highestCheckout: number;
  c60: number; // 60–99
  c100: number; // 100–139
  c140: number; // 140–179
  c180: number;
  busts: number;
  /** Kolejki, w których wynik był do zamknięcia. */
  checkoutAttempts: number;
  checkoutHits: number;
  checkoutPct: number | null;
  legsWon: number;
  legsPlayed: number;
  /** Najmniej lotek w wygranym legu (0 = brak). */
  bestLeg: number;
  /** Lotki rzucone w wygranych legach — do średniej lotek na leg. */
  dartsInWonLegs: number;
  dartsPerLeg: number;
  /** Lotki rzucone, gdy jedna lotka mogła zamknąć (np. 32 → D16). */
  dartsAtDouble: number;
  doubleHits: number;
  doublePct: number | null;
  /** Ile kolejek średnio trwa zamykanie (kolejki z wynikiem do zamknięcia / zamknięcia). */
  visitsPerCheckout: number | null;
  checkouts100: number;
  /** Którym polem zamykano legi, np. { D16: 4, BULL: 1 }. */
  finishes: Record<string, number>;
  /** Legi przerwane bez zwycięzcy (mecz zakończony przed czasem). */
  legsUnfinished: number;
  /** …w tym takie, w których gracz miał już wynik do zamknięcia. */
  stuckOnFinish: number;
  /** Z jakim wynikiem gracz utknął, np. { 2: 3, 32: 1 }. */
  stuckScores: Record<string, number>;
  segmentHits: Record<string, number>;
}

export function emptyStats(): PlayerStats {
  return {
    dartsThrown: 0, visits: 0, totalScored: 0, avg: 0,
    first9Scored: 0, first9Darts: 0, first9Avg: 0,
    highestTurn: 0, highestCheckout: 0, c60: 0, c100: 0, c140: 0, c180: 0, busts: 0,
    checkoutAttempts: 0, checkoutHits: 0, checkoutPct: null,
    legsWon: 0, legsPlayed: 0, bestLeg: 0, dartsInWonLegs: 0, dartsPerLeg: 0,
    dartsAtDouble: 0, doubleHits: 0, doublePct: null, visitsPerCheckout: null, checkouts100: 0, finishes: {},
    legsUnfinished: 0, stuckOnFinish: 0, stuckScores: {}, segmentHits: {},
  };
}

function finalize(s: PlayerStats): PlayerStats {
  s.avg = s.dartsThrown ? (s.totalScored / s.dartsThrown) * 3 : 0;
  s.first9Avg = s.first9Darts ? (s.first9Scored / s.first9Darts) * 3 : 0;
  s.checkoutPct = s.checkoutAttempts ? (s.checkoutHits / s.checkoutAttempts) * 100 : null;
  s.doublePct = s.dartsAtDouble ? (s.doubleHits / s.dartsAtDouble) * 100 : null;
  s.visitsPerCheckout = s.checkoutHits ? s.checkoutAttempts / s.checkoutHits : null;
  s.dartsPerLeg = s.legsWon ? s.dartsInWonLegs / s.legsWon : 0;
  return s;
}

function addTurn(s: PlayerStats, t: TurnResult, game: Game) {
  s.visits += 1;
  s.dartsThrown += t.dartsUsed;
  s.totalScored += t.scored;
  if (t.isBust) s.busts += 1;
  if (t.scored >= 180) s.c180 += 1;
  else if (t.scored >= 140) s.c140 += 1;
  else if (t.scored >= 100) s.c100 += 1;
  else if (t.scored >= 60) s.c60 += 1;
  if (t.scored > s.highestTurn) s.highestTurn = t.scored;
  if (t.visitInLeg < 3) {
    s.first9Scored += t.scored;
    s.first9Darts += t.dartsUsed;
  }
  if (canFinish(t.scoreBefore, game.settings.outMode, 3)) s.checkoutAttempts += 1;
  if (t.isCheckout) {
    s.checkoutHits += 1;
    if (t.scored > s.highestCheckout) s.highestCheckout = t.scored;
    if (t.scored >= 100) s.checkouts100 += 1;
    const last = t.darts?.[t.darts.length - 1];
    if (last) s.finishes[last] = (s.finishes[last] ?? 0) + 1;
  }
  countDoubles(s, t, game.settings.outMode);
  for (const d of t.darts ?? []) s.segmentHits[d] = (s.segmentHits[d] ?? 0) + 1;
}

/**
 * Lotki „na double”: rzucone, gdy jedna lotka mogła zamknąć leg.
 * Z tarczy/klawiatury liczone dokładnie, lotka po lotce. Przy wpisywaniu sum (numpad)
 * — tylko pewne przypadki: kolejka zaczęta z wynikiem do zamknięcia jedną lotką.
 */
function countDoubles(s: PlayerStats, t: TurnResult, out: Game["settings"]["outMode"]) {
  if (out === "single") return;
  if (t.darts) {
    let left = t.scoreBefore;
    for (const d of t.darts) {
      if (canFinish(left, out, 1)) {
        s.dartsAtDouble += 1;
        if (dartValue(d) === left && isValidFinishDart(d, out)) s.doubleHits += 1;
      }
      left -= dartValue(d);
      if (left <= 1) break;
    }
    return;
  }
  if (canFinish(t.scoreBefore, out, 1) && (t.isCheckout || t.scored === 0)) {
    s.dartsAtDouble += t.isCheckout ? t.dartsUsed : 3;
    if (t.isCheckout) s.doubleHits += 1;
  }
}

/**
 * Ile kolejek z rzędu gracz nie zamknął, stojąc już na double (wynik do zamknięcia jedną lotką,
 * np. 40, 8, 2), licząc tę kolejkę. Np. 40 → pudło, 8 → pudło, 8 → pudło = 3.
 */
export function failedFinishStreak(view: GameView, turn: TurnResult, out: Game["settings"]["outMode"]): number {
  const mine = view.legs[turn.legIndex].turns.filter((x) => x.playerId === turn.playerId);
  let i = mine.indexOf(turn);
  if (i < 0) i = mine.length - 1;
  let n = 0;
  for (; i >= 0; i--) {
    const t = mine[i];
    if (t.isCheckout || !canFinish(t.scoreBefore, out, 1)) break;
    n++;
  }
  return n;
}

/** Statystyki wszystkich graczy w jednym meczu. */
export function gameStats(game: Game, view: GameView = replay(game)): Record<string, PlayerStats> {
  const out: Record<string, PlayerStats> = {};
  for (const p of game.players) out[p.id] = emptyStats();
  for (const leg of view.legs) {
    if (leg.turns.length === 0) continue;
    const dartsInLeg: Record<string, number> = {};
    for (const t of leg.turns) {
      addTurn(out[t.playerId], t, game);
      dartsInLeg[t.playerId] = (dartsInLeg[t.playerId] ?? 0) + t.dartsUsed;
    }
    for (const p of game.players) {
      if (leg.winnerId) out[p.id].legsPlayed += 1;
    }
    if (leg.winnerId) {
      const s = out[leg.winnerId];
      s.legsWon += 1;
      const d = dartsInLeg[leg.winnerId] ?? 0;
      s.dartsInWonLegs += d;
      if (d > 0 && (s.bestLeg === 0 || d < s.bestLeg)) s.bestLeg = d;
    } else if (game.endedEarly) {
      // Leg przerwany — zapisujemy, kto na czym utknął.
      for (const p of game.players) {
        if (!dartsInLeg[p.id]) continue;
        const s = out[p.id];
        s.legsUnfinished += 1;
        const left = leg.scores[p.id];
        if (canFinish(left, game.settings.outMode, 3)) {
          s.stuckOnFinish += 1;
          s.stuckScores[left] = (s.stuckScores[left] ?? 0) + 1;
        }
      }
    }
  }
  for (const id of Object.keys(out)) finalize(out[id]);
  return out;
}

/** Średnia gracza tylko w bieżącym legu (na żywo). */
export function legAverage(view: GameView, playerId: string): number {
  const leg = view.legs[view.currentLegIndex];
  let darts = 0;
  let scored = 0;
  for (const t of leg.turns) {
    if (t.playerId !== playerId) continue;
    darts += t.dartsUsed;
    scored += t.scored;
  }
  return darts ? (scored / darts) * 3 : 0;
}

// ---------- Kariera (z historii, po nazwie gracza) ----------

export const normName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

export interface CareerStats extends PlayerStats {
  key: string;
  name: string;
  color: string;
  matches: number;
  wins: number;
  winPct: number;
  /** Mecze zakończone przed czasem (bez zwycięzcy). */
  unfinished: number;
  /** Średnia w kolejnych meczach (od najstarszego) — wykres formy. */
  form: { at: number; avg: number; won: boolean }[];
}

export interface StatsFilter {
  startingScore: number | "all";
  outMode: "single" | "double" | "master" | "all";
}

export function matchesFilter(g: Game, f: StatsFilter): boolean {
  if (f.startingScore !== "all" && g.settings.startingScore !== f.startingScore) return false;
  if (f.outMode !== "all" && g.settings.outMode !== f.outMode) return false;
  return true;
}

export function careerStats(history: Game[], f: StatsFilter): CareerStats[] {
  const map = new Map<string, CareerStats>();
  const games = history
    .filter((g) => g.finishedAt && matchesFilter(g, f))
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));

  for (const g of games) {
    const view = replay(g);
    const per = gameStats(g, view);
    for (const p of g.players) {
      const key = normName(p.name);
      let c = map.get(key);
      if (!c) {
        c = { ...emptyStats(), key, name: p.name, color: p.color, matches: 0, wins: 0, winPct: 0, unfinished: 0, form: [] };
        map.set(key, c);
      }
      c.name = p.name;
      c.color = p.color;
      const s = per[p.id];
      const won = view.winnerId === p.id;
      c.matches += 1;
      if (won) c.wins += 1;
      if (g.endedEarly) c.unfinished += 1;
      c.dartsThrown += s.dartsThrown;
      c.visits += s.visits;
      c.totalScored += s.totalScored;
      c.first9Scored += s.first9Scored;
      c.first9Darts += s.first9Darts;
      c.highestTurn = Math.max(c.highestTurn, s.highestTurn);
      c.highestCheckout = Math.max(c.highestCheckout, s.highestCheckout);
      c.c60 += s.c60;
      c.c100 += s.c100;
      c.c140 += s.c140;
      c.c180 += s.c180;
      c.busts += s.busts;
      c.checkoutAttempts += s.checkoutAttempts;
      c.checkoutHits += s.checkoutHits;
      c.legsWon += s.legsWon;
      c.legsPlayed += s.legsPlayed;
      if (s.bestLeg > 0 && (c.bestLeg === 0 || s.bestLeg < c.bestLeg)) c.bestLeg = s.bestLeg;
      c.dartsInWonLegs += s.dartsInWonLegs;
      c.dartsAtDouble += s.dartsAtDouble;
      c.doubleHits += s.doubleHits;
      c.checkouts100 += s.checkouts100;
      c.legsUnfinished += s.legsUnfinished;
      c.stuckOnFinish += s.stuckOnFinish;
      for (const [k, v] of Object.entries(s.segmentHits)) c.segmentHits[k] = (c.segmentHits[k] ?? 0) + v;
      for (const [k, v] of Object.entries(s.finishes)) c.finishes[k] = (c.finishes[k] ?? 0) + v;
      for (const [k, v] of Object.entries(s.stuckScores)) c.stuckScores[k] = (c.stuckScores[k] ?? 0) + v;
      c.form.push({ at: g.finishedAt ?? g.createdAt, avg: s.avg, won });
    }
  }
  return [...map.values()].map((c) => {
    finalize(c);
    const decided = c.matches - c.unfinished;
    c.winPct = decided ? (c.wins / decided) * 100 : 0;
    return c;
  });
}
