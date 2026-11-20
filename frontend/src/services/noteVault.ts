// PATH: src/services/noteVault.ts | REQ-ID: TERAPIA-CRYPTO-02
// Sejf klucza notatek (D042): DEK żyje WYŁĄCZNIE w pamięci tej karty — nie w localStorage, nie w bazie (tam tylko owinięty).
// Stany: loading → (unavailable | error | nokey | locked | unlocked).
//   unavailable = baza bez migracji 0016 (brak tabeli note_keys) → notatki działają jak przed 0.16 (jawnie), nic nie psujemy;
//   nokey       = osoba nie ustawiła jeszcze PIN-u do notatek;
//   locked      = PIN ustawiony, trzeba odblokować (raz na sesję);
//   unlocked    = DEK w pamięci; blokada sama po 20 min bezczynności, po powrocie do karty po > 5 min i po przywróceniu
//                 strony z pamięci wstecz (jak u Aliny — EncryptionGate).
// Poprawki po adwersarzu (20.11):
//   O2/O3 — rekord klucza (note_keys) pobierany ŚWIEŻO przed każdym odblokowaniem i zmianą PIN-u (inne urządzenie mogło zmienić
//           PIN albo zrobić „Nie pamiętam PIN-u”); każdy zapis niesie `dekId`, baza odrzuca nieaktualny klucz (KEY_STALE);
//           nieczytelne notatki → najpierw sprawdzenie, czy klucz w pamięci jest aktualny (vaultCheckFresh).
//   O4    — blokada dokańcza kolejkę zapisów edytorów (z kluczem), dopiero potem czyści klucz; nieudany zapis =
//           trwały komunikat (`notice`, pokazuje NoteNotice w App), nie w edytorze, który i tak znika.
// Runda 2 (R2-2): ekran blokuje się NATYCHMIAST (status „locked”, edytor znika, nie da się pisać); klucz zostaje w pamięci
//           (`drainDek`) WYŁĄCZNIE do szyfrowania zapisów już rozpoczętych, odczytu nim nie ma. `draining` → „Blokuję… dokańczam zapis”.
// (R2-3): niezapisany tekst (błąd zapisu, zapis > 30 s) trzymamy TYLKO w pamięci karty (`unsaved`) — NoteNotice pokazuje go
//           do skopiowania („Pokaż niezapisany tekst”); nigdy do localStorage ani do bazy.
// Ekrany nie dotykają kluczy — tylko seal()/open() (useGroup) i formularze PIN-u (NoteLock).
// Bez wartościowego importu groupData (źródło wstrzykuje groupData.ts przez vaultSetSource) — dzięki temu test jednostkowy
// w samym Node ładuje ten plik (R3-2). Rozszerzenia „.ts” w importach: Node bez kompilacji ich wymaga, Vite/tsc przyjmują.
import {
  createKeyRecord, decryptField, encryptField, isEncrypted, openKeyRecord, pinProblem, rewrapKeyRecord, type NoteKeyRecord,
} from './noteCrypto.ts';
import type { GroupDataSource } from './groupData.ts';
import type { MeetingNote } from '../types/group.ts';

/** To, czego sejf potrzebuje od źródła danych (demo albo Supabase). */
export type VaultSource = Pick<GroupDataSource, 'isDemo' | 'currentUserId' | 'noteKey' | 'createNoteKey' | 'replaceNoteKey' | 'resetMyNotes'>;
let src: VaultSource | null = null;
/** Podpina źródło danych (groupData.ts przy starcie; testy — atrapę). */
export function vaultSetSource(s: VaultSource) { src = s; }
const source = (): VaultSource => {
  if (!src) throw new Error('Sejf notatek bez źródła danych');
  return src;
};

