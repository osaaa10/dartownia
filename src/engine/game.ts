import { dartValue, isDeadScore, isValidFinishDart } from "./darts";
import type {
  Game,
  GameView,
  LegState,
  MatchSettings,
  OutMode,
  Player,
  TurnInput,
  TurnResult,
} from "./types";

export const PLAYER_COLORS = [
  "243 75% 62%", "38 95% 55%", "145 65% 48%", "0 80% 62%",
  "190 85% 55%", "280 70% 65%", "320 75% 62%", "25 90% 58%",
  "60 80% 52%", "170 70% 45%", "210 80% 62%", "340 75% 62%",
  "100 60% 50%", "260 70% 68%", "15 80% 58%", "200 70% 55%",
];

export const DEFAULT_SETTINGS: MatchSettings = {
  startingScore: 501,
  outMode: "double",
  format: "firstTo",
  legsTarget: 3,
  rotateStarter: true,
};

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createGame(players: Player[], settings: MatchSettings, now = Date.now()): Game {
  if (players.length < 1) throw new Error("Potrzebny co najmniej jeden gracz");
  return { v: 1, id: uid(), createdAt: now, players, settings, turns: [] };
}

export function legsNeeded(s: MatchSettings): number {
  if (s.format === "single") return 1;
  if (s.format === "firstTo") return Math.max(1, s.legsTarget);
  return Math.floor(Math.max(1, s.legsTarget) / 2) + 1;
}

export interface Evaluated {
  scoreAfter: number;
  scored: number;
  dartsUsed: number;
  isBust: boolean;
  isCheckout: boolean;
  /** Lotki faktycznie zaliczone do kolejki (po checkoucie/buście reszta jest odrzucana). */
  darts?: string[];
}

/** Zasady jednej kolejki — czysta funkcja. */
export function evaluateTurn(scoreBefore: number, input: TurnInput, out: OutMode): Evaluated {
  const bust = (darts?: string[]): Evaluated => ({
    scoreAfter: scoreBefore,
    scored: 0,
    dartsUsed: 3,
    isBust: true,
    isCheckout: false,
    darts,
  });

  if (input.darts && input.darts.length > 0) {
    let rem = scoreBefore;
    const used: string[] = [];
    for (const d of input.darts.slice(0, 3)) {
      used.push(d);
      rem -= dartValue(d);
      if (rem < 0 || isDeadScore(rem, out)) return bust(used);
      if (rem === 0) {
        if (!isValidFinishDart(d, out)) return bust(used);
        return {
          scoreAfter: 0,
          scored: scoreBefore,
          dartsUsed: used.length,
          isBust: false,
          isCheckout: true,
          darts: used,
        };
      }
    }
    if (input.bust) return bust(used);
    return {
      scoreAfter: rem,
      scored: scoreBefore - rem,
      dartsUsed: 3,
      isBust: false,
      isCheckout: false,
      darts: used,
    };
  }

  if (input.bust) return bust();

  const total = Math.max(0, Math.min(180, Math.round(input.total ?? 0)));
  const rem = scoreBefore - total;
  if (rem < 0 || isDeadScore(rem, out)) return bust();
  if (rem === 0) {
    if (out !== "single" && !input.validFinish) return bust();
    const n = Math.min(3, Math.max(1, input.dartsUsed ?? 3));
    return { scoreAfter: 0, scored: total, dartsUsed: n, isBust: false, isCheckout: true };
  }
  return { scoreAfter: rem, scored: total, dartsUsed: 3, isBust: false, isCheckout: false };
}

function newLeg(index: number, starterIndex: number, players: Player[], start: number): LegState {
  const scores: Record<string, number> = {};
  for (const p of players) scores[p.id] = start;
  return { index, starterIndex, scores, winnerId: null, turns: [] };
}

