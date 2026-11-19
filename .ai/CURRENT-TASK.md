# Current Task — stan na 19.11.2026

> Najpierw przeczytaj ten plik, potem `.ai/DECISIONS.md` (D001–D040) i koniec `.ai/CHANGELOG.md`.
> Treści grupy (imiona, notatki, zdjęcia tablicy, skany, PDF z zajęć) NIGDY w repo — leżą w Supabase grupy;
> pliki robocze od prowadzącego trzymaj w `prywatne/` (w `.gitignore`).

## Co działa na żywo

- **Wersja grupy:** https://consis-redroad.github.io/terapia/grupa/ — wersja **0.14.4**
  (sprawdzenie: `…/terapia/grupa/version.json`). Demo bez bazy: `…/terapia/`.
- **Supabase grupy:** projekt `saxrwnubdylaicnliwyc` (UE). Migracje `supabase/migrations/0001–0015`.
- **Logowanie (D025, D033):** Google albo e-mail + hasło bez potwierdzania maila. Admin = e-mail z tabeli `admins`
  (prowadzący). Zaproszenie (`invites`: e-mail + imię) wpuszcza od razu **tylko przy logowaniu Google**;
  konto z hasłem zawsze trafia do kolejki „czeka na akceptację”.
- **Admini (D037):** właściciel (`admins.can_wipe = true`) + admin 2. stopnia (`can_wipe = false`, prowadzi grupę,
  nie kasuje osób/zajęć/archiwum, nie rusza konta właściciela ani nazwy/opisu/harmonogramu grupy).
- **Praca domowa (D038):** może wskazywać materiał (PDF) i pozycję archiwum (czytnik z lektorem).
- **Ekrany:** Kalendarz (na telefonie najpierw siatka miesiąca, POD nią karta wybranych zajęć — bez samoczynnego
  przewijania; karta: praca domowa z edycją/usuwaniem i „Dodaj pracę zadaną na tych zajęciach”, streszczenie,
  Moje notatki, „Materiały do tych zajęć” = miniatury zdjęć z sali NA WIERZCHU + pliki), Program cyklu, Prace,
  Czat (miniatury zdjęć, „Grupa · N osób” + karta osoby — D035), Media, Zasady, Archiwum, Admin, Terminy.

## Jak dodać treści z zajęć — przepis dla AI (stała robota, ustalone 08–19.11)

**Tryb pracy (prowadzący 18.11):** „rób jak uważasz, wrzucisz — spojrzę i najwyżej napiszę, że coś nie tak”.
O przypięciu, temacie i podpisie decyduj sam, wgrywaj od razu, w odpowiedzi wypisz co i gdzie zrobiłeś.
Pytaj tylko, gdy materiały sobie przeczą (np. temat 27.10 — zostawiony pusty).

**Co skąd przychodzi → gdzie trafia:**

| Od prowadzącego | Tabela / miejsce | Widać w aplikacji |
|---|---|---|
| PDF / skan rozdany na zajęciach | `materials` (`meeting_id` = zajęcia, na których ROZDANO); plik w bucket `group-files`, ścieżka `admin/…` | karta zajęć → „Materiały do tych zajęć”, ekran Media |
| „to praca na przyszły wtorek” | `homework` (`given_meeting` = zajęcia rozdania, `due_meeting` = następne; `material_id` → PDF, `archive_item_id` → lektura) | karta obu zajęć, ekran Prace |
| JSON z transkrypcją PDF / zdjęcia tekstu | lektura czytnika w `archive_items` (`body.sections[{title, page, blocks[p, quote, callout, ul, img]}]` + `source`, `agenda`, `endnote`) | Archiwum + czytnik z lektorem; podpiąć do pracy domowej |
| zdjęcie tablicy z sali | `meeting_photos` (`meeting_id`, `path` = `admin/…`, `caption` ≤ 300 zn., np. „Tablica z sali, zajęcia DD.MM — zdjęcie: <kto zrobił>”) | miniatury na wierzchu „Materiałów do tych zajęć” |
| temat zajęć | `meetings.topic` = DOKŁADNIE `program_topics.title` (jedyne powiązanie — `ProgramSection` porównuje napisy) | Program cyklu pokazuje, kiedy temat był |

