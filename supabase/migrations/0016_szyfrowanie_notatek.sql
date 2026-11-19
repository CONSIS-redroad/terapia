-- PATH: supabase/migrations/0016_szyfrowanie_notatek.sql | REQ-ID: TERAPIA-DB-16
-- Bartek 20.11.2026: „Terapia — dane osobowe, notatki szyfruj” (D042).
-- Prywatne notatki do zajęć (meeting_notes, 0009) szyfruje PRZEGLĄDARKA (end-to-end) — baza dostaje wyłącznie szyfrogram
-- „rr1:<Base64(IV12 || AES-256-GCM + znacznik)>”. Klucz notatek (DEK) jest losowy na osobę i leży tu TYLKO owinięty
-- kluczem z PIN-u osoby (PBKDF2-SHA256, 600 000 iteracji). Ani prowadząca, ani właściciel bazy (postgres / klucz serwisowy)
-- nie odczytają notatek bez PIN-u. Zapomniany PIN = notatek nie odzyska nikt.
--   (a) note_keys — owinięty DEK + sól + iteracje; widzi/pisze WYŁĄCZNIE właściciel (admin też nie). anon = zero.
--   (b) meeting_notes: limity długości rozróżniają jawny tekst (jak w 0009: tytuł ≤ 200, treść ≤ 20 000 znaków) od szyfrogramu
--       (dłuższy: Base64 + IV + znacznik; tytuł ≤ 1 200, treść ≤ 110 000 znaków, tylko poprawny format „rr1:”).
--   (c) wyzwalacz meeting_notes_require_enc: gdy osoba MA już klucz, baza odrzuca jawną treść — stara wersja aplikacji
--       (PWA z pamięci) ani błąd w kodzie nie zapiszą notatki jawnie obok zaszyfrowanych. Kasowanie (DELETE) bez zmian.
--   (d) RODO: member_notes_purge (0009) kasuje teraz także klucz osoby (removed / blocked / DELETE z members).
-- Stare JAWNE notatki NIE są tu ruszane (baza nie zna PIN-u) — aplikacja szyfruje je sama przy pierwszym odblokowaniu
-- przez właściciela (encrypt-on-unlock). Nic nie jest kasowane.
-- Idempotentne (if not exists / or replace / drop … if exists). Próba: begin; <ta treść bez begin/commit>; raise exception … (rollback).

begin;

-- ───────────────────────── (a) owinięte klucze notatek ─────────────────────────
create table if not exists public.note_keys (
  member_id uuid primary key default auth.uid() references public.members (id) on delete cascade,
  wrapped_dek text not null check (char_length(wrapped_dek) between 40 and 200 and wrapped_dek ~ '^[A-Za-z0-9+/]+={0,2}$'),
  salt text not null check (char_length(salt) between 16 and 64 and salt ~ '^[A-Za-z0-9+/]+={0,2}$'),
  iter int not null check (iter between 100000 and 10000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.note_keys is
  'D042: klucz notatek osoby (AES-256-GCM) owinięty kluczem z PIN-u (PBKDF2-SHA256). Bez PIN-u bezużyteczny. Widzi tylko właściciel.';

drop trigger if exists note_keys_touch on public.note_keys;
create trigger note_keys_touch before update on public.note_keys
  for each row execute function public.touch_updated_at();

alter table public.note_keys enable row level security;
drop policy if exists note_keys_own on public.note_keys;
create policy note_keys_own on public.note_keys for all to authenticated
  using (member_id = auth.uid() and public.is_member())
  with check (member_id = auth.uid() and public.is_member());

-- ───────────────────────── (b) limity: jawny tekst ≠ szyfrogram ─────────────────────────
-- Zdejmij stare limity z 0009 (nazwy nadane automatycznie — szukamy po treści warunku, nie po nazwie).
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
alter table public.meeting_notes add constraint meeting_notes_title_len check (
  case when title like 'rr1:%' then char_length(title) <= 1200 and title ~ '^rr1:[A-Za-z0-9+/]+={0,2}$'
       else char_length(title) <= 200 end);
alter table public.meeting_notes add constraint meeting_notes_note_len check (
  case when note like 'rr1:%' then char_length(note) <= 110000 and note ~ '^rr1:[A-Za-z0-9+/]+={0,2}$'
       else char_length(note) <= 20000 end);

-- ───────────────────────── (c) po ustawieniu PIN-u — tylko szyfrogram ─────────────────────────
create or replace function public.meeting_notes_require_enc() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.note_keys k where k.member_id = new.member_id)
     and ((new.title <> '' and new.title not like 'rr1:%') or (new.note <> '' and new.note not like 'rr1:%')) then
    raise exception 'Notatki są szyfrowane — odśwież aplikację (stara wersja próbowała zapisać jawnie).'
      using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists meeting_notes_require_enc on public.meeting_notes;
create trigger meeting_notes_require_enc before insert or update on public.meeting_notes
  for each row execute function public.meeting_notes_require_enc();

-- ───────────────────────── (d) RODO: klucz znika razem z notatkami ─────────────────────────
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
grant select, insert, update, delete on public.note_keys to authenticated;   -- DELETE: „Nie pamiętam PIN-u” (własny wiersz)
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;   -- TRUNCATE omija RLS (0006)
revoke execute on function public.meeting_notes_require_enc() from public, anon, authenticated;
revoke execute on function public.member_notes_purge() from public, anon, authenticated;

commit;

-- Kontrola po wgraniu (ręcznie, nie część migracji):
--   select polname, polcmd from pg_policy where polrelid = 'public.note_keys'::regclass;          -- note_keys_own, *
--   select conname from pg_constraint where conrelid = 'public.meeting_notes'::regclass and contype = 'c';
--                                                                     -- meeting_notes_title_len, meeting_notes_note_len
--   select count(*) filter (where title like 'rr1:%' or note like 'rr1:%') as zaszyfrowane,
--          count(*) filter (where (title <> '' and title not like 'rr1:%') or (note <> '' and note not like 'rr1:%')) as jawne
--     from public.meeting_notes;   -- „jawne” spada do 0, gdy każdy właściciel raz odblokuje notatki w 0.16
--   Test w transakcji jako użytkownik (set local role authenticated + request.jwt.claims): cudzego note_keys nie widać;
--   po wstawieniu własnego klucza INSERT jawnej notatki → błąd 22023; szyfrogram „rr1:…” → OK.
--   Doradca bezpieczeństwa: GET /v1/projects/<ref>/advisors/security
