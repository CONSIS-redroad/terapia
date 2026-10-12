// PATH: src/components/MyNoteSection.tsx | REQ-ID: TERAPIA-NOTES-01
// „Moje notatki” do zajęć (Bartek 12.10): „oficjalne nazwy tematów to jedno, ale każdy może swoje notować —
// tytuły po mojemu, notatki sobie dopiszę”. Prywatne: w bazie RLS meeting_notes — tylko autor (admin też nie widzi cudzych).
//
// Zapis (poprawka po adwersarzu 12.10):
//  • pamiętamy ostatnio ZAPISANY tekst (savedRef) i bieżący (curRef); „Zapisano” TYLKO gdy zapisany == bieżący;
//  • zapisy w kolejce — jeden naraz; po powrocie, jeśli bieżący ≠ zapisany, idzie następny (nic nie ginie, gdy pisze się w trakcie zapisu);
//  • zapis: chwilę po pisaniu, przy wyjściu z pola, przyciskiem, przy zmianie zajęć (odmontowanie), przy pagehide i ukryciu karty;
//  • autozapis NIGDY nie kasuje — puste pola nie są wysyłane; usunięcie tylko przyciskiem „Usuń moją notatkę” z potwierdzeniem;
//  • gdy odczyt notatek się nie udał (loadError) — edycja zablokowana, żeby nie nadpisać istniejącej notatki pustą.
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Lock, NotebookPen, Save, Trash2, X } from 'lucide-react';
import type { MeetingNote } from '../types/group';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'empty' | 'deleted';
type Snap = { title: string; text: string };

interface Props {
  meetingId: string;
  note?: MeetingNote;
  onSave: (meetingId: string, title: string, note: string) => Promise<void>;
  onDelete: (meetingId: string) => Promise<void>;
  /** Odczyt notatek padł (sieć / uprawnienia) — nie wiemy, co jest w bazie, więc nie pozwalamy pisać. */
  loadError?: boolean;
}

const AUTOSAVE_MS = 1200;
const same = (a: Snap, b: Snap) => a.title === b.title && a.text === b.text;
const isEmpty = (s: Snap) => !s.title.trim() && !s.text.trim();

