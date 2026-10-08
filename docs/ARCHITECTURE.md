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
- **Role:** admin (e-mail z `group.yml`), uczestnik (wpuszczony przez admina). Niezaakceptowany nie widzi nic (RLS).
- **Prywatność:** grupa widzi imię; nazwisko/zdjęcie/opis tylko po włączeniu przez uczestnika. Dzienniczek samoobserwacji
  to osobna aplikacja (`CONSIS-redroad/dzienniczek`) — tylko link, bez wymiany danych.
- **Limity:** plik ≤ 20 MB, osoba ≤ 40 MB łącznie; grupa ≤ ~20 osób → ≤ 800 MB w 1 GB darmowego planu.
- **Aktualizacje:** każdy build ma numer (`version.json`); aplikacja przy otwarciu sama przechodzi na nowy.
- **Faza 0 (teraz):** zamiast Supabase — dane demo w przeglądarce (`frontend/src/demo/`).
