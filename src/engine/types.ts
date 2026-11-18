// Typy domenowe. Gra jest zapisywana jako LOG kolejek (TurnInput[]),
// a cały stan (wyniki, legi, zwycięzca) jest z niego odtwarzany funkcją replay().
// Dzięki temu cofanie i poprawianie to po prostu usunięcie/podmiana ostatniego wpisu.

export type OutMode = "single" | "double" | "master";
export type MatchFormat = "single" | "firstTo" | "bestOf";
export type InputMode = "board" | "keypad" | "numpad";

/**
 * Etykieta lotki: "S1".."S20", "D1".."D20", "T1".."T20", "25" (outer bull),
 * "BULL" (50, liczy się jako double), "MISS".
 */
export type DartLabel = string;

export interface Player {
  id: string;
  name: string;
  /** Kolor jako trójka HSL, np. "243 75% 59%". */
  color: string;
}

export interface MatchSettings {
  startingScore: number;
  outMode: OutMode;
  format: MatchFormat;
  /** Dla firstTo: ile legów trzeba wygrać. Dla bestOf: z ilu legów (nieparzyste). */
  legsTarget: number;
  rotateStarter: boolean;
}

/** Jeden wpis w logu = jedna kolejka (do 3 lotek) aktualnego gracza. */
export interface TurnInput {
  /** Lotki rzucone w kolejce (tarcza / klawiatura segmentów). */
  darts?: DartLabel[];
  /** Suma kolejki (numpad). Używane, gdy brak `darts`. */
  total?: number;
  /** Numpad: iloma lotkami zakończono (1–3). Domyślnie 3. */
  dartsUsed?: number;
  /** Numpad: czy ostatnia lotka była double (lub double/treble w Master Out). */
  validFinish?: boolean;
  /** Ręczny bust (np. lotka poza tarczą przy finiszu, pomyłka). */
  bust?: boolean;
  at: number;
}

export interface Game {
  v: 1;
  id: string;
  createdAt: number;
  players: Player[];
  settings: MatchSettings;
  turns: TurnInput[];
  /** Ustawiane, gdy mecz się zakończył (czas ostatniej kolejki). */
  finishedAt?: number;
}

/** Wynik odtworzenia jednej kolejki. */
export interface TurnResult {
  playerId: string;
  legIndex: number;
  /** Która to kolejka tego gracza w legu (0, 1, 2…). */
  visitInLeg: number;
  scoreBefore: number;
  scoreAfter: number;
  /** Punkty zaliczone (0 przy buście). */
  scored: number;
  /** Rzucone lotki — do średniej. Bust liczy się jako 3 lotki. */
  dartsUsed: number;
  isBust: boolean;
  isCheckout: boolean;
  darts?: DartLabel[];
  at: number;
}

export interface LegState {
  index: number;
  starterIndex: number;
  scores: Record<string, number>;
  winnerId: string | null;
  turns: TurnResult[];
}

export interface GameView {
  legs: LegState[];
  legWins: Record<string, number>;
  currentLegIndex: number;
  currentPlayerIndex: number;
  finished: boolean;
  winnerId: string | null;
  turns: TurnResult[];
}

export const MAX_PLAYERS = 16;
