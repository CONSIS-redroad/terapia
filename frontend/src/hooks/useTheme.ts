// PATH: src/hooks/useTheme.ts | REQ-ID: TERAPIA-THEME-01
// Tryb: 'system' (jak telefon/komputer) → 'light' → 'dark'. Atrybut data-theme na <html>.
// Pierwsze ustawienie robi skrypt w index.html (bez mignięcia złym kolorem).
import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'terapia_theme_v1';

function read(): ThemeMode {
  try { const v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark') return v; } catch { /* ignoruj */ }
  return 'system';
}

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#070b10' : '#f4f6f8');
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(read);

  useEffect(() => {
    apply(mode);
    try { if (mode === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch { /* ignoruj */ }
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => apply('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [mode]);

  const cycle = () => setMode(m => (m === 'system' ? 'light' : m === 'light' ? 'dark' : 'system'));
  return { mode, cycle };
}
