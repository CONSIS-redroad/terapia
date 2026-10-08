# Jak współtworzyć TERAPIA

Zasady pracy nad kodem dla ludzi i dla AI. Przeczytaj przed pierwszą zmianą.

Najpierw: [`README.md`](README.md) (co to jest), [`docs/STRUKTURA.md`](docs/STRUKTURA.md) (mapa kodu),
[`.ai/INDEX.md`](.ai/INDEX.md) i [`.ai/CURRENT-TASK.md`](.ai/CURRENT-TASK.md) (bieżące zadanie), [`.ai/DECISIONS.md`](.ai/DECISIONS.md) (ustalenia).

## 1. Przepływ pracy

```
gałąź → zmiana → npx tsc --noEmit → npm run build → test na telefonie (390 px, oba motywy) → PR / merge → GitHub Actions → GitHub Pages
```

| Krok | Polecenie / działanie | Uwagi |
|---|---|---|
| 1. Gałąź | `git switch -c <krotki-opis>` (np. `czat-reakcje`) | Na `main` nie pracujemy bezpośrednio — push na `main` od razu wydaje. |
| 2. Zmiana | jak najmniejsza, w miejscu wskazanym w `docs/STRUKTURA.md` | Nie przebudowuj całości dla małej zmiany. Szukaj istniejącej funkcji, zanim napiszesz drugą. |
| 3. Typy | `cd frontend && npx tsc --noEmit` | Zero błędów. |
| 4. Build | `npm run build` | Musi przejść; powstaje `dist/` z `version.json`. |
| 5. Test ręczny | `npm run dev` → DevTools, szerokość 390 px (też 320 px), motyw jasny i ciemny | Dotknij zmienionego miejsca palcem/myszą; sprawdź brak przewijania w bok. |
| 6. Wpisy | `.ai/CHANGELOG.md`; decyzja → `.ai/DECISIONS.md` | Zob. § 5. |
| 7. PR / merge | PR do `main` z opisem: co, dlaczego, jak sprawdzone | Mała zmiana jednej osoby może iść merge bez PR, ale po krokach 3–5. |
| 8. Wydanie | automatyczne: `.github/workflows/pages.yml` | Push na `main` w `frontend/**` → `npm ci` → `tsc --noEmit` → `build` → GitHub Pages. Użytkownicy dostaną nową wersję sami (wymuszona aktualizacja). |

Po wydaniu otwórz stronę na telefonie i sprawdź, czy wersja w Ustawieniach się zmieniła.

## 2. Konwencja commitów

- **Po polsku, w trybie rozkazującym**, opis skutku: `Dodaj reakcje do wiadomości`, `Popraw kontrast przycisku w trybie ciemnym`.
- Pierwsza linia do ~72 znaków, bez kropki. Szczegóły (dlaczego, jak sprawdzone) w treści po pustej linii.
- Jeden commit = jedna logiczna zmiana. Nie mieszaj refaktoru z nową funkcją.
- Odwołanie do decyzji, jeśli dotyczy: `(D016)`.

| Dobrze | Źle |
|---|---|
| `Dodaj kategorię „Ćwiczenia” w mediach` | `poprawki` |
| `Napraw przesunięcie daty przy zmianie czasu` | `fixed bug` |
| `Przenieś emotki czatu do ui.config.ts` | `Dodałem emotki i jeszcze parę rzeczy` |

## 3. Zakazy

