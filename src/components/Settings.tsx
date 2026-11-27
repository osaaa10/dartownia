import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ALargeSmall,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Megaphone,
  Mic,
  MicOff,
  Play,
  Sun,
  SunDim,
  Target,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { SOUND_EVENTS, sound, type SoundEvent } from "../lib/audio";
import {
  DART_NAMINGS,
  DEFAULT_VOICE_STYLES,
  VOICE_RANGES,
  VOICE_STYLES,
  speech,
  type BullName,
  type DartNaming,
  type RangeKey,
  type VoiceStyle,
} from "../lib/speech";
import { sanitize, type AppStore } from "../lib/store";
import { cn, pl } from "../lib/util";
import { SizeControls } from "./SizeSettings";
import { Button, ConfirmDialog, Modal, Row, Segmented, SectionLabel, Switch } from "./ui";

type Notify = (m: string, t?: "info" | "good" | "bad") => void;
type PageId = "game" | "look" | "sound" | "voice" | "calls" | "data";

const PAGES: Record<PageId, { title: string; icon: typeof Target }> = {
  game: { title: "Rozgrywka", icon: Target },
  look: { title: "Wygląd i rozmiar", icon: ALargeSmall },
  sound: { title: "Dźwięki", icon: Volume2 },
  voice: { title: "Lektor", icon: Mic },
  calls: { title: "Co mówi lektor", icon: Megaphone },
  data: { title: "Dane i kopia", icon: Database },
};

const INPUT_LABEL = { board: "Tarcza", keypad: "Pola", numpad: "Suma" } as const;

// ---------------------------------------------------------------- panel

