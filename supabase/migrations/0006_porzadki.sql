-- PATH: supabase/migrations/0006_porzadki.sql | REQ-ID: TERAPIA-DB-06
-- (1) „Usuń całą grupę” czyści też archiwum (0003). (2) Odebranie domyślnych uprawnień TRUNCATE/REFERENCES/TRIGGER,
-- które Supabase nadaje rolom API — TRUNCATE omija RLS (zmierzone przy 0003).

create or replace function public.wipe_group(p_confirm text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if not public.is_admin() then
    raise exception 'Tylko admin może usunąć grupę' using errcode = '42501';
  end if;
  select name into v_name from public.group_info where id = 1;
  if p_confirm is null or btrim(p_confirm) <> btrim(v_name) then
    raise exception 'Potwierdzenie nie zgadza się z nazwą grupy' using errcode = '22023';
  end if;
  perform set_config('terapia.bypass', 'on', true);
  delete from public.reactions where true;
  delete from public.attachments where true;
  delete from public.messages where true;
  delete from public.homework_done where true;
  delete from public.homework where true;
  delete from public.meeting_photos where true;
  delete from public.materials where true;
  delete from public.archive_items where true;
  delete from public.meetings where true;
  delete from public.announcements where true;
  delete from public.consents where true;
  delete from public.invites where true;
  delete from public.members where true;
  perform set_config('terapia.bypass', 'off', true);
end $$;
revoke execute on function public.wipe_group(text) from public, anon;
grant execute on function public.wipe_group(text) to authenticated;

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
