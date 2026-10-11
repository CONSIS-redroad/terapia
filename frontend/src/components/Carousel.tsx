// PATH: src/components/Carousel.tsx | REQ-ID: TERAPIA-CAROUSEL-01
// Telefon/tablet: ekrany grupy przesuwane palcem w bok (CSS scroll-snap — natywny gest, bez bibliotek).
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// full = ekran na całą wysokość (czat): strona stoi, przewija się tylko jego zawartość (Bartek 11.10: „w trybie czat przewijanie ma być czatu”)
export interface Slide { id: string; label: string; icon: React.FC<{ className?: string }>; badge?: number; full?: boolean; content: React.ReactNode }
export interface CarouselHandle { goTo: (id: string) => void }

export const Carousel = forwardRef<CarouselHandle, { slides: Slide[] }>(({ slides }, ref) => {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // dolny pasek dopiero gdy karuzela jest na ekranie — na ekranie startowym nie zasłania „Przewiń”
  const [navOn, setNavOn] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNavOn(e.isIntersecting), { rootMargin: '0px 0px -35% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

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

  // Ekran „full” (czat) aktywny → karuzela dosuwa się pod pasek u góry i blokujemy przewijanie STRONY;
  // przewija się tylko lista wiadomości. Inny ekran → strona znów się przewija.
  const fullActive = !!slides[active]?.full;
  const [trackH, setTrackH] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = track.current?.children[active] as HTMLElement | undefined;
    if (!el) return;
    const upd = () => setTrackH(el.offsetHeight);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, slides.length]);
  useEffect(() => {
    if (!fullActive) return;
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = 'hidden';
    html.classList.add('rr-czat');
    // przypnij czat pod paskiem u góry — także po wysunięciu klawiatury (przeglądarka przewija wtedy stronę do pola)
    const pin = () => root.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    pin();
    const vv = window.visualViewport;
    const onVv = () => requestAnimationFrame(pin);
    vv?.addEventListener('resize', onVv);
    window.addEventListener('scroll', onVv, { passive: true });
    return () => {
      html.style.overflow = prev; html.classList.remove('rr-czat', 'rr-typing');
      vv?.removeEventListener('resize', onVv); window.removeEventListener('scroll', onVv);
    };
  }, [fullActive]);

  // po zmianie liczby ekranów (np. przełączenie na admina) nie zostawać „poza” ostatnim
  useEffect(() => { if (active > slides.length - 1) scrollToIndex(slides.length - 1, false); }, [slides.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={root} className="pb-24" style={{ scrollMarginTop: 'var(--rr-top)' }}>
      {/* dolny pasek ekranów — jak w aplikacjach: kciuk sięga, zawsze widoczny */}
      <nav data-rr-nav className={`fixed bottom-0 inset-x-0 z-40 transition-transform duration-300 ${navOn ? 'translate-y-0' : 'translate-y-full'}`} aria-hidden={!navOn}>
      <div className="px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-head backdrop-blur-2xl border-t border-line shadow-[0_-8px_24px_rgba(0,0,0,0.12)]" role="navigation" aria-label="Ekrany grupy">
        <div className="flex max-w-xl mx-auto">
          {slides.map((s, i) => (
            <button key={s.id} onClick={() => scrollToIndex(i)} aria-current={active === i ? 'page' : undefined}
              className={`tap relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${active === i ? 'text-acc' : 'text-mut'}`}>
              <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${active === i ? 'bg-sky-500/20' : ''}`}><s.icon className="w-5 h-5" /></span>
              <span data-rr-nav-label>{s.label}</span>
              {!!s.badge && <span className="absolute top-0 right-[calc(50%-1.6rem)] min-w-5 h-5 px-1 rounded-full bg-amber-400 text-xs leading-5 text-black">{s.badge}</span>}
            </button>
          ))}
        </div>
      </div>
      </nav>

      <div ref={track} className="flex items-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar overscroll-x-contain -mx-3" style={{ scrollbarWidth: 'none', height: trackH }}>
        {slides.map(s => (
          <section key={s.id} aria-label={s.label} className={`w-full shrink-0 snap-start snap-always px-3 min-w-0 ${s.full ? 'h-[calc(var(--rr-vh,100dvh)-var(--rr-top)-var(--rr-nav)-env(safe-area-inset-bottom))]' : ''}`}>
            <div className={`rounded-2xl bg-panel backdrop-blur-md border border-line shadow-sm overflow-hidden ${s.full ? 'h-full flex flex-col' : ''}`}>
              <h2 {...(s.full ? { 'data-rr-full-title': '' } : {})} className={`px-4 text-xl font-extrabold tracking-tight text-fg flex items-center gap-2 ${s.full ? 'pt-3 pb-1 shrink-0' : 'pt-4 pb-2'}`}>
                <s.icon className="w-5 h-5 text-acc" />{s.label}
              </h2>
              {s.full ? <div className="flex-1 min-h-0">{s.content}</div> : s.content}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
});
Carousel.displayName = 'Carousel';
