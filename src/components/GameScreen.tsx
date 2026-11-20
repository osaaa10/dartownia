import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import {
  ChevronDown,
  Crosshair,
  Grid3x3,
  Hash,
  Maximize,
  Minimize,
  Pause,
  Pencil,
  RotateCcw,
  Settings,
  Target,
  Trophy,
  Undo2,
} from "lucide-react";
import { displayLabel, suggestCheckout } from "../engine/darts";
import { addTurn, describeSettings, legsNeeded, rematch, renamePlayer, replay, setPlayerDoubles, undoTurn } from "../engine/game";
import { gameStats, legAverage, type PlayerStats } from "../engine/stats";
import type { Game, GameView, InputMode, TurnInput } from "../engine/types";
import { sound } from "../lib/audio";
import { speech } from "../lib/speech";
import type { AppStore } from "../lib/store";
import { cn, fmtNum, pl } from "../lib/util";
import { BoardInput, KeypadInput, NumpadInput } from "./inputs";
import { DoublesPicker, doublesText } from "./DoublesPicker";
import { Button, ConfirmDialog, Modal } from "./ui";

interface Props {
  store: AppStore;
  game: Game;
  onPause: () => void;
  onNewGame: () => void;
  onOpenSettings: () => void;
  notify: (msg: string, tone?: "info" | "good" | "bad") => void;
}

function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) void lock.release();
      } catch {
        /* np. bateria oszczędzania */
      }
    };
    void request();
    const onVis = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}

const MODES: { value: InputMode; label: string; icon: typeof Crosshair }[] = [
  { value: "board", label: "Tarcza", icon: Crosshair },
  { value: "keypad", label: "Pola", icon: Grid3x3 },
  { value: "numpad", label: "Suma", icon: Hash },
];

