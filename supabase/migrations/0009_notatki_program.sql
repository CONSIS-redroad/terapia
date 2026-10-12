-- PATH: supabase/migrations/0009_notatki_program.sql | REQ-ID: TERAPIA-DB-09
-- Bartek 12.10.2026: „oficjalne nazwy tematów to jedno, ale każdy może swoje notować — te są moje notatki,
-- tytuły po mojemu, notatki sobie dopiszę” + „daj dodatkowe 10 kolumn na przyszłość”.
--   (a) meeting_notes  — PRYWATNE notatki uczestnika do zajęć: „mój tytuł” + notatka. Widzi/pisze/kasuje WYŁĄCZNIE właściciel
--                        (admin też NIE widzi cudzych). anon = zero.
--   (b) program_topics — oficjalny program cyklu (lista tematów do wglądu). Czyta członek, pisze admin.
--                        Program NIE jest przypinany do dat — temat zajęć (`meetings.topic`) dalej ustawia admin
--                        (w aplikacji może go wybrać z listy programu albo wpisać dowolny tekst).
--       group_info.program_name — nazwa programu cyklu (jeden program na grupę, jak jeden wiersz group_info).
--   (c) zapas1…zapas10 (text, nullable) w meeting_notes, program_topics i meetings — użycie notuj w docs/ZAPAS_KOLUMN.md.
-- Idempotentne (if not exists / or replace / drop policy if exists; seed tylko gdy tabela pusta).

begin;

-- ───────────────────────── wspólne: znacznik zmiany ─────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────── (a) prywatne notatki do zajęć ─────────────────────────
create table if not exists public.meeting_notes (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  member_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),     -- „mój tytuł” zajęć
  note text not null default '' check (char_length(note) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (meeting_id, member_id)
);
create index if not exists meeting_notes_member on public.meeting_notes (member_id);

drop trigger if exists meeting_notes_touch on public.meeting_notes;
create trigger meeting_notes_touch before insert or update on public.meeting_notes
  for each row execute function public.touch_updated_at();

alter table public.meeting_notes enable row level security;
-- Tylko właściciel i tylko gdy jest wpuszczonym członkiem (is_member() obejmuje admina — ale admin też widzi WYŁĄCZNIE swoje).
drop policy if exists notes_own on public.meeting_notes;
create policy notes_own on public.meeting_notes for all to authenticated
  using (member_id = auth.uid() and public.is_member())
  with check (member_id = auth.uid() and public.is_member());

-- ───────────────────────── (b) program cyklu ─────────────────────────
alter table public.group_info add column if not exists program_name text not null default '';
alter table public.group_info drop constraint if exists group_info_program_name_len;
alter table public.group_info add constraint group_info_program_name_len check (char_length(program_name) <= 200);
update public.group_info set program_name = '„ROZWÓJ OSOBISTY” DLA WSPÓŁUZALEŻNIONYCH'
 where id = 1 and program_name = '';

create table if not exists public.program_topics (
  id uuid primary key default gen_random_uuid(),
  position int not null default 0,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  note text not null default '' check (char_length(note) <= 2000),
  updated_at timestamptz not null default now()
);
create index if not exists program_topics_position on public.program_topics (position);

drop trigger if exists program_topics_touch on public.program_topics;
create trigger program_topics_touch before insert or update on public.program_topics
  for each row execute function public.touch_updated_at();

alter table public.program_topics enable row level security;
drop policy if exists program_read on public.program_topics;
create policy program_read  on public.program_topics for select to authenticated using (public.is_member());
drop policy if exists program_admin on public.program_topics;
create policy program_admin on public.program_topics for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed: 21 tematów z karty zajęć (nazwy ogólne, bez danych osobowych) — tylko gdy program jest pusty.
insert into public.program_topics (position, title)
select t.nr, t.title
from unnest(array[
  'Wychodzenie ze schematów współuzależnienia',
  'Cele – stawianie ich i realizacja',
  'Rozpoznawanie uczuć',
  'Pozytywne myślenie',
  'Zasoby – jak z nich korzystać',
  'Granice, czyli czym jest siła wewnętrzna',
  'Lęk',
  'Złość',
  'Potrzeby',
  'Wstyd',
  'Przemoc emocjonalna',
  'Asertywność',
  'Komunikacja',
  'Jak pomóc dzieciom',
  'Wartości',
  'Bądź dobrym dla siebie',
  'Duchowość',
  'Miłość',
  'Strategie radzenia sobie w związkach (film)',
  'Żal po stracie',
  'Poczucie krzywdy, poczucie winy'
]) with ordinality as t(title, nr)
where not exists (select 1 from public.program_topics);

-- ───────────────────────── (c) 10 zapasowych kolumn ─────────────────────────
do $$
declare t text; i int;
begin
  foreach t in array array['meeting_notes', 'program_topics', 'meetings'] loop
    for i in 1..10 loop
      execute format('alter table public.%I add column if not exists %I text', t, 'zapas' || i);
      execute format('comment on column public.%I.%I is %L', t, 'zapas' || i,
                     'zapas na przyszłość — użycie notuj w docs/ZAPAS_KOLUMN.md');
    end loop;
  end loop;
end $$;

-- ───────────────────────── GRANT (jawnie; anon = nic) ─────────────────────────
revoke all on public.meeting_notes, public.program_topics from anon;
grant select, insert, update, delete on public.meeting_notes, public.program_topics to authenticated;
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;   -- TRUNCATE omija RLS (0006)
-- funkcja-wyzwalacz nie ma być wołana przez API
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

commit;

-- Kontrola po wgraniu (ręcznie, nie część migracji):
--   select count(*) from public.program_topics;                                   -- 21
--   select program_name from public.group_info;                                   -- „ROZWÓJ OSOBISTY” DLA WSPÓŁUZALEŻNIONYCH
--   select polname, polcmd from pg_policy where polrelid = 'public.meeting_notes'::regclass;  -- notes_own, *
--   Doradca bezpieczeństwa: GET /v1/projects/<ref>/advisors/security
