# Struktura kodu — `frontend/src`

Mapa dla programisty: co gdzie leży, którędy płyną dane, gdzie wprowadzić typową zmianę.
Stan: wersja 0.9, faza 0 (demo bez logowania, dane zmyślone). Plan faz: [`PLAN-SKLADANIA.md`](PLAN-SKLADANIA.md).

## 1. Drzewo katalogów

```
frontend/
├── index.html              strona startowa; mały skrypt ustawia data-theme przed renderem (bez mignięcia kolorem)
├── vite.config.ts          build: PWA, numer wersji i budowy, emisja version.json
├── package.json            zależności i skrypty (dev, build, preview, lint = tsc --noEmit)
├── public/                 ikony PWA (icon.svg, apple-touch-icon, pwa-192/512)
└── src/
    ├── main.tsx            punkt wejścia: montuje <App /> i ładuje index.css
    ├── App.tsx             powłoka: tapeta, nagłówek, ekran startowy, siatka paneli (komputer) albo karuzela (telefon), onboarding, ustawienia
    ├── index.css           Tailwind v4 + zmienne motywu --t-* (jasny/ciemny), klasy bazowe, klasa .tap
    ├── components/
    │   ├── Carousel.tsx        karuzela ekranów na telefonie/tablecie (CSS scroll-snap) + dolny pasek; używa App
    │   ├── PanelContainer.tsx  ramka panelu na komputerze: zwijanie, ukrywanie, przesuwanie, przeciąganie; używa App
    │   ├── panels.tsx          MeetingsPanel (kalendarz), MembersPanel (admin), MaterialRow, MaterialsPanel, AnnouncementsPanel; używa App i LessonCard
    │   ├── LessonCard.tsx      karta zajęć: praca domowa → streszczenie + „Więcej” + zdjęcia → materiały; edycja admina; dueLabel()
    │   ├── HomeworkPanel.tsx   ekran „Prace”: lista według terminu, odhaczanie „zrobione”; używa App
    │   ├── ChatPanel.tsx       czat: odpowiedzi, reakcje, emotki, załączniki, moderacja, przypięte ogłoszenia; używa App
    │   ├── MediaLibrary.tsx    biblioteka mediów: szukanie, kategorie (CATEGORIES), powiązanie z zajęciami; używa App
    │   ├── RulesPanel.tsx      ekran „Zasady”: zasady, regulamin, numery kryzysowe (CrisisBox); używa App i Onboarding
    │   ├── Onboarding.tsx      pierwsze wejście: imię → zasady + regulamin → akceptacja; validateFirstName(); używa App i ProfilePanel
    │   ├── ProfilePanel.tsx    profil uczestnika (widoczność dla grupy) + komponent Avatar; używa SettingsModal, App, ChatPanel, panels
    │   ├── SettingsModal.tsx   okno ustawień: profil, wygląd (motyw, tapeta), panele, dane; używa App
    │   ├── Wallpaper.tsx       tło: niebo + scena motywu + cząsteczki + ruch (paralaksa, obracanie); używa App
    │   └── PWAInstallButton.tsx przycisk „Zainstaluj” + instrukcja dla iOS/komputera; używa App
    ├── hooks/
    │   ├── useGroup.ts         stan grupy dla ekranów: ładuje wszystko z groupData, akcje (wyślij, reaguj, usuń, akceptuj…) i przeładowanie
    │   ├── useTheme.ts         tryb system/jasny/ciemny → atrybut data-theme na <html>
    │   ├── useWallpaper.ts     ustawienia tapety (motyw, cząsteczki, gęstość, ruch, zasłona) w localStorage; useIsDark()
    │   ├── usePanelLayout.ts   kolejność/zwinięcie/widoczność paneli w localStorage
    │   └── usePWAInstall.ts    obsługa beforeinstallprompt, wykrycie instalacji i iOS
    ├── services/
    │   ├── groupData.ts        JEDYNE źródło danych grupy: interfejs GroupDataSource + implementacja demo (DemoSource)
    │   ├── appUpdate.tsx       wymuszona aktualizacja: UpdateGuard, APP_VERSION, APP_BUILD
    │   ├── files.ts            załączniki: limity (MAX_FILE 20 MB, MAX_USER_TOTAL 40 MB), dozwolone typy, checkFile(), toAttachment()
    │   ├── format.ts           formatowanie dat po polsku (fmtDayLong, fmtShort, fmtTime, fmtRelative), isPast()
    │   └── profile.ts          profil w przeglądarce, publicView() (co widzi grupa), zmniejszanie zdjęcia, emotki i kolory awatarów
    ├── demo/
    │   ├── demoData.ts         dane fikcyjne: grupa, osoby, zajęcia, materiały, prace, ogłoszenia, wiadomości (daty względem „dziś”)
    │   └── rules.ts            zasady grupy, regulamin, numery kryzysowe, RULES_VERSION
    ├── themes/
    │   ├── types.ts            typ WallpaperTheme (kontrakt motywu tapety)
    │   ├── index.ts            rejestr THEMES, DEFAULT_THEME_ID, themeById()
    │   ├── sakura.tsx          motyw „Wiśnia na śniegu” (płatki)
    │   ├── deszcz.tsx          motyw „Deszcz” (krople)
    │   └── swit.tsx            motyw „Świt nad jeziorem” (bez cząsteczek)
    ├── types/
    │   ├── group.ts            kontrakty danych: Member, Group, Meeting, Homework, Material, Announcement, Message, Attachment
    │   └── panelLayout.ts      PanelId, PanelConfig, DEFAULT_PANELS (kolejność i domyślny stan paneli)
    └── config/
        └── ui.config.ts        (w przygotowaniu) jedno miejsce na emotki, reakcje, kolory awatarów, ikony ekranów — zob. WYGLAD.md
```

