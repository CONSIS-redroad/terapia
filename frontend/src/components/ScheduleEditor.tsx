// PATH: src/components/ScheduleEditor.tsx | REQ-ID: TERAPIA-SCHEDULE-01
// Admin → Harmonogram (Bartek 08.10): seria dat (np. 24 wtorki 16:30–19:15), wykluczenie dnia (odwołaj — treści zostają),
// przeniesienie (np. zamiast wtorku środa zastępczo), dodatkowe spotkanie, dołożenie brakujących terminów do pełnej serii.
import React, { useMemo, useState } from 'react';
import { CalendarPlus, Check, MoveRight, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import type { Meeting } from '../types/group';

const DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toIso = (day: string, time: string) => new Date(`${day}T${time}`).toISOString();
const minutes = (from: string, to: string) => {
  const [a, b] = from.split(':').map(Number); const [c, d] = to.split(':').map(Number);
  return Math.max(10, c * 60 + d - (a * 60 + b));
};
const endTime = (m: Meeting) => hm(new Date(new Date(m.date).getTime() + m.durationMin * 60000));
const label = (iso: string) => {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}`;
};

/** Daty serii: pierwszy `weekday` od `start` (włącznie), co tydzień, `count` razy. */
export function seriesDates(start: string, weekday: number, count: number): string[] {
  const d = new Date(`${start}T12:00`);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  const out: string[] = [];
  for (let i = 0; i < count; i++) { out.push(ymd(d)); d.setDate(d.getDate() + 7); } // setDate: bez przesunięcia przy zmianie czasu
  return out;
}

const field = 'tap w-full rounded-xl border border-line bg-surf px-3 text-base text-fg';
const btn = 'tap inline-flex items-center justify-center gap-1.5 rounded-xl px-4 text-base font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-sky-500/20 border-sky-400/30 text-acc hover:bg-sky-500/30`;
const btnGhost = `${btn} border-line text-fg2 hover:bg-surf2`;

interface Props {
  meetings: Meeting[];
  onAdd: (list: Omit<Meeting, 'id'>[]) => Promise<void> | void;
  onUpdate: (id: string, patch: Partial<Meeting>) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  /** Ile spotkań ma mieć cykl (domyślnie 24). */
  targetCount?: number;
}

export const ScheduleEditor: React.FC<Props> = ({ meetings, onAdd, onUpdate, onDelete, targetCount = 24 }) => {
  const sorted = useMemo(() => [...meetings].sort((a, b) => a.date.localeCompare(b.date)), [meetings]);
  const active = sorted.filter(m => !m.cancelled);
  const last = active[active.length - 1];

  // ── nowa seria ──
  const [showSeries, setShowSeries] = useState(meetings.length === 0);
  const [start, setStart] = useState(ymd(new Date()));
  const [weekday, setWeekday] = useState(2);
  const [from, setFrom] = useState('16:30');
  const [to, setTo] = useState('19:15');
  const [count, setCount] = useState(targetCount);
  const [place, setPlace] = useState('');
  const preview = useMemo(() => (count > 0 && count <= 60 ? seriesDates(start, weekday, count) : []), [start, weekday, count]);
  const [busy, setBusy] = useState(false);

  const saveSeries = async () => {
    setBusy(true);
    await onAdd(preview.map(day => ({ date: toIso(day, from), durationMin: minutes(from, to), topic: '', place })));
    setBusy(false); setShowSeries(false);
  };

  // ── dołóż brakujące do pełnej serii (po odwołaniach) ──
  const missing = Math.max(0, targetCount - active.length);
  const fillUp = async () => {
    if (!last) return;
    const d = new Date(last.date);
    const days = seriesDates(ymd(new Date(d.getTime() + 86400000)), d.getDay(), missing);
    await onAdd(days.map(day => ({ date: toIso(day, hm(d)), durationMin: last.durationMin, topic: '', place: last.place })));
  };

  // ── przeniesienie / dodatkowe ──
  const [editId, setEditId] = useState<string | null>(null);
  const [eDay, setEDay] = useState(''); const [eFrom, setEFrom] = useState(''); const [eTo, setETo] = useState(''); const [eNote, setENote] = useState('');
  const openEdit = (m: Meeting | null) => {
    const base = m ?? last;
    const d = base ? new Date(base.date) : new Date();
    setEditId(m ? m.id : 'new');
    setEDay(ymd(d)); setEFrom(base ? hm(d) : from); setETo(base ? endTime(base) : to); setENote(m?.note ?? (m ? '' : 'spotkanie dodatkowe'));
  };
  const saveEdit = async () => {
    const patch = { date: toIso(eDay, eFrom), durationMin: minutes(eFrom, eTo), note: eNote.trim() };
    if (editId === 'new') await onAdd([{ ...patch, topic: '', place: last?.place ?? place }]);
    else if (editId) await onUpdate(editId, patch);
    setEditId(null);
  };

  const editor = (
    <div className="mt-2 p-3 rounded-xl border border-sky-400/30 bg-sky-500/5 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
      <label className="min-w-0 text-sm text-mut">Dzień<input type="date" value={eDay} onChange={e => setEDay(e.target.value)} className={field} /></label>
      <div className="grid grid-cols-2 gap-2 min-w-0">
        <label className="min-w-0 text-sm text-mut">Od<input type="time" value={eFrom} onChange={e => setEFrom(e.target.value)} className={field} /></label>
        <label className="min-w-0 text-sm text-mut">Do<input type="time" value={eTo} onChange={e => setETo(e.target.value)} className={field} /></label>
      </div>
      <label className="min-w-0 sm:col-span-2 text-sm text-mut">Uwaga (widzi grupa)<input value={eNote} maxLength={300} onChange={e => setENote(e.target.value)} placeholder="np. zastępczo w środę" className={field} /></label>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={saveEdit} disabled={!eDay || !eFrom || !eTo}><Check className="w-4 h-4" />Zapisz</button>
        <button className={btnGhost} onClick={() => setEditId(null)}><X className="w-4 h-4" />Anuluj</button>
      </div>
    </div>
  );

  let nr = 0;
  return (
    <div className="p-3 sm:p-4 space-y-4 text-fg min-w-0">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-base">
          Spotkań w cyklu: <strong>{active.length}</strong> z {targetCount}
          {sorted.length - active.length > 0 && <span className="text-mut"> · odwołane: {sorted.length - active.length}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {missing > 0 && last && <button className={btnGhost} onClick={fillUp}><CalendarPlus className="w-4 h-4" />Dołóż {missing} na koniec</button>}
          <button className={btnGhost} onClick={() => setShowSeries(s => !s)}><CalendarPlus className="w-4 h-4" />{showSeries ? 'Schowaj serię' : 'Nowa seria'}</button>
        </div>
      </div>

      {showSeries && (
        <section className="p-3 rounded-2xl border border-line bg-surf space-y-3 min-w-0" aria-label="Nowa seria spotkań">
          <h3 className="text-lg font-bold">Nowa seria</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
            <label className="min-w-0 text-sm text-mut">Od dnia<input type="date" value={start} onChange={e => setStart(e.target.value)} className={field} /></label>
            <label className="min-w-0 text-sm text-mut">Dzień tygodnia
              <select value={weekday} onChange={e => setWeekday(Number(e.target.value))} className={field}>
                {[1, 2, 3, 4, 5, 6, 0].map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2 min-w-0">
              <label className="min-w-0 text-sm text-mut">Od<input type="time" value={from} onChange={e => setFrom(e.target.value)} className={field} /></label>
              <label className="min-w-0 text-sm text-mut">Do<input type="time" value={to} onChange={e => setTo(e.target.value)} className={field} /></label>
            </div>
            <label className="min-w-0 text-sm text-mut">Liczba spotkań<input type="number" min={1} max={60} value={count} onChange={e => setCount(Number(e.target.value))} className={field} /></label>
            <label className="min-w-0 sm:col-span-2 text-sm text-mut">Miejsce<input value={place} onChange={e => setPlace(e.target.value)} placeholder="np. sala 12" className={field} /></label>
          </div>
          {preview.length > 0 && (
            <p className="text-sm text-fg2">Od <strong>{label(toIso(preview[0], from))}</strong> do <strong>{label(toIso(preview[preview.length - 1], from))}</strong> — {preview.length} spotkań, {from}–{to}.
              {meetings.length > 0 && <span className="text-warn"> Spotkania dojdą do już istniejących.</span>}</p>
          )}
          <button className={btnPrimary} onClick={saveSeries} disabled={busy || !preview.length}><Check className="w-4 h-4" />{busy ? 'Zapisuję…' : `Zapisz serię (${preview.length})`}</button>
        </section>
      )}

      <ol className="space-y-2" aria-label="Spotkania">
        {sorted.map(m => {
          if (!m.cancelled) nr += 1;
          return (
            <li key={m.id} className={`p-3 rounded-xl border min-w-0 ${m.cancelled ? 'border-line bg-surf opacity-70' : 'border-line bg-surf'}`}>
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2 justify-between">
                <div className="min-w-0">
                  <div className="text-base font-semibold">
                    {m.cancelled ? <span className="text-mut line-through">{label(m.date)}</span> : <><span className="text-acc">{nr}.</span> {label(m.date)}</>}
                  </div>
                  <div className="text-sm text-mut">{hm(new Date(m.date))}–{endTime(m)}{m.place ? ` · ${m.place}` : ''}{m.cancelled ? ' · odwołane' : ''}</div>
                  {m.note && <div className="text-sm text-fg2">{m.note}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!m.cancelled && <button className={btnGhost} onClick={() => openEdit(m)}><MoveRight className="w-4 h-4" />Przenieś</button>}
                  {m.cancelled
                    ? <button className={btnGhost} onClick={() => onUpdate(m.id, { cancelled: false })}><RotateCcw className="w-4 h-4" />Przywróć</button>
                    : <button className={btnGhost} onClick={() => onUpdate(m.id, { cancelled: true })}><X className="w-4 h-4" />Odwołaj</button>}
                  {m.cancelled && <button className={`${btnGhost} text-bad`} onClick={() => { if (confirm('Usunąć to spotkanie na stałe? Materiały i prace przypięte do niego też znikną.')) void onDelete(m.id); }}><Trash2 className="w-4 h-4" />Usuń</button>}
                </div>
              </div>
              {editId === m.id && editor}
            </li>
          );
        })}
      </ol>
      {sorted.length === 0 && !showSeries && <p className="text-base text-mut">Brak spotkań — utwórz serię.</p>}

      <div>
        <button className={btnGhost} onClick={() => openEdit(null)}><Plus className="w-4 h-4" />Dodaj spotkanie dodatkowe</button>
        {editId === 'new' && editor}
      </div>
      <p className="text-sm text-mut">„Odwołaj” nie kasuje zajęć — materiały i prace domowe zostają, spotkanie nie liczy się do cyklu. „Dołóż na koniec” dopisuje brakujące terminy w tym samym dniu tygodnia.</p>
    </div>
  );
};
