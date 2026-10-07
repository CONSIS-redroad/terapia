# Plan składania TERAPIA

Stan na 2026-10-08. Decyzje: `.ai/DECISIONS.md` D005–D007.

## Założenia (Bartek 07–08.10.2026)
- Własna aplikacja, nie gotowiec (Classroom/Sites odrzucone).
- Backend: **Supabase** (darmowy plan, region UE). Baza kodu: **otwarty Atomic CRM** (`marmelab/atomic-crm`) —
  ma już logowanie Google, panel admina użytkowników (funkcja `users`), załączniki do Storage, notatki (→ rozmowy).
  Doświadczenie i pułapki z CRM Aliny (ten sam stos) — w MEMO, kodu Aliny nie kopiujemy.
- Logowanie: Google albo link na e-mail. **Każde dołączenie akceptuje admin.** Do akceptu użytkownik widzi tylko „poczekaj”.
- Pliki: Supabase Storage 1 GB — tylko materiały wrzucane raz (PDF, karty pracy, obrazy), z limitem rozmiaru.
  **Wideo/audio = link do zewnętrznego źródła**, nie plik na naszym serwerze.
- Wygląd: moduł `window-manager` (design Luna2).
- Dane zdrowotne (RODO art. 9): w publicznym repo tylko kod; sekrety tylko w zmiennych środowiska.
- Prywatny Dzienniczek nie jest dostępny przez członkostwo w grupie (D002).

## FAZA 1 — Panel jednej grupy
1. **Start projektu**: projekt Supabase (UE), kopia Atomic CRM do `frontend/`, odchudzenie z modułów CRM (firmy, deale).
2. **Logowanie + akceptacja**: Google + magic link; tabela członkostw ze statusem `pending/approved/blocked`;
   ekran admina „Do akceptacji” (na bazie funkcji `users` z Atomica); RLS: dane grupy tylko dla `approved`.
3. **Kalendarz grupy**: spotkania (data, temat, link do spotkania online).
4. **Materiały**: upload PDF/obrazów do Storage (limit rozmiaru, lista typów), linki do wideo/audio z podglądem (YouTube/Vimeo).
5. **Ogłoszenia + rozmowa grupy**: wątek wiadomości (na bazie notatek Atomica), Supabase Realtime.
6. **Okna**: powłoka z `window-manager`, na telefonie pełny ekran.
7. **Testy**: osoba niezaakceptowana nic nie widzi; osoba z grupy A nie widzi grupy B; złośliwy plik/HTML w wiadomości nie wykonuje się.
8. **Utrzymanie**: keepalive (darmowy Supabase usypia po tygodniu — dopisać adres do istniejącego automatu RedRoad),
   nocna kopia bazy (wzór kopii Aliny).
9. **Pilot**: jedna prawdziwa grupa.

## FAZA 2 — Grupa żyje
Obecność, prace domowe (termin + oddanie linku/pliku), dyskusja przy konkretnym spotkaniu.

## FAZA 3 — Terapeuta i powielanie grup
Wiele grup na terapeutę (izolacja RLS), „utwórz grupę jak X” (kopiuje kalendarz cykliczny i materiały, bez ludzi),
panel terapeuty, role `co_therapist`/`coordinator`.

## FAZA 4 — Dzienniczek (opcjonalnie)
Tylko świadome udostępnienie przez uczestnika; nigdy automatycznie.

## Otwarte
- Konto firmowe Google (Workspace?) — czy terapia pod RedRoad czy osobny podmiot; ewentualny magazyn plików na później.
- Konto Supabase dla projektu (redroadai@ w miejsce pustego `dkfk…` czy osobne).
