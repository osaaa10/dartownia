export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Polska odmiana: plural(1, "kolejka", "kolejki", "kolejek"). */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

export const pl = (n: number, one: string, few: string, many: string) => `${n} ${plural(n, one, few, many)}`;

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtNum(n: number, digits = 1): string {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function vibrate(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* brak wsparcia */
  }
}
