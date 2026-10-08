// PATH: src/services/supabaseClient.ts | REQ-ID: TERAPIA-SB-01
// Połączenie z Supabase GRUPY (D018: jedna kopia aplikacji = jedna grupa = własne Supabase).
// Do frontu trafia WYŁĄCZNIE klucz publiczny (publishable/anon) — bezpieczeństwo trzyma RLS w bazie
// (supabase/migrations/0001_init.sql). Klucz serwisowy (service_role / sb_secret_) NIGDY tutaj.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** `supabase` = wersja z prawdziwymi danymi; `demo` = dane fikcyjne w przeglądarce (faza 0). */
export const DATA_MODE: 'supabase' | 'demo' = import.meta.env.VITE_DATA_SOURCE === 'supabase' && url && key ? 'supabase' : 'demo';

/** Logowanie Google włącza się dopiero po skonfigurowaniu dostawcy w Supabase (VITE_AUTH_GOOGLE=1). */
export const GOOGLE_LOGIN = import.meta.env.VITE_AUTH_GOOGLE === '1';

export const supabase: SupabaseClient | null = DATA_MODE === 'supabase'
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'terapia_grupa_auth' },
    })
  : null;

/** Bucket na pliki czatu, zdjęcia z sali i materiały (limit 20 MB/plik w buckecie, 40 MB/osobę w bazie). */
export const FILES_BUCKET = 'group-files';

/** Adres powrotu z linku e-mail / Google = bieżąca strona aplikacji (bez parametrów). */
export function redirectUrl(): string {
  return window.location.origin + window.location.pathname;
}
