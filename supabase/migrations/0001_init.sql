-- PATH: supabase/migrations/0001_init.sql | REQ-ID: TERAPIA-DB-01
-- Schemat bazy JEDNEJ grupy (D018: jedna kopia aplikacji = jedna grupa = własne Supabase).
-- Zasady (PLAN-SKLADANIA, faza 2):
--   * niewpuszczony (status != approved) nie widzi NICZEGO z grupy — tylko własny wpis i zasady;
--   * admin = zalogowany e-mail obecny w tabeli `admins` (D019);
--   * uczestnik usuwa tylko swoje; admin moderuje (wiadomość znika, zostaje ślad);
--   * pliki: bucket `group-files`, 20 MB/plik (limit bucketu) i 40 MB/osobę (wyzwalacz w bazie);
--   * grupa widzi o uczestniku minimum IMIĘ + awatar-ikonkę; reszta tylko gdy uczestnik włączy (funkcja group_members()).
-- Od 30.10.2026 Supabase wymaga jawnych GRANT dla nowych tabel — są niżej, przy każdej tabeli.
-- Migracja jest idempotentna w granicach rozsądku (if not exists / or replace), ale przewidziana na PUSTY projekt.

begin;

-- ───────────────────────── typy ─────────────────────────
do $$ begin
  create type public.membership_status as enum ('pending', 'approved', 'blocked', 'removed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_role as enum ('therapist', 'participant');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.deleted_by as enum ('admin', 'author');
exception when duplicate_object then null; end $$;

-- ───────────────────────── admini ─────────────────────────
create table if not exists public.admins (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  note text,
  added_at timestamptz not null default now()
);

-- e-mail z tokenu logowania (magic link i Google dają zweryfikowany adres)
create or replace function public.jwt_email() returns text
language sql stable set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.email = public.jwt_email() and public.jwt_email() <> '')
$$;

-- Zaproszenia: admin dodaje osobę po e-mailu → po zalogowaniu wchodzi od razu jako zaakceptowana.
create table if not exists public.invites (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  name text not null default '' check (char_length(name) <= 40),
  invited_at timestamptz not null default now()
);

-- ───────────────────────── grupa (jeden wiersz) ─────────────────────────
create table if not exists public.group_info (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Grupa',
  description text not null default '',
  schedule text not null default '',
  rules_version text not null default '2026-10-08',
  updated_at timestamptz not null default now()
);
insert into public.group_info (id) values (1) on conflict do nothing;

-- ───────────────────────── członkostwo + profil ─────────────────────────
create table if not exists public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),   -- IMIĘ, obowiązkowe (D021)
  role public.member_role not null default 'participant',
  status public.membership_status not null default 'pending',
  emoji text not null default '🌿' check (char_length(emoji) <= 16),
  color text not null default '#38bdf8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  photo_url text check (photo_url is null or char_length(photo_url) <= 500),
  real_name text not null default '' check (char_length(real_name) <= 80),
  about text not null default '' check (char_length(about) <= 500),
  show_photo boolean not null default false,
  show_real_name boolean not null default false,
  show_about boolean not null default false,
  joined_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.members m where m.id = auth.uid() and m.status = 'approved')
$$;

-- Wstawienie/zmiana wpisu: status i rola tylko przez admina; admin wchodzi od razu jako zaakceptowany.
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
  else
    if (new.status, new.role) is distinct from (old.status, old.role) then
      if not public.is_admin() then
        raise exception 'Status i rolę zmienia tylko admin' using errcode = '42501';
      end if;
      new.decided_at := now(); new.decided_by := public.jwt_email();
    end if;
    new.id := old.id; new.joined_at := old.joined_at;
  end if;
  new.name := btrim(new.name);
  return new;
end $$;
drop trigger if exists members_guard on public.members;
create trigger members_guard before insert or update on public.members
  for each row execute function public.members_guard();

-- Jak grupa widzi uczestników: minimum imię + ikonka; reszta tylko za zgodą (przełączniki). E-mail tylko admin.
create or replace function public.group_members()
returns table (id uuid, name text, role public.member_role, status public.membership_status, emoji text, color text,
               photo_url text, about text, joined_at timestamptz, email text)
