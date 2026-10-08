// PATH: src/components/Wallpaper.tsx | REQ-ID: TERAPIA-WALL-BG
// Tło: niebo + scena motywu + cząsteczki. Ruch jak w Luna2: paralaksa (mysz, przewijanie)
// i obracanie przeciąganiem po pustym tle (na telefonie — tylko przewijanie, żeby nie psuć gestów).
import React, { useEffect, useRef, useState } from 'react';
import { themeById } from '../themes';
import type { ParticleKind } from '../themes';
import type { WallpaperSettings } from '../hooks/useWallpaper';

/* ---------- ruch (z Luna2: useParallax3D + useSpace3DRotation, scalone i z ograniczeniem) ---------- */
function useMotion(enabled: boolean) {
  const [state, setState] = useState({ scrollY: 0, mx: 0, my: 0, rotX: 0, rotY: 0, dragging: false });
  const drag = useRef({ x: 0, y: 0, rx: 0, ry: 0, on: false });

  useEffect(() => {
    if (!enabled) { setState({ scrollY: 0, mx: 0, my: 0, rotX: 0, rotY: 0, dragging: false }); return; }
    let raf = 0;
    const set = (patch: Partial<typeof state>) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setState(s => ({ ...s, ...patch })));
    };
    const onScroll = () => set({ scrollY: window.scrollY });
    const onMove = (e: MouseEvent) => {
      const patch: Partial<typeof state> = { mx: (e.clientX / window.innerWidth - 0.5) * 14, my: (e.clientY / window.innerHeight - 0.5) * 14 };
      if (drag.current.on) {
        patch.rotY = Math.max(-18, Math.min(18, drag.current.ry + (e.clientX - drag.current.x) * 0.06));
        patch.rotX = Math.max(-12, Math.min(12, drag.current.rx - (e.clientY - drag.current.y) * 0.06));
      }
      set(patch);
    };
    const onDown = (e: MouseEvent) => {
      // obracamy chwytając tło albo nagłówek strony — nie panel (ma własne przeciąganie), nie przycisk, nie pole tekstowe
      if ((e.target as HTMLElement)?.closest('[draggable="true"], header, button, input, textarea, a, select, label, [role="dialog"]')) return;
      e.preventDefault(); // bez zaznaczania tekstu podczas obracania
      setState(s => { drag.current = { x: e.clientX, y: e.clientY, rx: s.rotX, ry: s.rotY, on: true }; return { ...s, dragging: true }; });
    };
    const onUp = () => { if (drag.current.on) { drag.current.on = false; set({ dragging: false }); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
    };
  }, [enabled]);

  return state;
}

/* ---------- gwiazdy + komety (motyw Księżyc) ---------- */
// Gwiazdy migoczą; co 8–20 s pojedyncza spadająca gwiazda, co 20–60 s cichy deszcz 3–8 komet (2–4 s).
// Bez ruchu (ustawienie „Ruch tła: wył.” albo prefers-reduced-motion) — gwiazdy rysowane raz, bez komet i bez pętli.
// Test / pokaz: window.dispatchEvent(new Event('rr:komety')) — deszcz komet od razu.
// Ta sama logika (w czystym JS) jest w Dzienniczku: js/theme.js → starfield().
type Comet = { x: number; y: number; vx: number; vy: number; len: number; w: number; life: number; age: number; delay: number; big: boolean };

