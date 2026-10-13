-- PATH: supabase/migrations/0010_zaproszenie_tylko_google.sql | REQ-ID: TERAPIA-DB-10
-- Karta b474d22d (adwersarz 09.10): przy rejestracji e-mail + hasło bez potwierdzania maila (D025, mailer_autoconfirm)
-- adres z tokenu NIE jest sprawdzony. Ktoś mógł założyć konto hasłem na e-mail zaproszonej osoby, zanim ona weszła,
-- i od razu dostać jej miejsce w grupie. Teraz zaproszenie wpuszcza bez kolejki TYLKO przy logowaniu Google
-- (amr = oauth, adres potwierdzony przez Google) i tylko konto BEZ hasła. Konto z hasłem trafia do kolejki — wpuszcza admin (bramka z D025).

create or replace function public.jwt_oauth() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select bool_or(a ->> 'method' = 'oauth')
                   from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a), false)
$$;

create or replace function public.members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if public.is_admin() and new.id = auth.uid() then
      new.status := 'approved'; new.role := 'therapist'; new.decided_at := now(); new.decided_by := public.jwt_email();
    -- adwersarz 13.10: Supabase przy autoconfirm DOŁĄCZA logowanie Google do konta założonego wcześniej hasłem na ten adres,
    -- a hasło zostaje — więc samo amr=oauth nie wystarcza: konto nie może mieć tożsamości 'email' (hasła).
    elsif public.jwt_oauth()
      and not exists (select 1 from auth.identities ai where ai.user_id = auth.uid() and ai.provider = 'email')
      and exists (select 1 from public.invites i where i.email = public.jwt_email()) and new.id = auth.uid() then
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
grant execute on function public.jwt_oauth() to authenticated;
