// PATH: src/components/LessonCard.tsx | REQ-ID: TERAPIA-LESSON-01
// Karta zajęć (Bartek 08.10): bez „Dołącz online”. Najpierw PRACA DOMOWA (co oddać / co zadano),
// potem STRESZCZENIE (dla nieobecnych) z „Więcej” — rozwinięcie i zdjęcia z sali (tablica), które dodaje admin.
import React, { useRef, useState } from 'react';
import { CalendarDays, Camera, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, MapPin, Pencil, Video, X } from 'lucide-react';
import type { Homework, Material, Meeting } from '../types/group';
import { fmtDayLong, fmtShort, fmtTime, isPast } from '../services/format';
import { MaterialRow } from './panels';

const card = 'rounded-xl bg-surf border border-line';

/** „za tydzień”, „za 2 tygodnie”, „dziś”, „minęło” — liczone w dniach kalendarzowych. */
export function dueLabel(iso: string): string {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(iso); b.setHours(0, 0, 0, 0);
  const d = Math.round((b.getTime() - a.getTime()) / 864e5);
  if (d < 0) return 'termin minął';
  if (d === 0) return 'dziś';
  if (d === 1) return 'jutro';
  if (d % 7 === 0) return d === 7 ? 'za tydzień' : `za ${d / 7} tygodnie`;
  return `za ${d} dni`;
}

function shrinkPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('To nie jest zdjęcie.')); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Nie udało się wczytać zdjęcia.')); };
    img.src = url;
  });
}

interface Props {
  meeting: Meeting; index: number; total: number; isNext: boolean;
  meetings: Meeting[]; materials: Material[]; homework: Homework[];
  done: Record<string, boolean>; onToggleDone: (id: string) => void;
  isAdmin: boolean; onUpdate: (id: string, patch: Partial<Meeting>) => void;
  onPrev?: () => void; onNext?: () => void; onOpenMeeting: (id: string) => void;
}

