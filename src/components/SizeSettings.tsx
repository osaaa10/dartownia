import { Minus, Plus, RotateCcw } from "lucide-react";
import { DEFAULT_APP_SETTINGS, type AppStore } from "../lib/store";
import { cn } from "../lib/util";
import { Button, Modal, Row, SectionLabel, Segmented, Switch } from "./ui";

/** Klasy rozmiarów przycisków szybkich wyników (26, 41, 60…). */
export const PRESET_SIZES = [
  "h-10 text-sm",
  "h-12 text-lg",
  "h-14 text-2xl",
  "h-16 text-3xl",
] as const;

/** Klasy rozmiarów klawiatury z cyframi. */
export const KEYPAD_SIZES = [
  "h-12 text-2xl",
  "h-14 text-3xl",
  "h-16 text-4xl",
  "h-20 text-5xl",
] as const;

/** Klasy rozmiaru wyniku aktywnego gracza. */
export const SCORE_SIZES = [
  "text-[3.75rem]",
  "text-[4.75rem]",
  "text-[6rem]",
] as const;

const at = <T,>(list: readonly T[], i: number) => list[Math.min(list.length - 1, Math.max(0, i))];
export const presetClass = (i: number) => at(PRESET_SIZES, i);
export const keypadClass = (i: number) => at(KEYPAD_SIZES, i);
export const scoreClass = (i: number) => at(SCORE_SIZES, i);

const SIZE4 = [
  { value: 0, label: "Mały" },
  { value: 1, label: "Średni" },
  { value: 2, label: "Duży" },
  { value: 3, label: "Max" },
];

/** Ustawienia wyglądu: skala interfejsu, rozmiary przycisków i szybkie zatwierdzanie. */
export function SizeControls({ store }: { store: AppStore }) {
  const s = store.data.settings;
  const set = store.setSettings;
  const scale = s.uiScale || 1;
  const setScale = (v: number) => set((x) => ({ ...x, uiScale: Math.round(Math.min(1.4, Math.max(0.8, v)) * 100) / 100 }));

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Cały interfejs</SectionLabel>
        <div className="flex items-center gap-2">
          <Button size="icon" onClick={() => setScale(scale - 0.05)} aria-label="Mniejszy interfejs" disabled={scale <= 0.8}>
            <Minus className="h-4 w-4" />
          </Button>
          <input
            type="range"
            min={0.8}
            max={1.4}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="min-w-0 flex-1 accent-[rgb(var(--primary))]"
            aria-label="Skala interfejsu"
          />
          <Button size="icon" onClick={() => setScale(scale + 0.05)} aria-label="Większy interfejs" disabled={scale >= 1.4}>
            <Plus className="h-4 w-4" />
          </Button>
          <span className="w-12 text-right font-mono text-sm">{Math.round(scale * 100)}%</span>
        </div>
      </div>

      <div>
        <SectionLabel>Szybkie wyniki (26, 41, 60…)</SectionLabel>
        <Segmented value={s.presetSize} onChange={(v) => set((x) => ({ ...x, presetSize: v }))} options={SIZE4} cols={4} />
        <div className="mt-2 grid grid-cols-5 gap-1.5" aria-hidden>
          {[41, 60, 81, 100, 180].map((n) => (
            <div
              key={n}
              className={cn(
                "flex items-center justify-center rounded-md border border-line bg-surface2 font-mono font-semibold",
                presetClass(s.presetSize),
                n === 180 && "border-accent/50 text-accent",
              )}
            >
              {n}
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Klawiatura z cyframi</SectionLabel>
        <Segmented value={s.keypadSize} onChange={(v) => set((x) => ({ ...x, keypadSize: v }))} options={SIZE4} cols={4} />
        <div className="mt-2 grid grid-cols-3 gap-2" aria-hidden>
          {["7", "8", "9"].map((k) => (
            <div key={k} className={cn("flex items-center justify-center rounded-lg border border-line bg-surface2 font-score", keypadClass(s.keypadSize))}>
              {k}
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Wynik gracza na górze</SectionLabel>
        <Segmented
          value={s.scoreSize}
          onChange={(v) => set((x) => ({ ...x, scoreSize: v }))}
          options={[
            { value: 0, label: "Mały" },
            { value: 1, label: "Średni" },
            { value: 2, label: "Duży" },
          ]}
        />
      </div>

      <div className="rounded-xl border border-line bg-surface2 px-4">
        <Row label="Szybki wynik od razu zatwierdza" desc="Stuknięcie np. 60 zapisuje kolejkę bez „Zatwierdź”. Pomyłkę cofniesz strzałką.">
          <Switch checked={s.quickSubmit} onChange={(v) => set((x) => ({ ...x, quickSubmit: v }))} label="Szybki wynik od razu zatwierdza" />
        </Row>
      </div>

      <Button
        variant="ghost"
        className="w-full"
        onClick={() =>
          set((x) => ({
            ...x,
            uiScale: DEFAULT_APP_SETTINGS.uiScale,
            presetSize: DEFAULT_APP_SETTINGS.presetSize,
            keypadSize: DEFAULT_APP_SETTINGS.keypadSize,
            scoreSize: DEFAULT_APP_SETTINGS.scoreSize,
          }))
        }
      >
        <RotateCcw className="h-4 w-4" /> Przywróć domyślne rozmiary
      </Button>
    </div>
  );
}

export function SizePanel({ store, open, onClose }: { store: AppStore; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Wygląd i rozmiar">
      <SizeControls store={store} />
    </Modal>
  );
}