language sql stable security definer set search_path = '' as $$
  select m.id,
         case when m.show_real_name and btrim(m.real_name) <> '' then m.name || ' (' || btrim(m.real_name) || ')' else m.name end,
         m.role, m.status, m.emoji, m.color,
         case when m.show_photo or m.id = auth.uid() then m.photo_url end,
         case when m.show_about or m.id = auth.uid() then m.about else '' end,
         m.joined_at,
         case when public.is_admin() then u.email::text end
  from public.members m join auth.users u on u.id = m.id
  where public.is_admin() or (public.is_member() and m.status = 'approved') or m.id = auth.uid()
  order by m.joined_at
$$;

-- ───────────────────────── zgody (wersjonowane zasady) ─────────────────────────
create table if not exists public.consents (
  member_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  rules_version text not null check (char_length(rules_version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  primary key (member_id, rules_version)
);

-- ───────────────────────── zajęcia, zdjęcia z sali, prace domowe ─────────────────────────
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  duration_min int not null default 90 check (duration_min between 10 and 600),
  topic text not null default '' check (char_length(topic) <= 200),
  place text not null default '' check (char_length(place) <= 200),
  summary text not null default '' check (char_length(summary) <= 2000),
  details text not null default '' check (char_length(details) <= 20000),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_starts_at on public.meetings (starts_at);

create table if not exists public.meeting_photos (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  path text not null check (path like 'admin/%'),      -- obiekt w bucket group-files
  caption text not null default '' check (char_length(caption) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  given_meeting uuid not null references public.meetings (id) on delete cascade,
  due_meeting uuid not null references public.meetings (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  created_at timestamptz not null default now()
);

-- „Zrobione” — prywatne: widzi i zmienia tylko właściciel.
create table if not exists public.homework_done (
  homework_id uuid not null references public.homework (id) on delete cascade,
  member_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (homework_id, member_id)
);

-- ───────────────────────── materiały i ogłoszenia ─────────────────────────
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  kind text not null check (kind in ('pdf', 'image', 'video', 'audio', 'link')),
  category text not null default 'inne' check (category in ('zajecia', 'ksiazka', 'poradnik', 'podcast', 'film', 'inne')),
  author text not null default '' check (char_length(author) <= 200),
  url text check (url is null or url ~ '^https://'),    -- wideo/audio ZAWSZE link zewnętrzny (D007)
  path text check (path is null or path like 'admin/%'),-- pdf/obraz w bucket group-files
  meeting_id uuid references public.meetings (id) on delete set null,
  note text not null default '' check (char_length(note) <= 2000),
  added_at timestamptz not null default now(),
  check (url is not null or path is not null)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 5000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ───────────────────────── czat ─────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  reply_to uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_by public.deleted_by,
  deleted_reason text check (deleted_reason is null or char_length(deleted_reason) <= 300),
  deleted_at timestamptz
);
create index if not exists messages_created_at on public.messages (created_at);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null unique,                               -- <owner_id>/<uuid>-<nazwa> w bucket group-files
  name text not null check (char_length(name) between 1 and 120),
  mime text not null default 'application/octet-stream' check (char_length(mime) <= 120),
  size bigint not null check (size > 0 and size <= 20 * 1024 * 1024),
  kind text not null check (kind in ('image', 'video', 'audio', 'pdf', 'doc', 'txt')),
  deleted_by public.deleted_by,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (split_part(path, '/', 1) = owner_id::text)
);

-- jedna reakcja na osobę (jak WhatsApp)
create table if not exists public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  member_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, member_id)
);

-- Wiadomość: autor = zalogowany, nie można „odkasować” ani podmienić autora.
create or replace function public.messages_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid(); new.created_at := now();
    new.deleted_by := null; new.deleted_reason := null; new.deleted_at := null;
  else
    raise exception 'Wiadomości nie edytuje się — usuń przez delete_message()' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before insert or update on public.messages
  for each row when (current_setting('terapia.bypass', true) is distinct from 'on')
  execute function public.messages_guard();

