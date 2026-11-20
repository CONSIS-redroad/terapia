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
// Szyfrowanie (D042, 0.16): przy zablokowanych notatkach zamiast edytora jest NoteLock (PIN). Edytor montuje się dopiero
// na ODSZYFROWANEJ treści (stan „Zapisano” liczony na jawnym tekście); szyfruje useGroup.saveMyNote, nie ten ekran.
// O4 (adwersarz 20.11): cała pętla zapisów to JEDNA obietnica zgłaszana do sejfu (vaultTrack) — blokada czeka na nią
// z kluczem; „zapisz teraz” zarejestrowane w sejfie (vaultRegisterFlusher). Błąd zapisu po odmontowaniu → trwały komunikat.
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Lock, NotebookPen, Save, Trash2, X } from 'lucide-react';
import type { MeetingNote } from '../types/group';
import { NoteLock, NoteLockBar } from './NoteLock';
import { useNoteVault } from '../hooks/useGroup';
import { vaultIsDraining, vaultRegisterFlusher, vaultSavedOk, vaultState, vaultTrack, vaultUnsaved } from '../services/noteVault';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'empty' | 'deleted';
type Snap = { title: string; text: string };

interface Props {
  meetingId: string;
  note?: MeetingNote;
  onSave: (meetingId: string, title: string, note: string) => Promise<void>;
  onDelete: (meetingId: string) => Promise<void>;
  /** Odczyt notatek padł (sieć / uprawnienia) — nie wiemy, co jest w bazie, więc nie pozwalamy pisać. */
  loadError?: boolean;
  /** D042: notatki zaszyfrowane i jeszcze nieodblokowane (albo PIN nieustawiony) — pokaż PIN zamiast edytora. */
  locked?: boolean;
}

const Header: React.FC<{ encrypted: boolean }> = ({ encrypted }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
    <h5 className="flex items-center gap-1.5 text-sm font-bold text-fg"><NotebookPen className="w-4 h-4 text-acc" />Moje notatki</h5>
    <span className="inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full bg-emerald-500/10 text-ok border border-emerald-400/25">
      <Lock className="w-3.5 h-3.5" />{encrypted ? 'zaszyfrowane · widzisz tylko Ty' : 'widzisz tylko Ty'}
    </span>
  </div>
);

/** Sekcja notatek: PIN (zablokowane) albo edytor (odszyfrowane). Edytor dostaje `key`, więc startuje od świeżej treści. */
export const MyNoteSection: React.FC<Props> = (p) => {
  const v = useNoteVault();
  if (p.locked) return (
    <section className="mt-4" aria-label="Moje notatki">
      <Header encrypted />
      <NoteLock />
    </section>
  );
  return <NoteEditor key={p.meetingId} {...p} encrypted={v.status === 'unlocked'} />;
};

const AUTOSAVE_MS = 1200;
const same = (a: Snap, b: Snap) => a.title === b.title && a.text === b.text;
const isEmpty = (s: Snap) => !s.title.trim() && !s.text.trim();

