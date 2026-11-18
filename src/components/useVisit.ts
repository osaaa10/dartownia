import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dartValue, suggestCheckout } from "../engine/darts";
import { evaluateTurn } from "../engine/game";
import type { DartLabel, OutMode, TurnInput } from "../engine/types";
import { sound } from "../lib/audio";
import { vibrate } from "../lib/util";

export type VisitStatus = "open" | "bust" | "checkout" | "full";

/** Czas na cofnięcie ostatniej lotki, zanim kolejka zostanie zatwierdzona. */
const COMMIT_DELAY = 650;

/**
 * Stan bieżącej kolejki (do 3 lotek) dla tarczy i klawiatury segmentów.
 * Komponent jest montowany od nowa przy każdej kolejce (key), więc nie trzeba go resetować.
 */
export function useVisit(scoreBefore: number, out: OutMode, onCommit: (t: Omit<TurnInput, "at">) => void) {
  const [darts, setDarts] = useState<DartLabel[]>([]);
  const [committing, setCommitting] = useState(false);
  const timer = useRef<number | null>(null);
  const committed = useRef(false);

  const total = darts.reduce((s, d) => s + dartValue(d), 0);
  const ev = useMemo(
    () => (darts.length ? evaluateTurn(scoreBefore, { darts, at: 0 }, out) : null),
    [darts, scoreBefore, out],
  );
  const status: VisitStatus = !ev
    ? "open"
    : ev.isBust
      ? "bust"
      : ev.isCheckout
        ? "checkout"
        : darts.length >= 3
          ? "full"
          : "open";
  const remaining = status === "bust" ? scoreBefore : scoreBefore - total;
  const route = status === "open" ? suggestCheckout(remaining, out, 3 - darts.length) : null;

  const cancelTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setCommitting(false);
  };

  const commitNow = useCallback(
    (list: DartLabel[], bust = false) => {
      if (committed.current) return;
      committed.current = true;
      if (timer.current) window.clearTimeout(timer.current);
      onCommit(bust ? { darts: list, bust: true } : { darts: list });
    },
    [onCommit],
  );

  // Automatyczne zatwierdzenie po 3 lotkach, checkoucie lub buście.
  useEffect(() => {
    if (status === "open") return;
    setCommitting(true);
    timer.current = window.setTimeout(() => commitNow(darts), COMMIT_DELAY);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [status, darts, commitNow]);

  useEffect(() => () => cancelTimer(), []);

  const add = (label: DartLabel) => {
    if (status !== "open" || committed.current) return;
    vibrate(10);
    sound.dart();
    setDarts((d) => (d.length >= 3 ? d : [...d, label]));
  };

  const undo = () => {
    if (committed.current) return;
    cancelTimer();
    setDarts((d) => d.slice(0, -1));
  };

  /** Zakończ kolejkę wcześniej (brakujące lotki = pudła). */
  const finish = () => {
    if (darts.length === 0) return;
    commitNow(darts);
  };

  const manualBust = () => {
    vibrate([30, 40, 30]);
    commitNow(darts, true);
  };

  return { darts, total, remaining, status, route, committing, add, undo, finish, manualBust };
}
