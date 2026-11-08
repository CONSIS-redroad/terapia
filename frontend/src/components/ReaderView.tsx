// PATH: src/components/ReaderView.tsx | REQ-ID: TERAPIA-READER-01
// Czytnik materiałów z archiwum (0.11, Bartek 07.11.2026): pełny ekran, papier w kolorze piasku, dwa układy —
// Gazeta (arkusze wg stron oryginału, szpalty od tabletu) i Czytanie (jedna kolumna), pasek postępu, zapamiętanie miejsca,
// wielkość tekstu, szukanie w tekście, rozdziały, obrazy w tekście (PNG/JPG z magazynu grupy).
// Ustawienia i miejsce czytania leżą na urządzeniu (localStorage, try/catch) — opis kluczy: docs/DANE.md.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Headphones, List, Newspaper, Pause, Play, Search, Square, Type, X } from 'lucide-react';
import type { ArchiveBlock, ArchiveItem } from '../services/archive';
import { sectionBlocks } from '../services/archive';
import { pullReading, pushReading } from '../services/readingSync';
import './reader.css';

type Layout = 'gazeta' | 'czytanie';
const K_POS = 'rr_czytnik_v1', K_LAYOUT = 'rr_czytnik_uklad_v1', K_SIZE = 'rr_czytnik_rozmiar_v1', K_VOICE = 'rr_czytnik_lektor_v1';
const RATES = [0.8, 1, 1.2, 1.4];
const SIZES = [0.94, 1, 1.06, 1.18, 1.32];   // mnożnik rem — 5 stopni, środek = domyślny
const POS_MAX = 100;

const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* tryb prywatny */ } };

