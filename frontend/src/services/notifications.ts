// PATH: src/services/notifications.ts | REQ-ID: TERAPIA-NOTIF-01
//
// Powiadomienia — faza 0 (demo bez serwera): ustawienia w localStorage + lokalne powiadomienia
// pokazywane przez service worker PWA (registration.showNotification).
//
// FAZA 2 (Supabase + Web Push) — jak to podepniemy, bez implementacji tutaj:
//  1. Klucze VAPID: publiczny w env frontu (VITE_VAPID_PUBLIC_KEY), prywatny tylko w sekretach funkcji Supabase.
//  2. Po zgodzie (requestPermission() === 'granted'): registration.pushManager.subscribe({
//       userVisibleOnly: true, applicationServerKey: <VAPID public> }) → zapis subskrypcji
//     (endpoint + keys p256dh/auth) do tabeli np. `push_subscriptions` (RLS: user widzi tylko swoje),
//     razem z kopią NotifSettings (kategorie, godziny ciszy, muteUntil) — serwer musi je znać,
//     bo przy zamkniętej aplikacji to on decyduje, czy wysłać.
//  3. Edge Function Supabase (np. `send-push`) wołana z triggera bazy (nowa wiadomość, odpowiedź,
//     termin pracy domowej, streszczenie zajęć, ogłoszenie) → filtr po kategorii i isMutedNow
//     (ta sama logika co niżej, po stronie serwera) → wysyłka Web Push (biblioteka web-push / VAPID).
//  4. Service worker (vite-plugin-pwa, strategia injectManifest): handler `push` → showNotification
//     z tymi samymi opcjami co notify(); handler `notificationclick` → otwarcie/fokus okna aplikacji.
//  5. iOS: Web Push działa tylko w aplikacji dodanej do ekranu początkowego (iOS 16.4+) — stąd isIOSNotInstalled().
//
import { useCallback, useSyncExternalStore } from 'react';

export type NotifCategory = 'chat' | 'replies' | 'homework' | 'lessons' | 'announcements';

export interface NotifSettings {
  enabled: boolean;
  categories: Record<NotifCategory, boolean>;
  vibrate: boolean;
  sound: boolean;
  /** ISO — do kiedy wyciszone; brak = nie wyciszone */
  muteUntil?: string;
  quietHours: { on: boolean; from: string; to: string };
}

export type PermissionStateX = 'granted' | 'denied' | 'default' | 'unsupported';

const KEY = 'terapia_notif_v1';

export const DEFAULT_NOTIF: NotifSettings = {
  enabled: false, // do czasu zgody
  categories: { chat: true, replies: true, homework: true, lessons: true, announcements: true },
  vibrate: true,
  sound: true,
  muteUntil: undefined,
  quietHours: { on: false, from: '22:00', to: '07:00' },
};

const isHHMM = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);

export function loadNotif(): NotifSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_NOTIF;
    const x = JSON.parse(raw) as Partial<NotifSettings>;
    return {
      enabled: typeof x.enabled === 'boolean' ? x.enabled : DEFAULT_NOTIF.enabled,
      categories: { ...DEFAULT_NOTIF.categories, ...(x.categories ?? {}) },
      vibrate: typeof x.vibrate === 'boolean' ? x.vibrate : DEFAULT_NOTIF.vibrate,
      sound: typeof x.sound === 'boolean' ? x.sound : DEFAULT_NOTIF.sound,
      muteUntil: typeof x.muteUntil === 'string' ? x.muteUntil : undefined,
      quietHours: {
        on: typeof x.quietHours?.on === 'boolean' ? x.quietHours.on : DEFAULT_NOTIF.quietHours.on,
        from: isHHMM(x.quietHours?.from) ? x.quietHours.from : DEFAULT_NOTIF.quietHours.from,
        to: isHHMM(x.quietHours?.to) ? x.quietHours.to : DEFAULT_NOTIF.quietHours.to,
      },
    };
  } catch {
    return DEFAULT_NOTIF;
  }
}

