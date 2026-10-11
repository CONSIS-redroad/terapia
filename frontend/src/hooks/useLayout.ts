// PATH: src/hooks/useLayout.ts | REQ-ID: RR-UI-UKLAD
// UKŁAD: telefon / komputer (Bartek 11.10: „telefon nie może pozwalać na tryb komputerowy — w ustawieniach naszej apki
// ma być; nawet jak ktoś ma tak ustawioną przeglądarkę, ignorować — nasze ustawienie ma to zmieniać”).
// „Automatycznie” rozpoznaje telefon po FIZYCZNYM ekranie i dotyku (screen.width + pointer: coarse), a nie po szerokości,
// którą podaje przeglądarka — w trybie „wersja na komputer” przeglądarka udaje ~980 px i pomniejsza stronę.
// Wtedy powiększamy stronę z powrotem (zoom na <html>), żeby wyglądała jak na telefonie.
// Ustawienie jest PER URZĄDZENIE (localStorage), nie w profilu — telefon i komputer mają mieć różne układy.
import { useEffect, useState } from 'react';

export type LayoutMode = 'auto' | 'phone' | 'desktop';
const KEY = 'rr_ui_layout_v1';

export function readLayout(): LayoutMode {
  try { const v = localStorage.getItem(KEY); if (v === 'phone' || v === 'desktop') return v; } catch { /* ignoruj */ }
  return 'auto';
}

/** Urządzenie dotykowe z małym fizycznym ekranem — niezależnie od tego, co udaje przeglądarka. */
export function isPhoneDevice(): boolean {
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    return coarse && Math.min(screen.width, screen.height) < 600;
  } catch { return false; }
}

/** Strona udaje szeroki ekran (tryb „wersja na komputer” na telefonie)? → współczynnik powiększenia, inaczej 1. */
function desktopSiteRatio(): number {
  const r = window.innerWidth / Math.max(1, screen.width);
  return r > 1.3 ? r : 1;
}

export function decideMobile(mode: LayoutMode): boolean {
  if (mode === 'phone') return true;
  if (mode === 'desktop') return false;
  return isPhoneDevice() || window.matchMedia('(max-width: 1023px)').matches;
}

/** Przywraca skalę telefonu, gdy przeglądarka udaje komputer (zoom = szerokość udawana / fizyczna). */
export function applyPhoneScale(mobile: boolean) {
  const html = document.documentElement, st = html.style as CSSStyleDeclaration & { zoom: string };
  const r = mobile && isPhoneDevice() ? desktopSiteRatio() : 1;
  st.zoom = r > 1 ? String(Math.round(r * 1000) / 1000) : '';
  // .rr-phone wyłącza szerokie warianty Tailwinda (index.css); --rr-vh = wysokość ekranu w jednostkach po powiększeniu
  // (100dvh nie uwzględnia zoomu — czat na pełny ekran wychodziłby pod dolny pasek)
  html.classList.toggle('rr-phone', mobile);
  if (r > 1) html.style.setProperty('--rr-vh', `${Math.round(window.innerHeight / r)}px`);
  else html.style.removeProperty('--rr-vh');
}

export function useLayout() {
  const [mode, setModeState] = useState<LayoutMode>(readLayout);
  const [mobile, setMobile] = useState(() => decideMobile(readLayout()));
  useEffect(() => {
    const upd = () => { const m = decideMobile(mode); setMobile(m); applyPhoneScale(m); };
    upd();
    const mq = window.matchMedia('(max-width: 1023px)');
    mq.addEventListener('change', upd);
    window.addEventListener('resize', upd);
    window.addEventListener('orientationchange', upd);
    return () => { mq.removeEventListener('change', upd); window.removeEventListener('resize', upd); window.removeEventListener('orientationchange', upd); };
  }, [mode]);
  const setMode = (m: LayoutMode) => {
    setModeState(m);
    try { if (m === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, m); } catch { /* ignoruj */ }
  };
  return { mode, setMode, mobile };
}
