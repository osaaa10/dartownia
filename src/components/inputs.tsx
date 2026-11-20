import { useCallback, useEffect, useState } from "react";
import { Check, Delete, Undo2 } from "lucide-react";
import { dartValue, displayLabel, finishHint, isAchievable, suggestCheckout, type FinishHint } from "../engine/darts";
import { makeLabel } from "../engine/darts";
import type { DartLabel, OutMode, TurnInput } from "../engine/types";
import { cn, vibrate } from "../lib/util";
import { Dartboard } from "./Dartboard";
import { Button, Modal } from "./ui";
import { useVisit, type VisitStatus } from "./useVisit";

type Commit = (t: Omit<TurnInput, "at">) => void;

interface InputProps {
  scoreBefore: number;
  outMode: OutMode;
  onCommit: Commit;
  /** Ulubione double aktywnego gracza. */
  prefs?: number[];
}

/** Linia podpowiedzi: „Zamknięcie: T20 · D16” albo „Ustaw: 20 → zostaje 32 (D16)”. */
export function HintLine({ hint }: { hint: FinishHint | null }) {
  if (!hint) return null;
  return (
    <>
      <span className="shrink-0 uppercase tracking-wider text-muted">{hint.kind === "checkout" ? "Zamknięcie:" : "Ustaw:"}</span>
      {hint.route.map((r, i) => (
        <span
          key={i}
          className={cn(
            "rounded px-1.5 py-0.5 font-mono font-bold",
            hint.kind === "checkout" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary",
          )}
        >
          {displayLabel(r)}
        </span>
      ))}
      {hint.kind === "setup" && (
        <span className="truncate text-muted">
          → zostaje {hint.leave} ({displayLabel(hint.double)})
        </span>
      )}
    </>
  );
}

// ---------------------------------------------------------------- nagłówek kolejki

function dartChipClass(label: DartLabel) {
  if (label === "MISS") return "border-warn/50 bg-warn/10 text-warn";
  if (label.startsWith("T")) return "border-accent bg-accent/15 text-accent";
  if (label.startsWith("D") || label === "BULL") return "border-primary bg-primary/15";
  return "border-line bg-surface2";
}

