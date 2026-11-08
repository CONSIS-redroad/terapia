-- PATH: supabase/migrations/0012_admin_drugi_stopien.sql | REQ-ID: TERAPIA-DB-12
-- Bartek 08.11: drugi stopień admina („Janka — admin, ale bez usuwania grupy”).
-- admins.can_wipe = true → właściciel: usuwa grupę i zarządza listą adminów.
-- admins.can_wipe = false → admin drugiego stopnia: wszystko inne (wpuszczanie, terminy, prace, materiały, moderacja),
-- ale NIE usuwa grupy i NIE dopisuje/usuwa adminów ani nie podnosi sobie stopnia.

alter table public.admins add column if not exists can_wipe boolean not null default false;
-- dotychczasowi admini to właściciele (stan 08.11: jedno konto)
-- tylko przy pierwszym uruchomieniu (adwersarz 08.11: ponowne bez warunku robiło właściciela z admina 2. stopnia)
update public.admins set can_wipe = true where not exists (select 1 from public.admins where can_wipe);

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.email = public.jwt_email() and public.jwt_email() <> '' and a.can_wipe)
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- lista adminów: czyta każdy admin, zmienia tylko właściciel
drop policy if exists admins_admin_all on public.admins;
drop policy if exists admins_admin_read on public.admins;
drop policy if exists admins_owner_write on public.admins;
create policy admins_admin_read on public.admins for select to authenticated using (public.is_admin());
create policy admins_owner_write on public.admins for all to authenticated using (public.is_owner()) with check (public.is_owner());

create or replace function public.wipe_group(p_confirm text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if not public.is_owner() then
    raise exception 'Usunąć grupę może tylko właściciel' using errcode = '42501';
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