export const MyNoteSection: React.FC<Props> = ({ meetingId, note, onSave, onDelete, loadError }) => {
  const initial: Snap = { title: note?.title ?? '', text: note?.note ?? '' };
  const [open, setOpen] = useState(!!note);
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const [state, setState] = useState<SaveState>('idle');
  const [err, setErr] = useState('');
  const [askDelete, setAskDelete] = useState(false);
  const [hasSaved, setHasSaved] = useState(!!note);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const curRef = useRef<Snap>(initial);      // to, co jest w polach
  const savedRef = useRef<Snap>(initial);    // to, co na pewno jest w bazie
  const inFlight = useRef(false);            // trwa zapis
  const mounted = useRef(true);
  const set = (s: SaveState) => { if (mounted.current) setState(s); };

  /** Jeden zapis naraz; po powrocie — jeśli w międzyczasie coś dopisano — kolejny. Działa też po odmontowaniu (refy). */
  const flush = async (): Promise<void> => {
    clearTimeout(timer.current);
    if (inFlight.current) return;               // po powrocie bieżącego zapisu pętla sama sprawdzi różnicę
    const sent = curRef.current;
    if (same(sent, savedRef.current)) { set(isEmpty(savedRef.current) ? 'idle' : 'saved'); return; }
    if (isEmpty(sent)) { set('empty'); return; } // autozapis NIGDY nie kasuje
    inFlight.current = true;
    set('saving'); if (mounted.current) setErr('');
    try {
      await onSave(meetingId, sent.title, sent.text);
      savedRef.current = sent;
      if (mounted.current) setHasSaved(true);
    } catch (e) {
      inFlight.current = false;
      set('error'); if (mounted.current) setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    inFlight.current = false;
    if (!same(curRef.current, savedRef.current)) {
      if (isEmpty(curRef.current)) { set('empty'); return; }
      return flushRef.current();                // dopisane w trakcie zapisu → wyślij jeszcze raz
    }
    set('saved');
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const change = (t: string, n: string) => {
    setTitle(t); setText(n); curRef.current = { title: t, text: n };
    setAskDelete(false);
    set(isEmpty(curRef.current) && !same(curRef.current, savedRef.current) ? 'empty' : 'dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flushRef.current(); }, AUTOSAVE_MS);
  };

  // zapis przy zamknięciu/ukryciu karty przeglądarki i przy odmontowaniu (zmiana zajęć / ekranu)
  useEffect(() => {
    mounted.current = true;
    const onHide = () => { void flushRef.current().catch(() => { /* stan błędu pokazany w ekranie */ }); };
    const onVis = () => { if (document.visibilityState === 'hidden') onHide(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
      mounted.current = false;
      clearTimeout(timer.current);
      onHide(); // bieżący ≠ zapisany → zapis (także gdy inny zapis jeszcze w locie — pętla flush go dośle)
    };
  }, [meetingId]);

  const doDelete = async () => {
    clearTimeout(timer.current);
    set('saving'); setErr('');
    try {
      await onDelete(meetingId);
      const blank = { title: '', text: '' };
      savedRef.current = blank; curRef.current = blank;
      setTitle(''); setText(''); setHasSaved(false); setAskDelete(false);
      set('deleted');
    } catch (e) {
      set('error'); setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const status =
    state === 'saving' ? 'Zapisuję…'
      : state === 'saved' ? 'Zapisano'
        : state === 'dirty' ? 'Niezapisane zmiany…'
          : state === 'empty' ? 'Pola są puste — zapisana wersja zostaje w bazie.'
            : state === 'deleted' ? 'Notatka usunięta.'
              : state === 'error' ? `Nie zapisano: ${err}`
                : note?.updatedAt ? `Zapisane ${new Date(note.updatedAt).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '';

  return (
    <section className="mt-4" aria-label="Moje notatki">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h5 className="flex items-center gap-1.5 text-sm font-bold text-fg"><NotebookPen className="w-4 h-4 text-acc" />Moje notatki</h5>
        <span className="inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full bg-emerald-500/10 text-ok border border-emerald-400/25">
          <Lock className="w-3.5 h-3.5" />widzisz tylko Ty
        </span>
      </div>
      {loadError ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-bad">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />Nie udało się wczytać notatek — spróbuj później. (Edycja wyłączona, żeby nie nadpisać zapisanej notatki).
        </p>
      ) : !open ? (
        <button onClick={() => setOpen(true)} className="tap mt-2 flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-line text-fg2 text-sm hover:bg-surf2 cursor-pointer">
          <NotebookPen className="w-4 h-4" />Dodaj moją notatkę
        </button>
      ) : (
        <div className="mt-2 space-y-2 min-w-0">
          <label className="block text-sm text-mut">Mój tytuł
            <input value={title} maxLength={200} onChange={e => change(e.target.value, text)} onBlur={() => { if (state === 'dirty') void flush(); }}
              placeholder="po swojemu, np. „granice — przykład z pracy”"
              className="tap mt-1 w-full bg-surf border border-line rounded-lg px-3 text-base lg:text-sm text-fg focus:outline-none focus:border-sky-400/40" />
          </label>
          <label className="block text-sm text-mut">Notatka
            <textarea value={text} maxLength={20000} rows={5} onChange={e => change(title, e.target.value)} onBlur={() => { if (state === 'dirty') void flush(); }}
              placeholder="Co zapamiętałem/zapamiętałam, co chcę przemyśleć…"
              className="mt-1 w-full bg-surf border border-line rounded-lg px-3 py-2 text-base lg:text-sm text-fg leading-relaxed focus:outline-none focus:border-sky-400/40" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void flush()} disabled={state === 'saving'}
              className="tap inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-500/25 text-acc border border-sky-400/40 text-sm font-semibold cursor-pointer disabled:opacity-50">
              <Save className="w-4 h-4" />Zapisz
            </button>
            <span role="status" aria-live="polite" className={`text-sm ${state === 'error' ? 'text-bad' : state === 'saved' ? 'text-ok' : 'text-mut'}`}>
              {state === 'saved' && <Check className="inline w-4 h-4 mr-0.5 -mt-0.5" />}{status}
            </span>
          </div>
          <p className="text-sm text-mut">Zapisuje się samo chwilę po pisaniu. Widzisz tylko Ty — w aplikacji nie widzą ich inni uczestnicy ani prowadząca.</p>
          {hasSaved && (askDelete ? (
            <div role="group" aria-label="Potwierdź usunięcie notatki" className="rounded-lg border border-rose-400/30 bg-rose-500/5 p-3 space-y-2">
              <p className="text-sm text-fg">Usunąć tę notatkę na stałe? Tego nie da się cofnąć.</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void doDelete()} disabled={state === 'saving'}
                  className="tap inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-rose-400/40 bg-rose-500/15 text-bad text-sm font-semibold cursor-pointer disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />Tak, usuń
                </button>
                <button onClick={() => setAskDelete(false)} className="tap inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-line text-fg2 text-sm cursor-pointer">
                  <X className="w-4 h-4" />Anuluj
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAskDelete(true)} disabled={state === 'saving'}
              className="tap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-rose-400/25 text-bad text-sm hover:bg-rose-500/10 cursor-pointer disabled:opacity-50">
              <Trash2 className="w-4 h-4" />Usuń moją notatkę
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