// Prosty magazyn w module — wszystkie komponenty używające hooka widzą tę samą wartość.
let current: NotifSettings | null = null;
const listeners = new Set<() => void>();
const getSnapshot = () => (current ??= loadNotif());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function saveNotif(s: NotifSettings): void {
  current = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignoruj */ }
  listeners.forEach(fn => fn());
}

export function useNotifSettings(): [NotifSettings, (patch: Partial<NotifSettings>) => void] {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const update = useCallback((patch: Partial<NotifSettings>) => saveNotif({ ...getSnapshot(), ...patch }), []);
  return [s, update];
}

// ── Zgoda i środowisko ──────────────────────────────────────────────

export function permissionState(): PermissionStateX {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionStateX;
}

export async function requestPermission(): Promise<PermissionStateX> {
  if (permissionState() === 'unsupported') return 'unsupported';
  try {
    const r = await Notification.requestPermission();
    return r as PermissionStateX;
  } catch {
    return permissionState();
  }
}

export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ przedstawia się jako Mac — rozpoznaj po dotyku
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** iPhone/iPad w zwykłej karcie Safari — powiadomienia nie zadziałają, trzeba „Do ekranu początkowego”. */
export function isIOSNotInstalled(): boolean {
  return isIOS() && !isStandalone();
}

// ── Wyciszenie ──────────────────────────────────────────────────────

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export function inQuietHours(s: NotifSettings, now: Date = new Date()): boolean {
  if (!s.quietHours.on) return false;
  const from = toMin(s.quietHours.from), to = toMin(s.quietHours.to);
  if (from === to) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  return from < to ? t >= from && t < to : t >= from || t < to; // drugi wariant: przez północ
}

export function isMutedNow(s: NotifSettings, now: Date = new Date()): boolean {
  if (s.muteUntil) {
    const until = Date.parse(s.muteUntil);
    if (!Number.isNaN(until) && until > now.getTime()) return true;
  }
  return inQuietHours(s, now);
}

/** Do kiedy wyciszyć: godziny od teraz albo 'tomorrow' = jutro 7:00. */
export function muteUntilFor(opt: 1 | 8 | 'tomorrow', now: Date = new Date()): string {
  if (opt === 'tomorrow') {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(7, 0, 0, 0);
    return d.toISOString();
  }
  return new Date(now.getTime() + opt * 3600_000).toISOString();
}

// ── Pokazywanie ─────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<NotifCategory, string> = {
  chat: 'Czat — każda wiadomość',
  replies: 'Odpowiedzi do mnie',
  homework: 'Prace domowe — terminy',
  lessons: 'Nowe streszczenia zajęć',
  announcements: 'Ogłoszenia prowadzącej',
};

export function canNotify(s: NotifSettings, category: NotifCategory): boolean {
  return s.enabled && s.categories[category] && permissionState() === 'granted' && !isMutedNow(s);
}

/** Zwraca true, gdy powiadomienie zostało pokazane. Nigdy nie rzuca.
 *  `force` (powiadomienie testowe) pomija kategorię, wyłącznik i wyciszenie — ale nie zgodę przeglądarki. */
export async function notify(s: NotifSettings, category: NotifCategory, title: string, body: string, opts?: { force?: boolean }): Promise<boolean> {
  if (opts?.force ? permissionState() !== 'granted' : !canNotify(s, category)) return false;
  // `vibrate` nie ma w typach DOM TS, ale przeglądarki (Android) je obsługują
  const options: NotificationOptions & { vibrate?: number[] } = {
    body,
    icon: './pwa-192x192.png',
    badge: './pwa-192x192.png',
    tag: `terapia-${category}`,
    silent: !s.sound,
    vibrate: s.vibrate ? [120, 60, 120] : undefined,
  };
  let shown = false;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>(r => setTimeout(() => r(null), 3000)),
      ]);
      if (reg) { await reg.showNotification(title, options); shown = true; }
    }
  } catch { /* spróbuj fallbacku */ }
  if (!shown) {
    try { new Notification(title, options); shown = true; } catch { /* np. Chrome Android bez SW */ }
  }
  if (shown && s.vibrate) {
    try { navigator.vibrate?.([120, 60, 120]); } catch { /* iOS — brak wibracji */ }
  }
  return shown;
}
