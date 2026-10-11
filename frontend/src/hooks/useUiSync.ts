// PATH: src/hooks/useUiSync.ts | REQ-ID: RR-UI-PROFIL
// WYGLĄD PRZY PROFILU (Bartek 11.10): tryb jasny/ciemny i WYBRANE pola tapety leżą w bazie (members.ui), więc są te same
// na telefonie i komputerze i przeżywają aktualizacje. Nowa wersja zmienia tylko TREŚĆ motywu; nowe pola = domyślne.
// Zasady (adwersarz 11.10, rundy 1–3):
// - do bazy idą WYŁĄCZNIE kliknięcia w tej aplikacji (nie zdarzenia z innej karty), tylko zmienione pola, scalane
//   z aktualnym wpisem w bazie (dwa urządzenia nie kasują sobie wyborów); „Przywróć” = pusty wybór tapety;
// - pusty profil przy pierwszym logowaniu dostaje lokalny wybór (inaczej pierwsza zmiana innego pola by go zgubiła);
// - SCALANIE W BAZIE: wysyłamy tylko zmienione pola do funkcji ui_merge (migracja *_ui_merge.sql), baza dokleja je do
//   aktualnego wpisu — zapis na ślepo całej kolumny gubił zmiany z innego urządzenia i zmiany w locie (adwersarz, runda 4);
// - zapisy idą JEDEN PO DRUGIM (kolejka); nieudany wraca do kolejki (z zachowaniem „Przywróć”);
// - schowanie / zamknięcie karty: zmiany zabieramy OD RAZU i wysyłamy `keepalive` (przeglądarka dośle je po zamknięciu).
// Błędy są ciche — nie ruszają ekranu aplikacji.
import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import type { ThemeMode } from './useTheme';
import { cleanChoice, type WallpaperChoice } from './useWallpaper';

export interface UiPrefs { mode?: ThemeMode; wallpaper?: WallpaperChoice }
interface Pending { mode?: ThemeMode; resetWallpaper?: boolean; wallpaper?: WallpaperChoice } // wallpaper działa PO resecie

const MODES: ThemeMode[] = ['system', 'light', 'dark'];
const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isEmpty = (p: Pending) => !(p.mode || p.resetWallpaper || p.wallpaper);
/** Starsze zmiany + nowsze (nowsze wygrywają; „Przywróć” w nowszych kasuje starsze pola tapety). */
function combine(older: Pending, newer: Pending): Pending {
  const wp = newer.resetWallpaper ? newer.wallpaper
    : (older.wallpaper || newer.wallpaper ? { ...(older.wallpaper ?? {}), ...(newer.wallpaper ?? {}) } : undefined);
  return { mode: newer.mode ?? older.mode, resetWallpaper: older.resetWallpaper || newer.resetWallpaper || undefined, wallpaper: wp };
}
/** (zostawione dla testów — scalanie robi teraz baza, ui_merge) */
export function apply(base: UiPrefs, p: Pending): UiPrefs {
  const next: UiPrefs = { ...base };
  if (p.mode) next.mode = p.mode;
  if (p.resetWallpaper) next.wallpaper = {};
  if (p.wallpaper) next.wallpaper = { ...cleanChoice(next.wallpaper), ...p.wallpaper };
  return next;
}

