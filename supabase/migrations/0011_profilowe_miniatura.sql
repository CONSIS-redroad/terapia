-- PATH: supabase/migrations/0011_profilowe_miniatura.sql | REQ-ID: TERAPIA-DB-11
-- Zdjęcie profilowe (prowadzący 13.10): miniatura JPEG 160 px robiona w telefonie (ok. 10 KB) trzymana WPROST
-- w members.photo_url jako data:image/jpeg;base64. Celowo NIE w buckecie group-files: każdy członek może tam
-- czytać i listować wszystkie pliki (terapia_files_read), więc zdjęcie ustawione „tylko ja” dałoby się podejrzeć.
-- W wierszu members zdjęcie widzi właściciel i admin (members_self_read — stąd w aplikacji „tylko Ty i prowadząca”);
-- grupa dostaje je wyłącznie przez group_members() i tylko przy show_photo = true (bez zmian od 0001).
-- RODO (adwersarz 13.10 W3): admin usuwa osobę statusem removed/blocked, nie DELETE — wyzwalacz niżej kasuje wtedy
-- zdjęcie (i wyłącza jego pokazywanie); DELETE wiersza kasuje je razem z wierszem.

-- dane sprzed migracji: wszystko, co nie jest miniaturą JPEG, zerujemy (13.10 w bazie 0 zdjęć — zabezpieczenie)
-- (powtórzone po utworzeniu jpeg_miniatura_ok niżej — tu tylko to, co na pewno nie jest data URL JPEG)
update public.members set photo_url = null
 where photo_url is not null and photo_url !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$';

-- Wymiary z nagłówka JPEG — tylko prawdziwa miniatura do 256 × 256 px. Adwersarz 13.10: mały plik może deklarować
-- np. 12000 × 12000 px („bomba dekompresji”) i zawiesić telefony całej grupy przy dekodowaniu. Parser czyta segmenty
-- po kolei jak dekoder i przyjmuje WYŁĄCZNIE znane znaczniki (biała lista, runda 3: `FF00` udający segment chował
-- duży SOF przed parserem); dokładnie jeden SOF, potem dane obrazu (SOS). Wszystko inne = odrzucone.
create or replace function public.jpeg_miniatura_ok(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare b bytea; n int; i int := 2; m int; seg int; h int := 0; w int := 0; sof int := 0;
begin
  if p is null then return true; end if;
  b := decode(substr(p, 24), 'base64');            -- po 'data:image/jpeg;base64,' (23 znaki)
  n := length(b);
  if n < 4 or get_byte(b, 0) <> 255 or get_byte(b, 1) <> 216 then return false; end if;   -- FFD8 = początek JPEG
  while i + 4 <= n loop
    if get_byte(b, i) <> 255 then return false; end if;
    m := get_byte(b, i + 1);
    -- dozwolone segmenty z długością: APP0–APP15, DQT, DHT, DRI, COM, SOF0–3/5–7/9–11/13–15, SOS
    if not (m between 224 and 239 or m in (219, 196, 221, 254, 218)
            or (m between 192 and 207 and m not in (196, 200, 204))) then
      return false;
    end if;
    seg := get_byte(b, i + 2) * 256 + get_byte(b, i + 3);
    if seg < 2 or i + 2 + seg > n then return false; end if;
    if m = 218 then                                                          -- SOS: początek danych obrazu
      return sof = 1 and h between 1 and 256 and w between 1 and 256;
    end if;
    if m between 192 and 207 and m not in (196, 200, 204) then              -- SOFn
      if seg < 8 then return false; end if;
      sof := sof + 1;
      h := get_byte(b, i + 5) * 256 + get_byte(b, i + 6);
      w := get_byte(b, i + 7) * 256 + get_byte(b, i + 8);
    end if;
    i := i + 2 + seg;
  end loop;
  return false;                                                              -- brak SOS
exception when others then return false;                                    -- zły base64 itp.
end $$;

update public.members set photo_url = null where photo_url is not null and not public.jpeg_miniatura_ok(photo_url);

alter table public.members drop constraint if exists members_photo_url_check;
alter table public.members drop constraint if exists members_photo_miniatura;
alter table public.members add constraint members_photo_miniatura check (
  photo_url is null
  or (char_length(photo_url) <= 40000 and photo_url ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
      and public.jpeg_miniatura_ok(photo_url))
);

create or replace function public.members_photo_rodo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('removed', 'blocked') then
    new.photo_url := null; new.show_photo := false;
  end if;
  return new;
end $$;
revoke execute on function public.members_photo_rodo() from public, anon, authenticated;

drop trigger if exists members_photo_rodo on public.members;
create trigger members_photo_rodo before insert or update on public.members
  for each row execute function public.members_photo_rodo();

-- osoby już usunięte przed tą migracją
update public.members set photo_url = null, show_photo = false
 where status in ('removed', 'blocked') and (photo_url is not null or show_photo);
