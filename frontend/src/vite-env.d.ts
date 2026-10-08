/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTH_GOOGLE?: string;
}
