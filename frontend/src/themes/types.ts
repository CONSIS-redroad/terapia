// PATH: src/themes/types.ts | REQ-ID: TERAPIA-WALL-01
// Motyw tapety = JEDEN plik w src/themes/ + jedna linia w src/themes/index.ts.
// Scena to warstwa SVG/CSS (bez zdjęć z zewnątrz — działa offline i bez zgód na obce domeny),
// cząsteczki rysuje wspólny silnik (ParticleLayer) wg `particles`.
import type React from 'react';

export type ParticleKind = 'petals' | 'rain' | 'snow' | 'none';

export interface WallpaperTheme {
  id: string;
  name: string;
  description: string;
  /** Niebo / tło — osobno dla trybu jasnego i ciemnego. */
  sky: { light: string; dark: string };
  /** Scena (SVG) — dostaje tryb, żeby dobrać kolory. */
  Scene: React.FC<{ dark: boolean }>;
  particles: ParticleKind;
  /** Kolory cząsteczek (losowane z listy). */
  particleColors: { light: string[]; dark: string[] };
  /** Mały podgląd do okna ustawień (CSS background). */
  preview: string;
}
