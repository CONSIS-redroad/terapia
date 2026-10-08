-- PATH: supabase/migrations/0003_archiwum.sql | REQ-ID: TERAPIA-DB-03
-- Archiwum „Powrót do przeszłości” (ETAP I, Bartek 08.10): treści starej TERAPII — lektury z tekstem do czytania,
-- PDF-y z zajęć, obrazy, nagranie lektora, linki. Treść i pliki żyją WYŁĄCZNIE w tej bazie i w Storage grupy
-- (bucket `group-files`, folder `admin/archiwum/…`) — nigdy w repozytorium.
-- MP3 lektora w Storage = świadomy wyjątek od D007 („audio tylko linkiem”) — dyspozycja Bartka.
-- Uprawnienia jak reszta schematu: czyta członek grupy (is_member), pisze admin (is_admin), anon = nic.

begin;

create table if not exists public.archive_items (
  id uuid primary key default gen_random_uuid(),
  slug text unique check (slug is null or slug ~ '^[a-z0-9-]{1,80}$'),   -- klucz importu (ponowne wgranie = aktualizacja)
  kind text not null default 'lektura' check (kind in ('lektura', 'pdf', 'obraz', 'audio', 'wideo_link', 'link')),
  category text not null default 'inne' check (category in ('zajecia', 'ksiazka', 'poradnik', 'podcast', 'film', 'inne')),
  title text not null check (char_length(title) between 1 and 200),
  author text not null default '' check (char_length(author) <= 200),
  note text not null default '' check (char_length(note) <= 2000),
  lead text not null default '' check (char_length(lead) <= 5000),
  -- treść do czytania: {"sections":[{"title","paragraphs":[],"bullets":[],"after","quotes":[]}]}
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object' and pg_column_size(body) <= 512000),
  -- [{"url","title","comment"}] — tylko https
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  cover_path text check (cover_path is null or cover_path like 'admin/%'),
  audio_path text check (audio_path is null or audio_path like 'admin/%'),
  -- ["admin/…/obraz.jpg", …]
  gallery jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery) = 'array'),
  -- [{"path":"admin/…","name":"plik.pdf","size":123}]
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  source_date date,                                                         -- data z dawnej TERAPII (zajęcia / dodanie)
  meeting_id uuid references public.meetings (id) on delete set null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists archive_items_order on public.archive_items (sort, source_date desc);

alter table public.archive_items enable row level security;

drop policy if exists archive_read on public.archive_items;
create policy archive_read on public.archive_items for select to authenticated using (public.is_member());
drop policy if exists archive_admin on public.archive_items;
create policy archive_admin on public.archive_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.archive_items from anon, public;
-- domyślne uprawnienia Supabase dają też TRUNCATE/REFERENCES/TRIGGER (TRUNCATE omija RLS) — zostawiamy tylko CRUD
revoke truncate, references, trigger on public.archive_items from authenticated;
grant select, insert, update, delete on public.archive_items to authenticated;

commit;