export type VaultStatus = 'loading' | 'unavailable' | 'error' | 'nokey' | 'locked' | 'unlocked';
/** Niezapisany tekst + WŁAŚCICIEL (uid osoby, która go pisała) — R4-1: spóźnione wywołanie po zmianie osoby jest porzucane. */
export interface UnsavedNote { owner: string; meetingId: string; title: string; note: string }
export interface VaultState {
  status: VaultStatus;
  /** Trwa blokada: ekran już zablokowany, w tle dokańczam rozpoczęte zapisy (R2-2). */
  draining?: boolean;
  /** Niezapisany tekst do skopiowania — tylko w pamięci tej karty (R2-3). */
  unsaved?: UnsavedNote[];
  /** Komunikat przy formularzu PIN-u (np. „klucz zmieniono na innym urządzeniu”). */
  error?: string;
  /** Trwały komunikat globalny: zmiana notatki NIE została zapisana (blokada / wylogowanie / zapis z odmontowanego edytora). */
  notice?: string;
}

const IDLE_MS = 20 * 60 * 1000;
const SUSPEND_MS = 5 * 60 * 1000;
/** Ile najdłużej blokada czeka na dokończenie zapisów (wolne łącze). Potem i tak blokuje, z komunikatem. */
const DRAIN_MAX_MS = 30_000;

let state: VaultState = { status: 'loading' };
let record: NoteKeyRecord | null = null;
let dek: CryptoKey | null = null;
/** Klucz tylko do dokończenia rozpoczętych zapisów podczas blokady (R2-2) — nigdy do odczytu. */
let drainDek: CryptoKey | null = null;
let draining = false;
let uid = '';
let unlockGen = 0;
let locking: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = (s: VaultState) => {
  state = { ...s, notice: s.notice ?? state.notice, unsaved: state.unsaved, draining };
  listeners.forEach(f => f());
};
const touch = () => { state = { ...state, draining }; listeners.forEach(f => f()); };
export const vaultState = () => state;
export const vaultSubscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
/** Numer odblokowania — rośnie przy każdym „unlocked” (useGroup migruje stare jawne notatki raz na odblokowanie). */
export const vaultGeneration = () => unlockGen;
/** Id klucza w pamięci (do zapisu) — null, gdy zablokowane. */
export const vaultDekId = () => (dek && record ? record.dekId : null);

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const STALE_MSG = 'Klucz notatek zmieniono na innym urządzeniu (nowy PIN albo „Nie pamiętam PIN-u”) — odblokuj notatki aktualnym PIN-em.';

// ── trwały komunikat ─────────────────────────────────────────────────────────
export function vaultNotice(text: string) { state = { ...state, notice: text }; listeners.forEach(f => f()); }
/** Zamknięcie komunikatu kasuje też niezapisany tekst z pamięci (użytkownik zdecydował). */
export function vaultDismissNotice() { state = { ...state, notice: undefined, unsaved: undefined }; listeners.forEach(f => f()); }
/** Zapamiętaj (w pamięci karty) niezapisany tekst notatki + komunikat (R2-3). Jedna pozycja na zajęcia — najnowsza. */
export function vaultUnsaved(u: UnsavedNote, why: string) {
  // R4-1: tekst tylko dla właściciela — po wylogowaniu / zmianie osoby porzucamy go po cichu (bez logu treści)
  if (!u.owner || u.owner !== uid) return;
  const list = (state.unsaved ?? []).filter(x => x.meetingId !== u.meetingId);
  state = { ...state, unsaved: [...list, u], notice: `Ostatnia zmiana w notatce NIE została zapisana (${why}). Niezapisany tekst jest tylko w tej karcie — skopiuj go.` };
  listeners.forEach(f => f());
}
/** Zapis jednak doszedł (np. po przekroczeniu czasu blokady) — usuń tę pozycję z niezapisanych. */
export function vaultSavedOk(meetingId: string) {
  if (!state.unsaved?.some(x => x.meetingId === meetingId)) return;
  const unsaved = state.unsaved.filter(x => x.meetingId !== meetingId);
  state = { ...state, unsaved: unsaved.length ? unsaved : undefined, notice: unsaved.length ? state.notice : undefined };
  listeners.forEach(f => f());
}
/** Kto jest teraz zalogowany w sejfie (edytor zapamiętuje to przy montowaniu jako właściciela tekstu). */
export const vaultOwner = () => uid;
/** Czy trwa blokada z dokańczaniem zapisów (edytor może jeszcze dosłać rozpoczęty zapis). */
export const vaultIsDraining = () => draining;