function VisitHeader({
  darts,
  total,
  remaining,
  status,
  hint,
  committing,
}: {
  darts: DartLabel[];
  total: number;
  remaining: number;
  status: VisitStatus;
  hint: FinishHint | null;
  committing: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => {
            const d = darts[i];
            return (
              <div
                key={i}
                className={cn(
                  "flex h-12 w-14 flex-col items-center justify-center rounded-lg border-2 font-mono text-sm font-bold leading-tight",
                  d ? dartChipClass(d) : i === darts.length ? "border-dashed border-primary/60 text-muted" : "border-dashed border-line text-muted/40",
                )}
              >
                {d ? (
                  <>
                    <span>{displayLabel(d)}</span>
                    <span className="text-[10px] font-normal text-muted">{dartValue(d)}</span>
                  </>
                ) : (
                  <span className="text-[11px]">#{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="ml-auto flex items-end gap-4 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted">Kolejka</div>
            <div className="font-score text-3xl leading-none">{total}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted">Zostaje</div>
            <div
              className={cn(
                "font-score text-3xl leading-none",
                status === "bust" && "text-danger",
                status === "checkout" && "text-accent",
              )}
            >
              {status === "bust" ? "BUST" : remaining}
            </div>
          </div>
        </div>
      </div>
      {/* Stała wysokość — nic pod spodem nie skacze. */}
      <div className="mt-2 flex h-6 items-center gap-2 overflow-hidden text-xs">
        {committing ? (
          <span className={cn("font-semibold", status === "bust" ? "text-danger" : "text-accent")}>
            {status === "bust" ? "Bust! " : status === "checkout" ? "Checkout! " : ""}Zatwierdzam… (możesz jeszcze cofnąć)
          </span>
        ) : (
          <HintLine hint={hint} />
        )}
      </div>
    </div>
  );
}

function VisitActions({
  v,
}: {
  v: ReturnType<typeof useVisit>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button onClick={v.undo} disabled={v.darts.length === 0} className="h-12">
        <Undo2 className="h-4 w-4" /> Cofnij
      </Button>
      <Button onClick={v.manualBust} className="h-12 border-danger/50 bg-danger/10 text-danger">
        Bust
      </Button>
      <Button variant="accent" onClick={v.finish} disabled={v.darts.length === 0} className="h-12">
        <Check className="h-4 w-4" /> Zatwierdź
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- tarcza

export function BoardInput({ scoreBefore, outMode, onCommit, prefs, confirmMode }: InputProps & { confirmMode: "double" | "single" }) {
  const v = useVisit(scoreBefore, outMode, onCommit, prefs);
  const [pending, setPending] = useState<DartLabel | null>(null);
  const locked = v.status !== "open";

  const tap = useCallback(
    (label: DartLabel) => {
      if (locked) return;
      if (confirmMode === "single") {
        v.add(label);
        return;
      }
      if (pending === label) {
        setPending(null);
        v.add(label);
      } else {
        vibrate(6);
        setPending(label);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locked, confirmMode, pending, v.add],
  );

  const hint = v.hint?.route[0] ?? null;

  return (
    <div className="space-y-2.5">
      <VisitHeader {...v} />
      {/* Pasek wyboru: zawsze ta sama wysokość, więc tarcza się nie przesuwa. */}
      <div className="flex h-11 items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm">
        {pending ? (
          <>
            <span className="truncate">
              <span className="text-muted">Wybrano </span>
              <span className="font-mono font-bold text-primary">
                {displayLabel(pending)} · {dartValue(pending)}
              </span>
              <span className="hidden text-muted sm:inline"> — stuknij ponownie</span>
            </span>
            <span className="flex shrink-0 gap-1.5">
              <button className="rounded-md border border-line px-2.5 py-1 text-xs" onClick={() => setPending(null)}>
                Anuluj
              </button>
              <button
                className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-white"
                onClick={() => tap(pending)}
              >
                OK
              </button>
            </span>
          </>
        ) : (
          <span className="text-xs text-muted">
            {locked
              ? "Kolejka zakończona"
              : confirmMode === "double"
                ? "Stuknij pole, potem stuknij je jeszcze raz, żeby potwierdzić"
                : "Stuknij pole, w które trafiła lotka"}
          </span>
        )}
      </div>
      <div className="mx-auto w-full max-w-[min(440px,72vh)]">
        <Dartboard onHit={tap} pending={pending} hits={v.darts} highlight={hint} disabled={locked} />
      </div>
      <button
        type="button"
        disabled={locked}
        onClick={() => tap("MISS")}
        className={cn(
          "h-11 w-full rounded-lg border font-mono text-xs font-bold uppercase tracking-widest transition disabled:opacity-40",
          pending === "MISS" ? "border-primary bg-primary/15 text-primary" : "border-line bg-surface2 text-muted",
        )}
      >
        {pending === "MISS" ? "Pudło — stuknij ponownie" : "Pudło (poza punktami) · 0"}
      </button>
      <VisitActions v={v} />
    </div>
  );
}

// ---------------------------------------------------------------- klawiatura segmentów

export function KeypadInput({ scoreBefore, outMode, onCommit, prefs }: InputProps) {
  const v = useVisit(scoreBefore, outMode, onCommit, prefs);
  const [mult, setMult] = useState<1 | 2 | 3>(1);
  const locked = v.status !== "open";

  const add = (segment: number, m: 1 | 2 | 3 = mult) => {
    v.add(makeLabel(segment, segment === 0 ? 1 : m));
    setMult(1);
  };

  return (
    <div className="space-y-2.5">
      <VisitHeader {...v} />
      <div className="grid grid-cols-5 gap-1.5">
        {[20, 19, 18, 17, 16].map((s) => (
          <button
            key={s}
            disabled={locked}
            onClick={() => add(s, 3)}
            className="h-11 rounded-lg border border-accent/40 bg-accent/10 font-score text-xl text-accent active:scale-95 disabled:opacity-40"
          >
            T{s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {([1, 2, 3] as const).map((m) => (
          <button
            key={m}
            disabled={locked}
            onClick={() => setMult(mult === m ? 1 : m)}
            className={cn(
              "h-12 rounded-lg border font-score text-2xl transition active:scale-95 disabled:opacity-40",
              mult === m
                ? m === 3
                  ? "border-accent bg-accent/20 text-accent"
                  : m === 2
                    ? "border-primary bg-primary/20"
                    : "border-fg/40 bg-surface3"
                : "border-line bg-surface2 text-muted",
            )}
          >
            {m === 1 ? "Single" : m === 2 ? "Double" : "Treble"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            disabled={locked}
            onClick={() => add(n)}
            className={cn(
              "h-12 rounded-lg border border-line bg-surface2 font-score text-2xl active:scale-95 disabled:opacity-40",
              mult === 3 && "text-accent",
              mult === 2 && "text-primary",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button disabled={locked} onClick={() => v.add("25")} className="h-12 rounded-lg border border-ok/40 bg-ok/10 font-score text-2xl active:scale-95 disabled:opacity-40">
          25
        </button>
        <button disabled={locked} onClick={() => v.add("BULL")} className="h-12 rounded-lg border border-danger/50 bg-danger/10 font-score text-2xl active:scale-95 disabled:opacity-40">
          Bull 50
        </button>
        <button disabled={locked} onClick={() => add(0)} className="h-12 rounded-lg border border-warn/40 bg-warn/10 font-score text-2xl text-warn active:scale-95 disabled:opacity-40">
          Pudło
        </button>
      </div>
      <VisitActions v={v} />
    </div>
  );
}

// ---------------------------------------------------------------- numpad (suma kolejki)

const PRESETS = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180];

export function NumpadInput({ scoreBefore, outMode, onCommit, prefs }: InputProps) {
  const [value, setValue] = useState("");
  const [askFinish, setAskFinish] = useState(false);
  const [askImpossible, setAskImpossible] = useState(false);
  const num = Number(value || 0);
  const after = scoreBefore - num;
  const bust = value !== "" && (after < 0 || (outMode !== "single" && after === 1));

  const submit = (force = false) => {
    if (value === "" || num > 180) return;
    if (!force && !isAchievable(num)) {
      setAskImpossible(true);
      return;
    }
    if (after === 0) {
      setAskFinish(true);
      return;
    }
    onCommit({ total: num });
  };

  // Klawiatura fizyczna (np. laptop przy tarczy).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || askFinish || askImpossible) return;
      if (/^[0-9]$/.test(e.key)) setValue((v) => (v.length >= 3 ? v : (v + e.key).replace(/^0+(?=\d)/, "")));
      else if (e.key === "Backspace") setValue((v) => v.slice(0, -1));
      else if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const press = (k: string) => {
    vibrate(8);
    setValue((v) => (v.length >= 3 ? v : (v + k).replace(/^0+(?=\d)/, "")));
  };

  const finishOptions = [1, 2, 3].filter((n) => suggestCheckout(num, outMode, n) !== null);
  const needsDouble = outMode !== "single";

  return (
    <div className="space-y-2.5">
      <div className={cn("rounded-xl border bg-surface px-4 py-3", num > 180 ? "border-warn" : "border-line")}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted">Wynik kolejki</div>
            <div className={cn("font-score text-6xl leading-none", value === "" && "text-muted/40")}>{value || "0"}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted">Zostaje</div>
            <div className={cn("font-score text-4xl leading-none", bust && "text-danger")}>
              {bust ? "BUST" : Math.max(after, 0)}
            </div>
          </div>
        </div>
        <div className="mt-2 flex h-6 items-center gap-2 overflow-hidden text-xs">
          {num > 180 ? (
            <span className="text-warn">Maksymalnie 180</span>
          ) : (
            <HintLine hint={finishHint(scoreBefore, outMode, 3, prefs)} />
          )}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {PRESETS.map((n) => (
          <button
            key={n}
            onClick={() => setValue(String(n))}
            className={cn(
              "h-10 rounded-md border border-line bg-surface2 font-mono text-sm font-semibold active:scale-95",
              n === 180 && "border-accent/50 text-accent",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <button key={k} onClick={() => press(k)} className="h-14 rounded-lg border border-line bg-surface2 font-score text-3xl active:scale-95">
            {k}
          </button>
        ))}
        <button onClick={() => setValue("")} className="h-14 rounded-lg border border-line bg-surface2 text-xs font-bold uppercase text-muted active:scale-95">
          Wyczyść
        </button>
        <button onClick={() => press("0")} className="h-14 rounded-lg border border-line bg-surface2 font-score text-3xl active:scale-95">
          0
        </button>
        <button
          onClick={() => setValue((v) => v.slice(0, -1))}
          aria-label="Usuń cyfrę"
          className="flex h-14 items-center justify-center rounded-lg border border-line bg-surface2 active:scale-95"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>
      <Button variant="accent" size="lg" className="w-full" disabled={value === "" || num > 180} onClick={() => submit()}>
        <Check className="h-5 w-5" /> Zatwierdź
      </Button>

      <Modal open={askFinish} onClose={() => setAskFinish(false)} title="Koniec lega?">
        <p className="text-sm text-muted">
          {needsDouble
            ? outMode === "master"
              ? "Ostatnia lotka musi być w double, treble albo bullu. Iloma lotkami zamknięto?"
              : "Ostatnia lotka musi być w double albo bullu. Iloma lotkami zamknięto?"
            : "Iloma lotkami zamknięto?"}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((n) => (
            <Button
              key={n}
              variant="accent"
              disabled={!finishOptions.includes(n)}
              onClick={() => {
                setAskFinish(false);
                onCommit({ total: num, dartsUsed: n, validFinish: true });
              }}
            >
              {n} {n === 1 ? "lotka" : "lotki"}
            </Button>
          ))}
        </div>
        {needsDouble && (
          <Button
            className="mt-2 w-full border-danger/50 text-danger"
            onClick={() => {
              setAskFinish(false);
              onCommit({ total: num, validFinish: false });
            }}
          >
            Nie trafiłem {outMode === "master" ? "double/treble" : "doubla"} — bust
          </Button>
        )}
      </Modal>

      <Modal open={askImpossible} onClose={() => setAskImpossible(false)} title="Na pewno?">
        <p className="text-sm text-muted">
          Wyniku <b className="text-fg">{num}</b> nie da się rzucić trzema lotkami. Pewnie literówka.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => { setAskImpossible(false); setValue(""); }}>Popraw</Button>
          <Button variant="accent" onClick={() => { setAskImpossible(false); submit(true); }}>Zapisz mimo to</Button>
        </div>
      </Modal>
    </div>
  );
}
