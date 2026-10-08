-- PATH: supabase/migrations/0004_harmonogram.sql | REQ-ID: TERAPIA-DB-04
-- Harmonogram admina (Bartek 08.10): seria dat (np. 24 wtorki), wykluczenie dnia, przeniesienie (zamiast wtorku środa), dodatkowe spotkanie.
-- Odwołane spotkanie NIE jest kasowane (materiały i prace domowe przypięte do zajęć zostają) — ma `cancelled = true` i nie liczy się do serii.
alter table public.meetings add column if not exists cancelled boolean not null default false;
alter table public.meetings add column if not exists note text not null default '' check (char_length(note) <= 300);