// ── kolejka zapisów edytorów (O4) ────────────────────────────────────────────
const pending = new Map<Promise<boolean>, () => UnsavedNote | null>();
const flushers = new Set<() => void>();
/** Edytor zgłasza swoją pętlę zapisów (true = zapisane, false = błąd) i jak odczytać to, czego jeszcze nie zapisano.
 *  Blokada czeka, aż wszystkie się skończą; po przekroczeniu czasu zabiera niezapisany tekst do komunikatu (R2-3). */
export function vaultTrack(p: Promise<boolean>, unsavedOf: () => UnsavedNote | null): Promise<boolean> {
  pending.set(p, unsavedOf);
  void p.finally(() => pending.delete(p));
  return p;
}
/** Edytor rejestruje „zapisz teraz” (niezapisane zmiany czekające na autozapis) — woła je blokada przed czyszczeniem klucza. */
export function vaultRegisterFlusher(f: () => void): () => void { flushers.add(f); return () => { flushers.delete(f); }; }

/** Zapis trwa dłużej niż czeka blokada — przenieś niezapisany tekst do komunikatu, zanim klucz zniknie (R2-3). */
function keepUnsaved() {
  for (const get of pending.values()) {
    const u = get();
    if (u) vaultUnsaved(u, 'zapis trwał za długo, notatki zablokowano');
  }
}

/** Demo: test może skrócić czas czekania blokady (localStorage 'terapia_test_drain_ms'); wersja z bazą — zawsze 30 s. */
function drainMax(): number {
  if (!source().isDemo) return DRAIN_MAX_MS;
  try { return Number(localStorage.getItem('terapia_test_drain_ms')) || DRAIN_MAX_MS; } catch { return DRAIN_MAX_MS; }
}

async function drain(): Promise<boolean> {
  const until = Date.now() + drainMax();
  let ok = true;
  for (let round = 0; round < 20; round++) {
    flushers.forEach(f => { try { f(); } catch { /* edytor sam pokaże błąd */ } });
    await Promise.resolve();
    if (!pending.size) break;
    const left = until - Date.now();
    if (left <= 0) { keepUnsaved(); return false; }
    const res = await Promise.race([
      Promise.all([...pending.keys()]),
      new Promise<'timeout'>(r => setTimeout(() => r('timeout'), left)),
    ]);
    if (res === 'timeout') { keepUnsaved(); return false; }
    if (res.some(x => !x)) ok = false;
  }
  return ok;
}

// ── rekord klucza ────────────────────────────────────────────────────────────
/** Świeży rekord z bazy. undefined = nie udało się (sieć) — wołający decyduje, czy użyć zapamiętanego. */
async function fetchRecord(): Promise<NoteKeyRecord | null | 'unavailable' | undefined> {
  try { return await source().noteKey(); } catch { return undefined; }
}

/** Wczytaj (albo odśwież po zalogowaniu) rekord klucza zalogowanej osoby. */
export async function vaultInit(): Promise<void> {
  const me = source().currentUserId();
  if (me !== uid) { vaultForgetUser(); uid = me; } // R3-2: nic po poprzedniej osobie (klucz, niezapisany tekst, komunikat)
  if (state.status === 'unlocked') return;
  try {
    const r = await source().noteKey();
    if (r === 'unavailable') { record = null; emit({ status: 'unavailable' }); return; }
    record = r;
    emit({ status: r ? 'locked' : 'nokey', error: state.error });
  } catch (e) {
    emit({ status: 'error', error: msg(e) });
  }
}

function startUnlocked(rec: NoteKeyRecord, key: CryptoKey) {
  record = rec; dek = key; unlockGen++;
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
    await source().createNoteKey(rec);
  } catch (e) {
    if (msg(e) === 'KEY_EXISTS') { await vaultInit(); throw new Error('PIN ustawiono w międzyczasie na innym urządzeniu — odblokuj nim notatki.'); }
    if (msg(e) === 'NO_ACCOUNT') throw new Error('Twoje konto nie ma jeszcze profilu w grupie, więc notatek nie da się zaszyfrować. Napisz do prowadzącej.');
    throw e;
  }
  startUnlocked(rec, key);
}

