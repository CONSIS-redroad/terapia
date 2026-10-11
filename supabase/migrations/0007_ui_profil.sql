-- Wygląd przy profilu (Bartek 11.10.2026): tryb jasny/ciemny + ustawienia tapety użytkownika w bazie,
-- żeby były te same na telefonie i komputerze i przeżywały aktualizacje aplikacji (nowa wersja zmienia tylko TREŚĆ motywu).
-- Prywatne: group_members() tej kolumny nie zwraca; czyta ją tylko właściciel (members_self_read) i admin.
-- Zapis: istniejąca polityka members_self_update (własny wiersz). Idempotentne.
begin;
alter table public.members add column if not exists ui jsonb not null default '{}'::jsonb;
alter table public.members drop constraint if exists members_ui_shape;
alter table public.members add constraint members_ui_shape
  check (jsonb_typeof(ui) = 'object' and pg_column_size(ui) <= 2048);
commit;
