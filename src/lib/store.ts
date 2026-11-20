// Cały stan aplikacji trzymany w localStorage tego urządzenia.
// Nic nie jest wysyłane do internetu.

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS } from "../engine/game";
import { normName } from "../engine/stats";
import type { Game, InputMode, MatchSettings, Player } from "../engine/types";
import { DEFAULT_VOICE_STYLES, type RangeKey, type VoiceStyle } from "./speech";

export interface AppSettings {
  theme: "dark" | "light";
  sound: boolean;
  volume: number;
  /** Jak często po zwykłej kolejce gra niespodzianka: 0 = nigdy, 0.2 = 1 z 5. */
  surpriseChance: number;
  /** Niespodzianka gra zamiast odczytania wyniku albo po nim. */
  surpriseMode: "instead" | "after";
  speech: boolean;
  speechVolume: number;
  /** Lektor zapowiada, kto rzuca następny. */
  announceNext: boolean;
  /** Wybrany głos telefonu (voiceURI) albo null = automatycznie. */
  voiceURI: string | null;
  speechRate: number;
  /** Używaj nagranego lektora z public/voice/, jeśli jest. */
  usePack: boolean;
  /** Nagrany lektor mówi też, ile zostało (do 180). */
  callRemaining: boolean;
  /** Styl nagranego lektora dla przedziałów wyników (r0, r50, r100, r150, r180). */
  voiceStyles: Record<RangeKey, VoiceStyle>;
  /** Tarcza: "double" = drugie stuknięcie potwierdza, "single" = od razu. */
  boardConfirm: "double" | "single";
  inputMode: InputMode;
  keepAwake: boolean;
  lastMatch: MatchSettings;
}

export interface SavedPlayer {
  name: string;
  color: string;
  lastUsed: number;
  doubles?: number[];
}

export interface AppData {
  version: 1;
  activeGame: Game | null;
  history: Game[];
  savedPlayers: SavedPlayer[];
  settings: AppSettings;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "dark",
  sound: true,
  volume: 0.5,
  surpriseChance: 0,
  surpriseMode: "instead",
  speech: true,
  speechVolume: 0.9,
  announceNext: true,
  voiceURI: null,
  speechRate: 1.05,
  usePack: true,
  callRemaining: true,
  voiceStyles: DEFAULT_VOICE_STYLES,
  boardConfirm: "double",
  inputMode: "board",
  keepAwake: true,
  lastMatch: DEFAULT_SETTINGS,
};

const KEY = "kanciapa-dart:v1";
export const HISTORY_LIMIT = 500;

export function emptyData(): AppData {
  return { version: 1, activeGame: null, history: [], savedPlayers: [], settings: DEFAULT_APP_SETTINGS };
}

/** Sprawdza i uzupełnia dane (z localStorage lub z importu). */
export function sanitize(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") throw new Error("Niepoprawny plik");
  const r = raw as Partial<AppData>;
  if (r.version !== 1) throw new Error("Nieznana wersja danych");
  const isGame = (g: unknown): g is Game =>
    !!g && typeof g === "object" && Array.isArray((g as Game).players) && Array.isArray((g as Game).turns);
  return {
    version: 1,
    activeGame: isGame(r.activeGame) ? r.activeGame : null,
    history: Array.isArray(r.history) ? r.history.filter(isGame) : [],
    savedPlayers: Array.isArray(r.savedPlayers)
      ? r.savedPlayers.filter((p) => p && typeof p.name === "string")
      : [],
    settings: {
      ...DEFAULT_APP_SETTINGS,
      ...(r.settings ?? {}),
      lastMatch: { ...DEFAULT_SETTINGS, ...(r.settings?.lastMatch ?? {}) },
      voiceStyles: { ...DEFAULT_VOICE_STYLES, ...(r.settings?.voiceStyles ?? {}) },
    },
  };
}

function load(): { data: AppData; error: string | null } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { data: emptyData(), error: null };
    return { data: sanitize(JSON.parse(raw)), error: null };
  } catch (e) {
    // Nie nadpisuj uszkodzonego zapisu bez kopii — odłóż go pod osobnym kluczem.
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(`${KEY}:backup-${Date.now()}`, raw);
    } catch {
      /* brak miejsca */
    }
    return {
      data: emptyData(),
      error: `Nie udało się wczytać zapisu (${(e as Error).message}). Kopia starych danych została zachowana w przeglądarce.`,
    };
  }
}

