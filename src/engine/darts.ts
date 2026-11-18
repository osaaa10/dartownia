import type { DartLabel, OutMode } from "./types";

export interface ParsedDart {
  label: DartLabel;
  /** 0 = pudło, 1–20, 25 = bull. */
  segment: number;
  multiplier: 1 | 2 | 3;
  value: number;
}

export function makeLabel(segment: number, multiplier: 1 | 2 | 3): DartLabel {
  if (segment === 0) return "MISS";
  if (segment === 25) return multiplier === 2 ? "BULL" : "25";
  return `${multiplier === 3 ? "T" : multiplier === 2 ? "D" : "S"}${segment}`;
}

export function parseDart(label: DartLabel): ParsedDart {
  if (label === "MISS") return { label, segment: 0, multiplier: 1, value: 0 };
  if (label === "25") return { label, segment: 25, multiplier: 1, value: 25 };
  if (label === "BULL") return { label, segment: 25, multiplier: 2, value: 50 };
  const m = /^([SDT])(\d{1,2})$/.exec(label);
  if (!m) throw new Error(`Nieznana lotka: ${label}`);
  const seg = Number(m[2]);
  if (seg < 1 || seg > 20) throw new Error(`Nieznana lotka: ${label}`);
  const mult = m[1] === "T" ? 3 : m[1] === "D" ? 2 : 1;
  return { label, segment: seg, multiplier: mult, value: seg * mult };
}

const valueCache = new Map<DartLabel, number>();
export function dartValue(label: DartLabel): number {
  let v = valueCache.get(label);
  if (v === undefined) {
    v = parseDart(label).value;
    valueCache.set(label, v);
  }
  return v;
}

/** Etykieta do wyświetlenia: pojedyncze pole jako sama liczba ("20" zamiast "S20"). */
export function displayLabel(label: DartLabel): string {
  if (label === "MISS") return "Pudło";
  return label.startsWith("S") ? label.slice(1) : label;
}

/** Czy ta lotka może zakończyć leg w danym trybie. */
export function isValidFinishDart(label: DartLabel, out: OutMode): boolean {
  const d = parseDart(label);
  if (d.value === 0) return false;
  if (out === "single") return true;
  if (out === "double") return d.multiplier === 2;
  return d.multiplier === 2 || d.multiplier === 3; // master: double, treble lub bull
}

/** Najniższy wynik, który da się jeszcze zamknąć (przy double/master 1 to bust). */
export function isDeadScore(score: number, out: OutMode): boolean {
  return out !== "single" && score === 1;
}

// ---------- Wszystkie możliwe lotki ----------

export const ALL_DARTS: DartLabel[] = (() => {
  const out: DartLabel[] = [];
  for (let s = 1; s <= 20; s++) out.push(`S${s}`, `D${s}`, `T${s}`);
  out.push("25", "BULL");
  return out;
})();

const VALUES_ANY = new Set<number>([0, ...ALL_DARTS.map(dartValue)]);

/** Czy sumę `total` da się uzyskać dokładnie `n` lotkami (pudło = 0 się liczy). */
export function isAchievable(total: number, n = 3): boolean {
  if (total < 0 || total > 60 * n) return false;
  if (n === 1) return VALUES_ANY.has(total);
  for (const v of VALUES_ANY) {
    if (v <= total && isAchievable(total - v, n - 1)) return true;
  }
  return false;
}

// ---------- Podpowiedzi zakończeń ----------

