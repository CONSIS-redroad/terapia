// PATH: tests/unit/noteMigration.test.ts | REQ-ID: TERAPIA-CRYPTO-T2
// R2-1 (adwersarz runda 2): warunek migracji jawnej notatki nie może nieść treści w URL żądania.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { URL_SAFE_MAX, filterQueryString, migrationFilter, notatekGen } from '../../src/services/noteMigration.ts';

const MEET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ME = '11111111-1111-4111-8111-111111111111';
const TS = '2026-11-20T00:47:12.123456+00:00';
const LONG = ('Zażółć gęślą jaźń — ćwiczenie z asertywności. ').repeat(500).slice(0, 20000); // 20 000 znaków z polskimi

test('warunek migracji: tylko id zajęć, osoby i updated_at — bez treści, krótki', () => {
  const qs = filterQueryString(migrationFilter(MEET, ME, TS));
  assert.ok(qs.length < 300, `długość ${qs.length}`);
  assert.ok(!qs.includes(encodeURIComponent(LONG.slice(0, 30))) && !qs.includes('Za'), 'w URL nie ma treści');
  assert.deepEqual(migrationFilter(MEET, ME, TS).map(f => f[0]), ['meeting_id', 'member_id', 'updated_at']);
  assert.ok(qs.includes(encodeURIComponent(TS)));
});

test('para kontrolna: stary warunek z treścią (title/note w URL) dla 20 000 znaków przekracza limit bramki', () => {
  const old = filterQueryString([...migrationFilter(MEET, ME, TS).slice(0, 2), ['title', 'Mój tytuł'], ['note', LONG]]);
  assert.ok(old.length > URL_SAFE_MAX, `stary warunek ${old.length} zn. — test złapałby go`);
  // nawet krótka polska notatka puchnie ×6 po zakodowaniu
  assert.ok(encodeURIComponent('ż').length === 6);
});

test('odmiana w komunikacie: 1 notatki / 2, 5 notatek', () => {
  assert.equal(notatekGen(1), 'notatki');
  assert.equal(notatekGen(2), 'notatek');
  assert.equal(notatekGen(5), 'notatek');
});
