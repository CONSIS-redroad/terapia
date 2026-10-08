# Konfiguracja grupy — `group.yml` (projekt, faza 1)

Jeden plik opisuje grupę. Admin zmienia go **w aplikacji** (panel admina) albo **lokalnie z AI**
(„dodaj przerwę 24.12”, „przenieś zajęcia na środy 17:00”) — AI edytuje plik, push → wydanie.
Oba wejścia zapisują to samo; aplikacja waliduje plik i pokazuje czytelny błąd zamiast białej strony.

Co JEST w pliku: rzeczy stałe i jawne dla grupy (harmonogram, zasady, tematy).
Czego NIE MA w pliku: danych osób, wiadomości, plików, haseł, klucza `service_role` — to tylko Supabase grupy.
Klucz publiczny (`anon`) Supabase i adres projektu trafiają do zmiennych środowiska wydania, nie do pliku.

## Przykład

```yaml
wersja: 1
grupa:
  nazwa: Grupa wsparcia „Krok po kroku”
  opis: Cykl 24 zajęć o radzeniu sobie ze stresem i napięciem.
  admini:                 # e-maile — zalogowanie nimi daje opcje admina
    - prowadzaca@example.com
  limit_osob: 20
  limity_plikow: { na_plik_mb: 20, na_osobe_mb: 40 }

zajecia:
  dzien: wtorek
  od: "18:00"
  do: "19:30"
  start: 2026-09-01
  liczba: 24
  miejsce: Sala 2, ul. Przykładowa 1
  przerwy: [2026-12-22, 2026-12-29]   # te tygodnie są pomijane, cykl przesuwa się dalej
  tematy:                              # opcjonalnie — numer zajęć: temat
    1: Poznajmy się — zasady grupy
    2: Skąd się bierze napięcie?
    3: Oddech i ciało

zasady:                   # pokazywane w zakładce Zasady i przy pierwszym wejściu
  wersja: 2026-10-08      # zmiana wersji = uczestnicy akceptują ponownie
  punkty:
    - tytul: Poufność
      tresc: To, co mówimy w grupie, zostaje w grupie.
    - tytul: Mówimy o sobie
      tresc: „Ja czuję…”, bez oceniania innych.

wyglad:
  motyw_domyslny: sakura  # sakura | deszcz | swit
```

## Gdzie co jest edytowane

| Element | `group.yml` | Aplikacja (admin) | Supabase |
|---|---|---|---|
| Nazwa, admini, limity | ✅ | podgląd | — |
| Harmonogram, tematy, przerwy | ✅ | ✅ edycja | — |
| Zasady grupy | ✅ | ✅ edycja | zgody uczestników |
| Streszczenia, zdjęcia z sali | — | ✅ | ✅ |
| Prace domowe | — | ✅ | ✅ |
| Ludzie, czat, pliki | — | ✅ | ✅ |
