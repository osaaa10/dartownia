import { useEffect, useState } from "react";
import { doubleLabel } from "../engine/darts";
import { cn } from "../lib/util";
import { Button, Modal } from "./ui";

const MAX = 3;
const OPTIONS = [...Array.from({ length: 20 }, (_, i) => 20 - i), 25];

/** Krótki opis, np. „D16 · D8”. */
export function doublesText(d?: number[]): string {
  return d && d.length ? d.map(doubleLabel).join(" · ") : "";
}

/** Wybór ulubionych doubli (do 3, w kolejności stukania). */
export function DoublesPicker({
  open,
  name,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  name: string;
  value?: number[];
  onClose: () => void;
  onSave: (d: number[]) => void;
}) {
  const [sel, setSel] = useState<number[]>(value ?? []);
  useEffect(() => {
    if (open) setSel(value ?? []);
  }, [open, value]);

  const toggle = (n: number) =>
    setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : s.length >= MAX ? [...s.slice(1), n] : [...s, n]));

  return (
    <Modal open={open} onClose={onClose} title={`Ulubione double${name ? ` — ${name}` : ""}`}>
      <p className="text-sm text-muted">
        Wybierz do {MAX} doubli, na których najchętniej kończysz, od najlepszego. Podpowiedzi zakończeń będą prowadzić na
        nie, a gdy nie da się zamknąć — pokażą, jak zostawić sobie ulubiony double.
      </p>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {OPTIONS.map((n) => {
          const idx = sel.indexOf(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              aria-pressed={idx >= 0}
              className={cn(
                "relative h-11 rounded-lg border font-score text-lg",
                idx >= 0 ? "border-accent bg-accent/20 text-accent" : "border-line bg-surface2",
                n === 25 && "col-span-2",
              )}
            >
              {n === 25 ? "Bull" : `D${n}`}
              {idx >= 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent font-sans text-[10px] font-bold text-accentfg">
                  {idx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 h-5 text-sm">
        {sel.length ? (
          <span>
            Kolejność: <b className="text-accent">{doublesText(sel)}</b>
          </span>
        ) : (
          <span className="text-muted">Brak — podpowiedzi standardowe.</span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button onClick={() => setSel([])} disabled={!sel.length}>
          Wyczyść
        </Button>
        <Button onClick={onClose}>Anuluj</Button>
        <Button
          variant="accent"
          onClick={() => {
            onSave(sel);
            onClose();
          }}
        >
          Zapisz
        </Button>
      </div>
    </Modal>
  );
}
