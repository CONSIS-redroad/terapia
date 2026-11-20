// PATH: supabase/tests/0016_pglite.mjs | REQ-ID: TERAPIA-DB-16-T
// Test migracji 0016 (D042) na PGlite (Postgres w procesie Node) — z odtworzeń adwersarza 20.11 + poprawki.
// Uruchom: cd supabase/tests && npm install && npm test   (kod wyjścia 0 = wszystko jak oczekiwano)
// Minimalny szkielet schematu z 0001/0009 (role, auth.uid(), is_member, meeting_notes z limitami 0009, purge RODO).
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sql0016 = fs.readFileSync(path.join(HERE, '../migrations/0016_szyfrowanie_notatek.sql'), 'utf8');
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', ADM = '00000000-0000-0000-0000-0000000000ad';
const M1 = '11111111-1111-1111-1111-111111111111', M2 = '22222222-2222-2222-2222-222222222222';
const K1 = 'aaaaaaaa-0000-4000-8000-000000000001', K2 = 'aaaaaaaa-0000-4000-8000-000000000002';

const BASE = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('test.email', true)) $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
create table public.admins(email text primary key);
create function public.jwt_email() returns text language sql stable set search_path='' as $$ select lower(coalesce(auth.jwt()->>'email','')) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.admins a where a.email=public.jwt_email() and public.jwt_email()<>'') $$;
create table public.members(id uuid primary key references auth.users(id) on delete cascade, status text not null default 'approved');
create function public.is_member() returns boolean language sql stable security definer set search_path='' as $$ select public.is_admin() or exists(select 1 from public.members m where m.id=auth.uid() and m.status='approved') $$;
create table public.meetings(id uuid primary key);
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at := now(); return new; end $$;
create table public.meeting_notes (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  member_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  note text not null default '' check (char_length(note) <= 20000),
  updated_at timestamptz not null default now(), primary key (meeting_id, member_id));
create trigger meeting_notes_touch before insert or update on public.meeting_notes for each row execute function public.touch_updated_at();
alter table public.meeting_notes enable row level security;
create policy notes_own on public.meeting_notes for all to authenticated using (member_id = auth.uid() and public.is_member()) with check (member_id = auth.uid() and public.is_member());
create function public.member_notes_purge() returns trigger language plpgsql security definer set search_path='' as $$
begin if tg_op='DELETE' then delete from public.meeting_notes where member_id=old.id; return old; end if;
 if new.status in ('removed','blocked') and new.status is distinct from old.status then delete from public.meeting_notes where member_id=new.id; end if; return new; end $$;
