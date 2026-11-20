// PATH: tests/unit/noteVault.test.ts | REQ-ID: TERAPIA-CRYPTO-T3
// R3-2 (adwersarz runda 3): niezapisany tekst i komunikat osoby A nie mogą zostać w karcie dla osoby B
// (wylogowanie, zmiana użytkownika). Sejf z atrapą źródła danych — bez przeglądarki i bez bazy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vaultOwner, vaultDismissNotice, vaultForgetUser, vaultInit, vaultLock, vaultSeal, vaultSetSource, vaultSetup, vaultState, vaultUnsaved,
} from '../../src/services/noteVault.ts';
import type { NoteKeyRecord } from '../../src/services/noteCrypto.ts';

let me = 'osoba-a';
const keys = new Map<string, NoteKeyRecord>();
vaultSetSource({
  isDemo: true,
  currentUserId: () => me,
  noteKey: async () => keys.get(me) ?? null,
  createNoteKey: async (rec) => { if (keys.has(me)) throw new Error('KEY_EXISTS'); keys.set(me, rec); },
  replaceNoteKey: async (_old, rec) => { keys.set(me, rec); },
  resetMyNotes: async () => { keys.delete(me); },
});
const A_TEXT = { owner: 'osoba-a', meetingId: 'sp-1', title: 'Tytuł A', note: 'Prywatny tekst osoby A' };

test('niezapisany tekst → zmiana osoby (vaultInit z innym uid) → unsaved i notice znikają', async () => {
  me = 'osoba-a';
  await vaultInit();
  vaultUnsaved(A_TEXT, 'test');
  assert.equal(vaultState().unsaved?.length, 1);
  assert.ok(vaultState().notice);
  me = 'osoba-b';
  await vaultInit();
  assert.equal(vaultState().unsaved, undefined, 'tekst A nie może przejść do B');
  assert.equal(vaultState().notice, undefined);
  assert.ok(!JSON.stringify(vaultState()).includes('Prywatny tekst osoby A'));
});

test('niezapisany tekst → wylogowanie (vaultForgetUser) → unsaved i notice znikają; emit ich nie przywraca', async () => {
  me = 'osoba-a';
  await vaultInit();
  vaultUnsaved(A_TEXT, 'test');
  vaultForgetUser();
  assert.equal(vaultState().unsaved, undefined);
  assert.equal(vaultState().notice, undefined);
  await vaultInit();                         // kolejny emit tej samej karty
  assert.equal(vaultState().unsaved, undefined);
});

test('para kontrolna: zwykła blokada TEJ SAMEJ osoby zachowuje niezapisany tekst (do odblokowania), klucz znika', async () => {
  me = 'osoba-c';
  await vaultInit();
  await vaultSetup('zielony kubek', 'zielony kubek');
  assert.equal(vaultState().status, 'unlocked');
  vaultUnsaved({ ...A_TEXT, owner: 'osoba-c', note: 'tekst C' }, 'test');
  await vaultLock();
  assert.equal(vaultState().status, 'locked');
  assert.equal(vaultState().unsaved?.[0]?.note, 'tekst C', 'tekst zostaje w pamięci do odblokowania (UI go nie pokazuje)');
  await assert.rejects(vaultSeal('sp-1', 't', 'n'), /zablokowane/, 'po blokadzie nie da się szyfrować');
  vaultDismissNotice();
  assert.equal(vaultState().unsaved, undefined, '„Zamknij” zapomina tekst');
});

test('R4-1: spóźniony vaultUnsaved osoby A (pętla odmontowanego edytora) po wylogowaniu A i zalogowaniu B — porzucony', async () => {
  me = 'osoba-r4a';
  await vaultInit();
  await vaultSetup('pin osoby A 1', 'pin osoby A 1');
  const ownerA = vaultOwner();              // edytor A zapamiętał właściciela przy montowaniu
  await vaultLock(); vaultForgetUser();     // A się wylogowuje (AuthGate)
  me = 'osoba-r4b'; await vaultInit();      // B loguje się w tej samej karcie
  vaultUnsaved({ owner: ownerA, meetingId: 'm1', title: 'Tytuł A', note: 'JAWNA TREŚĆ OSOBY A' }, 'Failed to fetch');
  await vaultSetup('pin osoby B 1', 'pin osoby B 1');
  assert.equal(vaultState().status, 'unlocked');
  assert.equal(vaultState().unsaved, undefined, 'B nie widzi tekstu A');
  assert.equal(vaultState().notice, undefined);
  assert.ok(!JSON.stringify(vaultState()).includes('JAWNA TREŚĆ OSOBY A'));
});

test('R4-1 para kontrolna: spóźniony vaultUnsaved TEJ SAMEJ osoby (bez zmiany konta) — tekst zostaje', async () => {
  me = 'osoba-r4c';
  await vaultInit();
  await vaultSetup('pin osoby C 1', 'pin osoby C 1');
  const owner = vaultOwner();
  await vaultLock();
  vaultUnsaved({ owner, meetingId: 'm1', title: 'Tytuł C', note: 'tekst C po blokadzie' }, 'Failed to fetch');
  assert.equal(vaultState().unsaved?.[0]?.note, 'tekst C po blokadzie');
  vaultDismissNotice();
});
