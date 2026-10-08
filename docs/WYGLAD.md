# Wygląd aplikacji — motywy, kolory, emotki

Dla osoby, która konfiguruje grupę. Każda zmiana wyglądu to edycja jednego, wskazanego pliku.
Po zmianie: `npx tsc --noEmit` i `npm run build` w katalogu `frontend/`, potem wydanie (zob. [`CONTRIBUTING.md`](../CONTRIBUTING.md)).

Domyślny motyw grupy w fazie 1 ustawi `group.yml` (`wyglad.motyw_domyslny`, zob. [`KONFIGURACJA.md`](KONFIGURACJA.md)).
Do tego czasu domyślny motyw ustawia `DEFAULT_THEME_ID` w `frontend/src/themes/index.ts`.

## 1. Motyw tapety

Motyw tapety to tło za panelami: niebo, scena (rysunek SVG) i opcjonalne cząsteczki (płatki, deszcz, śnieg).
Uczestnik wybiera motyw w **Ustawienia → Wygląd**. Lista motywów pochodzi z folderu `frontend/src/themes/`.

**Jeden motyw = jeden plik + jedna linia w rejestrze.**

| Krok | Co zrobić |
|---|---|
| 1 | Skopiuj `frontend/src/themes/swit.tsx` (najprostszy) jako np. `las.tsx`. |
| 2 | Zmień `id`, `name`, `description`, kolory i scenę. |
| 3 | W `frontend/src/themes/index.ts` dodaj import i wpis do listy `THEMES`. |
| 4 | Sprawdź motyw w trybie jasnym i ciemnym, na telefonie i komputerze. |

```ts
// frontend/src/themes/index.ts
import { las } from './las';
export const THEMES: WallpaperTheme[] = [sakura, deszcz, swit, las];
export const DEFAULT_THEME_ID = 'sakura';   // zmień na 'las', jeśli ma być domyślny
```

### Pola motywu (`WallpaperTheme`, plik `themes/types.ts`)

| Pole | Typ | Znaczenie |
|---|---|---|
| `id` | tekst | Stały identyfikator, małe litery bez polskich znaków (np. `las`). Zapamiętywany w ustawieniach uczestnika — nie zmieniaj go po wydaniu. |
| `name` | tekst | Nazwa w Ustawieniach (np. „Las o poranku”). |
| `description` | tekst | Jedno zdanie pod nazwą. |
| `sky` | `{ light, dark }` | Tło nieba — kolor lub gradient CSS, osobno dla jasnego i ciemnego. |
| `Scene` | komponent | Rysunek SVG. Dostaje `dark: boolean`, żeby dobrać kolory. |
| `particles` | `'petals'` · `'rain'` · `'snow'` · `'none'` | Rodzaj cząsteczek. `none` = spokojne tło bez ruchu. |
| `particleColors` | `{ light: string[], dark: string[] }` | Kolory cząsteczek, losowane z listy. Przy `none` puste listy. |
| `preview` | tekst (CSS background) | Mały podgląd w oknie ustawień — zwykle ten sam gradient co `sky.light`. |

### Minimalny motyw

```tsx
// frontend/src/themes/las.tsx
import React from 'react';
import type { WallpaperTheme } from './types';

const Scene: React.FC<{ dark: boolean }> = ({ dark }) => (
  <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" className="w-full h-full" aria-hidden="true">
    <path d="M0 560 C 300 500, 700 540, 1200 500 L1200 800 L0 800 Z" fill={dark ? '#14281d' : '#a7c4a0'} />
  </svg>
);

export const las: WallpaperTheme = {
  id: 'las',
  name: 'Las o poranku',
  description: 'Zielone wzgórza, lekki śnieg.',
  sky: {
    light: 'linear-gradient(180deg, #e6f4ea 0%, #f8fafc 100%)',
    dark: 'linear-gradient(180deg, #0b1410 0%, #111827 100%)',
  },
  Scene,
  particles: 'snow',
  particleColors: { light: ['#ffffff'], dark: ['#cbd5e1'] },
  preview: 'linear-gradient(180deg, #e6f4ea 0%, #f8fafc 100%)',
};
```

### Zasady dla motywów

- **Tylko SVG i CSS w pliku.** Bez zdjęć i czcionek z obcych serwerów — tapeta działa offline i nie wymaga zgód.
- **Spokojnie.** To aplikacja grupy terapeutycznej: stonowane kolory, wolny ruch. Ruch da się wyłączyć w ustawieniach,
  a system „ogranicz ruch” wyłącza go automatycznie.
