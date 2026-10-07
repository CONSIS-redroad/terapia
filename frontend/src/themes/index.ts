// PATH: src/themes/index.ts | REQ-ID: TERAPIA-WALL-REG
// REJESTR MOTYWÓW TAPETY. Nowy motyw = nowy plik obok (wzór: sakura.tsx) + jedna linia w THEMES.
import { sakura } from './sakura';
import { deszcz } from './deszcz';
import { swit } from './swit';
import type { WallpaperTheme } from './types';

export const THEMES: WallpaperTheme[] = [sakura, deszcz, swit];
export const DEFAULT_THEME_ID = 'sakura';

export function themeById(id: string): WallpaperTheme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

export type { WallpaperTheme, ParticleKind } from './types';
