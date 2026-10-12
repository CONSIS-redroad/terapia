// PATH: src/components/ProgramSection.tsx | REQ-ID: TERAPIA-PROGRAM-01
// „Program cyklu” (Bartek 12.10): oficjalna lista tematów do wglądu — rozwijana pod kalendarzem.
// Program NIE jest przypięty do dat (zajęcia nie szły 1:1 z programem); temat zajęć ustawia admin.
// Przy temacie pokazujemy zajęcia, które mają dokładnie ten temat (klik = otwórz zajęcia).
// Admin: zmiana nazwy programu, tytułów, kolejności, dodanie i usunięcie tematu.
import React, { useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ListOrdered, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Meeting, ProgramTopic } from '../types/group';
import { fmtShort } from '../services/format';

const norm = (s: string) => s.trim().toLocaleLowerCase('pl-PL');
/** 1 temat · 2–4 tematy (poza 12–14) · 5+ tematów. */
export const topicsLabel = (n: number) => {
  const d = n % 10, h = n % 100;
  return `${n} ${n === 1 ? 'temat' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'tematy' : 'tematów'}`;
};
const field = 'tap w-full min-w-0 rounded-lg border border-line bg-surf px-3 text-base lg:text-sm text-fg focus:outline-none focus:border-sky-400/40';
const iconBtn = 'tap w-11 shrink-0 flex items-center justify-center rounded-lg border border-line text-fg2 hover:bg-surf2 cursor-pointer disabled:opacity-30 disabled:cursor-default';
const btn = 'tap inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border cursor-pointer disabled:opacity-50';

interface Props {
  program: ProgramTopic[];
  programName?: string;
  /** Odczyt programu padł — pokazujemy komunikat i NIE dajemy edytować (zapis z pustej listy skasowałby tematy). */
  loadError?: boolean;
  meetings: Meeting[];
  isAdmin: boolean;
  onSave: (name: string, list: { id?: string; title: string; note?: string }[]) => Promise<void>;
  onOpenMeeting: (id: string) => void;
}

type Row = { id?: string; title: string; note?: string; key: string };

export const ProgramSection: React.FC<Props> = ({ program, programName, loadError, meetings, isAdmin, onSave, onOpenMeeting }) => {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const startEdit = () => {
    setName(programName ?? '');
    setRows(program.map(t => ({ id: t.id, title: t.title, note: t.note, key: t.id })));
    setErr(''); setEdit(true); setOpen(true);
  };
  const move = (i: number, d: -1 | 1) => setRows(r => {
    const j = i + d; if (j < 0 || j >= r.length) return r;
    const c = [...r]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  const save = async () => {
    setBusy(true); setErr('');
    // błąd = edycja zostaje otwarta (nic nie ginie) + komunikat
    try { await onSave(name, rows.map(({ id, title, note }) => ({ id, title, note }))); setEdit(false); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const meetingsOf = (title: string) => meetings.filter(m => norm(m.topic) === norm(title));

  if (!program.length && !isAdmin && !loadError) return null;

  return (
    <section className="md:col-span-2 min-w-0 rounded-xl bg-surf border border-line p-3 sm:p-4" aria-label="Program cyklu">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="tap w-full flex items-center gap-2 text-left cursor-pointer">
        <ListOrdered className="w-5 h-5 text-acc shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-fg">Program cyklu <span className="font-normal text-mut">({loadError ? 'nie wczytano' : topicsLabel(program.length)})</span></span>
          {programName && <span className="block text-sm text-fg2 truncate">{programName}</span>}
        </span>
        <ChevronDown className={`w-5 h-5 text-mut shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && loadError && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-bad">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />Nie udało się wczytać programu — spróbuj później.
        </p>
      )}

      {open && !edit && !loadError && (
        <div className="mt-3">
          <p className="text-sm text-mut">Oficjalne tematy programu. Kolejność zajęć nie musi iść 1:1 z programem — temat konkretnych zajęć jest w karcie zajęć.</p>
          <ol className="mt-2 space-y-1.5">
            {program.map((t, i) => {
              const ms = meetingsOf(t.title);
              return (
                <li key={t.id} className="flex gap-3 items-start py-1.5 border-b border-line last:border-b-0 min-w-0">
                  <span className="w-7 shrink-0 text-right text-base font-semibold text-acc">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base lg:text-sm text-fg">{t.title}</span>
                    {t.note && <span className="block text-sm text-fg2">{t.note}</span>}
                    {ms.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {ms.map(m => (
                          <button key={m.id} onClick={() => onOpenMeeting(m.id)} className="tap inline-flex items-center text-sm px-3 rounded-full bg-sky-500/10 text-acc border border-sky-400/25 cursor-pointer">
                            zajęcia {fmtShort(m.date)}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {isAdmin && (
            <button onClick={startEdit} className={`${btn} mt-3 border-line text-fg2 hover:bg-surf2`}><Pencil className="w-4 h-4" />Edytuj program</button>
          )}
        </div>
      )}

      {open && edit && (
        <div className="mt-3 space-y-3 min-w-0">
          <label className="block text-sm text-mut">Nazwa programu
            <input value={name} maxLength={200} onChange={e => setName(e.target.value)} className={`${field} mt-1`} />
          </label>
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.key} className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="w-7 shrink-0 text-right text-base font-semibold text-acc">{i + 1}.</span>
                {/* na wąskim telefonie pole zajmuje cały wiersz, przyciski schodzą pod spód */}
                <input value={r.title} maxLength={200} aria-label={`Temat ${i + 1}`}
                  onChange={e => setRows(x => x.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} className={`${field} flex-1 basis-48`} />
                <span className="ml-auto flex gap-1.5 shrink-0">
                <button className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="W górę"><ArrowUp className="w-4 h-4" /></button>
                <button className={iconBtn} disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="W dół"><ArrowDown className="w-4 h-4" /></button>
                <button className={`${iconBtn} text-bad`} onClick={() => setRows(x => x.filter((_, j) => j !== i))} aria-label="Usuń temat"><Trash2 className="w-4 h-4" /></button>
                </span>
              </li>
            ))}
          </ol>
          <button onClick={() => setRows(x => [...x, { title: '', key: `new-${Date.now()}` }])} className={`${btn} border-line text-fg2 hover:bg-surf2`}><Plus className="w-4 h-4" />Dodaj temat</button>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void save()} disabled={busy} className={`${btn} bg-sky-500/25 text-acc border-sky-400/40`}><Check className="w-4 h-4" />{busy ? 'Zapisuję…' : 'Zapisz program'}</button>
            <button onClick={() => setEdit(false)} className={`${btn} border-line text-fg2`}><X className="w-4 h-4" />Anuluj</button>
          </div>
          {err && <p role="alert" className="text-sm text-bad">Nie zapisano programu: {err}</p>}
          <p className="text-sm text-mut">Puste tytuły są pomijane. Zmiana programu nie zmienia tematów zajęć już wpisanych w kalendarzu.</p>
        </div>
      )}
    </section>
  );
};
