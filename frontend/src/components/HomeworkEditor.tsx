// PATH: src/components/HomeworkEditor.tsx | REQ-ID: TERAPIA-HOMEWORK-02
// Admin: dodawanie i edycja prac domowych (Bartek 09.10: „brakuje edycji, dodawania zadań”).
// Praca = zadana NA zajęciach X, termin = zajęcia Y (następne / za 2 / za 3 albo dowolne z kalendarza) — D017.
import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Homework, Meeting } from '../types/group';
import { fmtShort, isPast } from '../services/format';

const field = 'tap w-full rounded-xl border border-line bg-surf px-3 text-base text-fg';
const btn = 'tap inline-flex items-center justify-center gap-1.5 rounded-xl px-4 text-base font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export const HomeworkEditor: React.FC<{
  meetings: Meeting[]; // tylko aktualny cykl (bez odwołanych), posortowane
  initial?: Homework;
  onSave: (h: Omit<Homework, 'id'>) => Promise<void> | void;
  onCancel: () => void;
}> = ({ meetings, initial, onSave, onCancel }) => {
  const sorted = useMemo(() => [...meetings].sort((a, b) => a.date.localeCompare(b.date)), [meetings]);
  // domyślnie: zadane na ostatnich zajęciach, które już się odbyły (albo pierwszych w cyklu)
  const lastPast = [...sorted].reverse().find(m => isPast(m.date, m.durationMin)) ?? sorted[0];
  const [title, setTitle] = useState(initial?.title ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [given, setGiven] = useState(initial?.givenAt ?? lastPast?.id ?? '');
  const gi = sorted.findIndex(m => m.id === given);
  const [due, setDue] = useState(initial?.dueAt ?? sorted[Math.min(sorted.length - 1, gi + 1)]?.id ?? '');
  const di = sorted.findIndex(m => m.id === due);
  const [busy, setBusy] = useState(false);
  const label = (m: Meeting, i: number) => `${i + 1}. ${fmtShort(m.date)}${m.topic ? ` — ${m.topic}` : ''}`;
  const pickAfter = (n: number) => { const t = sorted[gi + n]; if (t) setDue(t.id); };

  if (sorted.length === 0) return <p className="p-3 text-base text-mut">Najpierw dodaj spotkania w zakładce Terminy.</p>;
  return (
    <div className="p-3 rounded-2xl border border-sky-400/30 bg-sky-500/5 space-y-2 min-w-0">
      <h3 className="text-lg font-bold">{initial ? 'Edytuj pracę domową' : 'Nowa praca domowa'}</h3>
      <label className="block text-sm text-mut">Tytuł<input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} className={field} placeholder="np. Dzienniczek emocji przez tydzień" /></label>
      <label className="block text-sm text-mut">Opis (co zrobić)
        <textarea value={desc} maxLength={5000} rows={3} onChange={e => setDesc(e.target.value)} className="w-full rounded-xl border border-line bg-surf px-3 py-2 text-base text-fg" />
      </label>
      <label className="block text-sm text-mut">Zadane na zajęciach
        <select value={given} onChange={e => { setGiven(e.target.value); const i = sorted.findIndex(m => m.id === e.target.value); if (di <= i) setDue(sorted[Math.min(sorted.length - 1, i + 1)].id); }} className={field}>
          {sorted.map((m, i) => <option key={m.id} value={m.id}>{label(m, i)}</option>)}
        </select>
      </label>
      <div className="text-sm text-mut">Termin — na zajęcia</div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map(n => (
          <button key={n} type="button" disabled={!sorted[gi + n]} onClick={() => pickAfter(n)}
            className={`${btn} ${di === gi + n ? 'bg-sky-500/20 border-sky-400/30 text-acc' : 'border-line text-fg2 hover:bg-surf2'}`}>
            {n === 1 ? 'następne' : `za ${n} tygodnie`}
          </button>
        ))}
      </div>
      <select value={due} onChange={e => setDue(e.target.value)} className={field} aria-label="Termin — zajęcia">
        {sorted.map((m, i) => i > gi ? <option key={m.id} value={m.id}>{label(m, i)}</option> : null)}
      </select>
      <div className="flex flex-wrap gap-2 pt-1">
        <button className={`${btn} bg-sky-500/20 border-sky-400/30 text-acc hover:bg-sky-500/30`} disabled={busy || !title.trim() || !given || !due || di <= gi}
          onClick={async () => { setBusy(true); await onSave({ title: title.trim(), description: desc.trim(), givenAt: given, dueAt: due }); setBusy(false); }}>
          <Check className="w-4 h-4" />{busy ? 'Zapisuję…' : 'Zapisz'}
        </button>
        <button className={`${btn} border-line text-fg2 hover:bg-surf2`} onClick={onCancel}><X className="w-4 h-4" />Anuluj</button>
      </div>
    </div>
  );
};
