// PATH: src/services/noteVault.ts | REQ-ID: TERAPIA-CRYPTO-02
// Sejf klucza notatek (D042): DEK żyje WYŁĄCZNIE w pamięci tej karty — nie w localStorage, nie w bazie (tam tylko owinięty).
// Stany: loading → (unavailable | error | nokey | locked | unlocked).
//   unavailable = baza bez migracji 0016 (brak tabeli note_keys) → notatki działają jak przed 0.16 (jawnie), nic nie psujemy;
//   nokey       = osoba nie ustawiła jeszcze PIN-u do notatek;
//   locked      = PIN ustawiony, trzeba odblokować (raz na sesję);
//   unlocked    = DEK w pamięci; blokada sama po 20 min bezczynności, po powrocie do karty po > 5 min i po przywróceniu
//                 strony z pamięci wstecz (jak u Aliny — EncryptionGate).
// Ekrany nie dotykają kluczy — tylko seal()/open() (useGroup) i formularze PIN-u (NoteLock).
import { groupData } from './groupData';
import {
  createKeyRecord, decryptField, encryptField, isEncrypted, openKeyRecord, pinProblem, rewrapKeyRecord, type NoteKeyRecord,
} from './noteCrypto';
import type { MeetingNote } from '../types/group';

export type VaultStatus = 'loading' | 'unavailable' | 'error' | 'nokey' | 'locked' | 'unlocked';
export interface VaultState { status: VaultStatus; error?: string }

const IDLE_MS = 20 * 60 * 1000;
const SUSPEND_MS = 5 * 60 * 1000;
/** Po zablokowaniu klucz jeszcze chwilę wolno użyć do ZAPISU (autozapis z odmontowywanego edytora) — nigdy do odczytu. */
const SAVE_GRACE_MS = 3000;

let state: VaultState = { status: 'loading' };
let record: NoteKeyRecord | null = null;
let dek: CryptoKey | null = null;
let graceDek: CryptoKey | null = null;
let graceTimer: ReturnType<typeof setTimeout> | undefined;
let uid = '';
let unlockGen = 0;
const listeners = new Set<() => void>();

const emit = (s: VaultState) => { state = s; listeners.forEach(f => f()); };
export const vaultState = () => state;
export const vaultSubscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
/** Numer odblokowania — rośnie przy każdym „unlocked” (useGroup migruje stare jawne notatki raz na odblokowanie). */
export const vaultGeneration = () => unlockGen;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Wczytaj (albo odśwież po zalogowaniu) rekord klucza zalogowanej osoby. */
export async function vaultInit(): Promise<void> {
  const me = groupData.currentUserId();
  if (me !== uid) { hardLock(); uid = me; record = null; }
  if (state.status === 'unlocked') return;
  try {
    const r = await groupData.noteKey();
    if (r === 'unavailable') { record = null; emit({ status: 'unavailable' }); return; }
    record = r;
    emit({ status: r ? 'locked' : 'nokey' });
  } catch (e) {
    emit({ status: 'error', error: msg(e) });
  }
}

function startUnlocked(key: CryptoKey) {
  clearTimeout(graceTimer); graceDek = null;
  dek = key; unlockGen++;
  armIdle();
  emit({ status: 'unlocked' });
}

/** Pierwsze ustawienie PIN-u. Rzuca czytelny błąd po polsku. */
export async function vaultSetup(pin: string, pin2: string): Promise<void> {
  const p = pinProblem(pin); if (p) throw new Error(p);
  if (pin !== pin2) throw new Error('PIN-y się różnią — wpisz ten sam dwa razy.');
  if (state.status !== 'nokey') throw new Error('PIN do notatek jest już ustawiony.');
  const { record: rec, dek: key } = await createKeyRecord(pin, uid);
  try {
    await groupData.createNoteKey(rec);
  } catch (e) {
    if (msg(e) === 'KEY_EXISTS') { await vaultInit(); throw new Error('PIN ustawiono w międzyczasie na innym urządzeniu — odblokuj nim notatki.'); }
    throw e;
  }
  record = rec;
  startUnlocked(key);
}

let badTries = 0;
/** Odblokowanie PIN-em. Zły PIN → „Zły PIN.” (po kolejnych pomyłkach z krótką przerwą). */
export async function vaultUnlock(pin: string): Promise<void> {
  if (!record) throw new Error('Brak PIN-u do odblokowania.');
  if (badTries >= 3) await new Promise(r => setTimeout(r, Math.min(30, 2 ** (badTries - 2)) * 1000));
  try {
    const key = await openKeyRecord(record, pin, uid);
    badTries = 0;
    startUnlocked(key);
  } catch (e) {
    if (msg(e) === 'BAD_PIN') { badTries++; throw new Error('Zły PIN.'); }
    throw e;
  }
}