export function useUiSync(o: {
  live: boolean; uid: string; ui: UiPrefs | null | undefined; ready: boolean;
  localMode: ThemeMode; localWallpaper: WallpaperChoice;
  setMode: (m: ThemeMode) => void; applyWallpaper: (c: WallpaperChoice) => void;
}) {
  const applied = useRef(false);
  const pending = useRef<Pending>({});
  const timer = useRef<number | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const token = useRef('');
  const uid = useRef(o.uid); uid.current = o.uid;

  const take = () => { const p = pending.current; pending.current = {}; return p; };
  const requeue = (p: Pending) => { pending.current = combine(p, pending.current); };

  const toRpc = (p: Pending) => ({ patch: { ...(p.mode ? { mode: p.mode } : {}), ...(p.wallpaper ? { wallpaper: p.wallpaper } : {}) }, reset_wallpaper: !!p.resetWallpaper });

  const flush = () => {
    chain.current = chain.current.then(async () => {
      const p = take();
      const sb = supabase;
      if (!sb || !uid.current || isEmpty(p)) return;
      try {
        const r = await sb.rpc('ui_merge', toRpc(p));
        if (r.error && (r.error.code === 'PGRST202' || /ui_merge/.test(r.error.message))) {
          // baza bez funkcji ui_merge (migracja *_ui_merge.sql jeszcze niewgrana) → po staremu: odczyt, scalenie, zapis
          const cur = await sb.from('members').select('ui').eq('id', uid.current).maybeSingle();
          if (cur.error) { requeue(p); return; }
          const up = await sb.from('members').update({ ui: apply((cur.data?.ui ?? {}) as UiPrefs, p) }).eq('id', uid.current);
          if (up.error) requeue(p);
        } else if (r.error) requeue(p);
      } catch { requeue(p); }
    });
    return chain.current;
  };

  /** Schowanie / zamknięcie karty: zabierz zmiany SYNCHRONICZNIE i wyślij keepalive — przeglądarka dośle po zamknięciu. */
  const sendNow = () => {
    if (isEmpty(pending.current) || !SB_URL || !SB_KEY || !token.current) return;
    window.clearTimeout(timer.current);
    const p = take();
    try {
      void fetch(`${SB_URL}/rest/v1/rpc/ui_merge`, {
        method: 'POST', keepalive: true,
        headers: { apikey: SB_KEY, Authorization: `Bearer ${token.current}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(toRpc(p)),
      }).then(r => { if (!r.ok) requeue(p); }, () => requeue(p));
    } catch { requeue(p); }
  };

  const schedule = (add: Pending) => {
    if (!o.live) return;
    pending.current = combine(pending.current, add);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 1000);   // suwaki nie wysyłają co klatkę
  };

  // 1) Po zalogowaniu wygląd z profilu wygrywa z lokalnym (raz na sesję). Pusty profil ← wybór z urządzenia.
  useEffect(() => {
    if (!o.live || !o.ready || applied.current) return;
    applied.current = true;
    const ui = (o.ui && typeof o.ui === 'object' ? o.ui : {}) as UiPrefs;
    if (ui.mode && MODES.includes(ui.mode)) o.setMode(ui.mode);
    else if (o.localMode !== 'system') schedule({ mode: o.localMode });
    if (ui.wallpaper && typeof ui.wallpaper === 'object' && !Array.isArray(ui.wallpaper)) o.applyWallpaper(cleanChoice(ui.wallpaper));
    else if (Object.keys(o.localWallpaper).length) schedule({ wallpaper: o.localWallpaper });
  }, [o.live, o.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Token sesji pod ręką — przy zamykaniu karty nie ma czasu na asynchroniczne pobieranie.
  useEffect(() => {
    const sb = supabase;
    if (!o.live || !sb) return;
    void sb.auth.getSession().then(({ data }) => { token.current = data.session?.access_token ?? ''; });
    const { data } = sb.auth.onAuthStateChange((_e, s) => { token.current = s?.access_token ?? ''; });
    return () => data.subscription.unsubscribe();
  }, [o.live]);

  // 3) Schowanie karty (telefon: przejście do innej aplikacji) i zamknięcie → wyślij od razu, z keepalive.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') sendNow(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', sendNow);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', sendNow); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    mode: (m: ThemeMode) => schedule({ mode: m }),
    wallpaper: (delta: WallpaperChoice) => { if (Object.keys(delta).length) schedule({ wallpaper: delta }); },
    resetWallpaper: () => schedule({ resetWallpaper: true }),
  };
}
