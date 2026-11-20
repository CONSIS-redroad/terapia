// PATH: src/components/NoteLock.tsx | REQ-ID: TERAPIA-CRYPTO-03
// PIN do notatek (D042). Prosto i uczciwie dla uczestników grupy:
//   • ustawienie PIN-u raz (min. 6 znaków, dwa razy) + JAWNA zgoda „zapomniany PIN = notatek nie odzyska nikt”;
//   • odblokowanie raz na sesję (sama blokada po 20 min bezczynności);
//   • „Zmień PIN” (te same notatki, nowe zabezpieczenie) i „Nie pamiętam PIN-u” (usuwa MOJE notatki, po potwierdzeniu).
import React, { useState } from 'react';
import { AlertTriangle, KeyRound, Lock, LockOpen, ShieldCheck, Trash2, X } from 'lucide-react';
import { useNoteVault } from '../hooks/useGroup';
import { vaultChangePin, vaultDismissNotice, vaultForgetAll, vaultInit, vaultLock, vaultSetup, vaultUnlock } from '../services/noteVault';
import { PIN_MIN, PIN_RULES, pinIsWeak } from '../services/noteCrypto';

const inputCls = 'tap mt-1 w-full bg-surf border border-line rounded-lg px-3 text-base text-fg focus:outline-none focus:border-sky-400/40';
const btnMain = 'tap inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-500/25 text-acc border border-sky-400/40 text-sm font-semibold cursor-pointer disabled:opacity-50';
const btnGhost = 'tap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-line text-fg2 text-sm hover:bg-surf2 cursor-pointer disabled:opacity-50';
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const PinInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; name: string }> = ({ label, value, onChange, autoFocus, name }) => (
  <label className="block text-sm text-mut">{label}
    <input type="password" name={name} value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus}
      autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={128} className={inputCls} />
  </label>
);

