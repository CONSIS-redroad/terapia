-- PATH: supabase/migrations/0014_admin_drugi_stopien_granice.sql | REQ-ID: TERAPIA-DB-14
-- Adwersarz 08.11 do 0012: admin 2. stopnia nie miał przycisku „usuń grupę”, ale mógł rozebrać ją po kawałku
-- i działać na koncie właściciela (blokada konta kasowała jego prywatne notatki). Decyzja Bartka 08.11 — „środek”:
-- admin 2. stopnia prowadzi grupę (prace, materiały, terminy, program, wpuszczanie, blokowanie uczestników, czat),
-- ale NIE: rusza konta właściciela, kasuje osób (tylko blokuje), kasuje zajęć (tylko odwołuje), kasuje archiwum
-- ani jego plików, zmienia nazwy/opisu/harmonogramu grupy.
-- Zapytania bez użytkownika (auth.uid() null: postgres / klucz serwisowy — import archiwum) nie są ograniczane.

-- 1. konto właściciela: zmienia je tylko on sam albo inny właściciel
create or replace function public.members_protect_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(old.id, new.id);
begin
  if auth.uid() is null or public.is_owner() or v_id = auth.uid() then
    return coalesce(new, old);
  end if;
  if exists (select 1 from auth.users u join public.admins a on a.email = lower(u.email)
             where u.id = v_id and a.can_wipe) then
    raise exception 'Konto właściciela grupy zmienia tylko właściciel' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.members_protect_owner() from public, anon, authenticated;
drop trigger if exists members_protect_owner on public.members;
create trigger members_protect_owner before update or delete on public.members
  for each row execute function public.members_protect_owner();

-- 2. kasowanie osób: tylko właściciel (admin 2. stopnia blokuje statusem — tak robi aplikacja)
drop policy if exists members_admin_delete on public.members;
create policy members_admin_delete on public.members for delete to authenticated using (public.is_owner());

-- 3. zajęcia: dodaje/zmienia/odwołuje każdy admin, kasuje tylko właściciel (kaskada kasuje notatki uczestników)
drop policy if exists meetings_admin on public.meetings;
drop policy if exists meetings_admin_insert on public.meetings;
drop policy if exists meetings_admin_update on public.meetings;
drop policy if exists meetings_owner_delete on public.meetings;
create policy meetings_admin_insert on public.meetings for insert to authenticated with check (public.is_admin());
create policy meetings_admin_update on public.meetings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy meetings_owner_delete on public.meetings for delete to authenticated using (public.is_owner());

-- 4. archiwum: kasuje tylko właściciel
drop policy if exists archive_admin on public.archive_items;
drop policy if exists archive_admin_insert on public.archive_items;
drop policy if exists archive_admin_update on public.archive_items;
drop policy if exists archive_owner_delete on public.archive_items;
create policy archive_admin_insert on public.archive_items for insert to authenticated with check (public.is_admin());
create policy archive_admin_update on public.archive_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy archive_owner_delete on public.archive_items for delete to authenticated using (public.is_owner());

-- 5. dane grupy: nazwę, opis i harmonogram zmienia tylko właściciel (program cyklu — każdy admin)
create or replace function public.group_info_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_owner()
     and (new.name, new.description, new.schedule) is distinct from (old.name, old.description, old.schedule) then
    raise exception 'Nazwę, opis i harmonogram grupy zmienia tylko właściciel' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.group_info_guard() from public, anon, authenticated;
drop trigger if exists group_info_guard on public.group_info;
create trigger group_info_guard before update on public.group_info
  for each row execute function public.group_info_guard();

-- 6. pliki: archiwum (admin/archiwum/…) kasuje tylko właściciel; reszta jak dotąd
drop policy if exists terapia_files_delete on storage.objects;
create policy terapia_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'group-files' and (
    (public.is_admin() and not ((storage.foldername(name))[1] = 'admin' and (storage.foldername(name))[2] = 'archiwum'))
    or (public.is_owner())
    or ((storage.foldername(name))[1] = (auth.uid())::text and public.is_member())
  ));
