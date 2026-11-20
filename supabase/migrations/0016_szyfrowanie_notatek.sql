-- PATH: supabase/migrations/0016_szyfrowanie_notatek.sql | REQ-ID: TERAPIA-DB-16
-- Bartek 20.11.2026: „Terapia — dane osobowe, notatki szyfruj” (D042).
-- Prywatne notatki do zajęć (meeting_notes, 0009) szyfruje PRZEGLĄDARKA (end-to-end) — baza dostaje wyłącznie szyfrogram
-- „rr1:<Base64(IV12 || AES-256-GCM + znacznik)>”. Klucz notatek (DEK) jest losowy na osobę i leży tu TYLKO owinięty
-- kluczem z PIN-u osoby (PBKDF2-SHA256, 600 000 iteracji). Prowadząca ani właściciel bazy (postgres / klucz serwisowy) widzą
-- tylko szyfrogram; odczyt wymaga PIN-u. UWAGA (uczciwie): kto ma kopię bazy, może próbować zgadywać PIN poza aplikacją —
-- krótki PIN z samych cyfr da się tak odgadnąć; dłuższy PIN / kilka słów chroni mocniej. Zapomniany PIN = notatek nie odzyska nikt.
--   (a) note_keys — owinięty DEK + sól + iteracje + dek_id (id klucza notatek: stały przy zmianie PIN-u, nowy po „Nie pamiętam
--       PIN-u”); widzi/pisze WYŁĄCZNIE właściciel (admin też nie). anon = zero. FK do auth.users (admin bez wiersza members też
--       może mieć notatki — tak jak meeting_notes).
--   (b) meeting_notes: kolumna dek_id (którym kluczem zaszyfrowano); limity rozróżniają jawny tekst (jak w 0009: tytuł ≤ 200,
--       treść ≤ 20 000 znaków) od szyfrogramu (tytuł ≤ 1 200, treść ≤ 110 000). Szyfrogram = PEŁNY format: „rr1:” + Base64
--       (długość podzielna przez 4, ≥ 40 znaków po prefiksie) — ta sama reguła co isEncrypted() w aplikacji. Jawny tekst, który
--       tylko zaczyna się od „rr1:”, jest JAWNY (dawniej wywracał migrację — adwersarz 20.11).
--   (c) wyzwalacz meeting_notes_require_enc: szyfrogram musi nieść dek_id AKTUALNEGO klucza (inaczej KEY_STALE — drugie
--       urządzenie z kluczem sprzed „Nie pamiętam PIN-u” nie zapisze notatki, której nikt potem nie odczyta); gdy osoba MA
--       klucz, baza odrzuca treść, która nie jest pełnym szyfrogramem (stara PWA 0.15 doklejająca tekst do szyfrogramu,
--       zapis jawny). Kasowanie (DELETE) bez zmian.
--   (d) note_keys_reset() — „Nie pamiętam PIN-u”: klucz + wszystkie MOJE notatki jedną transakcją (prawa wołającego, RLS).
--   (e) RODO: member_notes_purge (0009) kasuje teraz także klucz osoby (removed / blocked / DELETE z members).
-- Stare JAWNE notatki NIE są tu ruszane (baza nie zna PIN-u) — aplikacja szyfruje je sama przy pierwszym odblokowaniu
-- przez właściciela (encrypt-on-unlock, zapis WARUNKOWY: tylko gdy treść w bazie się nie zmieniła). Nic nie jest kasowane.
-- Idempotentne (if not exists / or replace / drop … if exists). Próba: begin; <ta treść bez begin/commit>; raise exception … (rollback).
-- Test na PGlite: supabase/tests/0016_pglite.mjs.

begin;