type Pos = { p: number; at: number };
function loadPos(): Record<string, Pos> {
  try {
    const o = JSON.parse(read(K_POS) || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch { return {}; }
}
export function readingProgress(id: string): number {
  const p = Number(loadPos()[id]?.p);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
}
function savePos(id: string, p: number) {
  const all = loadPos();
  all[id] = { p: Math.round(p * 1000) / 1000, at: Date.now() };
  const keys = Object.keys(all);
  if (keys.length > POS_MAX) keys.sort((a, b) => (all[a]?.at ?? 0) - (all[b]?.at ?? 0)).slice(0, keys.length - POS_MAX).forEach(k => delete all[k]);
  write(K_POS, JSON.stringify(all));
  pushReading(id, p);   // to samo miejsce na koncie — telefon i komputer (0015)
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Sheet = { page?: string; secs: number[] };

// ───────── lektor: synteza mowy wbudowana w przeglądarkę (Web Speech API) — bez zewnętrznych skryptów i serwera ─────────
// Android: głos Google polski, iPhone/iPad: Zosia, Windows: Paulina (Edge: Marek/Zofia online). Czytamy AKAPIT po akapicie —
// długie wypowiedzi Chrome potrafi uciąć po ~15 s, a po akapitach da się podświetlać i przewijać tekst.
const tts = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
function plVoices(): SpeechSynthesisVoice[] {
  if (!tts) return [];
  const v = tts.getVoices().filter(x => /^pl(-|_|$)/i.test(x.lang));
  // naturalne/online i Google wyżej
  return v.sort((a, b) => Number(/natural|online|google|premium|enhanced/i.test(b.name)) - Number(/natural|online|google|premium|enhanced/i.test(a.name)));
}
type VoicePref = { voice?: string; rate?: number };
function loadVoicePref(): VoicePref {
  try {
    const o = JSON.parse(read(K_VOICE) || '{}');
    if (!o || typeof o !== 'object') return {};
    return { voice: typeof o.voice === 'string' ? o.voice : undefined, rate: RATES.includes(o.rate) ? o.rate : undefined };
  } catch { return {}; }
}

export const ReaderView: React.FC<{ item: ArchiveItem; onClose: () => void }> = ({ item, onClose }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>(() => {
    const v = read(K_LAYOUT);
    return v === 'gazeta' || v === 'czytanie' ? v : (window.innerWidth >= 900 ? 'gazeta' : 'czytanie');
  });
  const [size, setSize] = useState<number>(() => { const v = read(K_SIZE), n = v === null || v === '' ? NaN : Number(v); return Number.isInteger(n) && n >= 0 && n < SIZES.length ? n : 2; });
  const [panel, setPanel] = useState<'' | 'szukaj' | 'rozdzialy' | 'aa' | 'lektor'>('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => plVoices());
  const [pref, setPref] = useState<VoicePref>(() => loadVoicePref());
  const [speaking, setSpeaking] = useState<'' | 'play' | 'pause'>('');
  const sayIdx = useRef(-1);
  const prefRef = useRef(pref); prefRef.current = pref;
  const voicesRef = useRef(voices); voicesRef.current = voices;
  const sayGen = useRef(0);   // numer „sesji” czytania — stare zdarzenia onend po zatrzymaniu nie ruszają dalej
  const [query, setQuery] = useState('');
  const [hit, setHit] = useState(0);
  const [hits, setHits] = useState(0);
  const [progress, setProgress] = useState(0);
  const [chapter, setChapter] = useState(-1);
  const [resume, setResume] = useState<number>(() => { const p = readingProgress(item.id); return p > 0.02 && p < 0.97 ? p : 0; });
  const [zoom, setZoom] = useState<{ url: string; caption?: string } | null>(null);
  const keepP = useRef<number | null>(null);
  const lastP = useRef(0);   // ostatnia pozycja — przy zamykaniu ref do przewijania jest już odpięty
  const moved = useRef(false); // zapisujemy miejsce dopiero, gdy czytelnik naprawdę przewinął (samo otwarcie/zamknięcie nie kasuje)
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // miejsce z konta: nowsze niż na tym urządzeniu → „Czytaj dalej” od niego (dopóki czytelnik sam nie przewinął)
  useEffect(() => {
    let live = true;
    void pullReading(item.id).then(r => {
      if (!live || !r || moved.current || r.at <= (Number(loadPos()[item.id]?.at) || 0)) return;
      const all = loadPos(); all[item.id] = { p: r.p, at: r.at }; write(K_POS, JSON.stringify(all));
      setResume(r.p > 0.02 && r.p < 0.97 ? r.p : 0);
    });
    return () => { live = false; };
  }, [item.id]);
  const opener = useRef<HTMLElement | null>(typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);

  // arkusze: nowy arkusz, gdy sekcja zaczyna nową stronę oryginału; bez numerów stron — w Gazecie arkusz na rozdział
  const sheets = useMemo<Sheet[]>(() => {
    const out: Sheet[] = [];
    const anyPage = item.sections.some(s => s.page);
    item.sections.forEach((s, i) => {
      const last = out[out.length - 1];
      const newSheet = !last || (anyPage ? !!s.page && s.page !== last.page : layout === 'gazeta' && !!s.title);
      if (newSheet) out.push({ page: s.page ?? last?.page, secs: [i] }); else last.secs.push(i);
    });
    return out;
  }, [item.sections, layout]);

  const chapters = useMemo(() => item.sections.map((s, i) => ({ i, title: s.title, page: s.page })).filter(c => c.title), [item.sections]);
  const words = useMemo(() => {
    const all = [item.lead ?? '', ...item.sections.flatMap(s => sectionBlocks(s).map(b => ('text' in b ? b.text : 'items' in b ? b.items.join(' ') : '')))].join(' ');
    return all.split(/\s+/).filter(Boolean).length;
  }, [item]);
  const minutes = Math.max(1, Math.round(words / 200));

  // podświetlanie wyników — licznik trafień idzie przez cały render
  const q = query.trim();
  const re = useMemo(() => (q.length >= 2 ? new RegExp(`(${esc(q)})`, 'gi') : null), [q]);
  let n = 0;
  const hl = (text: string): React.ReactNode => {
    if (!re) return text;
    const parts = text.split(re);
    if (parts.length === 1) return text;
    return parts.map((p, i) => (i % 2 === 1 ? <mark key={i} data-hit={n++}>{p}</mark> : p));
  };

  // pozycja = część przewinięta (0…1)
  const measure = useCallback(() => {
    const el = scrollRef.current; if (!el) return 0;
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? el.scrollTop / max : 0;
  }, []);
  const goTo = useCallback((p: number) => {
    const el = scrollRef.current; if (!el) return;
    el.scrollTop = p * (el.scrollHeight - el.clientHeight);
  }, []);

  // ───── lektor ─────
  useEffect(() => {
    if (!tts) return;
    const upd = () => setVoices(plVoices());
    upd(); tts.addEventListener?.('voiceschanged', upd);
    return () => { tts.removeEventListener?.('voiceschanged', upd); sayGen.current++; tts.cancel(); };
  }, []);
  const segs = () => [...(scrollRef.current?.querySelectorAll<HTMLElement>('[data-say]') ?? [])];
  const mark = (i: number) => segs().forEach((e, j) => e.classList.toggle('rd-say', j === i));
  const speakFrom = (i: number, gen: number) => {
    const list = segs(), el = list[i];
    if (!tts || !el || gen !== sayGen.current) { if (gen === sayGen.current) { setSpeaking(''); mark(-1); } return; }
    sayIdx.current = i; mark(i);
    const sc = scrollRef.current;
    if (sc) {
      const r = el.getBoundingClientRect(), c = sc.getBoundingClientRect();
      if (r.top < c.top + 40 || r.bottom > c.bottom - 40) sc.scrollTop += r.top - c.top - sc.clientHeight / 3;
    }
    const u = new SpeechSynthesisUtterance(el.innerText.replace(/\s+/g, ' ').trim());
    u.lang = 'pl-PL';
    const vs = voicesRef.current, pr = prefRef.current;   // refy: wywołania z onend/setTimeout widzą bieżące ustawienia
    const v = vs.find(x => x.name === pr.voice) ?? vs[0];
    if (v) u.voice = v;
    u.rate = pr.rate ?? 1;
    u.onend = () => { if (gen === sayGen.current) speakFrom(i + 1, gen); };
    u.onerror = e => { if (gen === sayGen.current && e.error !== 'interrupted' && e.error !== 'canceled') { setSpeaking(''); mark(-1); } };
    try { tts.speak(u); } catch { if (gen === sayGen.current) { setSpeaking(''); mark(-1); } }
  };
  const firstVisible = () => {
    const sc = scrollRef.current; if (!sc) return 0;
    const top = sc.getBoundingClientRect().top + 8;
    const i = segs().findIndex(e => e.getBoundingClientRect().bottom > top);
    return i < 0 ? 0 : i;
  };
  const play = () => {
    if (!tts) return;
    tts.cancel(); const gen = ++sayGen.current;
    document.querySelectorAll('audio').forEach(a => a.pause());   // nie mówić na nagranie lektury
    const from = speaking === 'pause' && sayIdx.current >= 0 ? sayIdx.current : firstVisible();
    setSpeaking('play'); setPanel(''); speakFrom(from, gen);
  };
  // pauza = zatrzymaj i zapamiętaj akapit (pause() na Androidzie bywa zawodne)
  const pause = () => { sayGen.current++; tts?.cancel(); setSpeaking('pause'); };
  const stop = () => { sayGen.current++; tts?.cancel(); setSpeaking(''); sayIdx.current = -1; mark(-1); };
  const savePref = (p: VoicePref) => { prefRef.current = p; setPref(p); write(K_VOICE, JSON.stringify(p)); if (speaking === 'play') { tts?.cancel(); const gen = ++sayGen.current; setTimeout(() => speakFrom(sayIdx.current, gen), 50); } };

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    let t = 0;
    const onScroll = () => {
      const p = measure(); setProgress(p);
      if (Math.abs(p - lastP.current) > 0.002 && el.scrollTop > 0) moved.current = true;
      lastP.current = p;
      const heads = el.querySelectorAll<HTMLElement>('h2[data-sec]');
      let cur = -1;
      const top0 = el.getBoundingClientRect().top;   // pozycja z ekranu — offsetTop w szpaltach gazety jest liczony od szpalty
      heads.forEach(h => { if (h.getBoundingClientRect().top - top0 <= 90) cur = Number(h.dataset.sec); });
      setChapter(cur);
      if (moved.current) { clearTimeout(t); t = window.setTimeout(() => savePos(item.id, p), 400); }
      if (p > 0.03) setResume(0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { el.removeEventListener('scroll', onScroll); clearTimeout(t); if (moved.current) savePos(item.id, lastP.current); };
  }, [item.id, measure]);

  // zmiana układu / wielkości: zostań w tym samym miejscu tekstu
  const keep = () => { keepP.current = measure(); };
  useLayoutEffect(() => { if (keepP.current !== null) { goTo(keepP.current); keepP.current = null; } }, [layout, size, goTo]);
  const setL = (l: Layout) => { keep(); setLayout(l); write(K_LAYOUT, l); };
  const setS = (s: number) => { keep(); setSize(s); write(K_SIZE, String(s)); };

  // wyniki szukania: licznik + przewinięcie do bieżącego
  useLayoutEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const marks = el.querySelectorAll<HTMLElement>('mark[data-hit]');
    setHits(marks.length);
    marks.forEach(m => m.classList.toggle('is-cur', Number(m.dataset.hit) === hit));
    const cur = marks[hit];
    if (cur) {
      const top = cur.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - el.clientHeight / 3;
      el.scrollTop = Math.max(0, top);
    }
  }, [re, hit, layout, size]);
  useEffect(() => { setHit(0); }, [q]);
  const step = (d: number) => { if (hits) setHit(h => (h + d + hits) % hits); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (zoom) setZoom(null); else if (panel) setPanel(''); else onClose(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setPanel('szukaj'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [panel, zoom, onClose]);

  // fokus: przy otwarciu na pasek, Tab krąży w czytniku, po zamknięciu wraca tam, skąd otwarto (aria-modal)
  useEffect(() => {
    const root = rootRef.current;
    root?.querySelector<HTMLElement>('.rd-bar button')?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !root) return;
      const f = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    const back = opener.current;
    return () => { document.removeEventListener('keydown', trap); if (back && document.contains(back)) back.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (panel === 'szukaj') inputRef.current?.focus({ preventScroll: true }); }, [panel]);
  // React nadpisuje className akapitu przy zmianie układu — przywróć podświetlenie czytanego akapitu
  useEffect(() => { if (speaking) mark(sayIdx.current); });

  // przewijanie strony pod czytnikiem zablokowane, póki czytnik otwarty
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);

  const jump = (i: number) => {
    const el = scrollRef.current, h = el?.querySelector<HTMLElement>(`h2[data-sec="${i}"]`);
    if (el && h) el.scrollTop += h.getBoundingClientRect().top - el.getBoundingClientRect().top - 12;
    setPanel('');
  };

  const block = (b: ArchiveBlock, key: string, first: boolean) => {
    switch (b.t) {
      case 'p': return <p key={key} data-say className={first ? 'rd-first rd-dropcap' : undefined}>{hl(b.text)}</p>;
      case 'quote': return <blockquote key={key} data-say className="rd-quote">{hl(b.text)}</blockquote>;
      case 'callout': return <aside key={key} className="rd-callout">{hl(b.text)}</aside>;
      case 'ul': return <ul key={key}>{b.items.map((x, j) => <li key={j} data-say>{hl(x)}</li>)}</ul>;
      case 'img': return (
        <figure key={key} className="rd-fig">
          <button type="button" onClick={() => setZoom(b)} aria-label={`Powiększ obraz${b.caption ? `: ${b.caption}` : ''}`}>
            <img src={b.url} alt={b.caption ?? ''} loading="lazy" />
          </button>
          {b.caption && <figcaption>{hl(b.caption)}</figcaption>}
        </figure>
      );
    }
  };

  const meta = item.read;
  const head = (page?: string) => (
    <div className="rd-sheet-head" aria-hidden="true">
      <span>{meta?.source ?? item.author ?? ''}</span>
      <span>{page ? `s. ${page}` : ''}</span>
    </div>
  );
  let firstPara = true;

  // portal do <body>: panele karuzeli mają transform, a w nim position:fixed nie zakrywa ekranu
  return createPortal(
    <div ref={rootRef} lang="pl" className={`rd rd--${layout}`} role="dialog" aria-modal="true" aria-label={`Czytnik: ${item.title}`} style={{ ['--rd-size' as string]: `${SIZES[size]}rem` }}>
      <div className="rd-bar">
        <div className="rd-bar-in">
          <button type="button" className="rd-btn" onClick={() => { stop(); onClose(); }} aria-label="Zamknij czytnik"><ArrowLeft /></button>
          <div className="rd-title"><span className="rd-title-name">{item.title}</span><small>{Math.round(progress * 100)}%<span className="rd-min"> · ok. {minutes} min czytania</span></small></div>
          <button type="button" className="rd-btn" aria-expanded={panel === 'szukaj'} onClick={() => setPanel(p => (p === 'szukaj' ? '' : 'szukaj'))} aria-label="Szukaj w tekście"><Search /><span className="rd-btn-label">Szukaj</span></button>
          {chapters.length > 0 && <button type="button" className="rd-btn" aria-expanded={panel === 'rozdzialy'} onClick={() => setPanel(p => (p === 'rozdzialy' ? '' : 'rozdzialy'))} aria-label="Rozdziały"><List /><span className="rd-btn-label">Rozdziały</span></button>}
          {tts && <button type="button" className="rd-btn" aria-expanded={panel === 'lektor'} aria-pressed={speaking === 'play'} onClick={() => setPanel(p => (p === 'lektor' ? '' : 'lektor'))} aria-label="Lektor — czytaj na głos"><Headphones /><span className="rd-btn-label">Lektor</span></button>}
          <button type="button" className="rd-btn" aria-expanded={panel === 'aa'} onClick={() => setPanel(p => (p === 'aa' ? '' : 'aa'))} aria-label="Wielkość tekstu"><Type /><span className="rd-btn-label">Tekst</span></button>
          <button type="button" className="rd-btn" onClick={() => setL(layout === 'gazeta' ? 'czytanie' : 'gazeta')}
            aria-label={layout === 'gazeta' ? 'Przełącz na układ do czytania' : 'Przełącz na układ gazetowy'}>
            {layout === 'gazeta' ? <BookOpen /> : <Newspaper />}<span className="rd-btn-label">{layout === 'gazeta' ? 'Do czytania' : 'Gazeta'}</span>
          </button>
        </div>
        <div className="rd-progress" role="progressbar" aria-label="Postęp czytania" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="rd-pop" hidden={panel !== 'szukaj'}>
          <div className="rd-search">
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj w tekście…" aria-label="Szukana fraza"
              ref={inputRef}
              onKeyDown={e => { if (e.key === 'Enter') step(e.shiftKey ? -1 : 1); }} />
            <span className="rd-count" aria-live="polite">{q.length >= 2 ? (hits ? `${hit + 1} z ${hits}` : 'brak') : ''}</span>
            <button type="button" className="rd-btn" onClick={() => step(-1)} disabled={!hits} aria-label="Poprzedni wynik"><ChevronUp /></button>
            <button type="button" className="rd-btn" onClick={() => step(1)} disabled={!hits} aria-label="Następny wynik"><ChevronDown /></button>
            <button type="button" className="rd-btn" onClick={() => { setQuery(''); setPanel(''); }} aria-label="Zamknij szukanie"><X /></button>
          </div>
        </div>
        <div className="rd-pop" hidden={panel !== 'rozdzialy'}>
          <ol className="rd-toc">
            {chapters.map(c => (
              <li key={c.i}><button type="button" aria-current={chapter === c.i} onClick={() => jump(c.i)}>{c.title}{c.page && <small>s. {c.page}</small>}</button></li>
            ))}
          </ol>
        </div>
        <div className="rd-pop" hidden={panel !== 'lektor'}>
          <div className="rd-say-row">
            {speaking === 'play'
              ? <button type="button" className="rd-btn rd-btn-main" onClick={pause}><Pause />Pauza</button>
              : <button type="button" className="rd-btn rd-btn-main" onClick={play}><Play />{speaking === 'pause' ? 'Wznów' : 'Czytaj na głos'}</button>}
            <button type="button" className="rd-btn" onClick={stop} disabled={!speaking} aria-label="Zatrzymaj lektora"><Square /></button>
            <span className="rd-say-rates" role="group" aria-label="Tempo czytania">
              {RATES.map(r => <button key={r} type="button" className="rd-btn" aria-pressed={(pref.rate ?? 1) === r} onClick={() => savePref({ ...pref, rate: r })}>{String(r).replace('.', ',')}×</button>)}
            </span>
          </div>
          {voices.length > 1 && (
            <label className="rd-say-voice">Głos
              <select value={pref.voice ?? voices[0]?.name ?? ''} onChange={e => savePref({ ...pref, voice: e.target.value })}>
                {voices.map(v => <option key={v.name} value={v.name}>{v.name.replace(/^Microsoft |^Google /, '').replace(/\s*\(.*\)\s*$/, '')}{v.localService === false ? ' (online)' : ''}</option>)}
              </select>
            </label>
          )}
          {!voices.length && <p className="rd-say-note">Na tym urządzeniu nie widać polskiego głosu. Android: Ustawienia → Zamiana tekstu na mowę → język polski. iPhone: Ustawienia → Dostępność → Treść mówiona → Głosy → Polski.</p>}
        </div>
        <div className="rd-pop" hidden={panel !== 'aa'}>
          <div className="rd-sizes" role="group" aria-label="Wielkość tekstu w czytniku">
            {SIZES.map((s, i) => (
              <button key={i} type="button" className="rd-btn" aria-pressed={size === i} onClick={() => setS(i)} aria-label={`Wielkość ${i + 1} z ${SIZES.length}`}>
                <span className="rd-aa" style={{ fontSize: `${0.8 + i * 0.16}rem` }}>A</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rd-scroll" ref={scrollRef} onPointerDown={() => setPanel(p => (p === 'szukaj' ? p : ''))}>
        {resume > 0 && (
          <div className="rd-resume" role="status">
            <span>Ostatnio przeczytane: {Math.round(resume * 100)}%.</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="rd-btn" onClick={() => { goTo(resume); setResume(0); }}>Czytaj dalej</button>
              <button type="button" className="rd-btn" onClick={() => setResume(0)}>Od początku</button>
            </span>
          </div>
        )}
        <div className="rd-doc">
          <section className="rd-sheet rd-cover">
            {head(sheets[0]?.page)}
            {meta?.epigraph && <p className="rd-epigraph" data-say>{hl(meta.epigraph)}</p>}
            <h1 data-say>{hl(item.title)}</h1>
            {item.author && <p className="rd-author" data-say>{hl(item.author)}</p>}
            {!!meta?.agenda?.length && <ul className="rd-agenda">{meta.agenda.map((a, i) => <li key={i}>{hl(a)}</li>)}</ul>}
            {item.lead && <p className="rd-lead" data-say style={{ textAlign: 'left', marginTop: '1em' }}>{hl(item.lead)}</p>}
          </section>

          {sheets.map((sh, si) => (
            <section key={si} className="rd-sheet">
              {head(sh.page)}
              <div className="rd-cols">
                {sh.secs.map(i => {
                  const s = item.sections[i];
                  return (
                    <React.Fragment key={i}>
                      {s.title && <h2 data-sec={i} data-say>{hl(s.title)}</h2>}
                      {sectionBlocks(s).map((b, j) => {
                        const first = firstPara && b.t === 'p';
                        if (first) firstPara = false;
                        return block(b, `${i}-${j}`, first && layout === 'gazeta');
                      })}
                    </React.Fragment>
                  );
                })}
                {si === sheets.length - 1 && !!meta?.endnote?.length && (
                  <div className="rd-end">{meta.endnote.map((e, i) => <p key={i}>{hl(e)}</p>)}</div>
                )}
              </div>
            </section>
          ))}
          <p className="rd-fin">— koniec —</p>
        </div>
      </div>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Powiększony obraz" onClick={() => setZoom(null)}
          className="fixed inset-0 z-[70] bg-bg/95 flex items-center justify-center p-4">
          <button type="button" onClick={() => setZoom(null)} aria-label="Zamknij"
            className="tap absolute top-3 right-3 min-w-11 h-11 inline-flex items-center justify-center rounded-full bg-panel border border-line text-fg cursor-pointer">
            <X className="w-6 h-6" />
          </button>
          <img src={zoom.url} alt={zoom.caption ?? ''} className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>,
    document.body,
  );
};