/** Zamiast edytora, gdy notatki są zablokowane / PIN nieustawiony / trwa odszyfrowanie. */
export const NoteLock: React.FC = () => {
  const v = useNoteVault();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [forget, setForget] = useState(false);
  const [forgetAgree, setForgetAgree] = useState(false);

  const run = async (f: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await f(); setPin(''); setPin2(''); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  if (v.status === 'loading' || v.status === 'unlocked' || v.status === 'unavailable')
    return <p className="mt-2 text-sm text-mut" role="status">{v.status === 'unlocked' ? 'Odszyfrowuję notatki…' : 'Sprawdzam zabezpieczenie notatek…'}</p>;

  if (v.status === 'error') return (
    <div className="mt-2 space-y-2">
      <p role="alert" className="flex items-start gap-1.5 text-sm text-bad"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />Nie udało się sprawdzić zabezpieczenia notatek — spróbuj za chwilę.</p>
      <button className={btnGhost} onClick={() => void vaultInit()}>Spróbuj ponownie</button>
    </div>
  );

  if (v.status === 'nokey') {
    const stale = v.error && !err ? <p role="alert" className="text-sm text-warn">{v.error}</p> : null;
    const weak = pin.length >= PIN_MIN && pinIsWeak(pin);
    return (
      <form className="mt-2 space-y-2 min-w-0" onSubmit={e => { e.preventDefault(); if (agree) void run(() => vaultSetup(pin, pin2)); }}>
        <p className="flex items-start gap-1.5 text-sm text-fg"><ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-ok" />
          Ustaw PIN do notatek. Notatki szyfrują się w Twoim telefonie/komputerze, zanim trafią do bazy — prowadząca i administrator widzą w bazie tylko szyfrogram.
          Krótki PIN z samych cyfr ktoś z kopią bazy mógłby jednak odgadnąć — dłuższy PIN albo kilka słów chroni mocniej.</p>
        <PinInput name="note-pin-new" label={`PIN do notatek (co najmniej ${PIN_MIN} znaków${PIN_RULES.requireLetter ? ', w tym litera' : ' — mogą być litery'})`} value={pin} onChange={setPin} />
        <PinInput name="note-pin-new2" label="Powtórz PIN" value={pin2} onChange={setPin2} />
        {stale}
        {weak && <p className="text-sm text-mut">Wskazówka: dłuższy PIN albo kilka słów (np. „zielony kubek rano”) chroni lepiej niż same cyfry.</p>}
        <label className="flex items-start gap-2 text-sm text-fg cursor-pointer">
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1 w-5 h-5 shrink-0" />
          <span><b>Rozumiem:</b> jeśli zapomnę PIN, moich notatek nie odzyska nikt — ani prowadząca, ani administrator. Zapiszę go w bezpiecznym miejscu.</span>
        </label>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <button type="submit" className={btnMain} disabled={busy || !agree || !pin || !pin2}>
          <KeyRound className="w-4 h-4" />{busy ? 'Ustawiam…' : 'Ustaw PIN i zaszyfruj notatki'}
        </button>
      </form>
    );
  }

  // locked
  return (
    <div className="mt-2 space-y-2 min-w-0">
      {v.draining && <p role="status" className="text-sm text-mut">Blokuję… dokańczam zapis</p>}
      <form className="space-y-2" onSubmit={e => { e.preventDefault(); void run(() => vaultUnlock(pin)); }}>
        <p className="flex items-start gap-1.5 text-sm text-fg"><Lock className="w-4 h-4 mt-0.5 shrink-0 text-acc" />Notatki są zaszyfrowane. Wpisz PIN do notatek, żeby je otworzyć.</p>
        {v.error && !err && <p role="alert" className="text-sm text-warn">{v.error}</p>}
        <PinInput name="note-pin" label="PIN do notatek" value={pin} onChange={setPin} autoFocus={false} />
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnMain} disabled={busy || !pin || !!v.draining}><LockOpen className="w-4 h-4" />{busy ? 'Otwieram…' : 'Odblokuj notatki'}</button>
          {!forget && <button type="button" className={btnGhost} onClick={() => setForget(true)}>Nie pamiętam PIN-u</button>}
        </div>
      </form>
      {forget && (
        <div role="group" aria-label="Nie pamiętam PIN-u" className="rounded-lg border border-rose-400/30 bg-rose-500/5 p-3 space-y-2">
          <p className="text-sm text-fg">Bez PIN-u zaszyfrowanych notatek nie da się odczytać — nikt nie ma zapasowego klucza.
            Możesz je <b>usunąć</b> i ustawić nowy PIN (notatki zaczniesz od nowa). Tego nie da się cofnąć.</p>
          <label className="flex items-start gap-2 text-sm text-fg cursor-pointer">
            <input type="checkbox" checked={forgetAgree} onChange={e => setForgetAgree(e.target.checked)} className="mt-1 w-5 h-5 shrink-0" />
            <span>Tak, usuń wszystkie moje notatki do zajęć.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="tap inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-rose-400/40 bg-rose-500/15 text-bad text-sm font-semibold cursor-pointer disabled:opacity-50"
              disabled={busy || !forgetAgree} onClick={() => void run(async () => { await vaultForgetAll(); setForget(false); setForgetAgree(false); })}>
              <Trash2 className="w-4 h-4" />Usuń notatki i ustaw nowy PIN
            </button>
            <button className={btnGhost} onClick={() => { setForget(false); setForgetAgree(false); }}><X className="w-4 h-4" />Anuluj</button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Pasek pod edytorem (tylko przy zaszyfrowanych notatkach): „Zablokuj” + „Zmień PIN”. */
export const NoteLockBar: React.FC = () => {
  const v = useNoteVault();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [c, setC] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (v.status !== 'unlocked') return null;

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      await vaultChangePin(a, b, c);
      setA(''); setB(''); setC(''); setOpen(false);
      setMsg({ ok: true, text: 'PIN zmieniony. Notatki otwieraj teraz nowym PIN-em.' });
    } catch (e) { setMsg({ ok: false, text: errMsg(e) }); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className={btnGhost} onClick={() => void vaultLock()}><Lock className="w-4 h-4" />Zablokuj notatki</button>
        {!open && <button className={btnGhost} onClick={() => { setOpen(true); setMsg(null); }}><KeyRound className="w-4 h-4" />Zmień PIN</button>}
      </div>
      {open && (
        <form className="rounded-lg border border-line p-3 space-y-2" onSubmit={e => { e.preventDefault(); void submit(); }}>
          <PinInput name="note-pin-old" label="Obecny PIN" value={a} onChange={setA} />
          <PinInput name="note-pin-new" label={`Nowy PIN (co najmniej ${PIN_MIN} znaków)`} value={b} onChange={setB} />
          <PinInput name="note-pin-new2" label="Powtórz nowy PIN" value={c} onChange={setC} />
          <p className="text-sm text-mut">Notatki zostają te same. Nowego PIN-u też nikt nie odzyska — zapisz go w bezpiecznym miejscu.</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnMain} disabled={busy || !a || !b || !c}>{busy ? 'Zmieniam…' : 'Zmień PIN'}</button>
            <button type="button" className={btnGhost} onClick={() => { setOpen(false); setA(''); setB(''); setC(''); setMsg(null); }}><X className="w-4 h-4" />Anuluj</button>
          </div>
        </form>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
    </div>
  );
};

/** Trwały komunikat globalny (O4/R2-3): zmiana notatki nie została zapisana, a edytora już nie ma (blokada, wylogowanie,
 *  zmiana zajęć). Niezapisany tekst — tylko z pamięci tej karty, do skopiowania; „Zamknij” go zapomina. */
export const NoteNotice: React.FC = () => {
  const v = useNoteVault();
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState('');
  if (!v.notice) return null;
  const list = v.unsaved ?? [];
  const asText = (u: { title: string; note: string }) => (u.title ? `${u.title}\n\n${u.note}` : u.note);
  const copy = async (t: string, id: string) => {
    try { await navigator.clipboard.writeText(t); setCopied(id); } catch { setCopied(''); }
  };
  return (
    <div role="alert" className="fixed inset-x-0 top-20 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto max-w-md w-full max-h-[70vh] overflow-y-auto rounded-xl border border-rose-400/40 bg-panel shadow-lg p-3 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-bad" />
          <p className="text-sm text-fg flex-1">{v.notice}</p>
          <button onClick={() => { setShow(false); vaultDismissNotice(); }} className="tap shrink-0 inline-flex items-center justify-center min-w-11 rounded-full border border-line text-fg2 cursor-pointer" aria-label="Zamknij komunikat"><X className="w-4 h-4" /></button>
        </div>
        {list.length > 0 && !show && (
          <button onClick={() => setShow(true)} className={btnGhost}>Pokaż niezapisany tekst</button>
        )}
        {show && list.map(u => (
          <div key={u.meetingId} className="space-y-1">
            <textarea readOnly value={asText(u)} rows={5} aria-label="Niezapisany tekst notatki"
              className="w-full bg-surf border border-line rounded-lg px-3 py-2 text-base text-fg leading-relaxed" />
            <button onClick={() => void copy(asText(u), u.meetingId)} className={btnGhost}>{copied === u.meetingId ? 'Skopiowano' : 'Kopiuj'}</button>
          </div>
        ))}
      </div>
    </div>
  );
};
