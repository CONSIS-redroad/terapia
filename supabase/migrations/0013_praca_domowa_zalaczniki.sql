-- PATH: supabase/migrations/0013_praca_domowa_zalaczniki.sql | REQ-ID: TERAPIA-DB-13
-- Bartek 08.11: „po to robimy te prace, żeby było wszystko łatwo dostępne” — praca domowa wskazuje
-- materiał wyjściowy (PDF z zajęć) i naszą wersję do czytania z lektorem (pozycja archiwum).
-- Usunięcie materiału / pozycji archiwum nie kasuje pracy — tylko gubi przycisk (on delete set null).

alter table public.homework
  add column if not exists material_id uuid references public.materials(id) on delete set null,
  add column if not exists archive_item_id uuid references public.archive_items(id) on delete set null;
