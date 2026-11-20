// PATH: src/services/noteCrypto.ts | REQ-ID: TERAPIA-CRYPTO-01
// Szyfrowanie prywatnych notatek PO STRONIE PRZEGLĄDARKI (D042, Bartek 20.11: „Terapia — dane osobowe, notatki szyfruj”).
// Wzorzec: CRM Aliny (`CRM-Atomic/src/legacy-v1/services/crypto.ts`) — szyfrowanie kopertowe:
//   • DEK  = losowy klucz AES-256-GCM, jeden na osobę; w bazie leży TYLKO owinięty KEK-iem (tabela note_keys, 0016);
//   • KEK  = klucz z PIN-u przez PBKDF2-SHA256 (600 000 iteracji, sól 16 B na osobę) — nigdy nie opuszcza przeglądarki;
//   • pole = "rr1:" + Base64( IV[12] || szyfrogram+znacznik GCM ).
// Różnice względem Aliny (świadome):
//   1. Jawny prefiks „rr1:” zamiast heurystyki looksEncrypted() — notatka uczestnika może sama wyglądać jak Base64
//      (np. „Abcdefghijklmnopqrstuvwxyz1234”), heurystyka uznałaby ją za szyfrogram i „zgubiła”. Prefiks = zero pomyłek
//      i wersja formatu na przyszłość. `isEncrypted()` rozpoznaje stare JAWNE notatki (migracja przy odblokowaniu).
//   2. AAD (dane uwierzytelnione) = osoba + zajęcia + pole: szyfrogramu nie da się przełożyć do innych zajęć / innej osoby
//      ani zamienić tytułu z treścią — odszyfrowanie takiej podmiany kończy się błędem, nie cudzą treścią.
//   3. Base64 kawałkami (bez `String.fromCharCode(...wielka_tablica)` — przy 60 KB notatce to przepełnia stos).
//   4. DEK po odblokowaniu NIE daje się wyeksportować (extractable=false); zmiana PIN-u odwija go ponownie starym PIN-em.
// Plik bez importów — testy jednostkowe uruchamia sam Node (`npm test`, globalny WebCrypto).

export const ENC_PREFIX = 'rr1:';
export const PBKDF2_ITER = 600_000;
/** JEDNO miejsce wymagań PIN-u (O5, decyzja Bartka w toku): zmiana tutaj = zmiana w formularzach, komunikatach i testach. */
export const PIN_RULES = {
  minLength: 6,
  /** true = PIN musi zawierać literę (same cyfry odrzucone). Dziś false — tylko podpowiedź „dłuższy / kilka słów”. */
  requireLetter: false,
} as const;
export const PIN_MIN = PIN_RULES.minLength;
const KEY_AAD = 'terapia/note_keys/v1/';
const FIELD_AAD = 'terapia/meeting_notes/v1/';

const subtle = () => globalThis.crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder();

// ── Base64 ────────────────────────────────────────────────────────────────────
export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const join = (a: Uint8Array, b: ArrayBuffer): string => {
  const r = new Uint8Array(a.byteLength + b.byteLength);
  r.set(a, 0); r.set(new Uint8Array(b), a.byteLength);
  return toB64(r);
};

const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
/** Czy pole jest naszym szyfrogramem (prefiks + poprawny Base64 o długości ≥ IV + znacznik). Stara jawna notatka → false.
 *  TA SAMA reguła co w bazie (0016: meeting_notes_*_len i wyzwalacz) — jawny tekst zaczynający się od „rr1:” jest jawny. */
export function isEncrypted(s: string | null | undefined): boolean {
  if (!s || !s.startsWith(ENC_PREFIX)) return false;
  const body = s.slice(ENC_PREFIX.length);
  return body.length >= 40 && body.length % 4 === 0 && B64_RE.test(body);
}

// ── Klucze ────────────────────────────────────────────────────────────────────
export function randomSalt(): Uint8Array<ArrayBuffer> { return globalThis.crypto.getRandomValues(new Uint8Array(16)); }
const randomIV = () => globalThis.crypto.getRandomValues(new Uint8Array(12));

