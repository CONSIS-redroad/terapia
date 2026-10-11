// PATH: src/hooks/useUiSync.ts | REQ-ID: RR-UI-PROFIL
// WYGLĄD PRZY PROFILU (Bartek 11.10): tryb jasny/ciemny i WYBRANE pola tapety leżą w bazie (members.ui), więc są te same
// na telefonie i komputerze i przeżywają aktualizacje. Nowa wersja zmienia tylko TREŚĆ motywu; nowe pola = domyślne.
// Zasady (adwersarz 11.10): do bazy idą WYŁĄCZNIE kliknięcia w tej aplikacji (nie zdarzenia z innej karty), tylko
// zmienione pola, scalane z aktualnym wpisem w bazie (dwa urządzenia nie kasują sobie wyborów); „Przywróć” = pusty wybór.
// Pusty profil przy pierwszym logowaniu = wysyłamy do niego lokalny wybór (inaczej pierwsza zmiana innego pola
// stworzyłaby w bazie wpis bez dawnego wyboru, który potem by wygrał). Zapis leci od razu przy chowaniu karty;
// nieudany wraca do kolejki i idzie przy kolejnej zmianie / schowaniu. Błędy są ciche — nie ruszają ekranu aplikacji.
import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import type { ThemeMode } from './useTheme';
import { cleanChoice, type WallpaperChoice } from './useWallpaper';

export interface UiPrefs { mode?: ThemeMode; wallpaper?: WallpaperChoice }
interface Pending { mode?: ThemeMode; wallpaper?: WallpaperChoice; resetWallpaper?: boolean }

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function useUiSync(o: {
  live: boolean; uid: string; ui: UiPrefs | null | undefined; ready: boolean;
  localMode: ThemeMode; localWallpaper: WallpaperChoice;
  setMode: (m: ThemeMode) => void; applyWallpaper: (c: WallpaperChoice) => void;
}) {
  const applied = useRef(false);
  const pending = useRef<Pending>({});
  const timer = useRef<number | undefined>(undefined);

  // 1) Po zalogowaniu wygląd z profilu wygrywa z lokalnym (raz na sesję). Pusty profil = zostaje to, co lokalnie.
  useEffect(() => {
    if (!o.live || !o.ready || applied.current) return;
    applied.current = true;
    const ui = o.ui ?? {};
    if (ui.mode && MODES.includes(ui.mode)) o.setMode(ui.mode);
    else if (o.localMode !== 'system') schedule({ mode: o.localMode });              // profil bez trybu ← wybór z urządzenia
    if (ui.wallpaper && typeof ui.wallpaper === 'object' && !Array.isArray(ui.wallpaper)) o.applyWallpaper(cleanChoice(ui.wallpaper));
    else if (Object.keys(o.localWallpaper).length) schedule({ wallpaper: o.localWallpaper }); // profil bez tapety ← wybór z urządzenia
  }, [o.live, o.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chowanie / zamykanie karty: wyślij od razu, nie czekaj na debounce.
  useEffect(() => {
    const now = () => { if (document.visibilityState === 'hidden' && hasPending()) { window.clearTimeout(timer.current); void flush(); } };
    const bye = () => { if (hasPending()) { window.clearTimeout(timer.current); void flush(); } };
    document.addEventListener('visibilitychange', now);
    window.addEventListener('pagehide', bye);
    return () => { document.removeEventListener('visibilitychange', now); window.removeEventListener('pagehide', bye); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPending = () => { const p = pending.current; return !!(p.mode || p.resetWallpaper || p.wallpaper); };
  // nieudany zapis wraca do kolejki; nowsze zmiany (zrobione w trakcie) mają pierwszeństwo
  const requeue = (p: Pending) => {
    const n = pending.current;
    pending.current = {
      mode: n.mode ?? p.mode,
      resetWallpaper: n.resetWallpaper || (p.resetWallpaper && !n.wallpaper) || undefined,
      wallpaper: n.resetWallpaper ? n.wallpaper : (p.wallpaper || n.wallpaper ? { ...(p.wallpaper ?? {}), ...(n.wallpaper ?? {}) } : undefined),
    };
  };
  const flush = async () => {
    const p = pending.current; pending.current = {};
    const sb = supabase;
    if (!sb || !o.uid || !(p.mode || p.resetWallpaper || p.wallpaper)) return;
    try {
      const cur = await sb.from('members').select('ui').eq('id', o.uid).maybeSingle();
      if (cur.error) { requeue(p); return; }
      const now = (cur.data?.ui ?? {}) as UiPrefs;
      const next: UiPrefs = { ...now };
      if (p.mode) next.mode = p.mode;
      if (p.resetWallpaper) next.wallpaper = {};
      if (p.wallpaper) next.wallpaper = { ...cleanChoice(next.wallpaper), ...p.wallpaper };
      const up = await sb.from('members').update({ ui: next }).eq('id', o.uid);
      if (up.error) requeue(p);
    } catch { requeue(p); }
  };

  const schedule = (add: Pending) => {
    if (!o.live) return;
    const p = pending.current;
    if (add.mode) p.mode = add.mode;
    if (add.resetWallpaper) { p.resetWallpaper = true; p.wallpaper = undefined; }
    if (add.wallpaper && Object.keys(add.wallpaper).length) p.wallpaper = { ...(p.wallpaper ?? {}), ...add.wallpaper };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 1000);   // suwaki nie wysyłają co klatkę
  };

  return {
    mode: (m: ThemeMode) => schedule({ mode: m }),
    wallpaper: (delta: WallpaperChoice) => schedule({ wallpaper: delta }),
    resetWallpaper: () => schedule({ resetWallpaper: true }),
  };
}
