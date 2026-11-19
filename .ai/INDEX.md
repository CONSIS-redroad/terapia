# AI Project Index — TERAPIA (stan 19.11.2026)

Kolejność czytania przed pracą:
1. `.ai/RULES.md` — twarde zasady (prywatność, treści, wydanie). **Obowiązkowe.**
2. `.ai/CURRENT-TASK.md` — co działa na żywo, wersja, baza, przepis „Jak dodać treści z zajęć”, zaproszenia, narzędzia okna.
3. `.ai/DECISIONS.md` — ustalenia prowadzącego D001–D042 (przed zmianą zachowania sprawdź, czy nie ma decyzji).
4. `CONTRIBUTING.md` — jak wprowadzać zmianę (gałąź → tsc → build → test 390 px → PR → Pages), konwencja commitów.
5. `docs/STRUKTURA.md` — mapa kodu `frontend/src` (+ tabela plików po 0.9 na końcu). `docs/INSTRUKCJA-ADMINA.md` — obsługa przez prowadzącego.

Najczęstsze zadania → gdzie:
- Dodanie treści z zajęć (PDF, praca domowa, lektura z lektorem, źródło do czytnika, zdjęcia tablic, temat) → `CURRENT-TASK.md` § „Jak dodać treści z zajęć”.
- Zaproszenie osób / logowanie → `CURRENT-TASK.md` § „Jak zaprosić osoby”.
- Zmiana wyglądu / ekranu → `docs/STRUKTURA.md` + `docs/WYGLAD.md`.
- Baza (tabele, RLS) → `supabase/migrations/0001–0016`.
- Szyfrowanie notatek (PIN, klucze) → D042, `frontend/src/services/noteCrypto.ts` + `noteVault.ts`, `components/NoteLock.tsx`, `npm test`.

UWAGA: `modules/*/INDEX.md` i lista `modules:` w `PROJECT-MAP.yml` to **szkielet z 07.10** (plan domenowy sprzed kodu) —
NIE opisują działającej aplikacji. Kod żyje w `frontend/src` (mapa: `docs/STRUKTURA.md`). Siostrzana aplikacja: Dzienniczek
(osobne repo `CONSIS-redroad/dzienniczek`, opis dla AI w jego `README.md` i `.ai/RULES.md`).
