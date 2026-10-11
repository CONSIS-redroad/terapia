-- Scalanie wyglądu PO STRONIE BAZY (adwersarz 11.10 runda 4: zapis przy zamykaniu karty nadpisywał na ślepo całą kolumnę
-- ui — gubił zmiany z innego urządzenia i zmiany w locie). Klient wysyła TYLKO zmienione pola (patch), baza dokleja je
-- do aktualnego members.ui. Wymaga kolumny ui (migracja *_ui_profil.sql). Idempotentne.
create or replace function public.ui_merge(patch jsonb, reset_wallpaper boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Brak sesji' using errcode = '42501'; end if;
  if patch is null or jsonb_typeof(patch) <> 'object' or pg_column_size(patch) > 2048 then
    raise exception 'Nieprawidłowe ustawienia wyglądu' using errcode = '22023';
  end if;
  update public.members m set ui =
      (case when reset_wallpaper then (m.ui - 'wallpaper') || jsonb_build_object('wallpaper', '{}'::jsonb) else m.ui end)
      || (patch - 'wallpaper')
      || (case when jsonb_typeof(patch->'wallpaper') = 'object' then jsonb_build_object('wallpaper',
            coalesce(case when reset_wallpaper then '{}'::jsonb else m.ui->'wallpaper' end, '{}'::jsonb) || (patch->'wallpaper'))
          else '{}'::jsonb end)
  where m.id = auth.uid();
end $$;
revoke execute on function public.ui_merge(jsonb, boolean) from public, anon;
grant execute on function public.ui_merge(jsonb, boolean) to authenticated;
