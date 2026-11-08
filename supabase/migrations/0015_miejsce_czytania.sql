-- PATH: supabase/migrations/0015_miejsce_czytania.sql | REQ-ID: TERAPIA-DB-15
-- Bartek 08.11: „skoro jest się zalogowanym, to nie problem zapamiętać, na którym procencie skończyło się czytanie”.
-- Miejsce w lekturze z Archiwum leży przy koncie (telefon ⟷ komputer), nie tylko na urządzeniu (localStorage zostaje
-- jako szybka kopia i zapas bez sieci). Widzi i zmienia wyłącznie sam czytelnik; admin też nie.
-- Usunięcie osoby albo lektury kasuje wiersze (kaskada).

create table if not exists public.reading_positions (
  member_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  item_id uuid not null references public.archive_items (id) on delete cascade,
  p real not null check (p >= 0 and p <= 1),
  updated_at timestamptz not null default now(),
  primary key (member_id, item_id)
);
alter table public.reading_positions enable row level security;

drop policy if exists reading_positions_own on public.reading_positions;
create policy reading_positions_own on public.reading_positions for all to authenticated
  using (member_id = auth.uid() and public.is_member())
  with check (member_id = auth.uid() and public.is_member());

revoke all on public.reading_positions from public, anon, authenticated;
grant select, insert, update, delete on public.reading_positions to authenticated;
