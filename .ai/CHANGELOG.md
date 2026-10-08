# Changelog

## 2026-10-07 — Szkielet
- utworzono szkielet platformy, roadmapę, dokumentację AI, bezpieczeństwa, model danych i moduły.

## 2026-10-07 — Window Manager
- dodano niezależny moduł `modules/window-manager`
- design oparto na komponentach paneli i modali z `CONSIS-redroad/Luna2`
- dodano drag, resize, z-index, minimize, maximize, close
- dodano persystencję układu w localStorage
- dodano fallback mobile full-screen
- nie powiązano modułu z żadnym modułem domenowym TERAPIA

## 2026-10-08 — Plan i decyzje
- `docs/PLAN-SKLADANIA.md` (fazy 1–4), decyzje D005–D007 (Supabase + Atomic CRM, akceptacja admina, pliki/wideo).
- 2026-10-08: D005 poprawione — baza kodu Luna2 zamiast Atomic CRM.

## 2026-10-08 — Faza 0: demo
- `frontend/` = Luna2 przerobiona na panel grupy: Mój profil (pseudonim, awatar ikonka/zdjęcie, przełączniki „pokaż grupie”), Spotkania, Ogłoszenia, Rozmowa grupy, Materiały, Uczestnicy i akceptacja (podgląd prowadzącej).
- Dane fikcyjne za warstwą `services/groupData.ts`; usunięte Firebase/three/pogoda/księżyc.
- GitHub Pages przez Actions. Testy: tsc 0, build 0, headless (desktop + 390 px) bez błędów konsoli; poprawiony błąd dat przy zmianie czasu.
- 2026-10-08: tryb jasny i ciemny (zmienne motywu w `index.css`, przełącznik: jak w urządzeniu → jasny → ciemny).
- 2026-10-08: tryb admina (tylko admin widzi panel: wpuść / odrzuć / dodaj osobę / usuń / przywróć), w demo przełącznik „Uczestnik / Admin”.
- 2026-10-08: kalendarz zajęć — cykl (demo: 24 wtorki), kropki w dniach zajęć, klik = temat, miejsce, link i materiały TYCH zajęć; każdy materiał przypięty do zajęć (`meetingId`).
- 2026-10-08: telefon / tablet / komputer — układ 2 kolumny od 1024 px, przycisk „Zainstaluj” (PWA) z instrukcją dla iOS, Androida i komputera.
- 2026-10-08: tapety z folderu `src/themes/` (wiśnia na śniegu z opadającymi płatkami, deszcz, świt) z ruchem jak w Luna (paralaksa + obracanie przeciąganiem); ustawienia użytkownika w oknie z zakładkami jak w Luna (Profil, Wygląd, Panele, Dane), otwierane awatarem w nagłówku.
- 2026-10-08: Media — biblioteka: szukanie (tytuł/autor/temat zajęć), kategorie (do zajęć, książki, poradniki, podcasty, filmy, inne), data dodania (7/30 dni, od daty), powiązanie z zajęciami albo luźne, sortowanie; klik w zajęcia przenosi do kalendarza.
- 2026-10-08: telefon jak aplikacja — strona zawsze w szerokości ekranu (kalendarz rozpychał do 427 px), bez przybliżania przy wpisywaniu (16 px w polach), bez przybliżania podwójnym stuknięciem, miejsce na notch i pasek gestów; zmierzone 320/360/390/430 px: szerokość strony = szerokość ekranu.
- 2026-10-08: start jak w Luna (pierwszy ekran = sama tapeta z nazwą grupy, panele po przewinięciu), kalendarz = sedno, Media zwijane (klik w tytuł), telefon/tablet: karuzela ekranów przesuwanych palcem (Kalendarz, Media, Ogłoszenia, Rozmowa, Admin) z zakładkami, przycisk „Mój dzienniczek” (consis-redroad.github.io/dzienniczek) w nagłówku i na starcie.
- 2026-10-08: telefon — projekt informacji: skala +12,5 % (tekst 18 px, etykiety ≥ 13,5 px, zero stałych px), cele dotyku ≥ 44 px, dolny pasek ekranów (pojawia się przy treści), w Kalendarzu najpierw karta zajęć, w Mediach kategorie w jednym rzędzie + „Filtry”, duże tytuły ekranów, większe ikony nagłówka.
- 2026-10-08: wersja 0.9.0 — wymuszona aktualizacja (version.json + UpdateGuard: przy otwarciu/powrocie strona sama przeładowuje się na nową budowę, bez przycisków; test: stara budowa 13:23 → sama na 13:36).
- 2026-10-08: karta zajęć bez „Dołącz online”: Praca domowa → Streszczenie dla nieobecnych + „Więcej” (rozwinięcie, zdjęcia tablicy; admin: Edytuj, Dodaj zdjęcie z aparatu) → Materiały. Nowy ekran „Prace” (wg terminu, „za tydzień / za 3 tygodnie”, odhaczanie prywatne). Pasek: Kalendarz · Prace · Media · Tablica · Czat.
- 2026-10-08: czat jak WhatsApp (odpowiedzi z cytatem, reakcje, emotki, załączniki 20 MB/plik i 40 MB/osobę, autor/admin usuwa plik, admin usuwa wiadomość niezgodną z zasadami — zostaje ślad), ogłoszenia jako przypięte w czacie; zakładka Zasady (zasady grupy, regulamin, numery kryzysowe); ekran powitalny: imię obowiązkowe + zgoda (wersjonowana); admin widzi limity plików osób i grupy.
- 2026-10-08: dokumenty: README (opis repo), docs/PLAN-SKLADANIA.md (plan rozwoju faz 0–4), docs/ARCHITECTURE.md, docs/KONFIGURACJA.md + config/group.example.yml, decyzje D018–D021.
