import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Crown, Play, Plus, Shuffle, Target, Trash2, X } from "lucide-react";
import { DoublesPicker } from "./DoublesPicker";
import { PLAYER_COLORS, createGame, describeSettings, replay, uid } from "../engine/game";
import { normName } from "../engine/stats";
import { MAX_PLAYERS, type Game, type MatchSettings, type OutMode, type Player } from "../engine/types";
import type { AppStore } from "../lib/store";
import { cn, pl } from "../lib/util";
import { Button, ConfirmDialog, Row, Segmented, SectionLabel, Switch } from "./ui";

function nextColor(used: Player[]): string {
  const taken = new Set(used.map((p) => p.color));
  return PLAYER_COLORS.find((c) => !taken.has(c)) ?? PLAYER_COLORS[used.length % PLAYER_COLORS.length];
}

// ---------------------------------------------------------------- kontynuacja

export function ContinueCard({ game, onContinue, onDiscard }: { game: Game; onContinue: () => void; onDiscard: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const view = replay(game);
  const legs = game.players.map((p) => view.legWins[p.id]).join(":");
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Przerwany mecz</div>
      <div className="mt-1 font-semibold">{game.players.map((p) => p.name).join(" vs ")}</div>
      <div className="text-sm text-muted">
        {describeSettings(game.settings)} · leg {view.currentLegIndex + 1} · legi {legs} ·{" "}
        {pl(game.turns.length, "kolejka", "kolejki", "kolejek")}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button variant="accent" className="col-span-2" onClick={onContinue}>
          <Play className="h-4 w-4" /> Kontynuuj
        </Button>
        <Button onClick={() => setConfirm(true)}>
          <X className="h-4 w-4" /> Porzuć
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Porzucić mecz?"
        message="Niedokończony mecz zostanie usunięty i nie trafi do statystyk."
        confirmLabel="Porzuć"
        danger
        onConfirm={() => {
          setConfirm(false);
          onDiscard();
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- gracze

export function PlayerSetup({
  store,
  players,
  setPlayers,
  onNext,
}: {
  store: AppStore;
  players: Player[];
  setPlayers: (p: Player[]) => void;
  onNext: () => void;
}) {
  const saved = store.data.savedPlayers;
  const used = new Set(players.map((p) => normName(p.name)));
  const available = saved.filter((s) => !used.has(normName(s.name)));
  const names = players.map((p) => normName(p.name));
  const dupes = names.filter((n, i) => n && names.indexOf(n) !== i);
  const empty = players.some((p) => !p.name.trim());

  const [picking, setPicking] = useState<string | null>(null);
  const picked = players.find((p) => p.id === picking);

  const add = (name = "", color?: string, doubles?: number[]) => {
    const emptyIdx = name ? players.findIndex((p) => !p.name.trim()) : -1;
    if (emptyIdx >= 0) {
      setPlayers(players.map((p, i) => (i === emptyIdx ? { ...p, name, color: color ?? p.color, doubles } : p)));
      return;
    }
    if (players.length >= MAX_PLAYERS) return;
    setPlayers([...players, { id: uid(), name, color: color ?? nextColor(players), doubles }]);
  };
  /** Ulubione double: ustawione przy graczu albo zapamiętane pod tą nazwą. */
  const doublesOf = (p: Player) =>
    p.doubles ?? saved.find((s) => normName(s.name) === normName(p.name))?.doubles;
  const update = (id: string, name: string) => setPlayers(players.map((p) => (p.id === id ? { ...p, name } : p)));
  const remove = (id: string) => setPlayers(players.filter((p) => p.id !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= players.length) return;
    const next = [...players];
    [next[i], next[j]] = [next[j], next[i]];
    setPlayers(next);
  };
  const shuffle = () => {
    const next = [...players];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setPlayers(next);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-score text-3xl tracking-wide">Gracze</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={shuffle} disabled={players.length < 2}>
            <Shuffle className="h-4 w-4" /> Losuj kolejność
          </Button>
          <span className="font-mono text-sm text-muted">
            {players.length}/{MAX_PLAYERS}
          </span>
        </div>
      </div>

      <ul className="space-y-2">
        {players.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-score text-xl"
              style={{ background: `hsl(${p.color} / 0.18)`, color: `hsl(${p.color})` }}
            >
              {p.name.trim()[0]?.toUpperCase() ?? i + 1}
            </span>
            <input
              value={p.name}
              onChange={(e) => update(p.id, e.target.value)}
              onBlur={() => update(p.id, p.name.trim().replace(/\s+/g, " "))}
              placeholder={`Gracz ${i + 1}`}
              maxLength={20}
              aria-label={`Nazwa gracza ${i + 1}`}
              className="h-10 min-w-0 flex-1 rounded-md bg-transparent px-2 text-base outline-none focus:bg-surface2"
            />
            <button
              type="button"
              onClick={() => setPicking(p.id)}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 font-mono text-[11px] font-bold",
                doublesOf(p)?.length ? "border-accent/50 text-accent" : "border-line text-muted",
              )}
              aria-label={`Ulubione double — ${p.name || `gracz ${i + 1}`}`}
              title="Ulubione double"
            >
              <Target className="h-3.5 w-3.5" />
              {doublesOf(p)?.length ? doublesOf(p)!.map((d) => (d === 25 ? "B" : d)).join("·") : "D?"}
            </button>
            {i === 0 ? (
              <span className="flex items-center gap-1 rounded-md bg-accent/15 px-2 py-1 text-[10px] font-bold uppercase text-accent" title="Zaczyna">
                <Crown className="h-3 w-3" />
              </span>
            ) : null}
            <div className="flex">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-muted disabled:opacity-20" aria-label="W górę">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === players.length - 1}
                className="rounded p-1.5 text-muted disabled:opacity-20"
                aria-label="W dół"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(p.id)}
                disabled={players.length <= 1}
                className="rounded p-1.5 text-muted hover:text-danger disabled:opacity-20"
                aria-label={`Usuń ${p.name || "gracza"}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {available.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-3">
          <SectionLabel>Szybko dodaj</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {available.slice(0, 16).map((s) => (
              <button
                key={s.name}
                onClick={() => add(s.name, s.color, s.doubles)}
                disabled={players.length >= MAX_PLAYERS && !players.some((p) => !p.name.trim())}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-3 py-1 text-sm"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${s.color})` }} />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button className="w-full border-dashed" onClick={() => add()} disabled={players.length >= MAX_PLAYERS}>
        <Plus className="h-4 w-4" /> Dodaj gracza
      </Button>

      <DoublesPicker
        open={!!picked}
        name={picked?.name.trim() ?? ""}
        value={picked ? doublesOf(picked) : undefined}
        onClose={() => setPicking(null)}
        onSave={(d) => {
          if (!picked) return;
          setPlayers(players.map((p) => (p.id === picked.id ? { ...p, doubles: d } : p)));
          if (picked.name.trim()) store.saveDoubles(picked.name, d);
        }}
      />
      <p className="text-[11px] text-muted">
        <Target className="mr-1 inline h-3 w-3" />
        — ulubione double gracza. Podpowiedzi zakończeń prowadzą na nie.
      </p>

      {empty && <p className="text-sm text-warn">Wpisz imię każdego gracza.</p>}
      {dupes.length > 0 && <p className="text-sm text-warn">Dwóch graczy ma to samo imię — statystyki by się pomieszały.</p>}

      <Button variant="primary" size="lg" className="w-full" disabled={empty || dupes.length > 0} onClick={onNext}>
        Dalej — ustawienia meczu <ArrowRight className="h-5 w-5" />
      </Button>
    </section>
  );
}

// ---------------------------------------------------------------- ustawienia meczu

const OUTS: { value: OutMode; label: string; desc: string }[] = [
  { value: "single", label: "Single Out", desc: "Każde pole kończy" },
  { value: "double", label: "Double Out", desc: "Kończy double lub bull" },
  { value: "master", label: "Master Out", desc: "Double, treble lub bull" },
];

export function MatchSetup({
  settings,
  onChange,
  onBack,
  onStart,
}: {
  settings: MatchSettings;
  onChange: (s: MatchSettings) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const set = (patch: Partial<MatchSettings>) => onChange({ ...settings, ...patch });
  const preset = [301, 501, 701].includes(settings.startingScore) ? settings.startingScore : "custom";
  const [custom, setCustom] = useState(String(settings.startingScore));

  const setLegs = (n: number) => {
    let v = Math.min(21, Math.max(1, n));
    if (settings.format === "bestOf" && v % 2 === 0) v = v + (n > settings.legsTarget ? 1 : -1);
    set({ legsTarget: Math.min(21, Math.max(1, v)) });
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-score text-3xl tracking-wide">Ustawienia meczu</h2>
        <Button size="sm" variant="ghost" onClick={onBack}>
          ← Gracze
        </Button>
      </div>

      <div>
        <SectionLabel>Punkty na start</SectionLabel>
        <Segmented
          value={preset as number | "custom"}
          onChange={(v) => {
            if (v === "custom") set({ startingScore: Math.max(2, Number(custom) || 1001) });
            else set({ startingScore: v as number });
          }}
          options={[
            { value: 301, label: <span className="font-score text-2xl">301</span> },
            { value: 501, label: <span className="font-score text-2xl">501</span> },
            { value: 701, label: <span className="font-score text-2xl">701</span> },
            { value: "custom", label: <span className="font-score text-2xl">Inne</span> },
          ]}
        />
        {preset === "custom" && (
          <input
            type="number"
            inputMode="numeric"
            min={2}
            max={9999}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Number(e.target.value);
              if (n >= 2 && n <= 9999) set({ startingScore: Math.round(n) });
            }}
            className="mt-2 h-12 w-full rounded-lg border border-line bg-surface px-4 text-center font-score text-3xl outline-none focus:border-primary"
          />
        )}
      </div>

      <div>
        <SectionLabel>Zakończenie</SectionLabel>
        <Segmented value={settings.outMode} onChange={(v) => set({ outMode: v })} options={OUTS} />
      </div>

      <div>
        <SectionLabel>Format</SectionLabel>
        <Segmented
          value={settings.format}
          onChange={(v) => {
            const lt = v === "bestOf" && settings.legsTarget % 2 === 0 ? settings.legsTarget + 1 : settings.legsTarget;
            set({ format: v, legsTarget: lt });
          }}
          options={[
            { value: "single", label: "Jeden leg", desc: "Szybka gra" },
            { value: "firstTo", label: "Do X legów", desc: "Kto pierwszy wygra X" },
            { value: "bestOf", label: "Best of X", desc: "Najlepszy z X" },
          ]}
        />
        {settings.format !== "single" && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
            <span className="flex-1 text-sm">
              {settings.format === "firstTo" ? "Wygrane legi potrzebne" : "Liczba legów"}
            </span>
            <button onClick={() => setLegs(settings.legsTarget - (settings.format === "bestOf" ? 2 : 1))} className="h-10 w-10 rounded-lg border border-line bg-surface2 text-xl" aria-label="Mniej">
              −
            </button>
            <span className="w-10 text-center font-score text-3xl">{settings.legsTarget}</span>
            <button onClick={() => setLegs(settings.legsTarget + (settings.format === "bestOf" ? 2 : 1))} className="h-10 w-10 rounded-lg border border-line bg-surface2 text-xl" aria-label="Więcej">
              +
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface px-4">
        <Row label="Zmieniaj zaczynającego" desc="Każdy kolejny leg zaczyna następny gracz">
          <Switch checked={settings.rotateStarter} onChange={(v) => set({ rotateStarter: v })} label="Zmieniaj zaczynającego" />
        </Row>
      </div>

      <Button variant="accent" size="lg" className={cn("w-full")} onClick={onStart}>
        <Play className="h-5 w-5" /> Rozpocznij grę
      </Button>
    </section>
  );
}

export function startNewGame(store: AppStore, players: Player[], settings: MatchSettings) {
  const clean = players.map((p) => ({ ...p, name: p.name.trim().replace(/\s+/g, " ") }));
  store.startGame(createGame(clean, settings));
}
