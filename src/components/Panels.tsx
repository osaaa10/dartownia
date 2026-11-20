import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Play, Trash2, Trophy, Upload, Volume2 } from "lucide-react";
import { SOUND_EVENTS, sound, type SoundEvent } from "../lib/audio";
import { speech } from "../lib/speech";
import { describeSettings, replay } from "../engine/game";
import { careerStats, gameStats, type CareerStats, type StatsFilter } from "../engine/stats";
import type { Game } from "../engine/types";
import { sanitize, type AppStore } from "../lib/store";
import { cn, fmtDate, fmtNum, pl } from "../lib/util";
import { Dartboard } from "./Dartboard";
import { StatGrid } from "./GameScreen";
import { Button, ConfirmDialog, Modal, Row, Segmented, SectionLabel, Switch } from "./ui";

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
                    <Trophy className="h-4 w-4 shrink-0 text-accent" />
                    <span className="truncate">{winner?.name ?? "—"}</span>
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
      </div>
      {game.players.map((p) => (
        <div key={p.id} className="rounded-lg border border-line bg-surface2 p-2">
          <div className="mb-1.5 flex items-center justify-between text-sm font-semibold">
            <span>
              {p.name} {view.winnerId === p.id && "🏆"}
            </span>
            <span className="font-score text-xl text-accent">{view.legWins[p.id]}</span>
          </div>
          <StatGrid s={stats[p.id]} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- statystyki

type SortKey = "avg" | "wins" | "winPct" | "first9Avg" | "highestCheckout" | "c180" | "checkoutPct" | "bestLeg";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "avg", label: "Średnia" },
  { key: "wins", label: "Wygrane" },
  { key: "winPct", label: "% wygranych" },
  { key: "first9Avg", label: "Pierwsze 9" },
  { key: "highestCheckout", label: "Najw. checkout" },
  { key: "c180", label: "180" },
  { key: "checkoutPct", label: "Checkout %" },
  { key: "bestLeg", label: "Najlepszy leg" },
];

function sortVal(c: CareerStats, k: SortKey): number {
  if (k === "bestLeg") return c.bestLeg ? -c.bestLeg : -Infinity;
  if (k === "checkoutPct") return c.checkoutPct ?? -1;
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
                      <th className="px-2 text-right">CO%</th>
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
                        <td className="px-2 text-right">{c.checkoutPct === null ? "—" : `${Math.round(c.checkoutPct)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[11px] text-muted">Stuknij gracza, żeby zobaczyć szczegóły i heatmapę.</p>
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
        {pl(c.matches, "mecz", "mecze", "meczów")} · {pl(c.wins, "wygrana", "wygrane", "wygranych")} · legi {c.legsWon}/{c.legsPlayed} ·{" "}
        {pl(c.dartsThrown, "lotka", "lotki", "lotek")}
      </div>
      <StatGrid s={c} />
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

// ---------------------------------------------------------------- ustawienia

export function SettingsPanel({
  store,
  open,
  onClose,
  notify,
}: {
  store: AppStore;
  open: boolean;
  onClose: () => void;
  notify: (m: string, t?: "info" | "good" | "bad") => void;
}) {
  const s = store.data.settings;
  const set = store.setSettings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof sanitize> | null>(null);

  const doExport = () => {
    const blob = new Blob([JSON.stringify(store.data, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanciapa-dart-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Kopia zapisana w pobranych plikach", "good");
  };

  const onFile = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        setPendingImport(sanitize(JSON.parse(String(r.result))));
      } catch (e) {
        notify(`Nie udało się wczytać: ${(e as Error).message}`, "bad");
      }
    };
    r.readAsText(f);
  };

  return (
    <Modal open={open} onClose={onClose} side title="Ustawienia">
      <div className="space-y-5">
        <div>
          <SectionLabel>Wygląd</SectionLabel>
          <Segmented
            value={s.theme}
            onChange={(v) => set((x) => ({ ...x, theme: v }))}
            options={[
              { value: "dark", label: "Ciemny" },
              { value: "light", label: "Jasny" },
            ]}
          />
        </div>

        <div>
          <SectionLabel>Tarcza</SectionLabel>
          <Segmented
            value={s.boardConfirm}
            onChange={(v) => set((x) => ({ ...x, boardConfirm: v }))}
            options={[
              { value: "double", label: "Podwójne stuknięcie", desc: "Mniej pomyłek" },
              { value: "single", label: "Jedno stuknięcie", desc: "Szybciej" },
            ]}
          />
        </div>

        <AudioSettings store={store} open={open} />

        <div className="rounded-xl border border-line bg-surface2 px-4">
          <Row label="Nie wygaszaj ekranu" desc="W trakcie meczu">
            <Switch checked={s.keepAwake} onChange={(v) => set((x) => ({ ...x, keepAwake: v }))} label="Nie wygaszaj ekranu" />
          </Row>
        </div>

        <div>
          <SectionLabel>Dane</SectionLabel>
          <p className="mb-2 text-xs text-muted">
            Wszystko jest zapisane tylko na tym urządzeniu, w tej przeglądarce. Zrób kopię, żeby przenieść wyniki na inny
            telefon albo nie stracić ich po wyczyszczeniu przeglądarki.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={doExport}>
              <Download className="h-4 w-4" /> Zapisz kopię
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Wczytaj kopię
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="ghost" className="mt-2 w-full text-danger" onClick={() => setConfirmWipe(true)}>
            <Trash2 className="h-4 w-4" /> Usuń wszystkie dane
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted">
          Kanciapa Dart · działa offline · bez kont i bez reklam
        </p>
      </div>

      <ConfirmDialog
        open={!!pendingImport}
        title="Wczytać kopię?"
        message={
          pendingImport && (
            <>
              Kopia zawiera {pl(pendingImport.history.length, "mecz", "mecze", "meczów")}. Obecne dane na tym urządzeniu
              zostaną <b className="text-fg">zastąpione</b>.
            </>
          )
        }
        confirmLabel="Wczytaj"
        danger
        onConfirm={() => {
          if (pendingImport) store.replaceAll(pendingImport);
          setPendingImport(null);
          notify("Dane wczytane", "good");
        }}
        onCancel={() => setPendingImport(null)}
      />
      <ConfirmDialog
        open={confirmWipe}
        title="Usunąć wszystkie dane?"
        message="Zniknie trwający mecz, cała historia, statystyki i zapisani gracze. Tego nie da się cofnąć."
        confirmLabel="Usuń wszystko"
        danger
        onConfirm={() => {
          store.wipe();
          setConfirmWipe(false);
          notify("Dane usunięte");
        }}
        onCancel={() => setConfirmWipe(false)}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------- dźwięk i lektor

function Slider({ value, onChange, label, min = 0, max = 100 }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-32 accent-[rgb(var(--primary))]"
      aria-label={label}
    />
  );
}

function AudioSettings({ store, open }: { store: AppStore; open: boolean }) {
  const s = store.data.settings;
  const set = store.setSettings;
  const [found, setFound] = useState<Partial<Record<SoundEvent, boolean>>>({});
  const [pack, setPack] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!open) return;
    void sound.detect().then(() => setFound({ ...sound.found }));
    void speech.detectPack().then(setPack);
    const load = () => setVoices(speech.voices());
    load();
    if (speech.supported) window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      if (speech.supported) window.speechSynthesis.removeEventListener?.("voiceschanged", load);
    };
  }, [open]);

  const customCount = Object.values(found).filter(Boolean).length;
  const test = () =>
    void speech.announce({ kind: "turn", scored: 100, remaining: 121, player: "Kasia", nextName: "Tomek", nextScore: 301 }, true);

  return (
    <>
      <div>
        <SectionLabel>Dźwięki</SectionLabel>
        <div className="rounded-xl border border-line bg-surface2 px-4">
          <Row label="Dźwięki" desc="Sygnały przy rzutach">
            <Switch checked={s.sound} onChange={(v) => set((x) => ({ ...x, sound: v }))} label="Dźwięki" />
          </Row>
          <Row label="Głośność">
            <Slider value={Math.round(s.volume * 100)} onChange={(v) => set((x) => ({ ...x, volume: v / 100 }))} label="Głośność dźwięków" />
          </Row>
          <div className="py-3">
            <div className="mb-2 text-xs text-muted">
              {customCount > 0
                ? `Własne dźwięki z repozytorium: ${customCount} z ${SOUND_EVENTS.length}. Brakujące grają domyślnie.`
                : "Domyślne sygnały. Własne dźwięki wrzuca się do folderu public/sounds w repozytorium (instrukcja w README)."}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SOUND_EVENTS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => sound.play(e.id, true)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                    found[e.id] ? "border-accent/60 bg-accent/10 text-accent" : "border-line bg-surface text-muted",
                  )}
                  title={found[e.id] ? "Własny plik" : "Domyślny sygnał"}
                >
                  <Play className="h-3 w-3" /> {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Lektor</SectionLabel>
        <div className="rounded-xl border border-line bg-surface2 px-4">
          <Row label="Lektor" desc="Czyta wynik po każdej kolejce">
            <Switch checked={s.speech} onChange={(v) => set((x) => ({ ...x, speech: v }))} label="Lektor" />
          </Row>
          <Row label="Głośność lektora">
            <Slider value={Math.round(s.speechVolume * 100)} onChange={(v) => set((x) => ({ ...x, speechVolume: v / 100 }))} label="Głośność lektora" />
          </Row>
          {pack ? (
            <>
              <Row label="Nagrany lektor" desc="Znaleziony w repozytorium — wszyscy słyszą ten sam głos">
                <Switch checked={s.usePack} onChange={(v) => set((x) => ({ ...x, usePack: v }))} label="Nagrany lektor" />
              </Row>
              <Row label="Mów, ile zostało" desc="„Sto… zostaje sto dwadzieścia jeden” (do 180)">
                <Switch checked={s.callRemaining} onChange={(v) => set((x) => ({ ...x, callRemaining: v }))} label="Mów, ile zostało" />
              </Row>
            </>
          ) : (
            <p className="border-b border-line/60 py-3 text-xs text-muted">
              Brak nagranego lektora — mówi głos telefonu. Nagrania wrzuca się do folderu public/voice w repozytorium (instrukcja w README).
            </p>
          )}
          {(!pack || !s.usePack) && (
            <>
              <div className="border-b border-line/60 py-3">
                <div className="mb-1.5 text-sm font-medium">Głos telefonu</div>
                {voices.length === 0 ? (
                  <div className="text-xs text-muted">Ta przeglądarka nie ma głosów do czytania.</div>
                ) : (
                  <select
                    value={s.voiceURI ?? ""}
                    onChange={(e) => set((x) => ({ ...x, voiceURI: e.target.value || null }))}
                    className="h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm"
                    aria-label="Głos lektora"
                  >
                    <option value="">Automatycznie (najlepszy polski)</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                )}
                <div className="mt-1 text-[11px] text-muted">
                  Najładniej brzmią głosy z dopiskiem „Natural” lub „Online” (np. w Edge). Na Androidzie lepszy polski głos
                  można pobrać w Ustawienia → Zamiana tekstu na mowę.
                </div>
              </div>
              <Row label="Szybkość mowy">
                <Slider value={Math.round(s.speechRate * 100)} min={70} max={150} onChange={(v) => set((x) => ({ ...x, speechRate: v / 100 }))} label="Szybkość mowy" />
              </Row>
              <Row label="Zapowiadaj następnego" desc="„Teraz Tomek, 301”">
                <Switch checked={s.announceNext} onChange={(v) => set((x) => ({ ...x, announceNext: v }))} label="Zapowiadaj następnego" />
              </Row>
            </>
          )}
          <div className="py-3">
            <Button size="sm" onClick={test}>
              <Volume2 className="h-4 w-4" /> Posłuchaj lektora
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
