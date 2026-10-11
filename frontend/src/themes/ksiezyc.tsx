// PATH: src/themes/ksiezyc.tsx | REQ-ID: TERAPIA-WALL-KSIEZYC
// Księżyc — nocne niebo z gwiazdami, Księżyc ze zdjęcia NASA, co jakiś czas cichy deszcz komet
// (komety i spadające gwiazdy rysuje silnik cząsteczek, rodzaj 'stars' — components/Wallpaper.tsx).
//
// ZDJĘCIE: public/themes/ksiezyc.webp — lokalna, lekka kopia (1024 px, WebP z przezroczystym tłem).
// Źródło: NASA Image and Video Library, NHQ201903160003 „International Space Station transits the Moon”
//   (16.03.2019, fot. NASA/Joel Kowsky), https://images.nasa.gov/details/NHQ201903160003
// Zasady NASA (https://www.nasa.gov/nasa-brand-center/images-and-media/): materiały NASA nie są
//   objęte prawem autorskim w USA — wolno je używać m.in. w aplikacjach bez zgody; nie wolno
//   sugerować poparcia NASA ani używać logo NASA. Przy zdjęciu podajemy: „Zdjęcie: NASA/Joel Kowsky”.
// Kopię trzymamy u siebie (nie linkujemy serwera NASA): CSP pozwala tylko na własną domenę, a tapeta
//   ma działać offline w PWA.
import React from 'react';
import type { WallpaperTheme } from './types';

const MOON = `${import.meta.env.BASE_URL}themes/ksiezyc.webp`;
// środek i promień Księżyca w układzie 1200×800 — przesunięty ku środkowi, żeby był widoczny także na telefonie
const CX = 700, CY = 215, R = 122;

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// DZIEŃ (tryb jasny) — Bartek 11.10 23:39: „księżyc w ciemnym, a słońce w jasnym — taki to ma być motyw”.
// Słońce w miejscu Księżyca, błękitne niebo, chmury płyną powoli (SVG, bez zdjęć), zielone wzgórza. Bez gwiazd i komet.
const CLOUDS = [
  { x: 120, y: 150, s: 1.15, d: 140 }, { x: 860, y: 95, s: 0.85, d: 180 }, { x: 420, y: 300, s: 0.7, d: 160 }, { x: 1010, y: 330, s: 1, d: 200 },
];
const Day: React.FC<{ motion: boolean }> = ({ motion }) => (
  <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
    <defs>
      <radialGradient id="slonce-halo">
        <stop offset="0" stopColor="#fffbe6" stopOpacity="0.95" />
        <stop offset="0.35" stopColor="#fff3c4" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="slonce-tarcza" cx="0.42" cy="0.4">
        <stop offset="0" stopColor="#fffdf2" />
        <stop offset="0.7" stopColor="#ffe9a3" />
        <stop offset="1" stopColor="#ffd56b" />
      </radialGradient>
      <linearGradient id="slonce-mgla" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.6" stopColor="#ffffff" stopOpacity="0.35" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <circle cx={CX} cy={CY} r={R * 2.6} fill="url(#slonce-halo)" />
    <circle cx={CX} cy={CY} r={R * 0.62} fill="url(#slonce-tarcza)" />
    {CLOUDS.map((c, i) => (
      <g key={i} opacity="0.88" className={motion ? 'rr-chmura' : undefined} style={{ ['--rr-chmura-d' as string]: `${c.d}s` } as React.CSSProperties}>
        <g transform={`translate(${c.x} ${c.y}) scale(${c.s})`} fill="#ffffff">
          <ellipse cx="0" cy="0" rx="70" ry="26" /><ellipse cx="-42" cy="8" rx="44" ry="20" /><ellipse cx="46" cy="10" rx="50" ry="19" /><ellipse cx="6" cy="-18" rx="40" ry="24" />
        </g>
      </g>
    ))}
    <path d="M0 600 C 200 560, 400 585, 600 565 C 820 545, 1000 580, 1200 560 L1200 800 L0 800 Z" fill="#9fcfa9" opacity="0.85" />
    <rect x="0" y="540" width="1200" height="100" fill="url(#slonce-mgla)" />
    <path d="M0 690 C 260 660, 520 705, 780 680 C 960 664, 1080 690, 1200 676 L1200 800 L0 800 Z" fill="#7cb98b" />
  </svg>
);