/** Standardowe drogi Double Out (zweryfikowane testem: suma i kończący double). */
const DOUBLE_OUT_TABLE: Record<number, DartLabel[]> = {
  170: ["T20", "T20", "BULL"], 167: ["T20", "T19", "BULL"], 164: ["T20", "T18", "BULL"],
  161: ["T20", "T17", "BULL"], 160: ["T20", "T20", "D20"], 158: ["T20", "T20", "D19"],
  157: ["T20", "T19", "D20"], 156: ["T20", "T20", "D18"], 155: ["T20", "T19", "D19"],
  154: ["T20", "T18", "D20"], 153: ["T20", "T19", "D18"], 152: ["T20", "T20", "D16"],
  151: ["T20", "T17", "D20"], 150: ["T20", "T18", "D18"], 149: ["T20", "T19", "D16"],
  148: ["T20", "T20", "D14"], 147: ["T20", "T17", "D18"], 146: ["T20", "T18", "D16"],
  145: ["T20", "T15", "D20"], 144: ["T20", "T20", "D12"], 143: ["T20", "T17", "D16"],
  142: ["T20", "T14", "D20"], 141: ["T20", "T19", "D12"], 140: ["T20", "T20", "D10"],
  139: ["T19", "T14", "D20"], 138: ["T20", "T18", "D12"], 137: ["T20", "T15", "D16"],
  136: ["T20", "T20", "D8"], 135: ["T20", "T17", "D12"], 134: ["T20", "T14", "D16"],
  133: ["T20", "T19", "D8"], 132: ["T20", "T16", "D12"], 131: ["T20", "T13", "D16"],
  130: ["T20", "T18", "D8"], 129: ["T19", "T16", "D12"], 128: ["T18", "T14", "D16"],
  127: ["T20", "T17", "D8"], 126: ["T19", "T19", "D6"], 125: ["25", "T20", "D20"],
  124: ["T20", "T16", "D8"], 123: ["T19", "T16", "D9"], 122: ["T18", "T18", "D7"],
  121: ["T20", "T11", "D14"], 120: ["T20", "S20", "D20"], 119: ["T19", "T12", "D13"],
  118: ["T20", "S18", "D20"], 117: ["T20", "S17", "D20"], 116: ["T20", "S16", "D20"],
  115: ["T20", "S15", "D20"], 114: ["T20", "S14", "D20"], 113: ["T20", "S13", "D20"],
  112: ["T20", "S12", "D20"], 111: ["T20", "S11", "D20"], 110: ["T20", "S10", "D20"],
  109: ["T20", "S9", "D20"], 108: ["T20", "S16", "D16"], 107: ["T19", "S10", "D20"],
  106: ["T20", "S6", "D20"], 105: ["T20", "S5", "D20"], 104: ["T18", "S18", "D16"],
  103: ["T19", "S6", "D20"], 102: ["T20", "S10", "D16"], 101: ["T17", "S10", "D20"],
  100: ["T20", "D20"], 99: ["T19", "S10", "D16"], 98: ["T20", "D19"], 97: ["T19", "D20"],
  96: ["T20", "D18"], 95: ["T19", "D19"], 94: ["T18", "D20"], 93: ["T19", "D18"],
  92: ["T20", "D16"], 91: ["T17", "D20"], 90: ["T20", "D15"], 89: ["T19", "D16"],
  88: ["T20", "D14"], 87: ["T17", "D18"], 86: ["T18", "D16"], 85: ["T15", "D20"],
  84: ["T20", "D12"], 83: ["T17", "D16"], 82: ["T14", "D20"], 81: ["T19", "D12"],
  80: ["T20", "D10"], 79: ["T19", "D11"], 78: ["T18", "D12"], 77: ["T19", "D10"],
  76: ["T20", "D8"], 75: ["T17", "D12"], 74: ["T14", "D16"], 73: ["T19", "D8"],
  72: ["T16", "D12"], 71: ["T13", "D16"], 70: ["T18", "D8"], 69: ["T19", "D6"],
  68: ["T20", "D4"], 67: ["T17", "D8"], 66: ["T10", "D18"], 65: ["T19", "D4"],
  64: ["T16", "D8"], 63: ["T13", "D12"], 62: ["T10", "D16"], 61: ["T15", "D8"],
  60: ["S20", "D20"], 59: ["S19", "D20"], 58: ["S18", "D20"], 57: ["S17", "D20"],
  56: ["S16", "D20"], 55: ["S15", "D20"], 54: ["S14", "D20"], 53: ["S13", "D20"],
  52: ["S12", "D20"], 51: ["S11", "D20"], 50: ["BULL"], 49: ["S9", "D20"],
  48: ["S16", "D16"], 47: ["S15", "D16"], 46: ["S6", "D20"], 45: ["S13", "D16"],
  44: ["S12", "D16"], 43: ["S11", "D16"], 42: ["S10", "D16"], 41: ["S9", "D16"],
  40: ["D20"], 39: ["S7", "D16"], 38: ["D19"], 37: ["S5", "D16"], 36: ["D18"],
  35: ["S3", "D16"], 34: ["D17"], 33: ["S1", "D16"], 32: ["D16"], 31: ["S15", "D8"],
  30: ["D15"], 29: ["S13", "D8"], 28: ["D14"], 27: ["S11", "D8"], 26: ["D13"],
  25: ["S9", "D8"], 24: ["D12"], 23: ["S7", "D8"], 22: ["D11"], 21: ["S5", "D8"],
  20: ["D10"], 19: ["S3", "D8"], 18: ["D9"], 17: ["S1", "D8"], 16: ["D8"],
  15: ["S7", "D4"], 14: ["D7"], 13: ["S5", "D4"], 12: ["D6"], 11: ["S3", "D4"],
  10: ["D5"], 9: ["S1", "D4"], 8: ["D4"], 7: ["S3", "D2"], 6: ["D3"], 5: ["S1", "D2"],
  4: ["D2"], 3: ["S1", "D1"], 2: ["D1"],
};

