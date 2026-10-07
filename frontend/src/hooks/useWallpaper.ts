// PATH: src/hooks/useWallpaper.ts | REQ-ID: TERAPIA-WALL-SET
import { useEffect, useState } from 'react';
import { DEFAULT_THEME_ID } from '../themes';

export interface WallpaperSettings {
  themeId: string;
  particles: boolean;
  density: number;   // 0.5 mało · 1 średnio · 1.6 dużo
  motion: boolean;   // paralaksa + obracanie przeciąganiem (jak w Luna)
  veil: number;      // 0..0.6 — zasłona tła dla czytelności
}

const KEY = 'terapia_wallpaper_v1';

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export const DEFAULT_WALLPAPER: WallpaperSettings = {
  themeId: DEFAULT_THEME_ID, particles: true, density: 1, motion: true, veil: 0.15,
};

function load(): WallpaperSettings {
  const base = { ...DEFAULT_WALLPAPER, motion: !reducedMotion(), particles: !reducedMotion() };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...base, ...JSON.parse(raw) };
  } catch { /* ignoruj */ }
  return base;
}

export function useWallpaper() {
  const [settings, setSettings] = useState<WallpaperSettings>(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignoruj */ } }, [settings]);
  const reset = () => setSettings({ ...DEFAULT_WALLPAPER, motion: !reducedMotion(), particles: !reducedMotion() });
  return { settings, setSettings, reset };
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