export function SettingsPanel({
  store,
  open,
  onClose,
  notify,
}: {
  store: AppStore;
  open: boolean;
  onClose: () => void;
  notify: Notify;
}) {
  const [page, setPage] = useState<PageId | null>(null);
  const audio = useAudioInfo(open);

  // Po zamknięciu wracamy do listy kategorii.
  useEffect(() => {
    if (!open) setPage(null);
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} side title={page ? PAGES[page].title : "Ustawienia"}>
      {page ? (
        <div className="space-y-5">
          <button
            type="button"
            data-back
            onClick={() => setPage(null)}
            className="-ml-2 -mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-surface2"
          >
            <ChevronLeft className="h-4 w-4" /> Ustawienia
          </button>
          {page === "game" && <GamePage store={store} />}
          {page === "look" && <LookPage store={store} />}
          {page === "sound" && <SoundPage store={store} audio={audio} />}
          {page === "voice" && <VoicePage store={store} audio={audio} />}
          {page === "calls" && <CallsPage store={store} />}
          {page === "data" && <DataPage store={store} notify={notify} />}
        </div>
      ) : (
        <Hub store={store} audio={audio} onOpen={setPage} />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- lista kategorii

function Hub({ store, audio, onOpen }: { store: AppStore; audio: AudioInfo; onOpen: (p: PageId) => void }) {
  const s = store.data.settings;
  const set = store.setSettings;
  const calls = [s.callRemaining, s.callBust, s.callWin, s.announceNext, s.callToGo, s.callCheckout].filter(Boolean).length;
  const naming = DART_NAMINGS.find((d) => d.id === s.dartNaming)?.label ?? "";
  const games = store.data.history.length;

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Szybko</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <QuickTile
            on={s.sound}
            onClick={() => set((x) => ({ ...x, sound: !x.sound }))}
            icon={s.sound ? Volume2 : VolumeX}
            label="Dźwięki"
          />
          <QuickTile
            on={s.speech}
            onClick={() => set((x) => ({ ...x, speech: !x.speech }))}
            icon={s.speech ? Mic : MicOff}
            label="Lektor"
          />
          <QuickTile
            on={s.keepAwake}
            onClick={() => set((x) => ({ ...x, keepAwake: !x.keepAwake }))}
            icon={s.keepAwake ? Sun : SunDim}
            label="Ekran"
            state={s.keepAwake ? "Nie gaśnie" : "Może gasnąć"}
          />
        </div>
      </div>

      <Group title="Mecz">
        <HubItem
          page="game"
          onOpen={onOpen}
          summary={`Domyślnie: ${INPUT_LABEL[s.inputMode]} · tarcza: ${s.boardConfirm === "double" ? "2 stuknięcia" : "1 stuknięcie"}`}
        />
        <HubItem
          page="look"
          onOpen={onOpen}
          summary={`${s.theme === "dark" ? "Ciemny" : "Jasny"} · interfejs ${Math.round((s.uiScale || 1) * 100)}%`}
        />
      </Group>

      <Group title="Dźwięk i lektor">
        <HubItem
          page="sound"
          onOpen={onOpen}
          summary={s.sound ? `Włączone · głośność ${Math.round(s.volume * 100)}%` : "Wyłączone"}
          dim={!s.sound}
        />
        <HubItem
          page="voice"
          onOpen={onOpen}
          summary={
            !s.speech ? "Wyłączony" : audio.pack && s.usePack ? "Nagrany lektor · styl wg wyniku" : "Głos telefonu"
          }
          dim={!s.speech}
        />
        <HubItem
          page="calls"
          onOpen={onOpen}
          summary={`${calls} z 6 włączonych · lotki: ${naming}`}
          dim={!s.speech}
        />
      </Group>

      <Group title="Dane">
        <HubItem
          page="data"
          onOpen={onOpen}
          summary={`${pl(games, "mecz", "mecze", "meczów")} na tym telefonie · kopia zapasowa`}
        />
      </Group>

      <p className="text-center text-[11px] text-muted">Kanciapa Dart · działa offline · bez kont i bez reklam</p>
    </div>
  );
}

function QuickTile({
  on,
  onClick,
  icon: Icon,
  label,
  state,
}: {
  on: boolean;
  onClick: () => void;
  icon: typeof Target;
  label: string;
  state?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition active:scale-95",
        on ? "border-primary bg-primary/15 text-fg" : "border-line bg-surface2 text-muted",
      )}
    >
      <Icon className={cn("h-6 w-6", on && "text-primary")} />
      <span className="text-xs font-semibold leading-tight">{label}</span>
      <span className="text-[10px] uppercase tracking-wider">{state ?? (on ? "Wł." : "Wył.")}</span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="divide-y divide-line/60 overflow-hidden rounded-xl border border-line bg-surface2">{children}</div>
    </div>
  );
}

function HubItem({ page, onOpen, summary, dim }: { page: PageId; onOpen: (p: PageId) => void; summary: string; dim?: boolean }) {
  const { title, icon: Icon } = PAGES[page];
  return (
    <button
      type="button"
      onClick={() => onOpen(page)}
      data-page={page}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface active:bg-surface"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className={cn("block truncate text-xs", dim ? "text-muted/70" : "text-muted")}>{summary}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
    </button>
  );
}

// ---------------------------------------------------------------- strony

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line bg-surface2 px-4">{children}</div>;
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[11px] text-muted">{children}</p>;
}

function GamePage({ store }: { store: AppStore }) {
  const s = store.data.settings;
  const set = store.setSettings;
  return (
    <>
      <div>
        <SectionLabel>Jak wpisywać wyniki</SectionLabel>
        <Segmented
          value={s.inputMode}
          onChange={(v) => set((x) => ({ ...x, inputMode: v }))}
          options={[
            { value: "board", label: "Tarcza", desc: "Stukasz w pola" },
            { value: "keypad", label: "Pola", desc: "Przyciski T/D" },
            { value: "numpad", label: "Suma", desc: "Wynik kolejki" },
          ]}
        />
        <Hint>Tryb zmienisz też w trakcie meczu, na górnym pasku.</Hint>
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

      <Card>
        <Row label="Szybki wynik od razu zatwierdza" desc="W trybie Suma: stuknięcie np. 60 zapisuje kolejkę bez „Zatwierdź”">
          <Switch checked={s.quickSubmit} onChange={(v) => set((x) => ({ ...x, quickSubmit: v }))} label="Szybki wynik od razu zatwierdza" />
        </Row>
        <Row label="Ekran nie gaśnie" desc="W trakcie meczu telefon się nie wygasza">
          <Switch checked={s.keepAwake} onChange={(v) => set((x) => ({ ...x, keepAwake: v }))} label="Ekran nie gaśnie" />
        </Row>
      </Card>
    </>
  );
}

