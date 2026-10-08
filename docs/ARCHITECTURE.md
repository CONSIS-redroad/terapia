# Architektura

```
Telefon / komputer (PWA, GitHub Pages grupy)
   │  React 19 + Vite + Tailwind 4 (na bazie Luna2)
   │  services/groupData.ts  ← jedyne wejście danych dla ekranów
   ├── group.yml              ← konfiguracja grupy (harmonogram, zasady, admini) — repo grupy
   └── Supabase GRUPY (własne darmowe konto, 1 GB)
         Auth (Google / link e-mail) · Postgres + RLS · Storage (pliki czatu, zdjęcia z sali) · Realtime (czat)
```

- **Jedna kopia aplikacji = jedna grupa** (fork repo + własne Supabase). Brak wspólnego serwera z danymi wielu grup.

## Faza 2 — jak to jest zbudowane (stan 09.10.2026)
- **Dwa buildy w jednym wydaniu:** `/` = demo (dane zmyślone w przeglądarce), `/grupa/` = Supabase (`VITE_DATA_SOURCE=supabase` + klucz PUBLICZNY ze zmiennych repo). Service Worker demo nie obsługuje `/grupa/` (D024).
- **Logowanie (D022, D025):** Google OAuth + e-mail i hasło bez potwierdzania maila (darmowa poczta Supabase nie wysyła do osób spoza zespołu projektu); bramką jest akceptacja admina. `AuthGate`: logowanie → imię + zgoda (wersjonowana) → „czekasz na akceptację” (sprawdza samo co 15 s) → aplikacja.
- **Uprawnienia w bazie (D023):** RLS na każdej tabeli, rola `anon` bez uprawnień; `is_admin()` = e-mail w tabeli `admins`, `is_member()` = wpuszczony; status, rolę i imię chroni wyzwalacz (zmiana imienia przez uczestnika = prośba `pending_name`, imiona unikalne — D028); grupa widzi osoby przez funkcję `group_members()` (e-mail tylko admin).
- **Pliki:** prywatny bucket `group-files` — 20 MB/plik (limit bucketu), 40 MB/osobę (wyzwalacz, folder = id osoby), `admin/` = zdjęcia z sali, materiały, archiwum; adresy podpisane (1 h). Realtime: wiadomości, reakcje, załączniki.
- **Migracje:** `supabase/migrations/0001_init` … `0006_porzadki` (archiwum 0003, harmonogram 0004, imiona 0005). Nowa zmiana = nowy plik; po wgraniu kontrola doradcy bezpieczeństwa Supabase.
- **CSP** w `index.html` dopuszcza tylko: własną domenę, `*.supabase.co` (https + wss), `blob:`/`data:` (pliki przed wysłaniem), miniatury `i.ytimg.com`.
- **Role:** admin (e-mail z `group.yml`), uczestnik (wpuszczony przez admina). Niezaakceptowany nie widzi nic (RLS).
- **Prywatność:** grupa widzi imię; nazwisko/zdjęcie/opis tylko po włączeniu przez uczestnika. Dzienniczek samoobserwacji
  to osobna aplikacja (`CONSIS-redroad/dzienniczek`) — tylko link, bez wymiany danych.
- **Limity:** plik ≤ 20 MB, osoba ≤ 40 MB łącznie; grupa ≤ ~20 osób → ≤ 800 MB w 1 GB darmowego planu.
- **Aktualizacje:** każdy build ma numer (`version.json`); aplikacja przy otwarciu sama przechodzi na nowy.
- **Faza 0 (teraz):** zamiast Supabase — dane demo w przeglądarce (`frontend/src/demo/`).
