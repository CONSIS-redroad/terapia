// PATH: tests/unit/noteCrypto.test.ts | REQ-ID: TERAPIA-CRYPTO-T1
// Testy szyfrowania notatek (D042). Uruchom: `npm test` (Node ≥ 22.18 — TypeScript bez kompilacji, WebCrypto wbudowane).
// Iteracje PBKDF2 obniżone w większości testów (szybkość); jeden test przechodzi pełne 600 000.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENC_PREFIX, PBKDF2_ITER, PIN_MIN, PIN_RULES, clipUnits, createKeyRecord, decryptField, encryptField, isEncrypted, openKeyRecord, pinIsWeak, pinProblem,
  rewrapKeyRecord, toB64, fromB64,
} from '../../src/services/noteCrypto.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const MEET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEET2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FAST = 100_000; // minimum dopuszczone przez bazę (0016)
const PIN = 'zielony kubek';

test('szyfruj → odszyfruj: polskie znaki, emoji, długa notatka', async () => {
  const { dek } = await createKeyRecord(PIN, ME, FAST);
  const texts = ['Granice — przykład z pracy: „nie” to zdanie. Zażółć gęślą jaźń 🙂', 'x'.repeat(20000), 'ą'.repeat(200)];
  for (const t of texts) {
    const enc = await encryptField(t, dek, ME, MEET, 'note');
    assert.ok(enc.startsWith(ENC_PREFIX));
    assert.ok(isEncrypted(enc));
    assert.ok(!enc.includes('Granice'));
    assert.equal(await decryptField(enc, dek, ME, MEET, 'note'), t);
  }
});

test('ten sam tekst → za każdym razem inny szyfrogram (losowe IV)', async () => {
  const { dek } = await createKeyRecord(PIN, ME, FAST);
  const a = await encryptField('to samo', dek, ME, MEET, 'title');
  const b = await encryptField('to samo', dek, ME, MEET, 'title');
  assert.notEqual(a, b);
});

test('puste pole zostaje puste (pusta notatka to nie treść)', async () => {
  const { dek } = await createKeyRecord(PIN, ME, FAST);
  assert.equal(await encryptField('', dek, ME, MEET, 'title'), '');
  assert.equal(await decryptField('', dek, ME, MEET, 'title'), '');
});

test('zły PIN → BAD_PIN, dobry PIN otwiera', async () => {
  const { record } = await createKeyRecord(PIN, ME, FAST);
  await assert.rejects(openKeyRecord(record, 'zielony kubeK', ME), /BAD_PIN/);
  await assert.rejects(openKeyRecord(record, '', ME), /BAD_PIN/);
  const dek = await openKeyRecord(record, PIN, ME);
  assert.equal(dek.extractable, false, 'DEK w pamięci nie daje się wyeksportować');
});

test('klucz cudzej osoby (podmiana wiersza note_keys) → BAD_PIN, nawet z dobrym PIN-em', async () => {
  const { record } = await createKeyRecord(PIN, OTHER, FAST);
  await assert.rejects(openKeyRecord(record, PIN, ME), /BAD_PIN/);
});

test('zmiana PIN-u: stare notatki czytelne nowym PIN-em, stary PIN już nie działa', async () => {
  const { record, dek } = await createKeyRecord(PIN, ME, FAST);
  const enc = await encryptField('notatka sprzed zmiany PIN-u', dek, ME, MEET, 'note');
  await assert.rejects(rewrapKeyRecord(record, 'zly-pin-123', 'nowy pin 456', ME, FAST), /BAD_PIN/);
  const rec2 = await rewrapKeyRecord(record, PIN, 'nowy pin 456', ME, FAST);
  assert.equal(rec2.dekId, record.dekId, 'zmiana PIN-u NIE zmienia id klucza notatek (inne urządzenia dalej zapisują)');
  assert.notEqual(rec2.salt, record.salt);
  assert.notEqual(rec2.wrappedDek, record.wrappedDek);
  await assert.rejects(openKeyRecord(rec2, PIN, ME), /BAD_PIN/);
  const dek2 = await openKeyRecord(rec2, 'nowy pin 456', ME);
  assert.equal(await decryptField(enc, dek2, ME, MEET, 'note'), 'notatka sprzed zmiany PIN-u');
});

test('rozpoznanie starej JAWNEJ notatki (migracja przy odblokowaniu)', async () => {
  for (const plain of ['', 'Moja notatka', 'Abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH', 'rr1: tak zaczęłam notatkę', 'rr1:krótko', ENC_PREFIX])
    assert.equal(isEncrypted(plain), false, plain);
  const { dek } = await createKeyRecord(PIN, ME, FAST);
  const plain = 'Stara notatka sprzed szyfrowania';
  assert.equal(await decryptField(plain, dek, ME, MEET, 'note'), plain, 'jawna wraca bez zmian');
  assert.equal(isEncrypted(await encryptField(plain, dek, ME, MEET, 'note')), true);
});