function LookPage({ store }: { store: AppStore }) {
  const s = store.data.settings;
  return (
    <>
      <div>
        <SectionLabel>Motyw</SectionLabel>
        <Segmented
          value={s.theme}
          onChange={(v) => store.setSettings((x) => ({ ...x, theme: v }))}
          options={[
            { value: "dark", label: "Ciemny", desc: "Do baru i wieczorem" },
            { value: "light", label: "Jasny", desc: "W słońcu" },
          ]}
        />
      </div>
      <SizeControls store={store} hideQuickSubmit />
    </>
  );
}

function SoundPage({ store, audio }: { store: AppStore; audio: AudioInfo }) {
  const s = store.data.settings;
  const set = store.setSettings;
  const customCount = Object.values(audio.found).filter(Boolean).length;
  return (
    <>
      <Card>
        <Row label="Dźwięki" desc="Efekty przy rzutach, 180 i wygranych">
          <Switch checked={s.sound} onChange={(v) => set((x) => ({ ...x, sound: v }))} label="Dźwięki" />
        </Row>
        <Row label="Głośność">
          <Slider value={Math.round(s.volume * 100)} onChange={(v) => set((x) => ({ ...x, volume: v / 100 }))} label="Głośność dźwięków" />
        </Row>
      </Card>

      <div className={cn(!s.sound && "opacity-60")}>
        <SectionLabel>Posłuchaj</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {SOUND_EVENTS.map((e) => (
            <button
              key={e.id}
              onClick={() => sound.play(e.id, true)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs",
                audio.found[e.id] ? "border-accent/60 bg-accent/10 text-accent" : "border-line bg-surface2 text-muted",
              )}
              title={audio.found[e.id] ? "Nagrany dźwięk" : "Krótki sygnał"}
            >
              <Play className="h-3 w-3" /> {e.label}
              {(audio.variants[e.id] ?? 0) > 1 && <span className="font-mono text-[10px]">×{audio.variants[e.id]}</span>}
            </button>
          ))}
        </div>
        <Hint>
          Pomarańczowe to nagrane dźwięki ({customCount} z {SOUND_EVENTS.length}), reszta to krótkie sygnały. Nowe dźwięki dodaje się do
          folderu public/sounds w repozytorium.
        </Hint>
      </div>

      <div className={cn(!s.sound && "opacity-60")}>
        <SectionLabel>Niespodzianka</SectionLabel>
        <p className="mb-2 text-xs text-muted">
          Co któraś zwykła kolejka zagra coś śmiesznego zamiast wyniku lub po nim. 180, busty i końcówki zawsze normalnie.
        </p>
        <Segmented
          value={s.surpriseChance}
          onChange={(v) => set((x) => ({ ...x, surpriseChance: v }))}
          cols={4}
          options={[
            { value: 0, label: "Wył." },
            { value: 1 / 3, label: "1 z 3" },
            { value: 0.2, label: "1 z 5" },
            { value: 0.1, label: "1 z 10" },
          ]}
        />
        {s.surpriseChance > 0 && (
          <div className="mt-2">
            <Segmented
              value={s.surpriseMode}
              onChange={(v) => set((x) => ({ ...x, surpriseMode: v }))}
              options={[
                { value: "instead", label: "Zamiast wyniku", desc: "Lektor milczy" },
                { value: "after", label: "Po wyniku", desc: "Najpierw wynik" },
              ]}
            />
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={() => void sound.playSurprise(true)}>
            <Play className="h-3.5 w-3.5" /> Posłuchaj
          </Button>
          <span className="text-[11px] text-muted">
            {audio.surprises > 0 ? `Nagranych niespodzianek: ${audio.surprises}` : "Wbudowane: boing, trąbka, laser"}
          </span>
        </div>
      </div>
    </>
  );
}

function VoicePage({ store, audio }: { store: AppStore; audio: AudioInfo }) {
  const s = store.data.settings;
  const set = store.setSettings;
  const recorded = audio.pack && s.usePack;
  return (
    <>
      <Card>
        <Row label="Lektor" desc="Czyta wynik po każdej kolejce">
          <Switch checked={s.speech} onChange={(v) => set((x) => ({ ...x, speech: v }))} label="Lektor" />
        </Row>
        <Row label="Głośność lektora">
          <Slider value={Math.round(s.speechVolume * 100)} onChange={(v) => set((x) => ({ ...x, speechVolume: v / 100 }))} label="Głośność lektora" />
        </Row>
      </Card>

      <div className={cn(!s.speech && "opacity-60")}>
        <SectionLabel>Głos</SectionLabel>
        {audio.pack ? (
          <Segmented
            value={s.usePack ? "pack" : "phone"}
            onChange={(v) => set((x) => ({ ...x, usePack: v === "pack" }))}
            options={[
              { value: "pack", label: "Nagrany lektor", desc: "Ten sam u wszystkich" },
              { value: "phone", label: "Głos telefonu", desc: "Syntezator" },
            ]}
          />
        ) : (
          <p className="text-xs text-muted">Brak nagranego lektora, więc mówi głos telefonu.</p>
        )}
      </div>

      {recorded ? (
        <div className={cn(!s.speech && "opacity-60")}>
          <VoiceStylePicker store={store} available={audio.avail} />
        </div>
      ) : (
        <div className={cn("space-y-3", !s.speech && "opacity-60")}>
          <div>
            <SectionLabel>Głos telefonu</SectionLabel>
            {audio.voices.length === 0 ? (
              <div className="text-xs text-muted">Ta przeglądarka nie ma głosów do czytania.</div>
            ) : (
              <select
                value={s.voiceURI ?? ""}
                onChange={(e) => set((x) => ({ ...x, voiceURI: e.target.value || null }))}
                className="h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm"
                aria-label="Głos lektora"
              >
                <option value="">Automatycznie (najlepszy polski)</option>
                {audio.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            )}
            <Hint>
              Najładniej brzmią głosy „Natural” lub „Online” (np. w Edge). Na Androidzie lepszy polski głos pobierzesz w Ustawienia →
              Zamiana tekstu na mowę.
            </Hint>
          </div>
          <Card>
            <Row label="Szybkość mowy">
              <Slider value={Math.round(s.speechRate * 100)} min={70} max={150} onChange={(v) => set((x) => ({ ...x, speechRate: v / 100 }))} label="Szybkość mowy" />
            </Row>
          </Card>
        </div>
      )}

      <ListenButton />
    </>
  );
}

function CallsPage({ store }: { store: AppStore }) {
  const s = store.data.settings;
  const set = store.setSettings;
  const toggle = (label: string, desc: string, key: "callRemaining" | "callBust" | "callWin" | "announceNext" | "callToGo" | "callCheckout") => (
    <Row label={label} desc={desc}>
      <Switch checked={s[key]} onChange={(v) => set((x) => ({ ...x, [key]: v }))} label={label} />
    </Row>
  );
  return (
    <>
      {!s.speech && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          Lektor jest wyłączony. Włącz go na górze ustawień albo w zakładce Lektor.
        </p>
      )}

      <div>
        <SectionLabel>Po rzucie</SectionLabel>
        <Card>
          {toggle("Ile zostało", "„Sześćdziesiąt… zostaje sto dwadzieścia jeden”", "callRemaining")}
          {toggle("Bust", "„Bast” po przebiciu", "callBust")}
          {toggle("Wygrana", "„Game shot” po legu, „Game shot i mecz” na koniec", "callWin")}
        </Card>
      </div>

      <div>
        <SectionLabel>Zapowiedź następnego gracza</SectionLabel>
        <Card>
          {toggle("Kto teraz rzuca", "„Teraz Pitek”, z nagranym nickiem", "announceNext")}
          {toggle("Ile do końca", "„Do końca sto trzydzieści” (do 180)", "callToGo")}
          {toggle("Podpowiedź zakończenia", "„Zakończenie: te dwadzieścia, de pięć”", "callCheckout")}
        </Card>
      </div>

      {s.callCheckout && (
        <div>
          <SectionLabel>Jak czytać lotki</SectionLabel>
          <Segmented
            value={s.dartNaming}
            onChange={(v) => set((x) => ({ ...x, dartNaming: v as DartNaming }))}
            options={DART_NAMINGS.map((d) => ({ value: d.id, label: d.label.split(" / ")[0], desc: `T20 = ${d.label.split(" / ")[0]} 20` }))}
          />
          <div className="mt-2">
            <Segmented
              value={s.bullName}
              onChange={(v) => set((x) => ({ ...x, bullName: v as BullName }))}
              options={[
                { value: "bull", label: "Bull" },
                { value: "bullseye", label: "Bullseye" },
              ]}
            />
          </div>
          <Hint>Zakończenie uwzględnia ulubione double gracza (ustawiasz je przy graczu).</Hint>
        </div>
      )}

      <ListenButton />
    </>
  );
}

function DataPage({ store, notify }: { store: AppStore; notify: Notify }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof sanitize> | null>(null);
  const games = store.data.history.length;
  const players = store.data.savedPlayers.length;

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
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-line bg-surface2 p-3 text-center">
          <div className="font-score text-3xl">{games}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted">{pl(games, "mecz", "mecze", "meczów").replace(/^\d+\s/, "")}</div>
        </div>
        <div className="rounded-xl border border-line bg-surface2 p-3 text-center">
          <div className="font-score text-3xl">{players}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted">{pl(players, "gracz", "graczy", "graczy").replace(/^\d+\s/, "")}</div>
        </div>
      </div>
      <p className="text-xs text-muted">
        Wyniki, statystyki i gracze są zapisane tylko na tym telefonie, w tej przeglądarce. Nie trafiają do internetu. Zrób kopię, żeby
        przenieść je na inny telefon albo nie stracić ich po wyczyszczeniu przeglądarki.
      </p>

      <div>
        <SectionLabel>Kopia zapasowa</SectionLabel>
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
      </div>

      <div>
        <SectionLabel>Strefa niebezpieczna</SectionLabel>
        <Button variant="ghost" className="w-full border border-danger/40 text-danger" onClick={() => setConfirmWipe(true)}>
          <Trash2 className="h-4 w-4" /> Usuń wszystkie dane
        </Button>
      </div>

      <ConfirmDialog
        open={!!pendingImport}
        title="Wczytać kopię?"
        message={
          pendingImport && (
            <>
              Kopia zawiera {pl(pendingImport.history.length, "mecz", "mecze", "meczów")}. Obecne dane na tym urządzeniu zostaną{" "}
              <b className="text-fg">zastąpione</b>.
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
    </>
  );
}

// ---------------------------------------------------------------- wspólne

interface AudioInfo {
  found: Partial<Record<SoundEvent, boolean>>;
  variants: Partial<Record<SoundEvent, number>>;
  surprises: number;
  pack: boolean;
  avail: Record<RangeKey, VoiceStyle[]>;
  voices: SpeechSynthesisVoice[];
}

/** Co jest nagrane w repozytorium (dźwięki, lektor) i jakie głosy ma telefon. */
function useAudioInfo(open: boolean): AudioInfo {
  const [found, setFound] = useState<Partial<Record<SoundEvent, boolean>>>({});
  const [variants, setVariants] = useState<Partial<Record<SoundEvent, number>>>({});
  const [surprises, setSurprises] = useState(0);
  const [pack, setPack] = useState(speech.packFound);
  const [avail, setAvail] = useState<Record<RangeKey, VoiceStyle[]>>(speech.available);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!open) return;
    void sound.detect().then(() => {
      setFound({ ...sound.found });
      setVariants({ ...sound.variants });
      setSurprises(sound.surprises);
    });
    void speech.detectPack().then((ok) => {
      setPack(ok);
      setAvail({ ...speech.available });
    });
    const load = () => setVoices(speech.voices());
    load();
    if (speech.supported) window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      if (speech.supported) window.speechSynthesis.removeEventListener?.("voiceschanged", load);
    };
  }, [open]);

  return { found, variants, surprises, pack, avail, voices };
}