export function GameScreen({ store, game, onPause, onNewGame, onOpenSettings, notify }: Props) {
  const settings = store.data.settings;
  const view = useMemo(() => replay(game), [game]);
  const stats = useMemo(() => gameStats(game, view), [game, view]);
  const [flash, setFlash] = useState<"bust" | "max" | null>(null);
  const [isFs, setIsFs] = useState(!!document.fullscreenElement);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [pickDoubles, setPickDoubles] = useState<string | null>(null);
  const pickPlayer = game.players.find((p) => p.id === pickDoubles);

  useWakeLock(settings.keepAwake && !view.finished);

  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const player = game.players[view.currentPlayerIndex];
  const leg = view.legs[view.currentLegIndex];
  const score = leg.scores[player.id];
  const lastTurn = view.turns[view.turns.length - 1];
  const lastPlayer = lastTurn && game.players.find((p) => p.id === lastTurn.playerId);

  const commit = (input: Omit<TurnInput, "at">) => {
    const next = addTurn(game, { ...input, at: Date.now() });
    if (next === game) return;
    store.updateGame((g) => (g.turns.length === game.turns.length ? next : g));

    const nv = replay(next);
    const t = nv.turns[nv.turns.length - 1];
    const who = game.players.find((p) => p.id === t.playerId)!;
    const nextP = next.players[nv.currentPlayerIndex];
    const nextScore = nv.legs[nv.currentLegIndex].scores[nextP.id];
    const base = {
      scored: t.scored,
      remaining: t.scoreAfter,
      player: who.name,
      nextName: nv.finished ? undefined : nextP.name,
      nextScore,
    };

    if (t.isBust) {
      sound.play("bust");
      setFlash("bust");
      notify(`Bust — ${who.name}`, "bad");
      void speech.announce({ ...base, kind: "bust" });
    } else if (nv.finished) {
      sound.play("match");
      void speech.announce({ ...base, kind: "match" });
    } else if (t.isCheckout) {
      sound.play("leg");
      notify(`${who.name} wygrywa lega!`, "good");
      void speech.announce({ ...base, kind: "leg" });
    } else {
      if (t.scored === 180) {
        sound.play("180");
        setFlash("max");
        notify(`180! ${who.name}`, "good");
      } else if (t.scored >= 140) sound.play("ton40");
      else if (t.scored >= 100) sound.play("ton");
      else sound.play("turn");
      void speech.announce({ ...base, kind: "turn" });
    }
  };

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 650);
    return () => window.clearTimeout(id);
  }, [flash]);

  const doUndo = () => {
    setConfirmUndo(false);
    store.updateGame(undoTurn);
    speech.stop();
    notify("Cofnięto ostatnią kolejkę");
  };

  const toggleFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify("Pełny ekran niedostępny w tej przeglądarce");
    }
  };

  const onCheckout = score <= 180 && suggestCheckout(score, game.settings.outMode, 3);
  const needed = legsNeeded(game.settings);

  return (
    <div className={cn("space-y-3", flash === "bust" && "animate-shake", flash === "max" && "animate-pop")}>
      {/* Pasek górny */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onPause} aria-label="Pauza — wróć do menu">
          <Pause className="h-4 w-4" /> Menu
        </Button>
        <div className="ml-auto flex rounded-lg border border-line bg-surface p-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => store.setSettings((s) => ({ ...s, inputMode: m.value }))}
              aria-pressed={settings.inputMode === m.value}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold",
                settings.inputMode === m.value ? "bg-primary text-white" : "text-muted",
              )}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={toggleFs} aria-label="Pełny ekran">
          {isFs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label="Ustawienia">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Aktywny gracz */}
      <div
        className="relative overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3"
        style={{ boxShadow: `inset 6px 0 0 hsl(${player.color})` }}
      >
        <div className="flex items-center justify-between gap-3 pl-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
              Leg {leg.index + 1} · rzuca
            </div>
            <div className="truncate font-score text-4xl tracking-wide">{player.name}</div>
            <div className="text-xs text-muted">{describeSettings(game.settings)}</div>
          </div>
          <div className={cn("font-score text-[4.75rem] leading-[0.85]", onCheckout && "text-accent")}>{score}</div>
        </div>
      </div>

      <Scoreboard
        game={game}
        view={view}
        stats={stats}
        needed={needed}
        onRename={(id, name) => setRenaming({ id, name })}
        onDoubles={(id) => setPickDoubles(id)}
      />

      {/* Wprowadzanie — montowane od nowa przy każdej kolejce */}
      {!view.finished && (
        <div key={`${game.id}-${game.turns.length}`}>
          {settings.inputMode === "board" ? (
            <BoardInput scoreBefore={score} outMode={game.settings.outMode} onCommit={commit} prefs={player.doubles} confirmMode={settings.boardConfirm} />
          ) : settings.inputMode === "keypad" ? (
            <KeypadInput scoreBefore={score} outMode={game.settings.outMode} onCommit={commit} prefs={player.doubles} />
          ) : (
            <NumpadInput scoreBefore={score} outMode={game.settings.outMode} onCommit={commit} prefs={player.doubles} />
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pb-2">
        <Button size="sm" onClick={() => setConfirmUndo(true)} disabled={!lastTurn} className="min-w-0 flex-1">
          <Undo2 className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {lastTurn && lastPlayer
              ? `Cofnij kolejkę: ${lastPlayer.name} ${lastTurn.isBust ? "BUST" : lastTurn.scored}`
              : "Cofnij kolejkę"}
          </span>
        </Button>
      </div>

      <ConfirmDialog
        open={confirmUndo}
        title="Cofnąć ostatnią kolejkę?"
        message={
          lastTurn && lastPlayer ? (
            <>
              {lastPlayer.name}: {lastTurn.isBust ? "bust" : `${lastTurn.scored} pkt`}
              {lastTurn.darts?.length ? ` (${lastTurn.darts.map(displayLabel).join(", ")})` : ""}. Gracz wpisze ją
              jeszcze raz.
            </>
          ) : null
        }
        confirmLabel="Cofnij"
        onConfirm={doUndo}
        onCancel={() => setConfirmUndo(false)}
      />

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Zmień nazwę">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (renaming) store.updateGame((g) => renamePlayer(g, renaming.id, renaming.name));
            setRenaming(null);
          }}
        >
          <input
            autoFocus
            maxLength={20}
            value={renaming?.name ?? ""}
            onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))}
            className="h-12 w-full rounded-lg border border-line bg-surface2 px-3 text-lg outline-none focus:border-primary"
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={() => setRenaming(null)}>Anuluj</Button>
            <Button variant="accent" type="submit">Zapisz</Button>
          </div>
        </form>
      </Modal>

      <DoublesPicker
        open={!!pickPlayer}
        name={pickPlayer?.name ?? ""}
        value={pickPlayer?.doubles}
        onClose={() => setPickDoubles(null)}
        onSave={(d) => {
          if (!pickPlayer) return;
          store.updateGame((g) => setPlayerDoubles(g, pickPlayer.id, d));
          store.saveDoubles(pickPlayer.name, d);
        }}
      />

      <WinnerModal
        game={game}
        view={view}
        stats={stats}
        onRematch={() => store.startGame(rematch(game))}
        onNewGame={onNewGame}
        onUndo={doUndo}
      />
    </div>
  );
}

// ---------------------------------------------------------------- tabela wyników