function starfield(cvs: HTMLCanvasElement, ctx: CanvasRenderingContext2D, colors: string[], density: number, animate: boolean) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  const area = Math.min(1.6, (window.innerWidth * window.innerHeight) / (1280 * 800));
  const n = Math.max(20, Math.round(70 * density * Math.max(0.45, area)));
  let stars: { x: number; y: number; r: number; o: number; ph: number; sp: number; c: string }[] = [];
  const place = () => {
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.pow(Math.random(), 1.3) * h * 0.8, r: 0.5 + Math.random() * 1.1,
      o: 0.35 + Math.random() * 0.55, ph: Math.random() * Math.PI * 2, sp: 0.6 + Math.random() * 1.6,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
  };
  const resize = () => {
    w = window.innerWidth; h = window.innerHeight;
    cvs.width = w * dpr; cvs.height = h * dpr;
    cvs.style.width = `${w}px`; cvs.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    place();
    if (!animate) draw(0);
  };
  const comets: Comet[] = [];
  const spawn = (big: boolean, delay: number, angle: number) => {
    const speed = big ? 420 + Math.random() * 220 : 700 + Math.random() * 300; // px/s
    comets.push({
      x: w * (0.25 + Math.random() * 0.95), y: -20 + Math.random() * h * 0.4,
      vx: -Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      len: big ? 120 + Math.random() * 110 : 60 + Math.random() * 50, w: big ? 1.4 + Math.random() * 0.9 : 1,
      life: big ? 1.4 + Math.random() * 0.9 : 0.7 + Math.random() * 0.4, age: 0, delay, big,
    });
  };
  const shower = () => {
    const count = Math.max(3, Math.min(8, Math.round((3 + Math.random() * 5) * Math.min(1, density + 0.2))));
    const angle = (24 + Math.random() * 12) * Math.PI / 180; // jeden kierunek dla całej serii
    for (let i = 0; i < count; i++) spawn(true, Math.random() * 2.6, angle + (Math.random() - 0.5) * 0.06);
  };
  const draw = (time: number) => {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      ctx.globalAlpha = animate ? s.o * (0.6 + 0.4 * Math.sin(time * s.sp + s.ph)) : s.o;
      ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const c of comets) {
      if (c.delay > 0) continue;
      const k = c.age / c.life, fade = Math.min(1, k * 5, (1 - k) * 3) * (c.big ? 0.75 : 0.55);
      const sp = Math.hypot(c.vx, c.vy), tx = c.x - (c.vx / sp) * c.len, ty = c.y - (c.vy / sp) * c.len;
      const g = ctx.createLinearGradient(c.x, c.y, tx, ty);
      g.addColorStop(0, colors[0]); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = fade; ctx.strokeStyle = g; ctx.lineWidth = c.w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke();
      if (c.big) { ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.arc(c.x, c.y, c.w * 1.1, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  };

  resize();
  window.addEventListener('resize', resize);
  if (!animate) return () => { window.removeEventListener('resize', resize); ctx.clearRect(0, 0, w, h); };

  let raf = 0, last = 0, clock = 0;
  let nextStar = 8 + Math.random() * 12, nextShower = 20 + Math.random() * 40;
  const frame = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; // po powrocie karty bez „skoku”
    last = now; clock += dt;
    if ((nextStar -= dt) <= 0) { spawn(false, 0, (20 + Math.random() * 25) * Math.PI / 180); nextStar = 8 + Math.random() * 12; }
    if ((nextShower -= dt) <= 0) { shower(); nextShower = 20 + Math.random() * 40; }
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      if (c.delay > 0) { c.delay -= dt; continue; }
      c.age += dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.age >= c.life) comets.splice(i, 1);
    }
    draw(clock);
    raf = requestAnimationFrame(frame);
  };
  const onVis = () => { cancelAnimationFrame(raf); last = 0; if (!document.hidden) raf = requestAnimationFrame(frame); };
  const onShower = () => { shower(); nextShower = 20 + Math.random() * 40; };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('rr:komety', onShower);
  if (!document.hidden) raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('rr:komety', onShower);
    ctx.clearRect(0, 0, w, h);
  };
}