-- Usunięcie wiadomości: autor (swoją) albo admin (każdą). Treść znika, zostaje ślad; plik też znika.
create or replace function public.delete_message(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_author uuid; v_by public.deleted_by;
begin
  select author_id into v_author from public.messages where id = p_id;
  if v_author is null then raise exception 'Brak wiadomości' using errcode = 'P0002'; end if;
  if v_author = auth.uid() and public.is_member() then v_by := 'author';
  elsif public.is_admin() then v_by := 'admin';
  else raise exception 'Możesz usunąć tylko swoją wiadomość' using errcode = '42501'; end if;
  perform set_config('terapia.bypass', 'on', true);
  update public.messages set body = '', deleted_by = v_by, deleted_at = now(),
         deleted_reason = case when v_by = 'admin' then left(p_reason, 300) end
   where id = p_id;
  perform set_config('terapia.bypass', 'off', true);
  delete from public.reactions where message_id = p_id;
  perform public.delete_attachment(p_id);
end $$;

-- Usunięcie samego pliku (wiadomość zostaje): właściciel albo admin. Kasuje obiekt w Storage → zwalnia limit.
create or replace function public.delete_attachment(p_message_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select * into a from public.attachments where message_id = p_message_id and deleted_at is null;
  if not found then return; end if;
  if not (public.is_admin() or (a.owner_id = auth.uid() and public.is_member())) then
    raise exception 'Możesz usunąć tylko swój plik' using errcode = '42501';
  end if;
  update public.attachments
     set deleted_by = case when a.owner_id = auth.uid() then 'author'::public.deleted_by else 'admin'::public.deleted_by end,
         deleted_at = now()
   where id = a.id;
  -- obiekt kasuje klient przez Storage API (polityka terapia_files_delete); tu próba awaryjna,
  -- bo nowsze Supabase blokują bezpośredni DELETE ze storage.objects
  begin
    delete from storage.objects where bucket_id = 'group-files' and name = a.path;
  exception when others then null;
  end;
end $$;

-- ───────────────────────── zajętość plików (40 MB / osobę) ─────────────────────────
create or replace function public.storage_used(p_owner uuid default auth.uid()) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  from storage.objects o
  where o.bucket_id = 'group-files' and split_part(o.name, '/', 1) = p_owner::text
    and (p_owner = auth.uid() or public.is_admin())
$$;

-- Admin: zajętość każdej osoby (panel limitów).
create or replace function public.storage_usage() returns table (member_id uuid, used bigint, files int)
language sql stable security definer set search_path = '' as $$
  select split_part(o.name, '/', 1)::uuid, sum((o.metadata ->> 'size')::bigint), count(*)::int
  from storage.objects o
  where o.bucket_id = 'group-files' and public.is_admin() and split_part(o.name, '/', 1) <> 'admin'
  group by 1
$$;

-- Limit w bazie: obiekt w group-files nie może przekroczyć 40 MB łącznie na właściciela (folder = uid).
-- Folder `admin/` (zdjęcia z sali, materiały) — bez limitu osobowego, tylko 20 MB/plik z bucketu.
create or replace function public.storage_quota_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_folder text := split_part(new.name, '/', 1); v_size bigint := coalesce((new.metadata ->> 'size')::bigint, 0); v_used bigint;
begin
  if new.bucket_id <> 'group-files' or v_folder = 'admin' then return new; end if;
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) into v_used
    from storage.objects o
   where o.bucket_id = 'group-files' and split_part(o.name, '/', 1) = v_folder and o.id <> new.id;
  if v_used + v_size > 40 * 1024 * 1024 then
    raise exception 'Limit 40 MB na osobę przekroczony (zajęte % B, plik % B)', v_used, v_size using errcode = '53400';
  end if;
  return new;
end $$;

-- ───────────────────────── RLS ─────────────────────────
alter table public.admins          enable row level security;
alter table public.invites         enable row level security;
alter table public.group_info      enable row level security;
alter table public.members         enable row level security;
alter table public.consents        enable row level security;
alter table public.meetings        enable row level security;
alter table public.meeting_photos  enable row level security;
alter table public.homework        enable row level security;
alter table public.homework_done   enable row level security;
alter table public.materials       enable row level security;
alter table public.announcements   enable row level security;
alter table public.messages        enable row level security;
alter table public.attachments     enable row level security;
alter table public.reactions       enable row level security;

-- admins: tylko admin czyta i zmienia listę adminów
create policy admins_admin_all on public.admins for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy invites_admin_all on public.invites for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- group_info: każdy zalogowany czyta nazwę grupy i wersję zasad (ekran „czekasz na akceptację”); zmienia admin
create policy group_info_read on public.group_info for select to authenticated using (true);
create policy group_info_admin on public.group_info for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- members: swój wpis zawsze; cała tabela tylko admin (grupa czyta przez group_members())
create policy members_self_read   on public.members for select to authenticated using (id = auth.uid() or public.is_admin());
create policy members_self_insert on public.members for insert to authenticated with check (id = auth.uid());
create policy members_self_update on public.members for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy members_admin_delete on public.members for delete to authenticated using (public.is_admin());

-- consents: swoje (wstawienie przed akceptacją — zgoda jest warunkiem wejścia); admin czyta wszystkie
create policy consents_self_read   on public.consents for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy consents_self_insert on public.consents for insert to authenticated with check (member_id = auth.uid());

-- treści grupy: czyta członek, pisze admin
create policy meetings_read  on public.meetings for select to authenticated using (public.is_member());
create policy meetings_admin on public.meetings for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy photos_read    on public.meeting_photos for select to authenticated using (public.is_member());
create policy photos_admin   on public.meeting_photos for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy homework_read  on public.homework for select to authenticated using (public.is_member());
create policy homework_admin on public.homework for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy materials_read  on public.materials for select to authenticated using (public.is_member());
create policy materials_admin on public.materials for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ann_read  on public.announcements for select to authenticated using (public.is_member());
create policy ann_admin on public.announcements for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- homework_done: prywatne
create policy hwdone_own on public.homework_done for all to authenticated
  using (member_id = auth.uid() and public.is_member()) with check (member_id = auth.uid() and public.is_member());

-- messages: czyta członek; pisze członek (jako on sam); usuwanie tylko przez delete_message()
create policy messages_read   on public.messages for select to authenticated using (public.is_member());
create policy messages_insert on public.messages for insert to authenticated with check (public.is_member() and author_id = auth.uid());

-- attachments: czyta członek; dodaje właściciel do SWOJEJ wiadomości
create policy att_read   on public.attachments for select to authenticated using (public.is_member());
create policy att_insert on public.attachments for insert to authenticated with check (
  public.is_member() and owner_id = auth.uid()
  and exists (select 1 from public.messages m where m.id = message_id and m.author_id = auth.uid() and m.deleted_at is null));

-- reactions: czyta członek; swoją reakcję dodaje/zmienia/zdejmuje sam
create policy react_read on public.reactions for select to authenticated using (public.is_member());
create policy react_own  on public.reactions for all    to authenticated
  using (member_id = auth.uid() and public.is_member()) with check (member_id = auth.uid() and public.is_member());

-- ───────────────────────── GRANT (jawnie; anon = nic) ─────────────────────────
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on
  public.admins, public.invites, public.group_info, public.members, public.consents, public.meetings, public.meeting_photos,
  public.homework, public.homework_done, public.materials, public.announcements, public.messages,
  public.attachments, public.reactions
to authenticated;
revoke execute on all functions in schema public from public, anon;
-- funkcje-wyzwalacze nie mają być wołane przez API (Supabase domyślnie daje EXECUTE rolom authenticated/anon)
revoke execute on function public.members_guard(), public.messages_guard(), public.storage_quota_guard() from public, anon, authenticated;
grant execute on function public.is_admin(), public.is_member(), public.jwt_email(), public.group_members(),
  public.delete_message(uuid, text), public.delete_attachment(uuid), public.storage_used(uuid), public.storage_usage()
to authenticated;

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('group-files', 'group-files', false, 20 * 1024 * 1024)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop trigger if exists terapia_storage_quota on storage.objects;
create trigger terapia_storage_quota before insert or update on storage.objects
  for each row execute function public.storage_quota_guard();

drop policy if exists terapia_files_read on storage.objects;
create policy terapia_files_read on storage.objects for select to authenticated
  using (bucket_id = 'group-files' and public.is_member());
drop policy if exists terapia_files_insert on storage.objects;
create policy terapia_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'group-files' and public.is_member()
    and ((storage.foldername(name))[1] = auth.uid()::text
         or ((storage.foldername(name))[1] = 'admin' and public.is_admin())));
drop policy if exists terapia_files_delete on storage.objects;
create policy terapia_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'group-files'
    and (public.is_admin() or ((storage.foldername(name))[1] = auth.uid()::text and public.is_member())));

-- ───────────────────────── Realtime czatu ─────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.messages, public.reactions, public.attachments;
exception when duplicate_object then null; when undefined_object then null; end $$;

commit;
