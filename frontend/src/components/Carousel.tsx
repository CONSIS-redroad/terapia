// PATH: src/components/Carousel.tsx | REQ-ID: TERAPIA-CAROUSEL-01
// Telefon/tablet: ekrany grupy przesuwane palcem w bok (CSS scroll-snap — natywny gest, bez bibliotek).
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface Slide { id: string; label: string; icon: React.FC<{ className?: string }>; badge?: number; content: React.ReactNode }
export interface CarouselHandle { goTo: (id: string) => void }

export const Carousel = forwardRef<CarouselHandle, { slides: Slide[]; stickyTop: string }>(({ slides, stickyTop }, ref) => {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollToIndex = (i: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    setActive(i);
    // Przeskok po stuknięciu bez animacji: dwa płynne przewijania naraz (w bok + do góry) przerywają się
    // nawzajem i tor staje na sąsiednim ekranie. Gest palcem i tak animuje przeglądarka (scroll-snap).
    el.scrollTo({ left: i * el.clientWidth, behavior: 'auto' });
    const top = root.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) root.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  };

  useImperativeHandle(ref, () => ({
    goTo: (id: string) => { const i = slides.findIndex(s => s.id === id); if (i >= 0) scrollToIndex(i); },
  }));

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // po zmianie liczby ekranów (np. przełączenie na admina) nie zostawać „poza” ostatnim
  useEffect(() => { if (active > slides.length - 1) scrollToIndex(slides.length - 1, false); }, [slides.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={root} className="scroll-mt-20">
      <nav className="sticky z-30 -mx-3 px-3 py-2" style={{ top: stickyTop }} aria-label="Ekrany grupy">
        <div className="flex gap-1 p-1 rounded-2xl bg-head backdrop-blur-2xl border border-line shadow-sm overflow-x-auto no-scrollbar">
          {slides.map((s, i) => (
            <button key={s.id} onClick={() => scrollToIndex(i)} aria-current={active === i ? 'page' : undefined}
              className={`relative flex-1 min-w-[4.5rem] flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors ${active === i ? 'bg-sky-500/20 text-acc' : 'text-mut'}`}>
              <s.icon className="w-4 h-4" />{s.label}
              {!!s.badge && <span className="absolute top-0.5 right-2 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-[10px] leading-4 text-black">{s.badge}</span>}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex justify-center gap-1.5" aria-hidden="true">
          {slides.map((s, i) => <span key={s.id} className={`h-1.5 rounded-full transition-all ${active === i ? 'w-5 bg-sky-400' : 'w-1.5 bg-mut2/50'}`} />)}
        </div>
      </nav>

      <div ref={track} className="flex items-start overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain -mx-3" style={{ scrollbarWidth: 'none' }}>
        {slides.map(s => (
          <section key={s.id} aria-label={s.label} className="w-full shrink-0 snap-start snap-always px-3 min-w-0">
            <div className="rounded-2xl bg-panel backdrop-blur-md border border-line shadow-sm overflow-hidden">
              <h3 className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-fg2 border-b border-line flex items-center gap-2">
                <s.icon className="w-3.5 h-3.5 text-mut" />{s.label}
              </h3>
              {s.content}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
});
Carousel.displayName = 'Carousel';