export const LessonCard: React.FC<Props> = ({ meeting: m, index, total, isNext, meetings, materials, homework, done, onToggleDone, isAdmin, onUpdate, onPrev, onNext, onOpenMeeting }) => {
  const [more, setMore] = useState(false);
  const [edit, setEdit] = useState(false);
  const [summary, setSummary] = useState(m.summary ?? '');
  const [details, setDetails] = useState(m.details ?? '');
  const [zoom, setZoom] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const past = isPast(m.date, m.durationMin);
  const mats = materials.filter(x => x.meetingId === m.id);
  const due = homework.filter(h => h.dueAt === m.id);   // do oddania/omówienia NA tych zajęciach
  const given = homework.filter(h => h.givenAt === m.id); // zadane NA tych zajęciach
  const meetingOf = (id: string) => meetings.find(x => x.id === id);
  const noOf = (id: string) => meetings.findIndex(x => x.id === id) + 1;

  const startEdit = () => { setSummary(m.summary ?? ''); setDetails(m.details ?? ''); setEdit(true); };
  const save = () => { onUpdate(m.id, { summary: summary.trim() || undefined, details: details.trim() || undefined }); setEdit(false); };
  const addPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { setErr(''); const url = await shrinkPhoto(f); onUpdate(m.id, { photos: [...(m.photos ?? []), { url, caption: `Zdjęcie z zajęć ${index + 1}` }] }); setMore(true); }
    catch (x) { setErr((x as Error).message); }
  };

  const hwItem = (h: Homework, mode: 'due' | 'given') => {
    const target = meetingOf(mode === 'due' ? h.givenAt : h.dueAt);
    return (
      <li key={h.id} className={`${card} p-3 flex gap-3`}>
        <button onClick={() => onToggleDone(h.id)} aria-pressed={!!done[h.id]} aria-label={done[h.id] ? 'Oznaczone jako zrobione' : 'Oznacz jako zrobione'}
          className={`tap shrink-0 w-7 h-7 mt-0.5 rounded-lg border-2 flex items-center justify-center cursor-pointer ${done[h.id] ? 'bg-emerald-500/80 border-emerald-500 text-white' : 'border-line'}`}>
          {done[h.id] && '✓'}
        </button>
        <span className="flex-1 min-w-0">
          <span className={`block text-base lg:text-sm font-semibold ${done[h.id] ? 'line-through text-mut' : 'text-fg'}`}>{h.title}</span>
          <span className="block text-sm lg:text-xs text-fg2 mt-0.5">{h.description}</span>
          {target && (
            <button onClick={() => onOpenMeeting(target.id)} className="mt-1.5 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-acc border border-sky-400/25 cursor-pointer">
              <CalendarDays className="w-3 h-3" />
              {mode === 'given' ? `na zajęcia ${noOf(target.id)} · ${fmtShort(target.date)} · ${dueLabel(target.date)}` : `zadane na zajęciach ${noOf(target.id)} (${fmtShort(target.date)})`}
            </button>
          )}
        </span>
      </li>
    );
  };

  return (
    <div className={`${card} min-w-0 p-4 order-first md:order-none ${isNext && !past ? 'bg-gradient-to-br from-sky-500/[0.08] to-transparent' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-acc font-semibold">Zajęcia {index + 1} z {total}{isNext && !past ? ' · najbliższe' : past ? ' · odbyte' : ''}</span>
        <span className="ml-auto flex gap-1">
          <button disabled={!onPrev} onClick={onPrev} className="tap w-10 flex items-center justify-center rounded-full hover:bg-surf2 text-mut disabled:opacity-30 cursor-pointer" aria-label="Poprzednie zajęcia"><ChevronLeft className="w-5 h-5" /></button>
          <button disabled={!onNext} onClick={onNext} className="tap w-10 flex items-center justify-center rounded-full hover:bg-surf2 text-mut disabled:opacity-30 cursor-pointer" aria-label="Następne zajęcia"><ChevronRight className="w-5 h-5" /></button>
        </span>
      </div>
      <h4 className="mt-1 text-xl font-bold text-fg leading-snug">{m.topic}</h4>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm lg:text-xs text-fg2">
        <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-mut" />{fmtDayLong(m.date)}, {fmtTime(m.date)}</span>
        <span className="flex items-center gap-1.5">{m.place === 'online' ? <Video className="w-4 h-4 text-mut" /> : <MapPin className="w-4 h-4 text-mut" />}{m.place}</span>
      </div>

      {/* PRACA DOMOWA — najważniejsze */}
      {(due.length > 0 || given.length > 0) && (
        <section className="mt-4">
          <h5 className="flex items-center gap-1.5 text-sm font-bold text-warn"><ClipboardCheck className="w-4 h-4" />Praca domowa</h5>
          {due.length > 0 && (
            <>
              <p className="mt-2 text-xs uppercase tracking-wider text-mut font-semibold">{past ? 'Była do oddania na te zajęcia' : 'Do zrobienia na te zajęcia'}</p>
              <ul className="mt-1.5 space-y-2">{due.map(h => hwItem(h, 'due'))}</ul>
            </>
          )}
          {given.length > 0 && (
            <>
              <p className="mt-3 text-xs uppercase tracking-wider text-mut font-semibold">Zadane na tych zajęciach</p>
              <ul className="mt-1.5 space-y-2">{given.map(h => hwItem(h, 'given'))}</ul>
            </>
          )}
        </section>
      )}

      {/* STRESZCZENIE — dla nieobecnych */}
      <section className="mt-4">
        <div className="flex items-center gap-2">
          <h5 className="text-sm font-bold text-fg">{past ? 'Streszczenie zajęć' : 'Czego będą dotyczyć'}</h5>
          {isAdmin && !edit && (
            <button onClick={startEdit} className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-line text-fg2 hover:bg-surf2 cursor-pointer"><Pencil className="w-3.5 h-3.5" />Edytuj</button>
          )}
        </div>
        {edit ? (
          <div className="mt-2 space-y-2">
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} maxLength={300} placeholder="Krótko: co było przedmiotem zajęć"
              className="w-full bg-surf border border-line rounded-lg px-3 py-2 text-base lg:text-sm text-fg focus:outline-none focus:border-sky-400/40" />
            <textarea value={details} onChange={e => setDetails(e.target.value)} rows={5} maxLength={3000} placeholder="Więcej: przebieg, ćwiczenia, wnioski — dla nieobecnych"
              className="w-full bg-surf border border-line rounded-lg px-3 py-2 text-base lg:text-sm text-fg focus:outline-none focus:border-sky-400/40" />
            <div className="flex gap-2">
              <button onClick={save} className="tap px-4 py-2 rounded-full bg-sky-500/25 text-acc border border-sky-400/40 text-sm font-semibold cursor-pointer">Zapisz</button>
              <button onClick={() => setEdit(false)} className="tap px-4 py-2 rounded-full border border-line text-fg2 text-sm cursor-pointer">Anuluj</button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-base lg:text-sm text-fg2 leading-relaxed">
              {m.summary ?? (past ? 'Prowadząca jeszcze nie dodała streszczenia.' : 'Streszczenie pojawi się po zajęciach.')}
            </p>
            {(m.details || (m.photos && m.photos.length > 0) || isAdmin) && (
              <button onClick={() => setMore(v => !v)} aria-expanded={more}
                className="tap mt-2 flex items-center gap-1 text-sm font-semibold text-acc cursor-pointer">
                {more ? 'Mniej' : 'Więcej'}{m.photos?.length ? ` · zdjęcia: ${m.photos.length}` : ''}
                <ChevronDown className={`w-4 h-4 transition-transform ${more ? 'rotate-180' : ''}`} />
              </button>
            )}
            {more && (
              <div className="mt-2 space-y-3">
                {m.details && <p className="text-base lg:text-sm text-fg2 leading-relaxed whitespace-pre-line">{m.details}</p>}
                {m.photos && m.photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {m.photos.map((ph, i) => (
                      <figure key={i} className="relative">
                        <button onClick={() => setZoom(ph.url)} className="block w-full cursor-zoom-in" aria-label={`Powiększ: ${ph.caption}`}>
                          <img src={ph.url} alt={ph.caption} className="w-full aspect-[8/5] object-cover rounded-lg border border-line" loading="lazy" />
                        </button>
                        <figcaption className="mt-1 text-xs text-mut truncate">{ph.caption}</figcaption>
                        {isAdmin && (
                          <button onClick={() => onUpdate(m.id, { photos: (m.photos ?? []).filter((_, j) => j !== i) })}
                            className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white cursor-pointer" aria-label="Usuń zdjęcie"><X className="w-4 h-4" /></button>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
                {isAdmin && (
                  <>
                    <button onClick={() => fileRef.current?.click()} className="tap flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-line text-fg2 text-sm hover:bg-surf2 cursor-pointer">
                      <Camera className="w-4 h-4" />Dodaj zdjęcie z sali (np. tablicy)
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={addPhoto} />
                    {err && <p className="text-sm text-bad">{err}</p>}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* MATERIAŁY */}
      <section className="mt-4">
        <h5 className="text-sm font-bold text-fg">Materiały do tych zajęć ({mats.length})</h5>
        {mats.length === 0
          ? <p className="mt-1.5 text-sm text-mut2">Brak materiałów.</p>
          : <div className="mt-2 space-y-2">{mats.map(x => <MaterialRow key={x.id} m={x} />)}</div>}
      </section>

      {zoom && (
        <div className="fixed inset-0 z-[90] bg-black/85 flex items-center justify-center p-3" onClick={() => setZoom(null)} role="dialog" aria-label="Zdjęcie">
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-lg" />
          <button className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-white/15 text-white" aria-label="Zamknij"><X className="w-6 h-6" /></button>
        </div>
      )}
    </div>
  );
};