- **Czytelność ma pierwszeństwo.** Panele leżą na tapecie; uczestnik może dodać zasłonę tła (suwak w Ustawieniach).
  Sprawdź, czy tekst na ekranie startowym jest czytelny w obu trybach.

## 2. Kolory interfejsu — jasny i ciemny

Kolory paneli, tekstu i przycisków to zmienne `--t-*` w `frontend/src/index.css`:
blok `:root` = tryb jasny, blok `:root[data-theme="dark"]` = tryb ciemny. Zmiana wartości w jednym miejscu zmienia całą aplikację.

| Zmienna | Klasa w kodzie | Do czego |
|---|---|---|
| `--t-bg` | `bg-bg` | tło strony |
| `--t-head` | `bg-head` | nagłówek, okna, pływające paski |
| `--t-panel` | `bg-panel` | panele (półprzezroczyste) |
| `--t-surf`, `--t-surf2` | `bg-surf`, `bg-surf2` | karty w panelu; stan wskazania/wciśnięcia |
| `--t-line` | `border-line` | obramowania |
| `--t-fg`, `--t-fg2` | `text-fg`, `text-fg2` | tekst główny i drugorzędny |
| `--t-mut`, `--t-mut2` | `text-mut`, `text-mut2` | podpisy, daty, wskazówki |
| `--t-acc` | `text-acc` | akcent (linki, aktywny ekran) |
| `--t-ok`, `--t-warn`, `--t-bad` | `text-ok`, `text-warn`, `text-bad` | powodzenie, ostrzeżenie, błąd/usuwanie |
| `--t-glow1`, `--t-glow2` | — | delikatne poświaty tła |

Zasady:

- Zmieniaj **parę** — wartość jasną i ciemną tej samej zmiennej.
- Kontrast tekstu do tła: minimum 4,5 : 1 (`--t-fg`, `--t-fg2`, `--t-mut` wobec `--t-bg` i `--t-panel`). Sprawdź w DevTools lub dowolnym kalkulatorze kontrastu.
- Nie dodawaj kolorów na sztywno w komponentach — nowa potrzeba = nowa zmienna `--t-*` w obu blokach + wpis w `@theme`.
- Kolor paska systemowego telefonu i ekranu startowego PWA: `theme_color` / `background_color` w `frontend/vite.config.ts`.

## 3. Emotki, reakcje, kolory awatarów, ikony ekranów

**Jedno miejsce do zmiany wyglądu: `frontend/src/config/ui.config.ts`.**

Plik zbiera drobne elementy wyglądu, które dziś są rozproszone po komponentach. Zawiera między innymi:

| Co | Gdzie widać |
|---|---|
| listę emotek czatu | panel emotek przy polu wiadomości |
| szybkie reakcje | pasek reakcji po przytrzymaniu/wskazaniu wiadomości |
| emotki awatarów | wybór awatara w profilu uczestnika |
| kolory awatarów | kółko wokół emotki awatara |
| ikony i etykiety ekranów | dolny pasek na telefonie, nagłówki paneli |
| kategorie mediów | filtry w bibliotece Media |

Jak zmieniać:

- Edytuj listy w tym pliku; nie szukaj wartości w komponentach.
- Emotki wpisuj jako znaki (np. `'🌿'`). Używaj emotek obsługiwanych przez Androida i iOS — nowe emotki starsze telefony pokażą jako kwadrat.
- Kolory awatarów w zapisie `#rrggbb` — aplikacja sama robi z nich półprzezroczyste tło i obramowanie. Sprawdź je w obu trybach.
- Ikony ekranów pochodzą z biblioteki [lucide-react](https://lucide.dev/icons/) — podaje się nazwę komponentu ikony z tej biblioteki.
- Etykiety ekranów krótkie (jedno słowo) — dolny pasek na telefonie 320 px mieści ich tylko kilka.
- Zmiana kategorii mediów zmienia też dane: kategoria używana przez istniejące materiały nie może zniknąć.

Szczegółowe nazwy pól są opisane w komentarzach na początku `ui.config.ts`.

## 4. Lista kontrolna po zmianie wyglądu

- [ ] `npx tsc --noEmit` i `npm run build` bez błędów.
- [ ] Motyw jasny i ciemny — tekst czytelny, przyciski widoczne.
- [ ] Telefon 320 i 390 px — brak przewijania w bok, dolny pasek się mieści.
- [ ] Ustawienia → Wygląd — nowy motyw ma podgląd i nazwę.
- [ ] „Ogranicz ruch” w systemie — tło stoi.