**Kroki:**
1. Rozpoznanie treści: zdjęcia/skany bez transkrypcji → podagent Sonnet (wiernie: nagłówki, tabele, listy → JSON).
   Gotowy JSON od prowadzącego = transkrypcja; PDF-a nie trzeba otwierać.
2. Ustal zajęcia: `select id, starts_at, topic from meetings order by starts_at` (`prywatne/sql_admin.py`).
3. Lektura: skrypt składa `manifest.json` + `files/` w `prywatne/import-<slug>/` (wzór konwertera:
   `tools/import/html_do_lektury.py`; przykłady paczek: `prywatne/import-asertywnosc/`, `import-porozumiewanie-sie/`),
   wgrywa `tools/import/wgraj_archiwum.py` (upsert po `slug` — ponowne uruchomienie = aktualizacja).
   **Treść pod lektora:** tytuły i akapity zwykłą pisownią, NIE WERSALIKAMI (lektor czyta wersaliki jak skróty —
   zamieniaj w skrypcie); każdy rozdział = osobna sekcja z `title` (czytnik czyta „Rozdział: …” wolniej i z pauzą);
   wyróżnienia jako `callout`; tabelę rozkładaj na listy per kolumna; zdjęcie tablicy może być też blokiem `img` w lekturze.
4. PDF + praca domowa: wzór `prywatne/przypnij_material.py` / `przypnij_porozumiewanie.py` (przed INSERT sprawdza,
   czy taki tytuł już jest — bez duplikatów). Zdjęcia z sali + tematy zajęć: wzór `prywatne/zajecia_tematy_zdjecia_1811.py`.
5. Sprawdzenie: SQL (wiersze są; rozmiar pliku w Storage = rozmiar źródła), `prywatne/sprawdz_lekture.py`;
   przy zmianie kodu — Playwright na demo (390 i 1280 px, 0 px przewijania w bok, brak błędów strony).

**Nie wolno:** treści grupy (imiona, zdjęcia, skany, PDF, transkrypcje) do repo — tylko `prywatne/` i Supabase;
klucza `service_role` w pliku ani czacie; zmian na żywo bez zgody prowadzącego (dla treści zgoda stała — tryb wyżej).

**Zmiana kodu → wydanie:** gałąź w `C:/CONSIS-redroad/terapia` (`git -C …`, nie w workspace RedRoad); wersja w
`frontend/package.json` + wpis w `.ai/CHANGELOG.md` + wersja w tym pliku; `npm run build`; PR i squash przez GitHub API
(brak `gh`); potem czekać na `…/terapia/version.json`. Aplikacja sama się przeładowuje po nowej wersji (PWA autoUpdate),
więc dwa wydania pod rząd potrafią „mignąć” użytkownikowi w trakcie klikania. Nie dodawać przewijania strony z kodu
(karuzela na telefonie; prowadzący 19.11: „zepsułeś przewijanie”).

**Baza zasypia:** darmowy Supabase pauzuje po ~7 dniach bez ruchu (objaw: „terapia nie wczytuje”). Codzienny ping:
`tools/alina_supabase_keepalive.py` w workspace RedRoad (schtask `RedRoad-Alina-Keepalive`, 09:17). Gdy mimo to
spauzowany — przywrócić projekt w panelu Supabase (konto organizacji grupy).

## Stan danych grupy

Treść (tematy, prace, członkowie) NIE w repo — opis w `prywatne/STAN_DANYCH.md` (lokalnie, w `.gitignore`)
albo zapytaniem SQL do bazy. Skrót: jedna seria zajęć, czat wyczyszczony 13.10 przed prezentacją dla grupy.

