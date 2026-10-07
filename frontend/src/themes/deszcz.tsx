// PATH: src/themes/deszcz.tsx | REQ-ID: TERAPIA-WALL-DESZCZ
// Deszcz — mgliste wzgórza i las w oddali, spokojny deszcz.
import React from 'react';
import type { WallpaperTheme } from './types';

const Trees: React.FC<{ y: number; color: string; scale: number; count: number; seed: number }> = ({ y, color, scale, count, seed }) => {
  const items = Array.from({ length: count }, (_, i) => {
    const x = ((i * 97 + seed * 31) % 1200) + ((i * 13) % 20);
    const h = (40 + ((i * 53 + seed) % 40)) * scale;
    return <path key={i} d={`M${x} ${y} L${x - h * 0.28} ${y} L${x} ${y - h} L${x + h * 0.28} ${y} Z`} fill={color} />;
  });
  return <g>{items}</g>;
};

const Scene: React.FC<{ dark: boolean }> = ({ dark }) => {
  const far = dark ? '#1f2a37' : '#cbd5e1';
  const mid = dark ? '#18222e' : '#94a3b8';
  const near = dark ? '#111a24' : '#64748b';
  const mist = dark ? 'rgba(148,163,184,0.10)' : 'rgba(255,255,255,0.55)';
  return (
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
      <path d="M0 520 C 180 460, 360 500, 540 470 C 740 438, 940 490, 1200 455 L1200 800 L0 800 Z" fill={far} opacity="0.7" />
      <Trees y={530} color={far} scale={0.7} count={40} seed={3} />
      <rect x="0" y="470" width="1200" height="120" fill={mist} />
      <path d="M0 610 C 240 570, 480 615, 720 590 C 940 568, 1060 600, 1200 585 L1200 800 L0 800 Z" fill={mid} opacity="0.85" />
      <Trees y={625} color={mid} scale={1} count={30} seed={11} />
      <rect x="0" y="600" width="1200" height="90" fill={mist} />
      <path d="M0 720 C 300 690, 600 735, 900 705 C 1030 692, 1120 712, 1200 700 L1200 800 L0 800 Z" fill={near} />
      {/* kałuża z odbiciem */}
      <ellipse cx="760" cy="760" rx="220" ry="16" fill={dark ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.35)'} />
    </svg>
  );
};

export const deszcz: WallpaperTheme = {
  id: 'deszcz',
  name: 'Deszcz',
  description: 'Mgliste wzgórza i las w oddali, spokojny deszcz.',
  sky: {
    light: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 60%, #94a3b8 100%)',
    dark: 'linear-gradient(180deg, #0b1220 0%, #111827 60%, #0f172a 100%)',
  },
  Scene,
  particles: 'rain',
  particleColors: { light: ['rgba(71,85,105,0.45)'], dark: ['rgba(148,163,184,0.35)'] },
  preview: 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 100%)',
};