/** Nowy DEK. Tylko w chwili ustawiania PIN-u jest „do wyeksportowania” (żeby go owinąć). */
export function generateDEK(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** KEK z PIN-u (PBKDF2-SHA256). PIN nie jest nigdzie zapisywany. */
export async function deriveKEK(pin: string, salt: Uint8Array<ArrayBuffer>, iter = PBKDF2_ITER): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', te.encode(pin.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}

/** Owiń DEK KEK-iem → Base64( IV || owinięty DEK + znacznik ). AAD = osoba (blob nie przenosi się na inne konto). */
export async function wrapDEK(dek: CryptoKey, kek: CryptoKey, memberId: string): Promise<string> {
  const iv = randomIV();
  const w = await subtle().wrapKey('raw', dek, kek, { name: 'AES-GCM', iv, additionalData: te.encode(KEY_AAD + memberId) });
  return join(iv, w);
}

/** Zły PIN (albo cudzy / uszkodzony blob) → Error('BAD_PIN'). */
export async function unwrapDEK(wrapped: string, kek: CryptoKey, memberId: string, extractable = false): Promise<CryptoKey> {
  const raw = fromB64(wrapped);
  try {
    return await subtle().unwrapKey('raw', raw.slice(12), kek,
      { name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: te.encode(KEY_AAD + memberId) },
      { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
  } catch {
    throw new Error('BAD_PIN');
  }
}

// ── Pola notatki ──────────────────────────────────────────────────────────────
export type NoteField = 'title' | 'note';
const fieldAad = (memberId: string, meetingId: string, field: NoteField) => te.encode(`${FIELD_AAD}${memberId}/${meetingId}/${field}`);

/** Zaszyfruj pole. Puste zostaje puste (pusta notatka ≠ treść; „usuwanie tylko przyciskiem” działa jak dotąd). */
export async function encryptField(plain: string, dek: CryptoKey, memberId: string, meetingId: string, field: NoteField): Promise<string> {
  if (plain === '') return '';
  const iv = randomIV();
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: fieldAad(memberId, meetingId, field) }, dek, te.encode(plain));
  return ENC_PREFIX + join(iv, ct);
}

/** Odszyfruj pole. Jawne (stara notatka sprzed szyfrowania) wraca bez zmian. Podmiana / uszkodzenie → wyjątek. */
export async function decryptField(stored: string, dek: CryptoKey, memberId: string, meetingId: string, field: NoteField): Promise<string> {
  if (!isEncrypted(stored)) return stored;
  const raw = fromB64(stored.slice(ENC_PREFIX.length));
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: fieldAad(memberId, meetingId, field) }, dek, raw.slice(12));
  return td.decode(pt);
}

// ── Rekord klucza (wiersz note_keys) ──────────────────────────────────────────
export interface NoteKeyRecord {
  wrappedDek: string;
  salt: string;      // Base64, 16 B
  iter: number;
  /** Identyfikator KLUCZA NOTATEK (DEK): stały przy zmianie PIN-u, nowy po „Nie pamiętam PIN-u”. Każdy zapis szyfrogramu
   *  niesie go do bazy, a baza odrzuca zapis kluczem, którego już nie ma (O2 adwersarza: drugie urządzenie z nieaktualnym kluczem). */
  dekId: string;
}

/** Ustawienie PIN-u: nowy DEK owinięty KEK-iem z PIN-u. Zwraca rekord do bazy i DEK do pamięci (już nieeksportowalny). */
export async function createKeyRecord(pin: string, memberId: string, iter = PBKDF2_ITER): Promise<{ record: NoteKeyRecord; dek: CryptoKey }> {
  const salt = randomSalt();
  const dekX = await generateDEK();
  const wrappedDek = await wrapDEK(dekX, await deriveKEK(pin, salt, iter), memberId);
  const record = { wrappedDek, salt: toB64(salt), iter, dekId: globalThis.crypto.randomUUID() };
  // do pamięci trafia kopia nieeksportowalna (sprawdza też od razu, że PIN odwija to, co zapisujemy)
  return { record, dek: await openKeyRecord(record, pin, memberId) };
}

/** Odblokowanie: PIN → DEK (nieeksportowalny). Zły PIN → Error('BAD_PIN'). */
export async function openKeyRecord(rec: NoteKeyRecord, pin: string, memberId: string, extractable = false): Promise<CryptoKey> {
  return unwrapDEK(rec.wrappedDek, await deriveKEK(pin, fromB64(rec.salt), rec.iter), memberId, extractable);
}

/** Zmiana PIN-u: ten sam DEK (notatki bez zmian), owinięty nowym KEK-iem z nową solą. Zły stary PIN → Error('BAD_PIN'). */
export async function rewrapKeyRecord(rec: NoteKeyRecord, oldPin: string, newPin: string, memberId: string, iter = PBKDF2_ITER): Promise<NoteKeyRecord> {
  const dekX = await openKeyRecord(rec, oldPin, memberId, true);
  const salt = randomSalt();
  return { wrappedDek: await wrapDEK(dekX, await deriveKEK(newPin, salt, iter), memberId), salt: toB64(salt), iter, dekId: rec.dekId };
}

/** Prosta ocena PIN-u dla ludzi (bez żargonu). '' = OK. */
export function pinProblem(pin: string): string {
  if (pin.length < PIN_RULES.minLength) return `PIN musi mieć co najmniej ${PIN_RULES.minLength} znaków.`;
  if (pin.length > 128) return 'PIN jest za długi (do 128 znaków).';
  if (PIN_RULES.requireLetter && !/\p{L}/u.test(pin)) return 'PIN musi zawierać co najmniej jedną literę.';
  return '';
}

/** Przytnij do `n` jednostek UTF-16, ale nie w połowie znaku (emoji = para surogatów; samotna połówka psuje zapis). */
export function clipUnits(s: string, n: number): string {
  if (s.length <= n) return s;
  const c = s.charCodeAt(n - 1);
  return s.slice(0, c >= 0xd800 && c <= 0xdbff ? n - 1 : n);
}

/** Ostrzeżenie (nie blokada): krótki PIN z samych cyfr łatwiej odgadnąć komuś, kto wyniesie bazę. */
export function pinIsWeak(pin: string): boolean {
  return /^\d+$/.test(pin) && pin.length < 10 || new Set(pin).size <= 2;
}