let badTries = 0;
/** Odblokowanie PIN-em — zawsze na ŚWIEŻYM rekordzie klucza z bazy (O2/O3). Zły PIN → „Zły PIN.”. */
export async function vaultUnlock(pin: string): Promise<void> {
  if (badTries >= 3) await new Promise(r => setTimeout(r, Math.min(30, 2 ** (badTries - 2)) * 1000));
  const fresh = await fetchRecord();
  if (fresh === 'unavailable') { record = null; emit({ status: 'unavailable' }); return; }
  if (fresh === null) {
    record = null; emit({ status: 'nokey', error: undefined });
    throw new Error('PIN do notatek usunięto na innym urządzeniu („Nie pamiętam PIN-u”) — ustaw nowy PIN.');
  }
  if (fresh) record = fresh;
  if (!record) throw new Error('Nie udało się sprawdzić PIN-u (brak połączenia) — spróbuj za chwilę.');
  const rec = record;
  try {
    const key = await openKeyRecord(rec, pin, uid);
    badTries = 0;
    startUnlocked(rec, key);
  } catch (e) {
    if (msg(e) !== 'BAD_PIN') throw e;
    // rekord mógł być z pamięci (sieć padła) albo zmienić się w tej sekundzie — jeszcze jedna próba na świeżym
    const again = await fetchRecord();
    if (again && again !== 'unavailable' && again.wrappedDek !== rec.wrappedDek) {
      record = again;
      try { const key = await openKeyRecord(again, pin, uid); badTries = 0; startUnlocked(again, key); return; } catch { /* zły też tutaj */ }
    }
    badTries++;
    throw new Error('Zły PIN.');
  }
}

/** Zmiana PIN-u: ten sam klucz notatek, nowe owinięcie (na świeżym rekordzie). Notatek nie trzeba przepisywać. */
export async function vaultChangePin(oldPin: string, newPin: string, newPin2: string): Promise<void> {
  const p = pinProblem(newPin); if (p) throw new Error(p);
  if (newPin !== newPin2) throw new Error('Nowe PIN-y się różnią.');
  const fresh = await fetchRecord();
  if (fresh && fresh !== 'unavailable') {
    if (record && fresh.dekId !== record.dekId) { await staleLock(fresh); throw new Error(STALE_MSG); }
    record = fresh;
  }
  if (!record) throw new Error('PIN nie jest ustawiony.');
  let rec: NoteKeyRecord;
  try { rec = await rewrapKeyRecord(record, oldPin, newPin, uid); }
  catch (e) { throw new Error(msg(e) === 'BAD_PIN' ? 'Obecny PIN jest zły.' : msg(e)); }
  try {
    await source().replaceNoteKey(record.wrappedDek, rec);
  } catch (e) {
    if (msg(e) === 'KEY_CHANGED') { hardLock(); await vaultInit(); throw new Error('PIN zmieniono w międzyczasie na innym urządzeniu — odblokuj nowym PIN-em.'); }
    throw e;
  }
  record = rec;
}

/** „Nie pamiętam PIN-u”: kasuje MOJE notatki i klucz jedną transakcją (świadomie, po potwierdzeniu) → można ustawić nowy PIN. */
export async function vaultForgetAll(): Promise<void> {
  await source().resetMyNotes();
  hardLock(); record = null;
  emit({ status: 'nokey', error: undefined });
}

/** Czy klucz w pamięci jest wciąż kluczem z bazy. Nie → blokada z komunikatem (STALE_MSG). Sieć padła → true (nie wiemy). */
export async function vaultCheckFresh(): Promise<boolean> {
  if (state.status !== 'unlocked' || !record) return true;
  const fresh = await fetchRecord();
  if (fresh === undefined || fresh === 'unavailable') return true;
  if (fresh && fresh.dekId === record.dekId) { record = fresh; return true; }
  await staleLock(fresh);
  return false;
}
async function staleLock(fresh: NoteKeyRecord | null) {
  hardLock();
  record = fresh;
  emit({ status: fresh ? 'locked' : 'nokey', error: STALE_MSG });
}

