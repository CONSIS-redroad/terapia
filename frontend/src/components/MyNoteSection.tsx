// PATH: src/components/MyNoteSection.tsx | REQ-ID: TERAPIA-NOTES-01
// „Moje notatki” do zajęć (Bartek 12.10): „oficjalne nazwy tematów to jedno, ale każdy może swoje notować —
// tytuły po mojemu, notatki sobie dopiszę”. Prywatne: widzi tylko autor (w bazie RLS meeting_notes — admin też nie widzi cudzych).
// Zapis automatyczny (chwilę po pisaniu, przy wyjściu z pola i przy zmianie zajęć) + przycisk „Zapisz”.
import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, NotebookPen, Save } from 'lucide-react';
import type { MeetingNote } from '../types/group';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Props {
  meetingId: string;
  note?: MeetingNote;
  onSave: (meetingId: string, title: string, note: string) => Promise<void>;
}

const AUTOSAVE_MS = 1200;

export const MyNoteSection: React.FC<Props> = ({ meetingId, note, onSave }) => {
  const [open, setOpen] = useState(!!note);
  const [title, setTitle] = useState(note?.title ?? '');
  const [text, setText] = useState(note?.note ?? '');
  const [state, setState] = useState<SaveState>('idle');
  const [err, setErr] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // najświeższe wartości dla zapisu przy odmontowaniu (zmiana zajęć / zamknięcie ekranu)
  const latest = useRef({ title, text, dirty: false });
  latest.current = { title, text, dirty: state === 'dirty' || state === 'error' };

  const save = async (t = title, n = text) => {
    clearTimeout(timer.current);
    setState('saving'); setErr('');
    try { await onSave(meetingId, t, n); setState('saved'); }
    catch (e) { setState('error'); setErr(e instanceof Error ? e.message : String(e)); }
  };

  const change = (t: string, n: string) => {
    setTitle(t); setText(n); setState('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(t, n); }, AUTOSAVE_MS);
  };

  useEffect(() => () => {
    clearTimeout(timer.current);
    if (latest.current.dirty) void onSave(meetingId, latest.current.title, latest.current.text).catch(() => { /* ekran już zamknięty */ });
  }, [meetingId]);

  const status =
    state === 'saving' ? 'Zapisuję…'
      : state === 'saved' ? 'Zapisano'
        : state === 'dirty' ? 'Niezapisane zmiany…'
          : state === 'error' ? `Nie zapisano: ${err}`
            : note?.updatedAt ? `Zapisane ${new Date(note.updatedAt).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '';

  return (
    <section className="mt-4" aria-label="Moje notatki">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h5 className="flex items-center gap-1.5 text-sm font-bold text-fg"><NotebookPen className="w-4 h-4 text-acc" />Moje notatki</h5>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-ok border border-emerald-400/25">
          <Lock className="w-3.5 h-3.5" />widzisz tylko Ty
        </span>
      </div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="tap mt-2 flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-line text-fg2 text-sm hover:bg-surf2 cursor-pointer">
          <NotebookPen className="w-4 h-4" />Dodaj moją notatkę
        </button>
      ) : (
        <div className="mt-2 space-y-2 min-w-0">
          <label className="block text-sm text-mut">Mój tytuł
            <input value={title} maxLength={200} onChange={e => change(e.target.value, text)} onBlur={() => { if (state === 'dirty') void save(); }}
              placeholder="po swojemu, np. „granice — przykład z pracy”"
              className="tap mt-1 w-full bg-surf border border-line rounded-lg px-3 text-base lg:text-sm text-fg focus:outline-none focus:border-sky-400/40" />
          </label>
          <label className="block text-sm text-mut">Notatka
            <textarea value={text} maxLength={20000} rows={5} onChange={e => change(title, e.target.value)} onBlur={() => { if (state === 'dirty') void save(); }}
              placeholder="Co zapamiętałem/zapamiętałam, co chcę przemyśleć…"
              className="mt-1 w-full bg-surf border border-line rounded-lg px-3 py-2 text-base lg:text-sm text-fg leading-relaxed focus:outline-none focus:border-sky-400/40" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void save()} disabled={state === 'saving'}
              className="tap inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-500/25 text-acc border border-sky-400/40 text-sm font-semibold cursor-pointer disabled:opacity-50">
              <Save className="w-4 h-4" />Zapisz
            </button>
            <span role="status" aria-live="polite" className={`text-sm ${state === 'error' ? 'text-bad' : state === 'saved' ? 'text-ok' : 'text-mut'}`}>
              {state === 'saved' && <Check className="inline w-4 h-4 mr-0.5 -mt-0.5" />}{status}
            </span>
          </div>
          <p className="text-xs text-mut">Zapisuje się samo chwilę po pisaniu. Tytuł i notatka są prywatne — nie widzi ich grupa ani prowadząca. Puste pola = notatka usunięta.</p>
        </div>
      )}
    </section>
  );
};