/** Zmiana PIN-u: ten sam klucz notatek, nowe owinięcie. Notatek nie trzeba przepisywać. */
export async function vaultChangePin(oldPin: string, newPin: string, newPin2: string): Promise<void> {
  if (!record) throw new Error('PIN nie jest ustawiony.');
  const p = pinProblem(newPin); if (p) throw new Error(p);
  if (newPin !== newPin2) throw new Error('Nowe PIN-y się różnią.');
  let rec: NoteKeyRecord;
  try { rec = await rewrapKeyRecord(record, oldPin, newPin, uid); }
  catch (e) { throw new Error(msg(e) === 'BAD_PIN' ? 'Obecny PIN jest zły.' : msg(e)); }
  try {
    await groupData.replaceNoteKey(record.wrappedDek, rec);
  } catch (e) {
    if (msg(e) === 'KEY_CHANGED') { hardLock(); await vaultInit(); throw new Error('PIN zmieniono w międzyczasie na innym urządzeniu — odblokuj nowym PIN-em.'); }
    throw e;
  }
  record = rec;
}

/** „Nie pamiętam PIN-u”: kasuje MOJE zaszyfrowane notatki i klucz (świadomie, po potwierdzeniu) → można ustawić nowy PIN. */
export async function vaultForgetAll(): Promise<void> {
  await groupData.resetMyNotes();
  hardLock(); record = null;
  emit({ status: 'nokey' });
}

/** Ręczna blokada / bezczynność. Klucz do ODCZYTU znika od razu; do dokończenia autozapisu — po 3 s. */
export function vaultLock() {
  if (state.status !== 'unlocked') return;
  graceDek = dek; dek = null;
  clearTimeout(graceTimer);
  graceTimer = setTimeout(() => { graceDek = null; }, SAVE_GRACE_MS);
  disarmIdle();
  emit({ status: record ? 'locked' : 'nokey' });
}

/** Wylogowanie / zmiana osoby: wszystko z pamięci od razu. */
export function hardLock() {
  dek = null; graceDek = null; clearTimeout(graceTimer); disarmIdle(); badTries = 0;
  if (state.status === 'unlocked') emit({ status: record ? 'locked' : 'nokey' });
}

// ── szyfrowanie notatek (dla useGroup) ───────────────────────────────────────
/** Zaszyfruj notatkę do zapisu. Bez 0016 (unavailable) — jawnie, jak przed 0.16. Zablokowane → błąd (nic nie idzie jawnie). */
export async function vaultSeal(meetingId: string, title: string, note: string): Promise<{ title: string; note: string }> {
  if (state.status === 'unavailable') return { title, note };
  const key = dek ?? graceDek;
  if (!key) throw new Error('Notatki są zablokowane — odblokuj je PIN-em.');
  const t = await encryptField(title, key, uid, meetingId, 'title');
  const n = await encryptField(note, key, uid, meetingId, 'note');
  // kontrola: to, co wysyłamy, na pewno się odszyfruje (nie zapiszemy czegoś, czego potem nie da się przeczytać)
  if (await decryptField(t, key, uid, meetingId, 'title') !== title || await decryptField(n, key, uid, meetingId, 'note') !== note)
    throw new Error('Kontrola szyfrowania nie przeszła — nic nie zapisano.');
  return { title: t, note: n };
}

/** Odszyfruj notatki z bazy. Niedająca się odczytać → `unreadable` (edycja tej jednej zablokowana, nie nadpiszemy). */
export async function vaultOpen(raw: Record<string, MeetingNote>): Promise<Record<string, MeetingNote>> {
  if (state.status === 'unavailable') return raw;
  const key = dek;
  if (!key) return {};
  const out: Record<string, MeetingNote> = {};
  for (const [id, n] of Object.entries(raw)) {
    try {
      out[id] = { ...n, title: await decryptField(n.title, key, uid, id, 'title'), note: await decryptField(n.note, key, uid, id, 'note') };
    } catch {
      out[id] = { ...n, title: '', note: '', unreadable: true };
    }
  }
  return out;
}

/** Czy notatka w bazie ma jeszcze jawną treść (sprzed szyfrowania) — do migracji przy odblokowaniu. */
export const isPlainNote = (n: MeetingNote) => (!!n.title && !isEncrypted(n.title)) || (!!n.note && !isEncrypted(n.note));

// ── blokada po bezczynności ──────────────────────────────────────────────────
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let lastActive = 0;
const ACT = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
const markActive = () => {
  lastActive = Date.now();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(vaultLock, IDLE_MS);
};
const onVisible = () => {
  if (document.visibilityState === 'visible' && Date.now() - lastActive > SUSPEND_MS) vaultLock();
  else if (document.visibilityState === 'hidden') lastActive = Date.now();
};
const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) vaultLock(); };
let armed = false;
function armIdle() {
  if (typeof window === 'undefined' || armed) { markActiveSafe(); return; }
  armed = true;
  ACT.forEach(ev => window.addEventListener(ev, markActive, { passive: true }));
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onPageShow);
  markActive();
}
function markActiveSafe() { if (typeof window !== 'undefined') markActive(); }
function disarmIdle() {
  clearTimeout(idleTimer);
  if (typeof window === 'undefined' || !armed) return;
  armed = false;
  ACT.forEach(ev => window.removeEventListener(ev, markActive));
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('pageshow', onPageShow);
}
