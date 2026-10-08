-- PATH: supabase/migrations/0005_imie_zatwierdza_admin.sql | REQ-ID: TERAPIA-DB-05
-- Bartek 08.10 23:51: „ponowna akceptacja pozwala zmienić imię — to admin musiałby zatwierdzić; nie może być, że ktoś pisze,
-- a później podmieni na kogoś innego; i co, jak będą dwie albo trzy Anie”.
-- 1) Uczestnik zmienia imię → trafia do `pending_name`; w grupie dalej widać stare, dopóki admin nie zatwierdzi.
-- 2) Imię w grupie unikalne wśród wpuszczonych (bez względu na wielkość liter) — admin nadaje rozróżnienie („Ania K.”).

alter table public.members add column if not exists pending_name text
  check (pending_name is null or char_length(btrim(pending_name)) between 1 and 40);

create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if public.is_admin() and new.id = auth.uid() then
      new.status := 'approved'; new.role := 'therapist'; new.decided_at := now(); new.decided_by := public.jwt_email();
    elsif exists (select 1 from public.invites i where i.email = public.jwt_email()) and new.id = auth.uid() then
      new.status := 'approved'; new.role := 'participant'; new.decided_at := now(); new.decided_by := 'zaproszenie';
    elsif not public.is_admin() then
      new.status := 'pending'; new.role := 'participant'; new.decided_at := null; new.decided_by := null;
    end if;
    new.joined_at := now();
    new.pending_name := null;
  else
    if (new.status, new.role) is distinct from (old.status, old.role) then
      if not public.is_admin() then
        raise exception 'Status i rolę zmienia tylko admin' using errcode = '42501';
      end if;
      new.decided_at := now(); new.decided_by := public.jwt_email();
    end if;
    -- zmiana imienia przez uczestnika = tylko propozycja dla admina
    if not public.is_admin() then
      if btrim(new.name) is distinct from btrim(old.name) then
        new.pending_name := btrim(new.name);
        new.name := old.name;
      else
        new.pending_name := coalesce(new.pending_name, old.pending_name);
        if new.pending_name is distinct from old.pending_name and new.pending_name is not null then
          new.pending_name := old.pending_name; -- pending_name ustawia się tylko przez zmianę imienia
        end if;
      end if;
    end if;
    new.id := old.id; new.joined_at := old.joined_at;
  end if;
  new.name := btrim(new.name);
  return new;
end $$;
revoke execute on function public.members_guard() from public, anon, authenticated;

-- unikalne imię wśród wpuszczonych do grupy
create unique index if not exists members_name_unique_approved
  on public.members (lower(btrim(name))) where status = 'approved';