## 2. Przepływ danych

```
Ekran (components/*)
   │  dostaje dane i akcje przez propsy z App.tsx
   ▼
App.tsx  ── const g = useGroup()
   ▼
hooks/useGroup.ts         ładuje wszystko równolegle, po każdej akcji woła load() ponownie
   ▼
services/groupData.ts     interfejs GroupDataSource; export const groupData = new DemoSource()
   ├── FAZA 0: DemoSource → demo/demoData.ts + zmiany tylko w localStorage tej przeglądarki
   └── FAZA 2: SupabaseSource (ten sam interfejs) → Auth, Postgres + RLS, Storage, Realtime
```

Zasady:

- **Ekran nigdy nie importuje `demo/` ani klienta Supabase.** Dane tylko przez `useGroup` → `groupData`.
- **Podmiana źródła = jedna linia** na końcu `groupData.ts`. Ekrany się nie zmieniają.
- **Wyjątki (stan lokalny, nie dane grupy):** profil (`services/profile.ts`), zgoda na zasady, motyw, tapeta,
  układ paneli. Żyją w `localStorage` i nie trafiają do grupy.
- **Uprawnienia w UI to tylko wygoda.** W fazie 2 o dostępie decyduje baza (RLS). Przełącznik „widok admina” istnieje wyłącznie w demo.

Klucze `localStorage` (prefiks `terapia_`): `terapia_demo_local_v1` (zmiany demo), `terapia_consent_v1`,
`terapia_demo_view`, `terapia_wallpaper_v1`, `terapia_panels_config_v7`. Zmiana kształtu danych = nowy sufiks wersji.

## 3. Gdzie co zmienić

| Chcę… | Pliki | Uwagi |
|---|---|---|
| **dodać ekran** | `types/panelLayout.ts` (nowy `PanelId` + wpis w `DEFAULT_PANELS`) → nowy komponent w `components/` → `App.tsx` (`SHORT` z etykietą i ikoną, gałąź w `content()`) | Podbij klucz `terapia_panels_config_vN` w `usePanelLayout.ts`, inaczej zapisany stary układ ukryje nowy ekran. Po pojawieniu się `config/ui.config.ts` etykiety i ikony ekranów idą tam. |
| **zmienić dane demo** | `demo/demoData.ts` | Wyłącznie dane zmyślone. Daty licz względem „dziś” (`setDate`), nie na sztywno. |
| **zmienić zasady / regulamin** | `demo/rules.ts` | Podbij `RULES_VERSION` — uczestnicy zaakceptują ponownie. W fazie 1 źródłem będzie `group.yml`. |
| **dodać pole do zajęć** | `types/group.ts` (`Meeting`) → `demo/demoData.ts` (przykład) → wyświetlenie w `components/LessonCard.tsx` | Pole opcjonalne (`?`), żeby stare dane działały. Edycja admina: `updateMeeting(id, patch)` już przyjmuje `Partial<Meeting>`. Zgłoś zmianę w `schemas/` (kontrakt bazy fazy 2). |
| **dodać akcję na danych** | `services/groupData.ts` (metoda w interfejsie + `DemoSource`) → `hooks/useGroup.ts` (opakowanie z `load()`) → props ekranu | Metodę musi mieć też przyszłe źródło Supabase — pisz ją jako kontrakt, nie skrót pod demo. |
| **zmienić limity plików** | `services/files.ts` | W fazie 2 limit egzekwuje baza; UI tylko podpowiada. |
| **dodać motyw tapety / zmienić kolory** | `themes/`, `index.css` | Opis: [`WYGLAD.md`](WYGLAD.md). |
| **zmienić kategorie mediów** | `types/group.ts` (`MediaCategory`) + `components/MediaLibrary.tsx` (`CATEGORIES`) | Po pojawieniu się `config/ui.config.ts` lista kategorii idzie tam. |