| Zakaz | Dlaczego |
|---|---|
| **Żadnych danych prawdziwych osób w repo** — imion, e-maili, numerów, rozmów, zdjęć, plików z zajęć. | Repo jest publiczne. Dane terapii to dane szczególnej kategorii (RODO art. 9). W repo wyłącznie kod i dane zmyślone. |
| **Żadnych kluczy `service_role`, haseł, tokenów** — ani w kodzie, ani w `.env` w repo, ani w historii. | `service_role` omija RLS i daje pełny dostęp do bazy grupy. Do frontu trafia wyłącznie klucz publiczny (`anon`) przez zmienne środowiska wydania. |
| **Żadnych stałych `px` w tekście i odstępach.** | Skala telefonu rośnie przez `rem`; `px` łamie czytelność (D015). Wyjątki: grubość ramki, rozmiar awatara liczony w JS. |
| **Żadnych kolorów na sztywno w komponentach** (`zinc-*`, `white`, `#hex`). | Psują jeden z motywów. Używaj klas `bg-panel`, `bg-surf`, `text-fg`… (zob. `docs/WYGLAD.md`). |
| **Ekran nie sięga do `demo/` ani do bazy bezpośrednio.** | Dane tylko przez `useGroup` → `services/groupData.ts`; inaczej faza 2 wymaga przepisania ekranów. |
| **Bez zewnętrznych zasobów bez potrzeby** (czcionki, obrazy, skrypty z obcych domen). | Prywatność uczestników i działanie offline. |
| **Bez wyłączania kroku `tsc` w workflow** i bez `// @ts-ignore` bez komentarza „dlaczego”. | Typy to jedyna automatyczna bramka przed wydaniem. |

Jeśli przez pomyłkę wypchniesz sekret: uznaj go za ujawniony, **natychmiast go unieważnij** (nowy klucz w Supabase),
dopiero potem czyść historię.

## 4. Checklista przed wydaniem

- [ ] `npx tsc --noEmit` — zero błędów.
- [ ] `npm run build` — przechodzi.
- [ ] Telefon 390 px i 320 px: brak przewijania w bok, dolny pasek się mieści, przyciski ≥ 44 px (klasa `tap`).
- [ ] Motyw jasny i ciemny: tekst czytelny na każdym zmienionym ekranie.
- [ ] Komputer (≥ 1024 px): siatka paneli, zwijanie i ukrywanie działa.
- [ ] Brak danych prawdziwych osób i sekretów w diffie (`git diff main --stat`, przejrzyj nowe pliki).
- [ ] Zmiana zasad/regulaminu → podbity `RULES_VERSION` (`demo/rules.ts`).
- [ ] Zmiana kształtu danych w `localStorage` → nowy sufiks klucza (`_v2`…).
- [ ] Nowe pole danych → zaktualizowane `types/group.ts` i kontrakt w `schemas/`.
- [ ] Widoczna zmiana dla użytkownika → podbita wersja w `frontend/package.json`.
- [ ] Wpis w `.ai/CHANGELOG.md`; nowa decyzja w `.ai/DECISIONS.md`.

## 5. Gdzie zapisywać

| Co | Gdzie | Format |
|---|---|---|
| **Decyzja** (wybór, którego nie widać w kodzie: „wideo tylko jako link”, „admin = e-mail z konfiguracji”) | [`.ai/DECISIONS.md`](.ai/DECISIONS.md) | `DNNN (RRRR-MM-DD): treść.` — kolejny numer; decyzja zmieniająca starszą pisze, którą zastępuje. Szablon: `docs/DECISION-TEMPLATE.md`. |
| **Zmiana** (co weszło w wersji) | [`.ai/CHANGELOG.md`](.ai/CHANGELOG.md) | data, wersja, 1–3 linie: co i po co. |
| **Bieżące zadanie / przekazanie pracy** | `.ai/CURRENT-TASK.md`, szablon `docs/HANDOFF-TEMPLATE.md` | stan, co dalej, czego nie ruszać. |
| **Mapa kodu** | `docs/STRUKTURA.md` | aktualizuj przy nowym pliku lub zmianie przepływu danych. |
| **Wygląd** | `docs/WYGLAD.md` | aktualizuj przy nowym polu motywu lub zmiennej koloru. |

## 6. Pytania i zgłoszenia

Błąd lub pomysł → GitHub Issue: co się dzieje, na jakim urządzeniu i szerokości, w którym motywie, zrzut ekranu
**bez danych prawdziwych osób**. Sprawy bezpieczeństwa nie publicznie — opis w [`docs/SECURITY.md`](docs/SECURITY.md).