/* ---------- cząsteczki ---------- */
// colorsKey (string), nie tablica — tło renderuje się przy każdym ruchu myszy, a nowa tablica restartowałaby animację.
const ParticleLayer: React.FC<{ kind: ParticleKind; colorsKey: string; density: number; motion: boolean }> = ({ kind, colorsKey, density, motion }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    const ctx = cvs?.getContext('2d');
    const colors = colorsKey ? colorsKey.split('|') : [];
    if (!cvs || !ctx || kind === 'none' || colors.length === 0) return;
    if (kind === 'stars') {
      let reduced = false;
      try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* brak matchMedia */ }
      return starfield(cvs, ctx, colors, density, motion && !reduced);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      cvs.width = w * dpr; cvs.height = h * dpr;
      cvs.style.width = `${w}px`; cvs.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const base = kind === 'rain' ? 110 : kind === 'snow' ? 60 : 26;
    const area = Math.min(1.6, (window.innerWidth * window.innerHeight) / (1280 * 800));
    const n = Math.max(6, Math.round(base * density * Math.max(0.45, area)));
    const pick = () => colors[Math.floor(Math.random() * colors.length)];
    const ps = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      s: kind === 'rain' ? 6 + Math.random() * 6 : kind === 'snow' ? 0.3 + Math.random() * 0.6 : 0.35 + Math.random() * 0.55,
      r: kind === 'rain' ? 10 + Math.random() * 14 : kind === 'snow' ? 1 + Math.random() * 2 : 4 + Math.random() * 5,
      a: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.02, sway: 0.4 + Math.random() * 0.8,
      c: pick(), o: 0.55 + Math.random() * 0.4,
    }));

    let raf = 0, t = 0;
    const frame = () => {
      t += 1;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        if (kind === 'rain') {
          p.y += p.s; p.x += p.s * 0.18;
          if (p.y > h) { p.y = -p.r; p.x = Math.random() * w; }
          ctx.strokeStyle = p.c; ctx.lineWidth = 1; ctx.globalAlpha = p.o;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.r * 0.18, p.y - p.r); ctx.stroke();
        } else if (kind === 'snow') {
          p.y += p.s; p.x += Math.sin((t + p.a * 50) / 60) * 0.3;
          if (p.y > h + 4) { p.y = -4; p.x = Math.random() * w; }
          ctx.fillStyle = p.c; ctx.globalAlpha = p.o;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        } else {
          // płatek: wolne opadanie, kołysanie i obrót
          p.y += p.s; p.x += Math.sin((t + p.a * 80) / 90) * p.sway + 0.15; p.a += p.spin;
          if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
          if (p.x > w + 10) p.x = -10;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
          ctx.fillStyle = p.c; ctx.globalAlpha = p.o;
          ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); };
  }, [kind, colorsKey, density, motion]);

  return <canvas ref={ref} className="fixed inset-0 pointer-events-none" aria-hidden="true" />;
};

/* ---------- tło ---------- */
export const Wallpaper: React.FC<{ settings: WallpaperSettings; dark: boolean }> = ({ settings, dark }) => {
  const theme = themeById(settings.themeId);
  const m = useMotion(settings.motion);
  const colors = dark ? theme.particleColors.dark : theme.particleColors.light;
  const { Scene } = theme;
  const lift = Math.min(60, m.scrollY * 0.06);

  return (
    <div className={`fixed inset-0 z-0 overflow-hidden ${m.dragging ? 'cursor-grabbing' : ''}`} style={{ background: dark ? theme.sky.dark : theme.sky.light, perspective: '1000px' }}>
      <div
        className="absolute -inset-16 transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: `translate3d(${m.mx + m.rotY * 3}px, ${m.my - m.rotX * 3 - lift}px, 0) rotateX(${m.rotX * 0.35}deg) rotateY(${m.rotY * 0.35}deg) scale(1.06)` }}
      >
        <Scene dark={dark} />
      </div>
      {settings.particles && <ParticleLayer kind={theme.particles} colorsKey={colors.join('|')} density={settings.density} motion={settings.motion} />}
      <div className="absolute inset-0 pointer-events-none" style={{ background: dark ? `rgba(7,11,16,${settings.veil})` : `rgba(255,255,255,${settings.veil})` }} />
    </div>
  );
};
