import { useMemo, useState } from "react";
import { Flag, Play, Trash2, Trophy } from "lucide-react";
import { describeSettings, replay, resumeEarly } from "../engine/game";
import { careerStats, gameStats, type CareerStats, type StatsFilter } from "../engine/stats";
import type { Game } from "../engine/types";
import type { AppStore } from "../lib/store";
import { cn, fmtDate, fmtNum, pl } from "../lib/util";
import { Dartboard } from "./Dartboard";
import { StatGrid } from "./GameScreen";
import { Button, ConfirmDialog, Modal, SectionLabel } from "./ui";

// ---------------------------------------------------------------- historia

export function HistoryPanel({ store, open, onClose }: { store: AppStore; open: boolean; onClose: () => void }) {
  const [detail, setDetail] = useState<Game | null>(null);
  const [toDelete, setToDelete] = useState<Game | null>(null);
  const history = store.data.history;

  return (
    <Modal open={open} onClose={onClose} side title="Historia meczów">
      {history.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Tu pojawią się zakończone mecze.
        </p>
      ) : (
        <ul className="space-y-2">
          {history.map((g) => {
            const v = replay(g);
            const winner = g.players.find((p) => p.id === v.winnerId);
            return (
              <li key={g.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface2 p-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(g)}>
                  <div className="flex items-center gap-1.5 font-semibold">
                    {g.endedEarly ? (
                      <>
                        <Flag className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate text-muted">Niedokończony</span>
                      </>
                    ) : (
                      <>
                        <Trophy className="h-4 w-4 shrink-0 text-accent" />
                        <span className="truncate">{winner?.name ?? "—"}</span>
                      </>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {g.players.map((p) => `${p.name} ${v.legWins[p.id]}`).join(" · ")}
                  </div>
                  <div className="text-[11px] text-muted">
                    {fmtDate(g.finishedAt ?? g.createdAt)} · {describeSettings(g.settings)}
                  </div>
                </button>
                <button
                  onClick={() => setToDelete(g)}
                  className="rounded-md p-2 text-muted hover:text-danger"
                  aria-label="Usuń mecz z historii"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Szczegóły meczu">
        {detail && <GameDetail game={detail} />}
        {detail?.endedEarly && (
          <div className="mt-3">
            {store.data.activeGame && !store.data.activeGame.finishedAt ? (
              <p className="text-xs text-muted">Żeby dokończyć ten mecz, najpierw zakończ albo porzuć obecny mecz.</p>
            ) : (
              <Button
                variant="accent"
                className="w-full"
                onClick={() => {
                  store.setGame(resumeEarly(detail));
                  setDetail(null);
                  onClose();
                }}
              >
                <Play className="h-4 w-4" /> Dokończ ten mecz
              </Button>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Usunąć mecz?"
        message="Mecz zniknie z historii i ze statystyk. Tego nie da się cofnąć (chyba że masz kopię zapasową)."
        confirmLabel="Usuń"
        danger
        onConfirm={() => {
          if (toDelete) store.deleteFromHistory(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </Modal>
  );
}

function GameDetail({ game }: { game: Game }) {
  const view = replay(game);
  const stats = gameStats(game, view);
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">
        {fmtDate(game.finishedAt ?? game.createdAt)} · {describeSettings(game.settings)} ·{" "}
        {pl(view.legs.length, "leg", "legi", "legów")}
        {game.endedEarly && " · zakończony przed czasem"}
      </div>
      {game.players.map((p) => (
        <div key={p.id} className="rounded-lg border border-line bg-surface2 p-2">
          <div className="mb-1.5 flex items-center justify-between text-sm font-semibold">
            <span>
              {p.name} {view.winnerId === p.id && "🏆"}
            </span>
            <span className="font-score text-xl text-accent">{view.legWins[p.id]}</span>
          </div>
          {game.endedEarly && (
            <div className="mb-1.5 text-xs text-muted">
              Zostało: <b className="font-mono text-fg">{view.legs[view.currentLegIndex].scores[p.id]}</b>
            </div>
          )}
          <StatGrid s={stats[p.id]} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- statystyki

type SortKey =
  | "avg" | "wins" | "winPct" | "first9Avg" | "highestCheckout" | "c180" | "checkoutPct" | "doublePct" | "bestLeg" | "dartsPerLeg" | "stuckOnFinish";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "avg", label: "Średnia" },
  { key: "wins", label: "Wygrane" },
  { key: "winPct", label: "% wygranych" },
  { key: "first9Avg", label: "Pierwsze 9" },
  { key: "highestCheckout", label: "Najw. checkout" },
  { key: "c180", label: "180" },
  { key: "checkoutPct", label: "Checkout %" },
  { key: "doublePct", label: "Double % (lotki)" },
  { key: "bestLeg", label: "Najlepszy leg" },
  { key: "dartsPerLeg", label: "Lotek na leg" },
  { key: "stuckOnFinish", label: "Utknięcia na double" },
];

function sortVal(c: CareerStats, k: SortKey): number {
  if (k === "bestLeg") return c.bestLeg ? -c.bestLeg : -Infinity;
  if (k === "dartsPerLeg") return c.dartsPerLeg ? -c.dartsPerLeg : -Infinity;
  if (k === "checkoutPct") return c.checkoutPct ?? -1;
  if (k === "doublePct") return c.doublePct ?? -1;
  return c[k];
}

export function StatsPanel({ store, open, onClose }: { store: AppStore; open: boolean; onClose: () => void }) {
  const [filter, setFilter] = useState<StatsFilter>({ startingScore: "all", outMode: "all" });
  const [sort, setSort] = useState<SortKey>("avg");
  const [selected, setSelected] = useState<string | null>(null);
  const all = useMemo(() => (open ? careerStats(store.data.history, filter) : []), [open, store.data.history, filter]);
  const rows = [...all].sort((a, b) => sortVal(b, sort) - sortVal(a, sort));
  const pick = (fn: (c: CareerStats) => number, min = false) => {
    const list = all.filter((c) => fn(c) > 0);
    if (!list.length) return null;
    return list.reduce((best, c) => ((min ? fn(c) < fn(best) : fn(c) > fn(best)) ? c : best));
  };
  const records = [
    { title: "Najwyższa średnia", c: pick((c) => c.avg), v: (c: CareerStats) => fmtNum(c.avg, 2) },
    { title: "Najwyższy checkout", c: pick((c) => c.highestCheckout), v: (c: CareerStats) => String(c.highestCheckout) },
    { title: "Najkrótszy leg", c: pick((c) => c.bestLeg, true), v: (c: CareerStats) => pl(c.bestLeg, "lotka", "lotki", "lotek") },
    { title: "Najwięcej 180", c: pick((c) => c.c180), v: (c: CareerStats) => String(c.c180) },
    { title: "Najlepszy na double", c: pick((c) => (c.dartsAtDouble >= 10 ? c.doublePct ?? 0 : 0)), v: (c: CareerStats) => `${Math.round(c.doublePct ?? 0)}%` },
    { title: "Najwięcej utknięć", c: pick((c) => c.stuckOnFinish), v: (c: CareerStats) => String(c.stuckOnFinish) },
  ];
  const sel = all.find((c) => c.key === selected) ?? null;

  return (
    <Modal open={open} onClose={onClose} side title="Statystyki">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={String(filter.startingScore)}
            onChange={(e) => setFilter({ ...filter, startingScore: e.target.value === "all" ? "all" : Number(e.target.value) })}
            className="h-10 rounded-lg border border-line bg-surface2 px-2 text-sm"
            aria-label="Tryb gry"
          >
            <option value="all">Wszystkie gry</option>
            <option value="301">301</option>
            <option value="501">501</option>
            <option value="701">701</option>
          </select>
          <select
            value={filter.outMode}
            onChange={(e) => setFilter({ ...filter, outMode: e.target.value as StatsFilter["outMode"] })}
            className="h-10 rounded-lg border border-line bg-surface2 px-2 text-sm"
            aria-label="Zakończenie"
          >
            <option value="all">Każde zakończenie</option>
            <option value="single">Single Out</option>
            <option value="double">Double Out</option>
            <option value="master">Master Out</option>
          </select>
        </div>

        {all.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Brak zakończonych meczów{filter.startingScore !== "all" || filter.outMode !== "all" ? " dla tych filtrów" : ""}.
          </p>
        ) : (
          <>
            <div>
              <SectionLabel>Rekordy</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {records.map((r) => (
                  <div key={r.title} className="rounded-lg border border-line bg-surface2 p-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted">{r.title}</div>
                    <div className="truncate text-sm font-semibold">{r.c ? r.c.name : "—"}</div>
                    <div className="font-score text-xl text-accent">{r.c ? r.v(r.c) : "—"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <SectionLabel>Ranking</SectionLabel>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-8 rounded-md border border-line bg-surface2 px-2 text-xs"
                  aria-label="Sortuj"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-surface2 text-[10px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-2 py-2 text-left">Gracz</th>
                      <th className="px-1 text-right">M</th>
                      <th className="px-1 text-right">W%</th>
                      <th className="px-1 text-right">Śr.</th>
                      <th className="px-1 text-right">180</th>
                      <th className="px-1 text-right">CO%</th>
                      <th className="px-2 text-right">D%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((c, i) => (
                      <tr
                        key={c.key}
                        onClick={() => setSelected(c.key === selected ? null : c.key)}
                        className={cn("cursor-pointer font-mono", c.key === selected && "bg-primary/10")}
                      >
                        <td className="px-2 py-2 font-sans">
                          <span className="mr-1.5 text-muted">{i + 1}.</span>
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: `hsl(${c.color})` }} />
                          {c.name}
                        </td>
                        <td className="px-1 text-right">{c.matches}</td>
                        <td className="px-1 text-right">{Math.round(c.winPct)}%</td>
                        <td className="px-1 text-right">{fmtNum(c.avg)}</td>
                        <td className="px-1 text-right">{c.c180}</td>
                        <td className="px-1 text-right">{c.checkoutPct === null ? "—" : `${Math.round(c.checkoutPct)}%`}</td>
                        <td className="px-2 text-right">{c.doublePct === null ? "—" : `${Math.round(c.doublePct)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                CO% — kolejki zakończone checkoutem, D% — lotki trafione na double. Stuknij gracza, żeby zobaczyć szczegóły.
              </p>
            </div>

            {sel && <PlayerDetail c={sel} />}
          </>
        )}
      </div>
    </Modal>
  );
}

function PlayerDetail({ c }: { c: CareerStats }) {
  const darts = Object.values(c.segmentHits).reduce((a, b) => a + b, 0);
  const top = Object.entries(c.segmentHits)
    .filter(([k]) => k !== "MISS")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const form = c.form.slice(-20);
  const maxAvg = Math.max(1, ...form.map((f) => f.avg));
  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-surface2/50 p-3">
      <div className="font-score text-2xl" style={{ color: `hsl(${c.color})` }}>
        {c.name}
      </div>
      <div className="text-xs text-muted">
        {pl(c.matches, "mecz", "mecze", "meczów")} · {pl(c.wins, "wygrana", "wygrane", "wygranych")}
        {c.unfinished > 0 && ` · ${pl(c.unfinished, "niedokończony", "niedokończone", "niedokończonych")}`} · legi {c.legsWon}/
        {c.legsPlayed} · {pl(c.dartsThrown, "lotka", "lotki", "lotek")}
      </div>
      <StatGrid s={c} />
      <FinishingStats s={c} />
      {form.length > 1 && (
        <div>
          <SectionLabel>Forma (średnia w ostatnich meczach)</SectionLabel>
          <div className="flex h-20 items-end gap-1">
            {form.map((f, i) => (
              <div
                key={i}
                title={`${fmtDate(f.at)} · ${fmtNum(f.avg)}`}
                className={cn("flex-1 rounded-t", f.won ? "bg-accent" : "bg-primary/60")}
                style={{ height: `${Math.max(6, (f.avg / maxAvg) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-1 text-[10px] text-muted">Pomarańczowe = wygrane mecze</div>
        </div>
      )}
      <div>
        <SectionLabel>Heatmapa trafień</SectionLabel>
        {darts === 0 ? (
          <p className="text-xs text-muted">Heatmapa pojawi się po grze na tarczy lub klawiaturze pól.</p>
        ) : (
          <>
            <div className="mx-auto max-w-[260px]">
              <Dartboard heat={c.segmentHits} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {top.map(([k, v]) => (
                <span key={k} className="rounded-md bg-surface3 px-2 py-0.5 font-mono text-xs">
                  {k.startsWith("S") ? k.slice(1) : k} ×{v}
                </span>
              ))}
              {c.segmentHits.MISS ? (
                <span className="rounded-md bg-warn/15 px-2 py-0.5 font-mono text-xs text-warn">pudła ×{c.segmentHits.MISS}</span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function topEntries(r: Record<string, number>, n: number) {
  return Object.entries(r)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function FinishingStats({ s }: { s: CareerStats }) {
  const finishes = topEntries(s.finishes, 5);
  const stuck = topEntries(s.stuckScores, 5);
  const cells: [string, string][] = [
    ["Lotki na double (trafione)", s.dartsAtDouble ? `${s.doubleHits}/${s.dartsAtDouble}` : "—"],
    ["Kolejek na zamknięcie", s.visitsPerCheckout === null ? "—" : fmtNum(s.visitsPerCheckout, 1)],
    ["Checkouty 100+", String(s.checkouts100)],
    ["Niedokończone mecze", String(s.unfinished)],
    ["Przerwane legi", String(s.legsUnfinished)],
    ["Utknięcia na double", String(s.stuckOnFinish)],
  ];
  return (
    <div>
      <SectionLabel>Zakończenia</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5">
        {cells.map(([l, v]) => (
          <div key={l} className="rounded-md bg-surface px-1 py-1.5 text-center">
            <div className="font-mono text-sm font-bold">{v}</div>
            <div className="text-[9px] uppercase leading-tight tracking-wide text-muted">{l}</div>
          </div>
        ))}
      </div>
      {finishes.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Zamyka na:</span>
          {finishes.map(([k, v]) => (
            <span key={k} className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-accent">
              {k} ×{v}
            </span>
          ))}
        </div>
      )}
      {stuck.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Utyka na:</span>
          {stuck.map(([k, v]) => (
            <span key={k} className="rounded-md bg-warn/15 px-2 py-0.5 font-mono text-warn">
              {k} ×{v}
            </span>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-muted">
        Lotki na double liczą się dokładnie przy wpisywaniu z tarczy lub pól; przy wpisywaniu sum — tylko gdy zostało do zamknięcia
        jedną lotką.
      </p>
    </div>
  );
}
