// PATH: src/components/HomeworkPanel.tsx | REQ-ID: TERAPIA-HOMEWORK-01
// Moduł „Prace domowe” (Bartek 08.10: „najważniejsze — brakuje modułu: dziś we wtorek był taki temat, sekcja praca domowa,
// wiadomo — na następny wtorek albo za 2–3 tygodnie”). Lista według TERMINU, z odhaczaniem „zrobione” (u uczestnika).
import React, { useState } from 'react';
import { CalendarDays, ClipboardCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { HomeworkEditor } from './HomeworkEditor';
import type { Homework, Meeting } from '../types/group';
import { fmtShort, isPast } from '../services/format';
import { dueLabel } from './LessonCard';

export const HomeworkPanel: React.FC<{
  homework: Homework[]; meetings: Meeting[]; done: Record<string, boolean>;
  onToggleDone: (id: string) => void; onOpenMeeting: (id: string) => void;
  /** Admin: dodawanie / edycja / usuwanie prac. */
  isAdmin?: boolean;
  onAdd?: (h: Omit<Homework, 'id'>) => Promise<void> | void;
  onUpdate?: (id: string, h: Partial<Homework>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}> = ({ homework, meetings, done, onToggleDone, onOpenMeeting, isAdmin, onAdd, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState<string | null>(null); // id pracy albo 'new'
  const m = (id: string) => meetings.find(x => x.id === id);
  const no = (id: string) => meetings.findIndex(x => x.id === id) + 1;
  const withDates = homework
    .map(h => ({ h, due: m(h.dueAt), given: m(h.givenAt) }))
    .filter(x => x.due && x.given)
    .sort((a, b) => a.due!.date.localeCompare(b.due!.date));
  const open = withDates.filter(x => !isPast(x.due!.date, x.due!.durationMin));
  const old = withDates.filter(x => isPast(x.due!.date, x.due!.durationMin)).reverse();
  const todo = open.filter(x => !done[x.h.id]).length;

  const row = ({ h, due, given }: (typeof withDates)[number]) => (
    <li key={h.id} className="rounded-xl bg-surf border border-line p-3 flex gap-3">
      <button onClick={() => onToggleDone(h.id)} aria-pressed={!!done[h.id]} aria-label={done[h.id] ? 'Zrobione' : 'Oznacz jako zrobione'}
        className={`tap shrink-0 w-7 h-7 mt-0.5 rounded-lg border-2 flex items-center justify-center cursor-pointer ${done[h.id] ? 'bg-emerald-500/80 border-emerald-500 text-white' : 'border-line'}`}>
        {done[h.id] && '✓'}
      </button>
      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className={`text-base lg:text-sm font-semibold ${done[h.id] ? 'line-through text-mut' : 'text-fg'}`}>{h.title}</span>
          <span className={`text-sm lg:text-xs font-semibold ${done[h.id] ? 'text-mut' : 'text-warn'}`}>{dueLabel(due!.date)}</span>
        </span>
        <span className="block text-sm lg:text-xs text-fg2 mt-0.5">{h.description}</span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          <button onClick={() => onOpenMeeting(due!.id)} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-acc border border-sky-400/25 cursor-pointer">
            <CalendarDays className="w-3 h-3" />termin: zajęcia {no(due!.id)} · {fmtShort(due!.date)}
          </button>
          <button onClick={() => onOpenMeeting(given!.id)} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-surf2 text-mut border border-line cursor-pointer">
            zadane: zajęcia {no(given!.id)}{given!.topic ? ` „${given!.topic}”` : ''}
          </button>
          {isAdmin && onUpdate && (
            <button onClick={() => setEditing(h.id)} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-line text-fg2 hover:bg-surf2 cursor-pointer"><Pencil className="w-3 h-3" />Edytuj</button>
          )}
          {isAdmin && onDelete && (
            <button onClick={() => { if (confirm(`Usunąć pracę „${h.title}”?`)) void onDelete(h.id); }} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-rose-400/25 text-bad hover:bg-rose-500/10 cursor-pointer"><Trash2 className="w-3 h-3" />Usuń</button>
          )}
        </span>
        {editing === h.id && onUpdate && (
          <div className="mt-2"><HomeworkEditor meetings={meetings} initial={h} onSave={async v => { await onUpdate(h.id, v); setEditing(null); }} onCancel={() => setEditing(null)} /></div>
        )}
      </span>
    </li>
  );

  return (
    <div className="p-4 space-y-4">
      <p className="flex items-center gap-2 text-base lg:text-sm text-fg2">
        <ClipboardCheck className="w-5 h-5 text-warn" />
        {todo === 0 ? 'Wszystko zrobione — brawo!' : `Do zrobienia: ${todo}`}
      </p>
      {isAdmin && onAdd && (editing === 'new'
        ? <HomeworkEditor meetings={meetings} onSave={async v => { await onAdd(v); setEditing(null); }} onCancel={() => setEditing(null)} />
        : <button onClick={() => setEditing('new')} className="tap inline-flex items-center gap-1.5 rounded-xl px-4 text-base font-semibold border border-sky-400/30 bg-sky-500/15 text-acc hover:bg-sky-500/25 cursor-pointer"><Plus className="w-4 h-4" />Dodaj pracę domową</button>)}
      <div>
        <h5 className="text-xs uppercase tracking-wider text-mut font-semibold">Aktualne — według terminu</h5>
        {open.length === 0 ? <p className="mt-2 text-sm text-mut2">Brak zadań.</p> : <ul className="mt-2 space-y-2">{open.map(row)}</ul>}
      </div>
      {old.length > 0 && (
        <details>
          <summary className="tap flex items-center text-sm text-mut cursor-pointer">Wcześniejsze ({old.length})</summary>
          <ul className="mt-2 space-y-2">{old.map(row)}</ul>
        </details>
      )}
      <p className="text-xs text-mut2">Znaczek „zrobione” widzisz tylko Ty — to Twoja lista.</p>
    </div>
  );
};