const NoteEditor: React.FC<Props & { encrypted: boolean }> = ({ meetingId, note, onSave, onDelete, loadError: readError, encrypted }) => {
  const loadError = readError || !!note?.unreadable;
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
  const loopRef = useRef<Promise<boolean> | null>(null); // trwa pętla zapisów (jeden zapis naraz)
  const mounted = useRef(true);
  const set = (s: SaveState) => { if (mounted.current) setState(s); };

  /** Jeden zapis naraz; po powrocie — jeśli w międzyczasie coś dopisano — kolejny. Działa też po odmontowaniu (refy).
   *  Zwraca obietnicę CAŁEJ pętli (true = wszystko zapisane, false = błąd); nigdy nie rzuca. */
  const flush = (): Promise<boolean> => {
    clearTimeout(timer.current);
    if (loopRef.current) return loopRef.current; // po powrocie bieżącego zapisu pętla sama sprawdzi różnicę
    if (same(curRef.current, savedRef.current)) { set(isEmpty(savedRef.current) ? 'idle' : 'saved'); return Promise.resolve(true); }
    if (isEmpty(curRef.current)) { set('empty'); return Promise.resolve(true); } // autozapis NIGDY nie kasuje
    const vs = vaultState();
    // R2-2: w trakcie blokady wolno DOSŁAĆ to, co wpisano przed blokadą (edytor już zniknął); po blokadzie — nie,
    // wtedy niezapisany tekst idzie do pamięci karty (R2-3), żeby dało się go skopiować
    if (vs.status !== 'unlocked' && vs.status !== 'unavailable' && !vaultIsDraining()) {
      vaultUnsaved(unsavedNow(), 'notatki zablokowano');
      return Promise.resolve(false);
    }
    const loop = (async (): Promise<boolean> => {
      for (;;) {
        const sent = curRef.current;
        if (same(sent, savedRef.current)) { set(isEmpty(sent) ? 'idle' : 'saved'); return true; }
        if (isEmpty(sent)) { set('empty'); return true; }
        set('saving'); if (mounted.current) setErr('');
        try {
          await onSave(meetingId, sent.title, sent.text);
          savedRef.current = sent;
          if (mounted.current) setHasSaved(true);
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          set('error');
          if (mounted.current) setErr(m);
          // edytora nie widać (zablokowano / zmiana zajęć) — komunikat globalny z tekstem do skopiowania (R2-3)
          if (!mounted.current || vaultState().status !== 'unlocked') vaultUnsaved(unsavedNow(), m);
          return false;
        }
        if (same(curRef.current, savedRef.current)) vaultSavedOk(meetingId);
      }                                         // dopisane w trakcie zapisu → pętla wysyła jeszcze raz
    })().finally(() => { loopRef.current = null; });
    loopRef.current = loop;
    vaultTrack(loop, () => (same(curRef.current, savedRef.current) ? null : unsavedNow()));
    return loop;
  };
  /** To, co jest w polach, a czego (jeszcze) nie ma w bazie — tylko do pamięci karty (R2-3). */
  function unsavedNow() { return { meetingId, title: curRef.current.title, note: curRef.current.text }; }
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
    const onHide = () => { void flushRef.current(); };
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
  // blokada sejfu najpierw prosi edytor o zapis niezapisanych zmian (O4)
  useEffect(() => vaultRegisterFlusher(() => { void flushRef.current(); }), []);

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

  const deleteUi = (label: string) => (askDelete ? (
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
      <Trash2 className="w-4 h-4" />{label}
    </button>
  ));
  const unreadable = !!note?.unreadable && !readError;

  return (
    <section className="mt-4" aria-label="Moje notatki">
      <Header encrypted={encrypted} />
      {loadError ? (
        <div className="mt-2 space-y-2">
          <p role="alert" className="flex items-start gap-1.5 text-sm text-bad">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{unreadable
              ? 'Tej notatki nie da się odszyfrować (uszkodzona albo zapisana kluczem, którego już nie ma). Edycja wyłączona — możesz ją usunąć i napisać od nowa.'
              : 'Nie udało się wczytać notatek — spróbuj później. (Edycja wyłączona, żeby nie nadpisać zapisanej notatki).'}
          </p>
          {unreadable && deleteUi('Usuń tę notatkę')}
          {unreadable && state === 'error' && <p role="status" className="text-sm text-bad">{err}</p>}
        </div>
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
          <p className="text-sm text-mut">{encrypted
            ? 'Zapisuje się samo chwilę po pisaniu. Szyfrowane Twoim PIN-em, zanim trafią do bazy — prowadząca i administrator widzą tylko szyfrogram.'
            : 'Zapisuje się samo chwilę po pisaniu. Widzisz tylko Ty — w aplikacji nie widzą ich inni uczestnicy ani prowadząca.'}</p>
          {encrypted && <NoteLockBar />}
          {hasSaved && deleteUi('Usuń moją notatkę')}
        </div>
      )}
    </section>
  );
};
