// PATH: src/themes/swit.tsx | REQ-ID: TERAPIA-WALL-SWIT
// Świt nad jeziorem — najspokojniejszy, bez opadów (dla osób, którym ruch przeszkadza).
import React from 'react';
import type { WallpaperTheme } from './types';

const Scene: React.FC<{ dark: boolean }> = ({ dark }) => (
  <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
    <circle cx="820" cy="470" r="90" fill={dark ? '#334155' : '#fde68a'} opacity={dark ? 0.5 : 0.75} />
    <path d="M0 500 C 200 455, 420 490, 620 465 C 820 440, 1000 480, 1200 455 L1200 560 L0 560 Z" fill={dark ? '#1e293b' : '#a7b4c8'} opacity="0.8" />
    <rect x="0" y="540" width="1200" height="260" fill={dark ? '#0f172a' : '#cfe0ee'} />
    {[0, 1, 2, 3, 4, 5].map(i => (
      <rect key={i} x={700 - i * 18} y={565 + i * 22} width={240 + i * 36} height="3" rx="1.5" fill={dark ? '#475569' : '#fef3c7'} opacity={0.5 - i * 0.07} />
    ))}
  </svg>
);

export const swit: WallpaperTheme = {
  id: 'swit',
  name: 'Świt nad jeziorem',
  description: 'Ciche jezioro o świcie, bez ruchu w tle.',
  sky: {
    light: 'linear-gradient(180deg, #e0e7ff 0%, #fde2e4 55%, #fef3c7 100%)',
    dark: 'linear-gradient(180deg, #0b1020 0%, #1e1b2e 60%, #1f2937 100%)',
  },
  Scene,
  particles: 'none',
  particleColors: { light: [], dark: [] },
  preview: 'linear-gradient(180deg, #e0e7ff 0%, #fde2e4 55%, #fef3c7 100%)',
};
