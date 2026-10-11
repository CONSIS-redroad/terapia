// PATH: src/hooks/useWallpaper.ts | REQ-ID: TERAPIA-WALL-SET
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_THEME_ID } from '../themes';

export interface WallpaperSettings {
  themeId: string;
  particles: boolean;
  density: number;   // 0.5 mało · 1 średnio · 1.6 dużo
  motion: boolean;   // paralaksa + obracanie przeciąganiem (jak w Luna)
  veil: number;      // 0..0.6 — zasłona tła dla czytelności
}

// Klucz WSPÓLNY z Dzienniczkiem (ten sam format: themeId, particles, density, motion, veil).
// v2 = RZADKI wybór (tylko pola zmienione przez użytkownika). Stare wersje aplikacji piszą do v1 pełny zestaw —
// osobny klucz sprawia, że nie zepsują nowego zapisu (adwersarz 11.10 SKEW). v1 czytamy WYŁĄCZNIE raz, do migracji.
const KEY = 'rr_ui_wallpaper_v2';
const V1_KEY = 'rr_ui_wallpaper_v1';
const OLD_KEY = 'terapia_wallpaper_v1';

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export const DEFAULT_WALLPAPER: WallpaperSettings = {
  themeId: DEFAULT_THEME_ID, particles: true, density: 1, motion: true, veil: 0.15,
};

// ZAPISUJEMY TYLKO TO, CO UŻYTKOWNIK ZMIENIŁ (Bartek 11.10; adwersarz 11.10):
// pod rr_ui_wallpaper_v2 leży RZADKI obiekt wybranych pól (np. { density: 1.6 }), nigdy pełny zestaw.
// Ustawienia na ekranie = domyślne ⊕ wybrane pola → nowa wersja z nowym/poprawionym motywem dochodzi do każdego,
// kto motywu sam nie wybrał, a wybrane pola zostają. Nowe pola ustawień = domyślne. v2 wspólny z Dzienniczkiem.
// Migracja (raz, gdy v2 nie istnieje): ze starego pełnego zapisu zostają motyw/gęstość/zasłona RÓŻNE od dawnych
// domyślnych (zapisanych tu na sztywno — nie z bieżącego DEFAULT, bo ten się zmieni). particles/motion pomijamy:
// stary zapis wpisywał je sam przy „ograniczeniu ruchu”. Wynik migracji zapisujemy od razu (też pusty `{}`).
export type WallpaperChoice = Partial<WallpaperSettings>;
const FIELDS: (keyof WallpaperSettings)[] = ['themeId', 'particles', 'density', 'motion', 'veil'];
const OLD_DEFAULTS = { themeId: 'sakura', density: 1, veil: 0.15 };   // dawne domyślne TEJ aplikacji — nie zmieniać

export function defaultWallpaper(): WallpaperSettings {
  return { ...DEFAULT_WALLPAPER, motion: !reducedMotion(), particles: !reducedMotion() };
}

/** Tylko znane pola o poprawnym typie (wpis z bazy / z innej aplikacji nie wstrzyknie śmieci). */
export function cleanChoice(x: unknown): WallpaperChoice {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>, out: WallpaperChoice = {};
  if (typeof o.themeId === 'string') out.themeId = o.themeId;
  if (typeof o.particles === 'boolean') out.particles = o.particles;
  if (typeof o.motion === 'boolean') out.motion = o.motion;
  if (typeof o.density === 'number' && [0.5, 1, 1.6].includes(o.density)) out.density = o.density;
  if (typeof o.veil === 'number' && o.veil >= 0 && o.veil <= 0.6) out.veil = o.veil;
  return out;
}

export function withDefaults(choice: WallpaperChoice | null | undefined): WallpaperSettings {
  return { ...defaultWallpaper(), ...cleanChoice(choice) };
}

function readChoice(): WallpaperChoice {
  try {
    const v2 = localStorage.getItem(KEY);
    if (v2 !== null) return cleanChoice(JSON.parse(v2));
    // migracja jednorazowa ze starego pełnego zapisu
    const raw = localStorage.getItem(V1_KEY) ?? localStorage.getItem(OLD_KEY);
    const c = cleanChoice(raw ? JSON.parse(raw) : null), kept: WallpaperChoice = {};
    if (c.themeId !== undefined && c.themeId !== OLD_DEFAULTS.themeId) kept.themeId = c.themeId;
    if (c.density !== undefined && c.density !== OLD_DEFAULTS.density) kept.density = c.density;
    if (c.veil !== undefined && c.veil !== OLD_DEFAULTS.veil) kept.veil = c.veil;
    writeChoice(kept);
    return kept;
  } catch { return {}; }
}

function writeChoice(c: WallpaperChoice) {
  try { localStorage.setItem(KEY, JSON.stringify(cleanChoice(c))); } catch { /* ignoruj */ }   // pusty {} = „bez wyboru”, bez ponownej migracji
}

export function useWallpaper() {
  const [choice, setChoice] = useState<WallpaperChoice>(readChoice);
  const settings = useMemo(() => withDefaults(choice), [choice]);   // stały obiekt — animacja tapety nie restartuje się co render
  /** Akcja użytkownika: zapamiętaj TYLKO pola, które się zmieniły. Zwraca te pola (do profilu w bazie). */
  const setSettings = (s: WallpaperSettings): WallpaperChoice => {
    const delta: WallpaperChoice = {};
    for (const k of FIELDS) if (s[k] !== settings[k]) (delta as Record<string, unknown>)[k] = s[k];
    if (!Object.keys(delta).length) return delta;
    const next = { ...choice, ...delta };
    setChoice(next); writeChoice(next);
    return delta;
  };
  /** Wybór z profilu w bazie (po zalogowaniu) — zastępuje lokalny, bez odsyłania do bazy. */
  const applyChoice = (c: WallpaperChoice) => { const n = cleanChoice(c); setChoice(n); writeChoice(n); };
  // zmiana tapety w Dzienniczku (inna karta) → od razu tutaj (tylko lokalnie; do bazy idą wyłącznie kliknięcia w tej aplikacji)
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === KEY) setChoice(readChoice()); };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);
  const reset = () => { setChoice({}); writeChoice({}); };
  return { settings, choice, setSettings, applyChoice, reset };
}

/** Czy aktualnie działa tryb ciemny (śledzi atrybut data-theme na <html>). */
export function useIsDark() {
  const get = () => document.documentElement.dataset.theme === 'dark';
  const [dark, setDark] = useState(get);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(get()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