## Jak zaprosić osoby (najczęstsza prośba)

Prowadzący podaje listę „e-mail + imię” → wpis do `public.invites` (panel Admin → „Dodaj osobę” albo SQL przez
Management API). Osoba loguje się **Google** na ten adres → wchodzi od razu z tym imieniem. Bez Gmaila → „Załóż konto”
(e-mail + hasło) → czeka, admin wpuszcza w panelu Admin.
Uwagi (adwersarz 13.10): adres w zaproszeniu musi być DOKŁADNIE taki jak w Google (kropki w Gmailu: `jan.kowalski` ≠ `jankowalski`
→ osoba trafi do kolejki, nie wejdzie sama). Osoby czekającej z hasłem na zaproszony adres nie wpuszczać bez potwierdzenia
poza aplikacją. Kontrola przed rozesłaniem: `b474_migracja.py stan` w oknie AI (admin bez konta = 0, wpuszczeni
zaproszeniem z hasłem = 0, konta z hasłem na zaproszony adres = 0).

## Narzędzia okna (poza repo)

- SQL na bazie: Management API `POST /v1/projects/saxrwnubdylaicnliwyc/database/query` z tokenem osobistym Supabase
  (`sbp_…`, tymczasowy od prowadzącego — od razu do sejfu `rrv`, nigdy w pliku/repo/argv; po robocie prowadzący go wyłącza).
- Próba bez skutków: `begin; … raise exception 'WYNIK: %'` (rollback, wynik w treści błędu).
- Pliki: bucket `group-files`, ścieżki admina `admin/…`; klucz serwisowy pobierany na chwilę z API (`api-keys?reveal=true`).
- Skrypty okna w `prywatne/` (gitignored, na whiteliście sejfu dla `TERAPIA_SUPABASE_TOKEN`; uruchamiać
  `env -u TERAPIA_SUPABASE_TOKEN python prywatne/<skrypt>.py`): `sql_admin.py "<sql>"`, `auth_admin.py`,
  `przypnij_material.py`, `wgraj_ostatnie_zajecia.py`. Testy uprawnień jako użytkownik: `set local role authenticated`
  + `request.jwt.claims`, rollback; id z `auth.users` liczyć wcześniej jako postgres (rola authenticated go nie czyta).
- `messages_guard` blokuje UPDATE wiadomości (DELETE dla właściciela/admina działa).
- Każda zmiana na żywo dopiero po adwersarzu (wyjątek: prowadzący mówi wprost „wrzucaj”).

## Otwarte

1. Karta 00b345f1 — audyt bezpieczeństwa TERAPII i Dzienniczka (wspólny origin `consis-redroad.github.io`,
   SSO, RLS/Storage/RPC, CSP). Raport → `_audit_drift/plany` w workspace RedRoad.
2. `is_admin()` ufa e-mailowi z tokenu — bezpieczne, dopóki konto admina istnieje (rejestracja na zajęty e-mail
   jest odrzucana); docelowo admin tylko przy sesji Google (jak D033).
3. Małe przyciski „Usuń z grupy” w panelu Admin (< 44 px) — do poprawy.
4. Edytor prac domowych nie ustawia ani nie czyści załączników (PDF / czytnik) — dziś tylko SQL (D038).
5. Przycisk PDF zawsze „Oryginał (PDF)”; podpisany link wygasa po 1 h (odświeżenie strony go odnawia).
6. Kolumna `archive_items.sort` jest pomijana — Archiwum układa się datą (od najnowszej).
7. Do decyzji prowadzącego: krótka uwaga przy głosach „(online)” w lektorze (tekst idzie do Google/Microsoft).
8. Zapas: FAZA 1 `group.yml` / konfigurator dla innych grup (`docs/PLAN-SKLADANIA.md`) — odłożone.
