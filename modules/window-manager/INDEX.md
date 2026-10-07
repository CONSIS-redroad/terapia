# Window Manager

Niezależny silnik wielookienkowego interfejsu TERAPIA.

## Źródło designu

Warstwa wizualna została oparta na istniejącym repozytorium `CONSIS-redroad/Luna2`, przede wszystkim na:
- `src/components/PanelContainer.tsx`
- `src/components/CustomizePanelsModal.tsx`
- `src/components/SettingsModal.tsx`
- `src/hooks/usePanelLayout.ts`
- `src/types/panelLayout.ts`

Nie kopiujemy logiki domenowej Luna2. Do TERAPIA przeniesiony jest język wizualny i wzorce interakcji, a mechanizm okien jest niezależny.

## Funkcje

- wiele jednocześnie otwartych okien
- przeciąganie po pasku tytułu
- zmiana rozmiaru
- z-index / aktywacja okna
- minimalizacja
- maksymalizacja / przywrócenie
- zamykanie
- zapamiętywanie pozycji i rozmiaru w `localStorage`
- blokada ruchu i resize
- transparentność
- mobile: automatyczny tryb pełnoekranowy
- brak zależności od kalendarza, sesji czy konkretnego modułu

## API

Główny punkt wejścia: `window-manager.js`.

Przykład:

```js
const wm = new WindowManager({ storageKey: 'terapia.windows.v1' });
wm.open({ id: 'calendar', title: 'Kalendarz', width: 900, height: 650, content: '<div>...</div>' });
```

## Zasada architektoniczna

Moduły TERAPIA nie zarządzają `position`, `z-index`, dragiem ani resize. Przekazują tylko zawartość i konfigurację okna.
