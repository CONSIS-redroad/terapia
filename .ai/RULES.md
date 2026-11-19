# Reguły dla AI — TERAPIA (stan 19.11.2026)

Ogólne: nie wymyślaj faktów · zachowuj istniejącą funkcjonalność · szukaj istniejącej funkcji, zanim napiszesz drugą ·
decyzje do `.ai/DECISIONS.md` · testuj · aktualizuj `CURRENT-TASK.md` i `CHANGELOG.md`.
Twarde zasady niżej pochodzą od prowadzącego (cytaty w MEMO RedRoad: `domains/dev/reference_terapia_repo_consis_redroad_2026_10_07.md`,
`user_bartek/wymagania_aplikacje_web_styl_pracy.md`). Imion uczestników NIE wpisuj do repo — nawet tutaj.

## 1. Prywatność i dane
1. Repo jest publiczne: tylko kod i dane zmyślone. Treści grupy (imiona, notatki, zdjęcia, skany, PDF, transkrypcje) → baza/Storage grupy
   i `prywatne/` (gitignored). Klucz `service_role` nigdy w repo, froncie ani czacie; tokeny tylko z sejfu `rrv`, w pamięci.
2. Teksty z prawami autorskimi (np. artykuły, rozdziały książek) tylko do Archiwum grupy — nigdy do repo ani do Dzienniczka (D036).
3. Dzienniczek jest prywatny i osobny: członkostwo w grupie nie daje dostępu do niego (D002). Między aplikacjami wspólny jest
   tylko wygląd (`rr_ui_theme_v1`, `rr_ui_wallpaper_v1`) — nie logowanie. Czat RedRoad to osobny system (własne konta, baza, klucze).
4. Pliki z podglądu/testów z prawdziwą treścią usuwaj po teście.

## 2. Ludzie, konta, uprawnienia
5. Każde dołączenie akceptuje admin. Zaproszenie wpuszcza bez kolejki tylko przy logowaniu Google (D033) — nie ufaj samemu e-mailowi.
6. Imię w grupie zmienia admin; zmiana przez uczestnika to propozycja (`pending_name`). Imiona aktywnych osób są unikalne.
   Przy nowej funkcji szukaj bocznych dróg do tej samej zmiany.
7. Dwa stopnie admina (D037): kasowanie osób/zajęć/archiwum i konto właściciela — tylko właściciel.

## 3. Treści z zajęć (przepis: `CURRENT-TASK.md` § „Jak dodać treści z zajęć”)
8. Materiały wgrywaj sam i zgłoś po fakcie, co i gdzie (prowadzący 18.11: „rób jak uważasz, wrzucisz — spojrzę, najwyżej napiszę”).
   Pytaj tylko, gdy materiały sobie przeczą.
9. Temat zajęć = DOKŁADNIE tytuł z `program_topics` (inaczej Program cyklu nie pokaże daty). Zdjęcie tablicy = `meeting_photos`
   (miniatura w „Materiałach do tych zajęć”). Praca domowa: zadana na zajęciach rozdania, termin na następnych; podepnij PDF i lekturę.
10. Tekst pod lektora: bez WERSALIKÓW (czyta je jak skróty), rozdział = sekcja z tytułem (lektor mówi „Rozdział: …” wolniej, z pauzą),
    wyróżnienia jako `callout`. Lektor czyta `textContent`, nie `innerText`.
11. Źródło w czytniku: strona PLIKU ≠ numer z druku („s. 6” to nie 6. strona PDF-a, D041) — `tools/import/zrodla_lektury.py`.
    Każdy skan PDF materiału NAJPIERW przez OCR9 (`tools/import/ocr9_zrodla.py … --podmien`): obraca strony i daje warstwę tekstu — nie obracaj ręcznie (Bartek 19.11).
12. Nie pisz, że „nic nie wychodzi z urządzenia” — głosy „(online)” wysyłają tekst do dostawcy.

## 4. Wygląd i zachowanie (telefon najpierw)
13. Telefon jak aplikacja: bez przewijania w bok, tekst ≥ 16 px (rem), cele dotyku ≥ 44 px, najważniejsza informacja pierwsza
    (na telefonie: kalendarz nad kartą zajęć). Przy czytaniu/słuchaniu nic nie wisi nad tekstem.
14. „Tylko komputer” warunkuj `(hover: hover) and (pointer: fine)` lub `.rr-phone`, nigdy samą szerokością ekranu.
15. Jasny i ciemny tryb wszędzie; kolory tylko przez zmienne motywu; obrazy motywów lokalnie, bez hotlinków.
16. Nie przewijaj strony z kodu (karuzela na telefonie; prowadzący 19.11: „zepsułeś przewijanie”). Strona rusza się palcem.
17. Aktualizacja PWA wymuszona przy wejściu (bez „odśwież” i bez przycisku „Sprawdź aktualizacje”), ale ustawienia użytkownika
    zostają — zapisuj tylko jawny wybór, nowe pola dociągaj domyślną przy odczycie.

## 5. Zmiana kodu i wydanie
18. Przebieg: `CONTRIBUTING.md` (gałąź → tsc → build → test 390 px oba motywy → PR → Pages); commity po polsku, tryb rozkazujący.
    Gałęzie zakładaj w tym repo (`git -C C:/CONSIS-redroad/terapia …`), PR/merge przez GitHub API kontem `CONSIS-redroad`.
19. Na żywo (`/grupa/`) korzystają prawdziwi ludzie: zmiana kodu, o którą prowadzący prosi wprost, może iść po testach;
    zmiana z własnej inicjatywy czeka na „wrzucaj”. Większe zmiany (logowanie, RLS, dane) — adwersarz przed scaleniem.
    Po wydaniu sprawdź `…/terapia/grupa/version.json`, nie sam „success” builda. Dwa wydania pod rząd przeładują użytkownikowi stronę.
20. Migracje bazy: najpierw próba w transakcji z `raise exception` (rollback), potem na żywo; nowe kolumny zapasowe w `docs/ZAPAS_KOLUMN.md`.
21. Baza zasypia po ~7 dniach ciszy (free tier) — keepalive `tools/alina_supabase_keepalive.py` w workspace RedRoad (schtask 09:17).