function Scoreboard({
  game,
  view,
  stats,
  needed,
  onRename,
  onDoubles,
}: {
  game: Game;
  view: GameView;
  stats: Record<string, PlayerStats>;
  needed: number;
  onRename: (id: string, name: string) => void;
  onDoubles: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const leg = view.legs[view.currentLegIndex];
  const activeId = game.players[view.currentPlayerIndex]?.id;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {needed > 1 && (
        <div className="flex items-center justify-between border-b border-line bg-surface2 px-4 py-1.5 text-[11px] uppercase tracking-wider text-muted">
          <span>Gracz</span>
          <span>Legi (do {needed}) · Wynik</span>
        </div>
      )}
      <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto">
        {game.players.map((p) => {
          const isActive = p.id === activeId && !view.finished;
          const last = [...leg.turns].reverse().find((t) => t.playerId === p.id);
          const isOpen = open === p.id;
          const s = stats[p.id];
          return (
            <li key={p.id} className={cn(isActive && "bg-primary/10")}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : p.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-score text-xl"
                  style={{ background: `hsl(${p.color} / 0.18)`, color: `hsl(${p.color})` }}
                >
                  {p.name.trim()[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("truncate font-semibold", isActive && "text-primary")}>{p.name}</span>
                    {view.winnerId === p.id && <Trophy className="h-3.5 w-3.5 text-accent" />}
                    <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition", isOpen && "rotate-180")} />
                  </span>
                  <span className="block text-[11px] text-muted">
                    śr. {fmtNum(legAverage(view, p.id))}
                    {last && (
                      <>
                        {" · ost. "}
                        <span className={cn(last.isBust && "text-danger")}>{last.isBust ? "BUST" : last.scored}</span>
                      </>
                    )}
                  </span>
                </span>
                {needed > 1 && (
                  <span className="font-score text-2xl text-accent" aria-label="Wygrane legi">
                    {view.legWins[p.id]}
                  </span>
                )}
                <span className={cn("w-16 text-right font-score text-4xl leading-none", isActive ? "text-fg" : "text-fg/80")}>
                  {leg.scores[p.id]}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-line/60 bg-surface2/50 px-3 pb-3 pt-2">
                  <StatGrid s={s} />
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <button
                      onClick={() => onRename(p.id, p.name)}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
                    >
                      <Pencil className="h-3 w-3" /> Zmień nazwę
                    </button>
                    <button
                      onClick={() => onDoubles(p.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
                    >
                      <Target className="h-3 w-3" /> Ulubione double:{" "}
                      <b className={p.doubles?.length ? "text-accent" : ""}>{doublesText(p.doubles) || "brak"}</b>
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StatGrid({ s }: { s: PlayerStats }) {
  const cells: [string, string | number][] = [
    ["Średnia", fmtNum(s.avg)],
    ["Pierwsze 9", s.first9Darts ? fmtNum(s.first9Avg) : "—"],
    ["Najw. kolejka", s.highestTurn || "—"],
    ["Najw. checkout", s.highestCheckout || "—"],
    ["100+", s.c100],
    ["140+", s.c140],
    ["180", s.c180],
    ["Checkout %", s.checkoutPct === null ? "—" : `${Math.round(s.checkoutPct)}%`],
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {cells.map(([l, v]) => (
        <div key={l} className="rounded-md bg-surface px-1 py-1.5 text-center">
          <div className="font-mono text-sm font-bold">{v}</div>
          <div className="text-[9px] uppercase tracking-wide text-muted">{l}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- koniec meczu

function WinnerModal({
  game,
  view,
  stats,
  onRematch,
  onNewGame,
  onUndo,
}: {
  game: Game;
  view: GameView;
  stats: Record<string, PlayerStats>;
  onRematch: () => void;
  onNewGame: () => void;
  onUndo: () => void;
}) {
  const winner = game.players.find((p) => p.id === view.winnerId);

  useEffect(() => {
    if (!winner) return;
    const end = Date.now() + 1200;
    let raf = 0;
    const fire = () => {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.3 },
        colors: [`hsl(${winner.color})`, "#f97316", "#22a0aa"],
        disableForReducedMotion: true,
      });
      if (Date.now() < end) raf = requestAnimationFrame(fire);
    };
    fire();
    return () => cancelAnimationFrame(raf);
  }, [winner?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!winner) return null;
  const sorted = [...game.players].sort((a, b) => view.legWins[b.id] - view.legWins[a.id]);

  return (
    <Modal open onClose={() => {}} dismissable={false}>
      <div className="pt-4 text-center">
        <Trophy className="mx-auto h-12 w-12 text-accent" />
        <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted">Zwycięzca</div>
        <div className="font-score text-6xl" style={{ color: `hsl(${winner.color})` }}>
          {winner.name}
        </div>
        <div className="text-sm text-muted">
          {sorted.map((p) => `${p.name} ${view.legWins[p.id]}`).join(" · ")} · {pl(view.legs.length, "leg", "legi", "legów")}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {sorted.map((p) => (
          <div key={p.id} className="rounded-lg border border-line bg-surface2 p-2">
            <div className="mb-1.5 text-sm font-semibold">{p.name}</div>
            <StatGrid s={stats[p.id]} />
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="accent" onClick={onRematch}>
          <RotateCcw className="h-4 w-4" /> Rewanż
        </Button>
        <Button onClick={onNewGame}>Nowa gra</Button>
      </div>
      <button onClick={onUndo} className="mt-3 w-full text-center text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
        Pomyłka? Cofnij ostatnią kolejkę
      </button>
    </Modal>
  );
}