## 4. Zasady jakości

| Zasada | Jak spełnić | Dlaczego |
|---|---|---|
| Kolory tylko z motywu | Klasy `bg-bg`, `bg-head`, `bg-panel`, `bg-surf`, `bg-surf2`, `border-line`, `text-fg`, `text-fg2`, `text-mut`, `text-mut2`, `text-acc`, `text-ok`, `text-warn`, `text-bad`. Bez nowych `zinc-*`, `white`, `#hex` w komponentach. | Jeden komponent musi wyglądać dobrze w motywie jasnym i ciemnym. |
| Rozmiary w `rem` | Klasy Tailwinda (`text-sm`, `p-4`). Bez `px` dla tekstu i odstępów. | Na telefonie skala rośnie o 12,5 % (`html { font-size: 112.5% }`) — `px` tego nie dziedziczy. |
| Tekst ≥ 16 px, etykiety ≥ 13,5 px | Treść minimum `text-base` na telefonie; `text-xs` tylko na etykiety. | D015 — czytelność dla wszystkich uczestników. |
| Cel dotyku ≥ 44 px | Klasa `tap` na przyciskach i linkach (działa < 1024 px), albo `min-w-10 h-10` / `h-11`. Pola formularzy mają 44 px z `index.css`. | Wytyczne dostępności; trafienie palcem. |
| Szerokość 320–430 px | Sprawdź w DevTools przy 320, 375, 390 i 430 px: brak przewijania w bok, nic nie wychodzi poza ekran. | `html, body { overflow-x: clip }` maskuje błędy — sprawdzaj wzrokowo. |
| Oba motywy | Każdy ekran obejrzyj w jasnym i ciemnym (Ustawienia → Wygląd). | Kontrast i czytelność tła tapety. |
| Typy | `npx tsc --noEmit` bez błędów. | Ten sam krok blokuje wydanie w GitHub Actions. |
| Build | `npm run build` przechodzi. | Sprawdza PWA, `version.json`, import plików. |
| Ruch | Animacje wyłączalne; szanuj `prefers-reduced-motion`. | Część uczestników źle znosi ruch tła. |
| `localStorage` | Każdy odczyt/zapis w `try/catch`. | Prywatne okno i zablokowany storage nie mogą psuć aplikacji. |

## 5. Wymuszona aktualizacja

Cel (D016): użytkownik nic nie klika i nie ma starej wersji.

1. **Build** (`vite.config.ts`) bierze `version` z `package.json` i nadaje numer budowy `APP_BUILD` = znacznik czasu UTC
   (np. `20261008T1512`). Oba trafiają do kodu (`__APP_VERSION__`, `__APP_BUILD__`) i do pliku `dist/version.json`.
   Numeru budowy nikt nie podbija ręcznie.
2. **Service Worker** (vite-plugin-pwa, `autoUpdate`, `skipWaiting`, `clientsClaim`) nie buforuje `version.json`.
3. **`UpdateGuard`** (`services/appUpdate.tsx`, montowany raz w `App`) pobiera `./version.json` z pominięciem pamięci
   podręcznej: przy starcie, przy powrocie do karty, po odzyskaniu sieci i co 15 minut.
4. Inny `build` na serwerze → komunikat „Wczytuję nową wersję…” i przeładowanie.
   Próba 1: aktualizacja Service Workera. Próba 2: wyrejestrowanie SW i wyczyszczenie pamięci podręcznej.
   Po dwóch nieudanych próbach strażnik się zatrzymuje (bez pętli przeładowań). Licznik prób: `sessionStorage`.
5. Offline → brak sprawdzenia, aplikacja działa na tym, co ma.

Wersję widać w Ustawieniach (`APP_VERSION`). Wersję `package.json` podbijaj przy zmianach widocznych dla użytkownika.