/** Ręczna blokada / bezczynność / wylogowanie. Ekran blokuje się OD RAZU (R2-2); klucz zostaje tylko do dokończenia
 *  rozpoczętych zapisów (O4), potem znika. Zwraca obietnicę końca dokańczania. */
export function vaultLock(): Promise<void> {
  if (locking) return locking;
  if (state.status !== 'unlocked') return Promise.resolve();
  drainDek = dek; dek = null; draining = true;
  disarmIdle();
  emit({ status: record ? 'locked' : 'nokey', error: undefined });
  locking = (async () => {
    const ok = await drain();
    if (!ok && !state.unsaved?.length)
      vaultNotice('Ostatnia zmiana w notatce NIE została zapisana przed zablokowaniem (brak połączenia albo błąd zapisu). Odblokuj notatki i sprawdź treść.');
  })().finally(() => { drainDek = null; draining = false; locking = null; touch(); });
  return locking;
}

/** Natychmiast, bez zapisów (sesja już nie istnieje: wylogowanie w innej karcie, zmiana osoby). */
/** Wylogowanie / zmiana osoby (R3-2): klucz, rekord, niezapisany tekst i komunikat — wszystko z pamięci; następna osoba
 *  w tej karcie nie zobaczy niczego po poprzedniej. */
export function vaultForgetUser() {
  hardLock();
  record = null; uid = '';
  state = { status: 'loading' };   // bez unsaved/notice/error poprzedniej osoby
  listeners.forEach(f => f());
}

export function hardLock() {
  dek = null; drainDek = null; disarmIdle(); badTries = 0;
  if (state.status === 'unlocked') emit({ status: record ? 'locked' : 'nokey' });
}

// ── szyfrowanie notatek (dla useGroup) ───────────────────────────────────────
/** Zaszyfruj notatkę do zapisu. Bez 0016 (unavailable) — jawnie, jak przed 0.16 (dekId undefined = bez kolumny).
 *  Zablokowane → błąd (nic nie idzie jawnie). */
export async function vaultSeal(meetingId: string, title: string, note: string): Promise<{ title: string; note: string; dekId?: string }> {
  if (state.status === 'unavailable') return { title, note };
  const key = dek ?? drainDek; // drainDek: tylko dokończenie zapisów rozpoczętych przed blokadą (R2-2)
  const rec = record;
  if (!key || !rec) throw new Error('Notatki są zablokowane — odblokuj je PIN-em.');
  const t = await encryptField(title, key, uid, meetingId, 'title');
  const n = await encryptField(note, key, uid, meetingId, 'note');
  // kontrola: to, co wysyłamy, na pewno się odszyfruje (nie zapiszemy czegoś, czego potem nie da się przeczytać)
  if (await decryptField(t, key, uid, meetingId, 'title') !== title || await decryptField(n, key, uid, meetingId, 'note') !== note)
    throw new Error('Kontrola szyfrowania nie przeszła — nic nie zapisano.');
  return { title: t, note: n, dekId: rec.dekId };
}

/** Odszyfruj notatki z bazy. Niedająca się odczytać → `unreadable` (edycja tej jednej zablokowana, można ją usunąć). */
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
  idleTimer = setTimeout(() => { void vaultLock(); }, IDLE_MS);
};
const onVisible = () => {
  if (document.visibilityState === 'visible' && Date.now() - lastActive > SUSPEND_MS) void vaultLock();
  else if (document.visibilityState === 'hidden') lastActive = Date.now();
};
const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) void vaultLock(); };
let armed = false;
function armIdle() {
  if (typeof window === 'undefined') return;
  if (armed) { markActive(); return; }
  armed = true;
  ACT.forEach(ev => window.addEventListener(ev, markActive, { passive: true }));
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onPageShow);
  markActive();
}
function disarmIdle() {
  clearTimeout(idleTimer);
  if (typeof window === 'undefined' || !armed) return;
  armed = false;
  ACT.forEach(ev => window.removeEventListener(ev, markActive));
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('pageshow', onPageShow);
}
