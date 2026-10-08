# TERAPIA — aplikacja grupy terapeutycznej

Prosta aplikacja (telefon / tablet / komputer, instalowana jak aplikacja — PWA) dla **jednej grupy terapeutycznej**:
kalendarz cyklu zajęć ze streszczeniami dla nieobecnych, prace domowe z terminami, czat grupy (jak WhatsApp),
biblioteka mediów i zasady grupy. Prywatny **Dzienniczek samoobserwacji** jest osobną aplikacją — grupa go nie widzi.

**Demo (dane zmyślone, bez logowania):** https://consis-redroad.github.io/terapia/
**Wersja grupy (prawdziwe dane, logowanie):** https://consis-redroad.github.io/terapia/grupa/
**Siostrzana aplikacja — prywatny Dzienniczek samoobserwacji:** repo [`CONSIS-redroad/dzienniczek`](https://github.com/CONSIS-redroad/dzienniczek), strona https://consis-redroad.github.io/dzienniczek/ — ten sam styl (motywy, jasny/ciemny), przyciski w obie strony; dane dzienniczka zostają w przeglądarce użytkownika i **grupa ich nie widzi** (D002).

## Dla kogo i jak działa

- **Uczestnik** loguje się (Google albo e-mail i hasło), wpisuje **imię** (minimum, które widzi grupa), akceptuje zasady i **czeka, aż admin go wpuści**. Zmianę imienia zatwierdza admin; dwie osoby nie mogą mieć tego samego imienia w grupie.
  Widzi: najbliższe zajęcia, co zadano, streszczenia, materiały, czat. Zdjęcie, nazwisko, opis — tylko jeśli sam włączy.
- **Admin / prowadząca** (rozpoznawany po adresie e-mail z konfiguracji grupy) wpuszcza i usuwa osoby, pisze
  streszczenia, dodaje zdjęcia z sali (np. tablicy), zadaje prace domowe, moderuje czat (usuwa wiadomości i pliki
  niezgodne z zasadami), widzi zajętość limitów plików.
- **Każda grupa ma własną kopię:** kod z tego repozytorium + **własne darmowe konto Supabase** (1 GB) — grupa do ~20 osób
  mieści się w darmowym planie (limit plików 40 MB na osobę). Nikt obcy nie trzyma danych grupy.
- **Konfiguracja grupy w pliku YAML** (nazwa, e-mail admina, dni i godziny zajęć, cykl, zasady). Admin zmienia ją
  w aplikacji albo lokalnie na komputerze z pomocą AI (edycja pliku) — szczegóły: [`docs/KONFIGURACJA.md`](docs/KONFIGURACJA.md).

## Co jest w aplikacji (stan: 09.10.2026 — demo + wersja grupy na Supabase)

| Ekran | Co robi |
|---|---|
| Start | Sama tapeta (motywy: wiśnia na śniegu, deszcz, świt) i nazwa grupy; ruch tła jak w Luna2 |
| Kalendarz | Cykl zajęć (np. 24 wtorki), kropki w dni zajęć; karta zajęć: **praca domowa → streszczenie + „Więcej” (zdjęcia tablicy) → materiały** |
| Prace | Prace domowe według terminu („za tydzień”, „za 3 tygodnie”), odhaczanie „zrobione” (prywatne) |
| Czat | Odpowiedzi z cytatem, reakcje emotkami, emotki, pliki (zdjęcia, wideo, PDF, DOC/DOCX, TXT…) do **20 MB/plik, 40 MB/osobę**; przypięte ogłoszenia prowadzącej |
| Media | Biblioteka: szukanie, kategorie (do zajęć, książki, poradniki, podcasty, filmy), data dodania, powiązanie z zajęciami albo „luźne” |
| Zasady | Zasady grupy, regulamin (za przesłane treści odpowiada ich autor), numery kryzysowe; zgoda przy pierwszym wejściu (wersjonowana) |
| Archiwum | „Powrót do przeszłości”: lektury z dawnych zajęć (tekst, okładka, galeria, nagranie MP3 z odtwarzaczem, PDF, filmy YouTube) |
| Admin | Wpuszczanie / odrzucanie / zaproszenia, zmiana i zatwierdzanie imion, limity plików, „Usuń całą grupę” (z potwierdzeniem nazwą) |
| Terminy (admin) | Seria spotkań (np. 24 wtorki), odwołanie dnia, przeniesienie (np. zastępczo w środę), dołożenie terminów, spotkanie dodatkowe |

Telefon: dolny pasek ekranów, przesuwanie palcem w bok, tekst ≥ 16 px, cele dotyku ≥ 44 px. Motyw jasny i ciemny.
Aktualizacja wymuszona: przy otwarciu aplikacja sama przechodzi na najnowszą wersję.

## Struktura repo

```
frontend/          aplikacja (React 19 + Vite + Tailwind 4 + PWA) — na bazie Luna2
  src/services/groupData.ts   JEDYNE źródło danych dla ekranów (demo albo Supabase — wybiera build)
  src/services/supabaseSource.ts  implementacja Supabase · src/components/AuthGate.tsx  logowanie i czekanie na akceptację
  src/demo/                   dane fikcyjne demo + zasady/regulamin (rules.ts)
  src/themes/                 motywy tapety (jeden plik = jeden motyw)
docs/              plan rozwoju, architektura, konfiguracja, bezpieczeństwo, model danych
.ai/               mapa projektu dla AI: decyzje (DECISIONS.md), bieżące zadanie, changelog
supabase/migrations/  schemat bazy grupy (0001…), wgrywany raz do własnego Supabase grupy
tools/import/      wgranie treści do Supabase grupy (treści NIGDY do repo — folder prywatne/ jest w .gitignore)
schemas/           kontrakty danych (robocze)
```

## Uruchomienie lokalnie

```
cd frontend
npm install
npm run dev        # http://localhost:3000
npx tsc --noEmit   # sprawdzenie typów
npm run build      # wersja do wydania (dist/ + version.json)
```

Wydanie: push na `main` → GitHub Actions (`.github/workflows/pages.yml`) → GitHub Pages.

## Ważne

- To repo jest publiczne: **wyłącznie kod i dane zmyślone**. Żadnych danych uczestników, treści grupy (lektury, PDF, nagrania), kluczy `service_role`/`sb_secret_`, haseł. Wszystko z grupy leży tylko w jej Supabase.
- Dane terapii to dane szczególnej kategorii (RODO art. 9). Regulamin i polityka prywatności w aplikacji to
  **wersja robocza do weryfikacji prawnej** przed prawdziwym startem.
- Aplikacja nie jest narzędziem pomocy w kryzysie — numery: 112 · 116 123 · 800 70 2222.

**Dla admina grupy (bez programowania):** [`docs/INSTRUKCJA-ADMINA.md`](docs/INSTRUKCJA-ADMINA.md) — konta, logowanie, Supabase, ustawienia, codzienna obsługa.

Dla programistów: [`docs/STRUKTURA.md`](docs/STRUKTURA.md) · wygląd: [`docs/WYGLAD.md`](docs/WYGLAD.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md) · test telefonu: `python frontend/tests/mobile_check.py --url <adres>`

Plan rozwoju: [`docs/PLAN-SKLADANIA.md`](docs/PLAN-SKLADANIA.md) · Decyzje: [`.ai/DECISIONS.md`](.ai/DECISIONS.md)