create trigger members_notes_purge_upd after update of status on public.members for each row execute function public.member_notes_purge();
create trigger members_notes_purge_del after delete on public.members for each row execute function public.member_notes_purge();
grant select, insert, update, delete on public.meeting_notes to authenticated;
grant select on public.members, public.meetings to authenticated;
insert into auth.users values ('${A}'),('${B}'),('${ADM}'); insert into public.members(id) values ('${A}'),('${B}');
insert into public.admins values ('adm@x.pl');
insert into public.meetings values ('${M1}'),('${M2}');
`;

let fails = 0, n = 0;
async function mk(extra) { const db = new PGlite(); await db.exec(BASE + extra); return db; }
/** expect: 'ok' | kod błędu ('42501') | fragment komunikatu; check(rows) — dodatkowy warunek na wynik. */
function runner(db) {
  return async (label, q, expect, { role, uid = '', email = '', check } = {}) => {
    n++;
    let got, rows;
    try {
      const pre = role ? `select set_config('test.uid','${uid}',false), set_config('test.email','${email}',false); set role ${role}; ` : '';
      const r = await db.exec(pre + q);
      if (role) await db.exec('reset role');
      rows = r.filter(z => z.fields?.length && !z.fields.some(f => f.name === 'set_config')).pop()?.rows ?? [];
      got = 'ok';
    } catch (e) {
      try { await db.exec('rollback'); } catch { /* brak transakcji */ }
      try { await db.exec('reset role'); } catch { /* */ }
      got = `${e.code} ${e.message}`;
    }
    const pass = expect === 'ok' ? got === 'ok' && (!check || check(rows)) : got !== 'ok' && got.includes(expect);
    if (!pass) fails++;
    console.log(pass ? 'PASS' : 'FAIL', label, '→', got === 'ok' ? `ok ${JSON.stringify(rows).slice(0, 120)}` : got.slice(0, 140));
  };
}

const W = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODk=';
const S = 'MTIzNDU2Nzg5MDEyMzQ1Ng==';
const CT = 'rr1:' + 'A'.repeat(300);              // poprawny format (300 % 4 = 0)
const CTT = 'rr1:' + 'B'.repeat(60);

const db = await mk(`insert into public.meeting_notes(meeting_id,member_id,title,note) values
  ('${M1}','${A}','plain A', repeat('ż',20000)),('${M1}','${B}','plain B','tekst B'),('${M2}','${ADM}','notatka admina','x'),
  ('${M2}','${B}','rr1: pierwsze zajęcia','jawna zaczynająca się od rr1:');`);
const x = runner(db);
await x('0016 #1 na danych (20 000 znaków jawnie + jawny tytuł „rr1: …”)', sql0016, 'ok');
await x('0016 #2 idempotencja', sql0016, 'ok');
await x('constrainty po', `select conname from pg_constraint where conrelid='public.meeting_notes'::regclass and contype='c' order by 1`, 'ok',
  { check: r => r.map(z => z.conname).join() === 'meeting_notes_note_len,meeting_notes_title_len' });
await x('A: insert własny klucz (dek_id K1)', `insert into public.note_keys(wrapped_dek,salt,iter,dek_id) values ('${W}','${S}',600000,'${K1}')`, 'ok', { role: 'authenticated', uid: A });
await x('A: insert klucz dla B', `insert into public.note_keys(member_id,wrapped_dek,salt,iter) values ('${B}','${W}','${S}',600000)`, '42501', { role: 'authenticated', uid: A });
await x('A: drugi insert (2. urządzenie) → 23505', `insert into public.note_keys(wrapped_dek,salt,iter) values ('${W}','${S}',600000)`, '23505', { role: 'authenticated', uid: A });
await x('B: cudzego klucza nie widać', `select count(*)::int c from public.note_keys`, 'ok', { role: 'authenticated', uid: B, check: r => r[0].c === 0 });
await x('ADMIN: cudzego klucza nie widać', `select count(*)::int c from public.note_keys`, 'ok', { role: 'authenticated', uid: ADM, email: 'adm@x.pl', check: r => r[0].c === 0 });
await x('anon: brak praw do note_keys', `select count(*) from public.note_keys`, '42501', { role: 'anon' });
await x('B: delete klucza A = 0 wierszy', `delete from public.note_keys where member_id='${A}' returning 1`, 'ok', { role: 'authenticated', uid: B, check: r => r.length === 0 });
await x('A: przeniesienie klucza na B', `update public.note_keys set member_id='${B}' returning 1`, '42501', { role: 'authenticated', uid: A });
await x('A(0.15): jawny UPDATE po kluczu → odmowa', `update public.meeting_notes set note='nowy jawny' where member_id='${A}' returning 1`, 'szyfrowane', { role: 'authenticated', uid: A });
await x('A: szyfrogram bez dek_id → KEY_STALE', `update public.meeting_notes set title='${CTT}', note='${CT}' where member_id='${A}' returning 1`, 'KEY_STALE', { role: 'authenticated', uid: A });
await x('A: szyfrogram z obcym dek_id → KEY_STALE', `update public.meeting_notes set title='${CTT}', note='${CT}', dek_id='${K2}' where member_id='${A}' returning 1`, 'KEY_STALE', { role: 'authenticated', uid: A });
await x('A: szyfrogram z aktualnym dek_id → OK', `update public.meeting_notes set title='${CTT}', note='${CT}', dek_id='${K1}' where member_id='${A}' returning 1`, 'ok', { role: 'authenticated', uid: A, check: r => r.length === 1 });
await x('A(0.15): szyfrogram + doklejone "ok" → odmowa', `update public.meeting_notes set note='${CT}ok' where member_id='${A}' returning 1`, 'szyfrowane', { role: 'authenticated', uid: A });
await x('A(0.15): tytuł-szyfrogram ucięty do 202 zn. → odmowa', `update public.meeting_notes set title='${('rr1:' + 'B'.repeat(500)).slice(0, 202)}' where member_id='${A}' returning 1`, 'szyfrowane', { role: 'authenticated', uid: A });
await x('A: czyści pola do pustych (dozwolone)', `update public.meeting_notes set title='', note='' where member_id='${A}' returning 1`, 'ok', { role: 'authenticated', uid: A });
await x('B(bez klucza): jawny tytuł „rr1: moje” = jawny', `update public.meeting_notes set title='rr1: moje' where member_id='${B}' and meeting_id='${M1}' returning 1`, 'ok', { role: 'authenticated', uid: B });
await x('B(bez klucza): szyfrogram bez klucza → KEY_STALE', `update public.meeting_notes set note='${CT}' where member_id='${B}' and meeting_id='${M1}' returning 1`, 'KEY_STALE', { role: 'authenticated', uid: B });
await x('migracja warunkowa: stara treść się zgadza → 1 wiersz', `insert into public.note_keys(wrapped_dek,salt,iter,dek_id) values ('${W}','${S}',600000,'${K2}');
  update public.meeting_notes set title='${CTT}', note='${CT}', dek_id='${K2}' where member_id='${B}' and meeting_id='${M1}' and title='rr1: moje' and note='tekst B' returning 1`,
  'ok', { role: 'authenticated', uid: B, check: r => r.length === 1 });
await x('migracja warunkowa: treść już inna → 0 wierszy (nic nie nadpisane)', `update public.meeting_notes set title='${CTT}', note='${CT}', dek_id='${K2}' where member_id='${B}' and meeting_id='${M1}' and title='rr1: moje' and note='tekst B' returning 1`,
  'ok', { role: 'authenticated', uid: B, check: r => r.length === 0 });
await x('B: note_keys_reset() kasuje klucz i notatki B, nie A', `select public.note_keys_reset(); select (select count(*)::int from public.note_keys) k, (select count(*)::int from public.meeting_notes) m`,
  'ok', { role: 'authenticated', uid: B, check: r => r[0].k === 0 && r[0].m === 0 });
await x('po resecie B: A nietknięte (postgres)', `select (select count(*)::int from public.note_keys where member_id='${A}') k, (select count(*)::int from public.meeting_notes where member_id='${A}') m`,
  'ok', { check: r => r[0].k === 1 && r[0].m === 1 });
await x('anon: note_keys_reset() bez prawa', `select public.note_keys_reset()`, '42501', { role: 'anon' });
await x('RODO: A removed → klucz i notatki znikają', `update public.members set status='removed' where id='${A}'; select (select count(*)::int from public.note_keys where member_id='${A}') k, (select count(*)::int from public.meeting_notes where member_id='${A}') n`,
  'ok', { check: r => r[0].k === 0 && r[0].n === 0 });
await x('ADMIN bez wiersza members: ustawia klucz (FK do auth.users)', `insert into public.note_keys(wrapped_dek,salt,iter) values ('${W}','${S}',600000) returning 1`, 'ok', { role: 'authenticated', uid: ADM, email: 'adm@x.pl' });

console.log('--- osobna baza: jawny tytuł > 200 (nie powinno być) → czytelny komunikat, nic nie zostaje ---');
const db3 = await mk(`alter table public.meeting_notes drop constraint meeting_notes_title_check; insert into public.meeting_notes(meeting_id,member_id,title,note) values ('${M1}','${B}', repeat('x', 250),'x');`);
const y = runner(db3);
await y('0016 na takich danych → bezpiecznik', sql0016, 'nie mieści się');
await y('note_keys nie powstało (wycofane czysto)', `select to_regclass('public.note_keys')::text t`, 'ok', { check: r => r[0].t === null });

console.log(`\n${n - fails}/${n} PASS`);
process.exit(fails ? 1 : 0);
