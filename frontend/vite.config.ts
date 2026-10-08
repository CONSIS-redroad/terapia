import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';

// Wersja = package.json, budowa = znacznik czasu builda (UTC). Każde wydanie ma INNY numer budowy
// bez ręcznego podbijania — strażnik w aplikacji (services/appUpdate.tsx) porównuje go z version.json.
const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version as string;
// Wersja z prawdziwymi danymi (faza 2) budowana do podkatalogu /grupa/ obok demo.
const LIVE = process.env.VITE_DATA_SOURCE === 'supabase';
const APP_BUILD = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13); // np. 20261008T1512


export default defineConfig(() => {
  return {
    base: './',
    define: { __APP_VERSION__: JSON.stringify(APP_VERSION), __APP_BUILD__: JSON.stringify(APP_BUILD) },
    plugins: [
      {
        name: 'terapia-version-json',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION, build: APP_BUILD }) });
        },
      },
      {
        // wersja z bazą (/grupa/) bez dopisku „(demo)” w tytule i opisie strony
        name: 'terapia-live-html',
        transformIndexHtml: (html: string) => (LIVE ? html.replace(/ \(demo\)/g, '').replace(/ Wersja demo z danymi przykładowymi\./g, '') : html),
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false, // rejestruje strażnik wersji (UpdateGuard)
        // demo (katalog główny) NIE może podawać swojej strony zamiast /grupa/ — inaczej SW demo przejmie wersję z bazą
        workbox: { globIgnores: ['version.json'], navigateFallbackDenylist: LIVE ? [] : [/\/grupa\//], cleanupOutdatedCaches: true, clientsClaim: true, skipWaiting: true },
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: './',
          name: LIVE ? 'TERAPIA — grupa' : 'TERAPIA — panel grupy (demo)',
          short_name: 'TERAPIA',
          description: LIVE ? 'Panel grupy terapeutycznej.' : 'Panel grupy terapeutycznej (demo).',
          theme_color: '#0f172a',
          background_color: '#070b10',
          display: 'standalone',
          start_url: './',
          scope: './',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
