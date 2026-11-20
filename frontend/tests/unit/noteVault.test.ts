// PATH: tests/unit/noteVault.test.ts | REQ-ID: TERAPIA-CRYPTO-T3
// R3-2 (adwersarz runda 3): niezapisany tekst i komunikat osoby A nie mogą zostać w karcie dla osoby B
// (wylogowanie, zmiana użytkownika). Sejf z atrapą źródła danych — bez przeglądarki i bez bazy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vaultDismissNotice, vaultForgetUser, vaultInit, vaultLock, vaultSeal, vaultSetSource, vaultSetup, vaultState, vaultUnsaved,
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
const A_TEXT = { meetingId: 'sp-1', title: 'Tytuł A', note: 'Prywatny tekst osoby A' };

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
  vaultUnsaved({ ...A_TEXT, note: 'tekst C' }, 'test');
  await vaultLock();
  assert.equal(vaultState().status, 'locked');
  assert.equal(vaultState().unsaved?.[0]?.note, 'tekst C', 'tekst zostaje w pamięci do odblokowania (UI go nie pokazuje)');
  await assert.rejects(vaultSeal('sp-1', 't', 'n'), /zablokowane/, 'po blokadzie nie da się szyfrować');
  vaultDismissNotice();
  assert.equal(vaultState().unsaved, undefined, '„Zamknij” zapomina tekst');
});