/** Odtwarza cały stan meczu z logu kolejek. */
export function replay(game: Game): GameView {
  const { players, settings } = game;
  const n = players.length;
  const needed = legsNeeded(settings);
  const legWins: Record<string, number> = {};
  for (const p of players) legWins[p.id] = 0;

  const legs: LegState[] = [newLeg(0, 0, players, settings.startingScore)];
  const all: TurnResult[] = [];
  let finished = false;
  let winnerId: string | null = null;

  for (const input of game.turns) {
    if (finished) break;
    const leg = legs[legs.length - 1];
    const pIdx = (leg.starterIndex + leg.turns.length) % n;
    const player = players[pIdx];
    const before = leg.scores[player.id];
    const ev = evaluateTurn(before, input, settings.outMode);
    const visitInLeg = Math.floor(leg.turns.length / n);
    const res: TurnResult = {
      playerId: player.id,
      legIndex: leg.index,
      visitInLeg,
      scoreBefore: before,
      scoreAfter: ev.scoreAfter,
      scored: ev.scored,
      dartsUsed: ev.dartsUsed,
      isBust: ev.isBust,
      isCheckout: ev.isCheckout,
      darts: ev.darts,
      at: input.at,
    };
    leg.turns.push(res);
    leg.scores[player.id] = ev.scoreAfter;
    all.push(res);

    if (ev.isCheckout) {
      leg.winnerId = player.id;
      legWins[player.id] += 1;
      if (legWins[player.id] >= needed) {
        finished = true;
        winnerId = player.id;
      } else {
        const nextStarter = settings.rotateStarter ? (leg.starterIndex + 1) % n : 0;
        legs.push(newLeg(leg.index + 1, nextStarter, players, settings.startingScore));
      }
    }
  }

  const cur = legs[legs.length - 1];
  const currentPlayerIndex = finished
    ? players.findIndex((p) => p.id === winnerId)
    : (cur.starterIndex + cur.turns.length) % n;

  return {
    legs,
    legWins,
    currentLegIndex: cur.index,
    currentPlayerIndex,
    finished,
    winnerId,
    turns: all,
  };
}

// ---------- Operacje na logu (zwracają nowy obiekt, nie mutują) ----------

function withFinish(game: Game): Game {
  const v = replay(game);
  const finishedAt = v.finished ? game.turns[game.turns.length - 1]?.at ?? Date.now() : undefined;
  const next: Game = { ...game };
  if (finishedAt) next.finishedAt = finishedAt;
  else delete next.finishedAt;
  return next;
}

/** Kończy mecz przed czasem: zostaje w historii i statystykach, bez zwycięzcy. */
export function endEarly(game: Game, at = Date.now()): Game {
  if (replay(game).finished || game.turns.length === 0) return game;
  return { ...game, finishedAt: at, endedEarly: true };
}

/** Wznawia mecz zakończony przed czasem. */
export function resumeEarly(game: Game): Game {
  const next: Game = { ...game };
  delete next.finishedAt;
  delete next.endedEarly;
  return next;
}

export function addTurn(game: Game, input: TurnInput): Game {
  if (replay(game).finished) return game;
  return withFinish({ ...game, turns: [...game.turns, input] });
}

export function undoTurn(game: Game): Game {
  if (game.turns.length === 0) return game;
  return withFinish({ ...game, turns: game.turns.slice(0, -1) });
}

export function replaceLastTurn(game: Game, input: TurnInput): Game {
  if (game.turns.length === 0) return game;
  return withFinish({ ...game, turns: [...game.turns.slice(0, -1), input] });
}

export function renamePlayer(game: Game, playerId: string, name: string): Game {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return game;
  return { ...game, players: game.players.map((p) => (p.id === playerId ? { ...p, name: clean } : p)) };
}

export function setPlayerDoubles(game: Game, playerId: string, doubles: number[]): Game {
  return { ...game, players: game.players.map((p) => (p.id === playerId ? { ...p, doubles } : p)) };
}

/** Rewanż: ci sami gracze, kolejność przesunięta o jeden (zaczyna następny). */
export function rematch(game: Game): Game {
  const [first, ...rest] = game.players;
  const order = game.players.length > 1 ? [...rest, first] : game.players;
  return createGame(order, game.settings);
}

export function describeSettings(s: MatchSettings): string {
  const out = s.outMode === "double" ? "Double Out" : s.outMode === "master" ? "Master Out" : "Single Out";
  const fmt =
    s.format === "single" ? "1 leg" : s.format === "firstTo" ? `do ${s.legsTarget} wygranych` : `best of ${s.legsTarget}`;
  return `${s.startingScore} · ${out} · ${fmt}`;
}