function ListenButton() {
  return (
    <Button
      className="w-full"
      onClick={() =>
        void speech.announce(
          { kind: "turn", scored: 100, remaining: 121, player: "Kasia", nextName: "Osa", nextScore: 130, nextCheckout: ["T20", "T20", "D5"] },
          true,
        )
      }
    >
      <Volume2 className="h-4 w-4" /> Posłuchaj przykładowej zapowiedzi
    </Button>
  );
}

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

// ---------------------------------------------------------------- styl nagranego lektora

const SAMPLE: Record<RangeKey, number> = { r0: 26, r50: 60, r100: 121, r150: 160, r180: 180 };

function VoiceStylePicker({ store, available }: { store: AppStore; available: Record<RangeKey, VoiceStyle[]> }) {
  const styles = { ...DEFAULT_VOICE_STYLES, ...store.data.settings.voiceStyles };
  const setStyles = (next: Record<RangeKey, VoiceStyle>) => store.setSettings((x) => ({ ...x, voiceStyles: next }));
  const everywhere = VOICE_STYLES.filter((st) => VOICE_RANGES.every((r) => available[r.key].includes(st.id)));
  const isDefault = VOICE_RANGES.every((r) => styles[r.key] === DEFAULT_VOICE_STYLES[r.key]);
  const listen = (n: number) => void speech.announce({ kind: "turn", scored: n, remaining: 0, player: "" }, true);

  return (
    <div>
      <SectionLabel>Styl lektora</SectionLabel>
      <p className="mb-2 text-xs text-muted">Jak lektor reaguje na wynik: spokojnie przy małych, krzyczy przy 180.</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          onClick={() => setStyles({ ...DEFAULT_VOICE_STYLES })}
          className={cn("rounded-full border px-2.5 py-1 text-xs", isDefault ? "border-primary bg-primary/15" : "border-line bg-surface2")}
        >
          Domyślny podział
        </button>
        {everywhere.map((st) => {
          const active = VOICE_RANGES.every((r) => styles[r.key] === st.id);
          return (
            <button
              key={st.id}
              onClick={() => setStyles(Object.fromEntries(VOICE_RANGES.map((r) => [r.key, st.id])) as Record<RangeKey, VoiceStyle>)}
              className={cn("rounded-full border px-2.5 py-1 text-xs", active ? "border-primary bg-primary/15" : "border-line bg-surface2")}
            >
              Wszystko: {st.label.toLowerCase()}
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5 rounded-xl border border-line bg-surface2 p-3">
        {VOICE_RANGES.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-xs text-muted">{r.label}</span>
            <select
              value={styles[r.key]}
              onChange={(e) => setStyles({ ...styles, [r.key]: e.target.value as VoiceStyle })}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-sm"
              aria-label={`Styl lektora dla wyników ${r.label}`}
            >
              {VOICE_STYLES.filter((st) => available[r.key].includes(st.id) || st.id === styles[r.key]).map((st) => (
                <option key={st.id} value={st.id} disabled={!available[r.key].includes(st.id)}>
                  {st.label}
                  {!available[r.key].includes(st.id) ? " (brak nagrań)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => listen(SAMPLE[r.key])}
              className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-xs"
              aria-label={`Posłuchaj ${SAMPLE[r.key]}`}
            >
              <Play className="h-3 w-3" /> {SAMPLE[r.key]}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