/** Historia = zakończone mecze. Aktywny mecz jest do niej dopisywany/usuwany po id. */
function syncHistory(history: Game[], game: Game | null): Game[] {
  if (!game) return history;
  const without = history.filter((h) => h.id !== game.id);
  if (game.finishedAt) return [game, ...without].slice(0, HISTORY_LIMIT);
  return without.length === history.length ? history : without;
}

function rememberPlayers(saved: SavedPlayer[], players: Player[]): SavedPlayer[] {
  const now = Date.now();
  const map = new Map(saved.map((s) => [normName(s.name), s]));
  for (const p of players) {
    if (!p.name.trim()) continue;
    const prev = map.get(normName(p.name));
    map.set(normName(p.name), { name: p.name.trim(), color: p.color, lastUsed: now, doubles: p.doubles ?? prev?.doubles });
  }
  return [...map.values()].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 100);
}

export type SaveState = "idle" | "saved" | "error";

export function useAppData() {
  const [initial] = useState(load);
  const [data, setData] = useState<AppData>(initial.data);
  const [loadError, setLoadError] = useState<string | null>(initial.error);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const skipFirst = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
        setSaveState("saved");
        setSavedAt(Date.now());
      } catch {
        setSaveState("error");
      }
    }, 200);
  }, [data]);

  // Zapis natychmiast przy zamykaniu karty.
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(dataRef.current));
      } catch {
        /* nic */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const setGame = useCallback((game: Game | null) => {
    setData((d) => ({ ...d, activeGame: game, history: syncHistory(d.history, game) }));
  }, []);

  /** Zmiana aktywnej gry funkcją — zawsze na najnowszym stanie (bez wyścigów). */
  const updateGame = useCallback((fn: (g: Game) => Game) => {
    setData((d) => {
      if (!d.activeGame) return d;
      const next = fn(d.activeGame);
      if (next === d.activeGame) return d;
      return { ...d, activeGame: next, history: syncHistory(d.history, next) };
    });
  }, []);

  const startGame = useCallback((game: Game) => {
    setData((d) => {
      // Ulubione double z zapisanych graczy, jeśli nie ustawiono ich przed meczem.
      const saved = new Map(d.savedPlayers.map((s) => [normName(s.name), s]));
      const players = game.players.map((p) =>
        p.doubles === undefined && saved.get(normName(p.name))?.doubles
          ? { ...p, doubles: saved.get(normName(p.name))!.doubles }
          : p,
      );
      const g = { ...game, players };
      return {
        ...d,
        activeGame: g,
        savedPlayers: rememberPlayers(d.savedPlayers, players),
        settings: { ...d.settings, lastMatch: game.settings },
      };
    });
  }, []);

  /** Zapamiętuje ulubione double gracza (po nazwie) na przyszłe mecze. */
  const saveDoubles = useCallback((name: string, doubles: number[]) => {
    const k = normName(name);
    setData((d) => {
      const exists = d.savedPlayers.some((s) => normName(s.name) === k);
      return {
        ...d,
        savedPlayers: exists
          ? d.savedPlayers.map((s) => (normName(s.name) === k ? { ...s, doubles } : s))
          : d.savedPlayers,
      };
    });
  }, []);

  const setSettings = useCallback((fn: (s: AppSettings) => AppSettings) => {
    setData((d) => ({ ...d, settings: fn(d.settings) }));
  }, []);

  const deleteFromHistory = useCallback((id: string) => {
    setData((d) => ({ ...d, history: d.history.filter((h) => h.id !== id) }));
  }, []);

  const forgetPlayer = useCallback((name: string) => {
    const k = normName(name);
    setData((d) => ({ ...d, savedPlayers: d.savedPlayers.filter((p) => normName(p.name) !== k) }));
  }, []);

  const replaceAll = useCallback((next: AppData) => {
    setData(next);
    setLoadError(null);
  }, []);

  const wipe = useCallback(() => {
    localStorage.removeItem(KEY);
    setData(emptyData());
  }, []);

  return {
    data,
    loadError,
    dismissLoadError: () => setLoadError(null),
    saveState,
    savedAt,
    setGame,
    updateGame,
    startGame,
    setSettings,
    deleteFromHistory,
    forgetPlayer,
    saveDoubles,
    replaceAll,
    wipe,
  };
}

export type AppStore = ReturnType<typeof useAppData>;
