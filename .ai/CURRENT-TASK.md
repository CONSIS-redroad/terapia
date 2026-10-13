# Current Task — stan na 13.10.2026

> Najpierw przeczytaj ten plik, potem `.ai/DECISIONS.md` (D001–D035) i koniec `.ai/CHANGELOG.md`.
> Treści grupy (imiona, notatki, zdjęcia tablicy, skany, PDF z zajęć) NIGDY w repo — leżą w Supabase grupy;
> pliki robocze od prowadzącego trzymaj w `prywatne/` (w `.gitignore`).

## Co działa na żywo

- **Wersja grupy:** https://consis-redroad.github.io/terapia/grupa/ — wersja **0.10.4**
  (sprawdzenie: `…/terapia/grupa/version.json`). Demo bez bazy: `…/terapia/`.
- **Supabase grupy:** projekt `saxrwnubdylaicnliwyc` (UE). Migracje `supabase/migrations/0001–0011`.
- **Logowanie (D025, D033):** Google albo e-mail + hasło bez potwierdzania maila. Admin = e-mail z tabeli `admins`
  (prowadzący). Zaproszenie (`invites`: e-mail + imię) wpuszcza od razu **tylko przy logowaniu Google**;
  konto z hasłem zawsze trafia do kolejki „czeka na akceptację”.
- **Ekrany:** Kalendarz (karta zajęć: praca domowa z edycją/usuwaniem i „Dodaj pracę zadaną na tych zajęciach”,
  streszczenie, zdjęcia tablicy, materiały, Moje notatki), Program cyklu, Prace, Czat (miniatury zdjęć, „Grupa · N osób” + karta osoby — D035),
  Media, Zasady, Archiwum, Admin, Terminy.

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
- `messages_guard` blokuje UPDATE wiadomości (DELETE dla właściciela/admina działa).
- Każda zmiana na żywo dopiero po adwersarzu (wyjątek: prowadzący mówi wprost „wrzucaj”).

## Otwarte

1. Karta 00b345f1 — audyt bezpieczeństwa TERAPII i Dzienniczka (wspólny origin `consis-redroad.github.io`,
   SSO, RLS/Storage/RPC, CSP). Raport → `_audit_drift/plany` w workspace RedRoad.
2. `is_admin()` ufa e-mailowi z tokenu — bezpieczne, dopóki konto admina istnieje (rejestracja na zajęty e-mail
   jest odrzucana); docelowo admin tylko przy sesji Google (jak D033).
3. Małe przyciski „Usuń z grupy” w panelu Admin (< 44 px) — do poprawy.
4. Zapas: FAZA 1 `group.yml` / konfigurator dla innych grup (`docs/PLAN-SKLADANIA.md`) — odłożone.
