// PATH: src/themes/sakura.tsx | REQ-ID: TERAPIA-WALL-SAKURA
// Wiśnia na śniegu — gałęzie z kwiatami nad zaśnieżonymi wzgórzami, płatki opadają powoli.
import React from 'react';
import type { WallpaperTheme } from './types';

/** Deterministyczne „losowanie”, żeby drzewo wyglądało tak samo przy każdym renderze. */
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const BRANCHES = [
  'M1250 120 C 1120 170, 1010 150, 900 210 C 820 255, 760 250, 690 300',
  'M1050 160 C 1000 230, 950 260, 880 330',
  'M900 210 C 870 150, 830 120, 770 110',
  'M1250 300 C 1150 320, 1080 370, 1000 380 C 950 386, 900 420, 860 460',
  'M1080 370 C 1060 430, 1020 470, 980 520',
  'M-20 80 C 90 110, 170 100, 250 150 C 300 180, 340 175, 400 200',
  'M170 103 C 190 160, 180 200, 150 240',
];

const Scene: React.FC<{ dark: boolean }> = ({ dark }) => {
  const rnd = seeded(7);
  const blossoms: { x: number; y: number; r: number; c: number }[] = [];
  // kwiaty wzdłuż końcówek gałęzi
  const anchors = [[700, 300], [770, 110], [880, 330], [860, 460], [980, 520], [1000, 380], [900, 210], [1050, 160], [400, 200], [150, 240], [250, 150], [1150, 140], [1180, 320]];
  anchors.forEach(([ax, ay]) => {
    for (let i = 0; i < 14; i++) blossoms.push({ x: ax + (rnd() - 0.5) * 120, y: ay + (rnd() - 0.5) * 80, r: 5 + rnd() * 9, c: Math.floor(rnd() * 3) });
  });
  const petal = dark ? ['#f9a8d4', '#fbcfe8', '#f472b6'] : ['#f9a8d4', '#fbcfe8', '#fda4af'];
  const branch = dark ? '#3b2a33' : '#5b4048';
  const snow1 = dark ? '#1e293b' : '#ffffff';
  const snow2 = dark ? '#273449' : '#eef2f7';
  const snow3 = dark ? '#334155' : '#e2e8f0';

  return (
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
      {/* odległe wzgórza w śniegu */}
      <path d="M0 560 C 200 500, 380 530, 560 505 C 760 478, 960 520, 1200 490 L1200 800 L0 800 Z" fill={snow3} opacity="0.9" />
      <path d="M0 620 C 220 580, 420 610, 640 590 C 860 570, 1020 610, 1200 585 L1200 800 L0 800 Z" fill={snow2} />
      <path d="M0 690 C 260 650, 520 700, 760 675 C 960 655, 1080 690, 1200 670 L1200 800 L0 800 Z" fill={snow1} />
      {/* gałęzie */}
      <g fill="none" stroke={branch} strokeLinecap="round" opacity={dark ? 0.9 : 0.75}>
        {BRANCHES.map((d, i) => <path key={i} d={d} strokeWidth={i === 0 || i === 3 || i === 5 ? 9 : 4.5} />)}
      </g>
      {/* kwiaty */}
      <g opacity={dark ? 0.85 : 0.95}>
        {blossoms.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y})`}>
            {[0, 72, 144, 216, 288].map(a => (
              <ellipse key={a} cx="0" cy={-b.r * 0.55} rx={b.r * 0.42} ry={b.r * 0.6} fill={petal[b.c]} transform={`rotate(${a})`} />
            ))}
            <circle r={b.r * 0.18} fill={dark ? '#fde68a' : '#fbbf24'} opacity="0.8" />
          </g>
        ))}
      </g>
    </svg>
  );
};

export const sakura: WallpaperTheme = {
  id: 'sakura',
  name: 'Wiśnia na śniegu',
  description: 'Kwitnąca wiśnia nad zaśnieżonymi wzgórzami, płatki opadają powoli.',
  sky: {
    light: 'linear-gradient(180deg, #fdf2f8 0%, #f1f5f9 55%, #ffffff 100%)',
    dark: 'linear-gradient(180deg, #120f1a 0%, #111827 55%, #0b1220 100%)',
  },
  Scene,
  particles: 'petals',
  particleColors: { light: ['#f9a8d4', '#fbcfe8', '#fda4af'], dark: ['#f9a8d4', '#f472b6', '#fbcfe8'] },
  preview: 'linear-gradient(180deg, #fdf2f8 0%, #fbcfe8 45%, #ffffff 100%)',
};