test('szyfrogram przeniesiony do innych zajęć / innej osoby / zamieniony tytuł↔treść → błąd, nie cudza treść', async () => {
  const { dek } = await createKeyRecord(PIN, ME, FAST);
  const enc = await encryptField('tajne', dek, ME, MEET, 'note');
  await assert.rejects(decryptField(enc, dek, ME, MEET2, 'note'));
  await assert.rejects(decryptField(enc, dek, OTHER, MEET, 'note'));
  await assert.rejects(decryptField(enc, dek, ME, MEET, 'title'));
});

test('uszkodzony szyfrogram → błąd (aplikacja oznacza notatkę jako nieczytelną i blokuje jej edycję)', async () => {
  const { dek } = await createKeyRecord(PIN, ME, FAST);
  const enc = await encryptField('tajne', dek, ME, MEET, 'note');
  const raw = fromB64(enc.slice(ENC_PREFIX.length)); raw[20] ^= 1;
  await assert.rejects(decryptField(ENC_PREFIX + toB64(raw), dek, ME, MEET, 'note'));
});

test('inny DEK (np. po „Nie pamiętam PIN-u” i nowym PIN-ie) nie czyta starych szyfrogramów i ma NOWE id', async () => {
  const a = await createKeyRecord(PIN, ME, FAST);
  const b = await createKeyRecord(PIN, ME, FAST);
  assert.match(a.record.dekId, /^[0-9a-f-]{36}$/);
  assert.notEqual(a.record.dekId, b.record.dekId, 'baza odrzuci zapis starym kluczem (KEY_STALE) po dek_id');
  const enc = await encryptField('stara', a.dek, ME, MEET, 'note');
  await assert.rejects(decryptField(enc, b.dek, ME, MEET, 'note'));
});

test('limity bazy 0016: szyfrogram maks. tytułu i treści mieści się w limicie', async () => {
  const { dek } = await createKeyRecord(PIN, ME, FAST);
  const t = await encryptField('ż'.repeat(200), dek, ME, MEET, 'title');
  const n = await encryptField('€'.repeat(20000), dek, ME, MEET, 'note'); // 3 bajty na znak — najgorszy przypadek BMP
  assert.ok(t.length <= 1200, `tytuł ${t.length}`);
  assert.ok(n.length <= 110000, `treść ${n.length}`);
  assert.match(t, /^rr1:[A-Za-z0-9+/]+={0,2}$/);
});

test('PIN: wymagania z JEDNEJ stałej PIN_RULES, ostrzeżenie dla krótkich samych cyfr', () => {
  assert.equal(PIN_MIN, PIN_RULES.minLength);
  assert.notEqual(pinProblem('x'.repeat(PIN_RULES.minLength - 1)), '');
  assert.equal(pinProblem('1'.repeat(PIN_RULES.minLength)) === '', !PIN_RULES.requireLetter);
  assert.equal(pinIsWeak('123456'), true);
  assert.equal(pinIsWeak('aaaaaaa'), true);
  assert.equal(pinIsWeak('zielony kubek'), false);
});

test('przycinanie po pełnych znakach — emoji na granicy limitu nie zostaje rozcięte', () => {
  const t = 'a'.repeat(199) + '🙂';          // 201 jednostek UTF-16
  const c = clipUnits(t, 200);
  assert.equal(c, 'a'.repeat(199));
  assert.equal(new TextDecoder().decode(new TextEncoder().encode(c)), c, 'bez samotnego surogatu (U+FFFD)');
  assert.equal(clipUnits('ąę', 200), 'ąę');
  assert.equal(clipUnits('ab🙂', 4), 'ab🙂');
});

test(`pełne ${PBKDF2_ITER} iteracji PBKDF2 (jak w aplikacji)`, async () => {
  const t0 = Date.now();
  const { record, dek } = await createKeyRecord(PIN, ME);
  assert.equal(record.iter, PBKDF2_ITER);
  const enc = await encryptField('pełna moc', dek, ME, MEET, 'note');
  assert.equal(await decryptField(enc, await openKeyRecord(record, PIN, ME), ME, MEET, 'note'), 'pełna moc');
  console.log(`  PBKDF2 ${PBKDF2_ITER}: ustawienie + odblokowanie ${Date.now() - t0} ms`);
});
