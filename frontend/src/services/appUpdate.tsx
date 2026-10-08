// PATH: src/services/appUpdate.tsx | REQ-ID: TERAPIA-UPDATE-02
// WYMUSZONA AKTUALNOŚĆ (Bartek 08.10: „strona wymusza — masz nieaktualną wersję i już; normalne sprawdzenie przy ładowaniu”).
// Bez przycisków i bez pytania: przy starcie i przy powrocie do aplikacji pobieramy `version.json` z serwera
// (z pominięciem pamięci podręcznej). Inny numer budowy = krótki komunikat i samo przeładowanie na nową wersję.
// Numer budowy nadaje build (vite.config.ts) — nikt nie musi go podbijać ręcznie.
import React, { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;
export const APP_VERSION = __APP_VERSION__;
export const APP_BUILD = __APP_BUILD__;

const TRIED_KEY = 'terapia_update_tried';

async function serverBuild(): Promise<string | null> {
  try {
    const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.build === 'string' ? j.build : null;
  } catch { return null; } // offline — zostajemy na tym, co jest
}

async function hardRefresh(build: string): Promise<boolean> {
  // Bezpiecznik przed pętlą: jedna próba „miękka” (nowy Service Worker), druga — czyszczenie pamięci.
  let tried = '';
  try { tried = sessionStorage.getItem(TRIED_KEY) ?? ''; sessionStorage.setItem(TRIED_KEY, tried ? `${build}#2` : build); } catch { /* ignoruj */ }
  if (tried === `${build}#2`) return false; // już dwa razy — nie zapętlamy się
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (tried === build) {
      // druga próba: wyrzuć stare pliki i Service Workera
      await reg?.unregister();
      if ('caches' in window) await Promise.all((await caches.keys()).map(k => caches.delete(k)));
    } else {
      await reg?.update();
      await new Promise(res => setTimeout(res, 1200));
    }
  } catch { /* przeładujemy i tak */ }
  window.location.reload();
  return true;
}

/** Strażnik wersji — montowany raz w App. Pokazuje tylko krótki komunikat podczas przeładowania. */
export const UpdateGuard: React.FC = () => {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Service Worker: nowa wersja przejmuje stronę od razu (autoUpdate), a przeładowanie robi strażnik.
    registerSW({ immediate: true });

    let busy = false;
    const verify = async () => {
      if (busy) return;
      busy = true;
      const b = await serverBuild();
      if (b && b !== APP_BUILD) { setUpdating(true); if (!(await hardRefresh(b))) setUpdating(false); }
      else if (b === APP_BUILD) { try { sessionStorage.removeItem(TRIED_KEY); } catch { /* ignoruj */ } }
      busy = false;
    };
    void verify();
    const onVis = () => { if (document.visibilityState === 'visible') void verify(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', verify);
    const t = window.setInterval(verify, 15 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', verify); window.clearInterval(t); };
  }, []);

  if (!updating) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/80 backdrop-blur-md">
      <div className="px-6 py-4 rounded-2xl bg-head border border-line shadow-2xl text-center">
        <div className="mx-auto mb-2 w-6 h-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
        <p className="text-base font-semibold text-fg">Wczytuję nową wersję…</p>
      </div>
    </div>
  );
};
