import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, History, Settings } from "lucide-react";
import { uid } from "./engine/game";
import { PLAYER_COLORS } from "./engine/game";
import type { MatchSettings, Player } from "./engine/types";
import { sound } from "./lib/audio";
import { speech } from "./lib/speech";
import { useAppData } from "./lib/store";
import { GameScreen } from "./components/GameScreen";
import { HistoryPanel, SettingsPanel, StatsPanel } from "./components/Panels";
import { ContinueCard, MatchSetup, PlayerSetup, startNewGame } from "./components/Setup";
import { Button, ConfirmDialog, Toast } from "./components/ui";
import { Logo } from "./components/Logo";

type Panel = "history" | "stats" | "settings" | null;

const freshPlayers = (): Player[] => [
  { id: uid(), name: "", color: PLAYER_COLORS[0] },
  { id: uid(), name: "", color: PLAYER_COLORS[1] },
];

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

export default function App() {
  const store = useAppData();
  const { data } = store;
  const game = data.activeGame;
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState<"players" | "settings">("players");
  const [players, setPlayers] = useState<Player[]>(freshPlayers);
  const [matchSettings, setMatchSettings] = useState<MatchSettings>(data.settings.lastMatch);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "info" | "good" | "bad"; id: number } | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);

  const notify = useCallback((msg: string, tone: "info" | "good" | "bad" = "info") => {
    setToast({ msg, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Motyw, dźwięk, lektor.
  const s = data.settings;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(s.theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", s.theme === "dark" ? "#0b1416" : "#f1f4f3");
  }, [s.theme]);
  useEffect(() => {
    sound.enabled = s.sound;
    sound.volume = s.volume;
    speech.enabled = s.speech;
    speech.volume = s.speechVolume;
    speech.rate = s.speechRate;
    speech.voiceURI = s.voiceURI;
    speech.usePack = s.usePack;
    speech.callRemaining = s.callRemaining;
    speech.announceNext = s.announceNext;
  }, [s.sound, s.volume, s.speech, s.speechVolume, s.speechRate, s.voiceURI, s.usePack, s.callRemaining, s.announceNext]);

  // Własne dźwięki i nagrany lektor z repozytorium (public/sounds, public/voice).
  useEffect(() => {
    void sound.detect();
    void speech.detectPack();
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  useEffect(() => {
    if (store.saveState === "error") notify("Nie udało się zapisać — brak miejsca w przeglądarce?", "bad");
  }, [store.saveState, notify]);

  const inGame = playing && !!game;
  const resumable = !!game && !game.finishedAt;
  const [confirmReplace, setConfirmReplace] = useState(false);
  const begin = () => {
    setConfirmReplace(false);
    startNewGame(store, players, matchSettings);
    setPlaying(true);
  };

  const goHome = () => {
    setPlaying(false);
    setStep("players");
  };

  return (
    <div className="safe-area min-h-screen">
      {toast && <Toast key={toast.id} message={toast.msg} tone={toast.tone} />}
      <div className="mx-auto max-w-2xl px-3 sm:px-4">
        {store.loadError && (
          <div className="mb-3 rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">
            {store.loadError}{" "}
            <button className="underline" onClick={store.dismissLoadError}>
              OK
            </button>
          </div>
        )}

        {inGame ? (
          <GameScreen
            store={store}
            game={game}
            onPause={goHome}
            onNewGame={() => {
              store.setGame(null);
              setPlayers(game.players.map((p) => ({ ...p, id: uid() })));
              setMatchSettings(game.settings);
              goHome();
            }}
            onOpenSettings={() => setPanel("settings")}
            notify={notify}
          />
        ) : (
          <>
            <header className="mb-5 flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                <Logo className="h-12 w-12" />
                <div>
                  <h1 className="font-score text-4xl leading-none tracking-wider text-accent">Kanciapa Dart</h1>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted">301 · 501 · 701 · offline</p>
                </div>
              </div>
              <nav className="flex items-center">
                <Button variant="ghost" size="icon" onClick={() => setPanel("stats")} aria-label="Statystyki">
                  <BarChart3 className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPanel("history")} aria-label="Historia">
                  <History className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPanel("settings")} aria-label="Ustawienia">
                  <Settings className="h-5 w-5" />
                </Button>
              </nav>
            </header>

            <main className="space-y-5 pb-6">
              {install && (
                <button
                  onClick={async () => {
                    await install.prompt();
                    setInstall(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-left text-sm"
                >
                  <Download className="h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <b>Zainstaluj na telefonie</b> — ikona na ekranie głównym, działa bez internetu.
                  </span>
                </button>
              )}

              {resumable && (
                <ContinueCard
                  game={game}
                  onContinue={() => setPlaying(true)}
                  onDiscard={() => store.setGame(null)}
                />
              )}

              {step === "players" ? (
                <PlayerSetup store={store} players={players} setPlayers={setPlayers} onNext={() => setStep("settings")} />
              ) : (
                <MatchSetup
                  settings={matchSettings}
                  onChange={setMatchSettings}
                  onBack={() => setStep("players")}
                  onStart={() => (resumable ? setConfirmReplace(true) : begin())}
                />
              )}
            </main>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmReplace}
        title="Zacząć nowy mecz?"
        message="Masz przerwany mecz. Nowa gra go usunie (niedokończone mecze nie trafiają do statystyk)."
        confirmLabel="Nowy mecz"
        danger
        onConfirm={begin}
        onCancel={() => setConfirmReplace(false)}
      />
      <HistoryPanel store={store} open={panel === "history"} onClose={() => setPanel(null)} />
      <StatsPanel store={store} open={panel === "stats"} onClose={() => setPanel(null)} />
      <SettingsPanel store={store} open={panel === "settings"} onClose={() => setPanel(null)} notify={notify} />
    </div>
  );
}