export const doubleOutTable = DOUBLE_OUT_TABLE;

// Kolejność preferencji przy wyszukiwaniu drogi.
const SETUP_ORDER: DartLabel[] = [
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => `T${s}`),
  "25",
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => `S${s}`),
  "BULL",
  ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => `D${s}`),
];
const DOUBLE_PREF = [20, 16, 18, 10, 8, 12, 14, 19, 17, 15, 13, 11, 9, 6, 4, 7, 5, 3, 2, 1].map((s) => `D${s}`);
const FINISH_ORDER: Record<OutMode, DartLabel[]> = {
  double: [...DOUBLE_PREF, "BULL"],
  master: [...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => `T${s}`), ...DOUBLE_PREF, "BULL"],
  single: SETUP_ORDER,
};

function search(score: number, out: OutMode, darts: number): DartLabel[] | null {
  // Najpierw najkrótsza droga.
  for (let n = 1; n <= darts; n++) {
    const r = searchExact(score, out, n);
    if (r) return r;
  }
  return null;
}

function searchExact(score: number, out: OutMode, n: number): DartLabel[] | null {
  if (n === 1) {
    for (const f of FINISH_ORDER[out]) if (dartValue(f) === score) return [f];
    return null;
  }
  for (const s of SETUP_ORDER) {
    const v = dartValue(s);
    const rest = score - v;
    if (rest <= 0 || isDeadScore(rest, out)) continue;
    const tail = searchExact(rest, out, n - 1);
    if (tail) return [s, ...tail];
  }
  return null;
}

/**
 * Sugerowana droga zakończenia dla wyniku przy `dartsLeft` lotkach w kolejce.
 * Zwraca null, gdy nie da się zamknąć.
 */
const checkoutCache = new Map<string, DartLabel[] | null>();

export function suggestCheckout(score: number, out: OutMode, dartsLeft = 3): DartLabel[] | null {
  const key = `${out}:${score}:${dartsLeft}`;
  if (checkoutCache.has(key)) return checkoutCache.get(key)!;
  const r = computeCheckout(score, out, dartsLeft);
  checkoutCache.set(key, r);
  return r;
}

function computeCheckout(score: number, out: OutMode, dartsLeft: number): DartLabel[] | null {
  if (score < 1 || dartsLeft < 1) return null;
  if (out === "double") {
    if (score > 170) return null;
    const t = DOUBLE_OUT_TABLE[score];
    if (t && t.length <= dartsLeft) return t;
    return search(score, out, dartsLeft);
  }
  if (score > 180) return null;
  return search(score, out, dartsLeft);
}

/** Czy wynik da się zamknąć w jednej kolejce (do liczenia prób checkoutu). */
export function canFinish(score: number, out: OutMode, dartsLeft = 3): boolean {
  return suggestCheckout(score, out, dartsLeft) !== null;
}