const Scene: React.FC<{ dark: boolean; motion?: boolean }> = ({ dark, motion = true }) => {
  if (!dark) return <Day motion={motion} />;
  const rnd = seeded(29);
  // kilka nieruchomych gwiazd w SVG — niebo zostaje nocne także przy wyłączonych cząsteczkach
  const stars = Array.from({ length: 46 }, () => ({ x: rnd() * 1200, y: Math.pow(rnd(), 1.4) * 520, r: 0.6 + rnd() * 1.3, o: 0.25 + rnd() * 0.5 }));
  const far = dark ? '#121a2e' : '#8f98c6';
  const near = dark ? '#0a101d' : '#7a83b3';
  return (
    <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
      <defs>
        <radialGradient id="ksiezyc-halo">
          <stop offset="0.55" stopColor={dark ? '#c7d2fe' : '#ffffff'} stopOpacity={dark ? 0.22 : 0.45} />
          <stop offset="1" stopColor={dark ? '#c7d2fe' : '#ffffff'} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ksiezyc-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark ? '#94a3b8' : '#ffffff'} stopOpacity="0" />
          <stop offset="0.6" stopColor={dark ? '#94a3b8' : '#ffffff'} stopOpacity={dark ? 0.07 : 0.3} />
          <stop offset="1" stopColor={dark ? '#94a3b8' : '#ffffff'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill={dark ? '#e2e8f0' : '#ffffff'}>
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={dark ? s.o : s.o * 0.6} />)}
      </g>
      {/* poświata, ciemna tarcza (światło popielate) i zdjęcie */}
      <circle cx={CX} cy={CY} r={R * 1.9} fill="url(#ksiezyc-halo)" />
      <circle cx={CX} cy={CY} r={R} fill={dark ? '#161e33' : '#7f8bc2'} opacity={dark ? 0.9 : 0.3} />
      <image href={MOON} x={CX - R} y={CY - R} width={R * 2} height={R * 2} opacity={dark ? 0.96 : 0.9} preserveAspectRatio="xMidYMid meet" />
      {/* odległe wzgórza i mgiełka nad horyzontem */}
      <path d="M0 600 C 200 560, 400 585, 600 565 C 820 545, 1000 580, 1200 560 L1200 800 L0 800 Z" fill={far} opacity={dark ? 0.95 : 0.55} />
      <rect x="0" y="540" width="1200" height="100" fill="url(#ksiezyc-mist)" />
      <path d="M0 690 C 260 660, 520 705, 780 680 C 960 664, 1080 690, 1200 676 L1200 800 L0 800 Z" fill={near} opacity={dark ? 1 : 0.6} />
    </svg>
  );
};

export const ksiezyc: WallpaperTheme = {
  id: 'ksiezyc',
  name: 'Księżyc',
  description: 'Noc z Księżycem (zdjęcie: NASA/Joel Kowsky), gwiazdy i komety; w trybie jasnym dzień ze Słońcem i chmurami.',
  sky: {
    // jasny = DZIEŃ ze Słońcem (jasne niebo — ciemny tekst czytelny); ciemny = noc z Księżycem
    light: 'linear-gradient(180deg, #6fb1ea 0%, #9fcdf3 40%, #d6ecfa 75%, #f1f8fd 100%)',
    dark: 'linear-gradient(180deg, #05070f 0%, #0b1224 55%, #111a30 100%)',
  },
  Scene,
  particles: 'stars',
  // pierwszy kolor = kolor komet
  particleColors: { light: [], dark: ['#f8fafc', '#dbeafe', '#fef3c7'] },
  preview: 'radial-gradient(circle at 68% 34%, #e5e7eb 0 13%, #94a3b8 14%, #1e293b 22%, #05070f 100%)',
};