-- ───────────────────────── (a) owinięte klucze notatek ─────────────────────────
create table if not exists public.note_keys (
  member_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  wrapped_dek text not null check (char_length(wrapped_dek) between 40 and 200 and wrapped_dek ~ '^[A-Za-z0-9+/]+={0,2}$'),
  salt text not null check (char_length(salt) between 16 and 64 and salt ~ '^[A-Za-z0-9+/]+={0,2}$'),
  iter int not null check (iter between 100000 and 10000000),
  dek_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.note_keys add column if not exists dek_id uuid not null default gen_random_uuid();
comment on table public.note_keys is
  'D042: klucz notatek osoby (AES-256-GCM) owinięty kluczem z PIN-u (PBKDF2-SHA256). Bez PIN-u bezużyteczny. Widzi tylko właściciel.';
comment on column public.note_keys.dek_id is
  'D042: id klucza notatek — stały przy zmianie PIN-u, nowy po „Nie pamiętam PIN-u”; zapis szyfrogramu musi go nieść (wyzwalacz).';

drop trigger if exists note_keys_touch on public.note_keys;
create trigger note_keys_touch before update on public.note_keys
  for each row execute function public.touch_updated_at();

alter table public.note_keys enable row level security;
drop policy if exists note_keys_own on public.note_keys;
create policy note_keys_own on public.note_keys for all to authenticated
  using (member_id = auth.uid() and public.is_member())
  with check (member_id = auth.uid() and public.is_member());

-- ───────────────────────── (b) dek_id + limity: jawny tekst ≠ szyfrogram ─────────────────────────
alter table public.meeting_notes add column if not exists dek_id uuid;
comment on column public.meeting_notes.dek_id is 'D042: id klucza (note_keys.dek_id), którym zaszyfrowano notatkę; null = jawna sprzed szyfrowania.';

-- Zdejmij stare limity z 0009 i poprzednie wersje z 0016 (nazwy nadane automatycznie — szukamy po treści warunku).
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.meeting_notes'::regclass and contype = 'c'
             and (pg_get_constraintdef(oid) ilike '%char_length(title)%' or pg_get_constraintdef(oid) ilike '%char_length(note)%')
  loop
    execute format('alter table public.meeting_notes drop constraint %I', c.conname);
  end loop;
end $$;

-- Bezpiecznik: wiersz, który nie zmieści się w żadnym z limitów, zatrzymuje migrację CZYTELNYM komunikatem (nie surowym 23514).
do $$
declare n int;
begin
  select count(*) into n from public.meeting_notes m
  where not (case when m.title ~ '^rr1:[A-Za-z0-9+/]+={0,2}$' and char_length(m.title) >= 44 and (char_length(m.title) - 4) % 4 = 0
                  then char_length(m.title) <= 1200 else char_length(m.title) <= 200 end)
     or not (case when m.note ~ '^rr1:[A-Za-z0-9+/]+={0,2}$' and char_length(m.note) >= 44 and (char_length(m.note) - 4) % 4 = 0
                  then char_length(m.note) <= 110000 else char_length(m.note) <= 20000 end);
  if n > 0 then
    raise exception '0016 przerwana: % notatek nie mieści się w limitach (jawny tytuł > 200 / treść > 20 000 znaków). Sprawdź je przed ponowną próbą.', n;
  end if;
end $$;

alter table public.meeting_notes add constraint meeting_notes_title_len check (
  case when title ~ '^rr1:[A-Za-z0-9+/]+={0,2}$' and char_length(title) >= 44 and (char_length(title) - 4) % 4 = 0
       then char_length(title) <= 1200 else char_length(title) <= 200 end);
alter table public.meeting_notes add constraint meeting_notes_note_len check (
  case when note ~ '^rr1:[A-Za-z0-9+/]+={0,2}$' and char_length(note) >= 44 and (char_length(note) - 4) % 4 = 0
       then char_length(note) <= 110000 else char_length(note) <= 20000 end);

-- ───────────────────────── (c) szyfrogram tylko aktualnym kluczem; po kluczu — tylko szyfrogram ─────────────────────────
create or replace function public.meeting_notes_require_enc() returns trigger
language plpgsql set search_path = '' as $$
declare
  k uuid;
  enc_t boolean;
  enc_n boolean;
begin
  enc_t := new.title ~ '^rr1:[A-Za-z0-9+/]+={0,2}$' and char_length(new.title) >= 44 and (char_length(new.title) - 4) % 4 = 0;
  enc_n := new.note ~ '^rr1:[A-Za-z0-9+/]+={0,2}$' and char_length(new.note) >= 44 and (char_length(new.note) - 4) % 4 = 0;
  select n.dek_id into k from public.note_keys n where n.member_id = new.member_id;
  if (enc_t or enc_n) and (k is null or new.dek_id is distinct from k) then
    raise exception 'KEY_STALE: Klucz notatek zmienił się na innym urządzeniu — odblokuj notatki ponownie.'
      using errcode = '22023';
  end if;
  if k is not null and ((new.title <> '' and not enc_t) or (new.note <> '' and not enc_n)) then
    raise exception 'Notatki są szyfrowane — odśwież aplikację (stara wersja próbowała zapisać jawnie).'
      using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists meeting_notes_require_enc on public.meeting_notes;
create trigger meeting_notes_require_enc before insert or update on public.meeting_notes
  for each row execute function public.meeting_notes_require_enc();

-- ───────────────────────── (d) „Nie pamiętam PIN-u” jedną transakcją ─────────────────────────
create or replace function public.note_keys_reset() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.note_keys where member_id = auth.uid();       -- najpierw klucz: równoległy zapis starym kluczem → KEY_STALE
  delete from public.meeting_notes where member_id = auth.uid();
end $$;

-- ───────────────────────── (e) RODO: klucz znika razem z notatkami ─────────────────────────
create or replace function public.member_notes_purge() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.meeting_notes where member_id = old.id;
    delete from public.note_keys where member_id = old.id;
    return old;
  end if;
  if new.status in ('removed', 'blocked') and new.status is distinct from old.status then
    delete from public.meeting_notes where member_id = new.id;
    delete from public.note_keys where member_id = new.id;
  end if;
  return new;
end $$;

-- ───────────────────────── GRANT (jawnie; anon = nic) ─────────────────────────
revoke all on public.note_keys from public, anon, authenticated;
grant select, insert, update, delete on public.note_keys to authenticated;   -- DELETE: własny wiersz (RLS)
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;   -- TRUNCATE omija RLS (0006)
revoke execute on function public.meeting_notes_require_enc() from public, anon, authenticated;
revoke execute on function public.member_notes_purge() from public, anon, authenticated;
revoke execute on function public.note_keys_reset() from public, anon;
grant execute on function public.note_keys_reset() to authenticated;

commit;

-- Kontrola po wgraniu (ręcznie, nie część migracji):
--   select polname, polcmd from pg_policy where polrelid = 'public.note_keys'::regclass;          -- note_keys_own, *
--   select conname from pg_constraint where conrelid = 'public.meeting_notes'::regclass and contype = 'c';
--                                                                     -- meeting_notes_title_len, meeting_notes_note_len
--   select count(*) filter (where dek_id is not null) as zaszyfrowane,
--          count(*) filter (where dek_id is null and (title <> '' or note <> '')) as jawne
--     from public.meeting_notes;   -- „jawne” spada do 0, gdy każdy właściciel raz odblokuje notatki w 0.16
--   Test w transakcji jako użytkownik (set local role authenticated + request.jwt.claims): cudzego note_keys nie widać;
--   po wstawieniu własnego klucza INSERT jawnej notatki → 22023; szyfrogram z cudzym/starym dek_id → KEY_STALE; z aktualnym → OK.
--   Doradca bezpieczeństwa: GET /v1/projects/<ref>/advisors/security
