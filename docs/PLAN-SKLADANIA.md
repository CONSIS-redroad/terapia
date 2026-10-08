# Plan rozwoju TERAPIA

Stan: **2026-10-08, wersja 0.9 — faza 0 (demo) gotowa.** Decyzje: `.ai/DECISIONS.md` (D001–D021).

## Założenia (ustalenia z Bartkiem, 07–08.10.2026)

1. **Jedna aplikacja = jedna grupa.** Każda grupa stawia własną kopię: kod z GitHuba + własne darmowe konto Supabase
   (1 GB). Grupa do ~20 osób × limit 40 MB/osobę = maks. 800 MB → mieści się w darmowym planie (D018).
2. **Admin = e-mail z konfiguracji grupy.** Zalogowanie tym adresem daje opcje admina (D019).
3. **Konfiguracja w pliku YAML** (`group.yml`): nazwa, admini, cykl zajęć (dni, godziny, liczba), zasady grupy.
   Edycja w aplikacji (panel admina) **albo lokalnie z AI** (edycja pliku) — oba wejścia, jedno źródło (D020).
4. **Mały konfigurator startowy** prowadzi przez: konto Supabase → klucze → wgranie schematu bazy → e-mail admina →
   pierwszy `group.yml` → wydanie (D021).
5. Telefon najpierw (D015), wymuszona aktualizacja (D016), kalendarz = oś, praca domowa ma termin = zajęcia (D017).
6. Prywatność: grupa widzi minimum = **imię**; reszta tylko za zgodą uczestnika; dzienniczek osobno (D002, D011).
7. Odpowiedzialność za treść: autor wiadomości/pliku (regulamin akceptowany przy wejściu, wersjonowany).

## FAZA 0 — Demo bez logowania ✅ (wersja 0.9)

Gotowe: start z tapetą (motywy z folderu), kalendarz cyklu z kartą zajęć (praca domowa → streszczenie + zdjęcia →
materiały), ekran Prace, czat jak WhatsApp (odpowiedzi, reakcje, emotki, pliki 20/40 MB, moderacja), Media,
Zasady + zgoda przy wejściu (imię obowiązkowe), panel admina (ludzie + limity), ustawienia jak w Luna2,
motyw jasny/ciemny, karuzela na telefonie, wymuszona aktualizacja. Dane: `frontend/src/demo/` (zmyślone).

## FAZA 1 — Konfiguracja grupy w YAML (następny krok)

1. Specyfikacja `group.yml` — `docs/KONFIGURACJA.md` (+ przykład `config/group.example.yml`).
2. Aplikacja czyta grupę, cykl zajęć, zasady z `group.yml` zamiast z danych demo (walidacja + czytelne błędy).
3. Generator cyklu: „wtorki 18:00–19:30, 24 zajęcia od 2026-09-01, przerwy: …” → lista zajęć.
4. Edytor w panelu admina (zasady, harmonogram, tematy) — zapis do tego samego modelu.
5. Instrukcja „konfiguracja z AI”: jak poprosić AI o zmianę `group.yml` lokalnie i wydać zmianę.

## FAZA 2 — Supabase grupy (dane prawdziwe)

1. Schemat bazy (SQL): członkostwa, zajęcia, streszczenia, prace domowe, wiadomości, reakcje, pliki, zgody.
2. **RLS:** nic dla niezaakceptowanych; admin = e-mail z konfiguracji; uczestnik usuwa tylko swoje.
3. Logowanie: Google + link na e-mail (Supabase Auth); ekran „czekasz na akceptację”.
4. Storage: pliki czatu i zdjęcia z sali; limity 20 MB/plik, 40 MB/osobę egzekwowane w bazie (nie tylko w UI).
5. Realtime czatu; podmiana `services/groupData.ts` (demo → Supabase) bez zmian ekranów.
6. Keepalive (darmowy Supabase usypia po tygodniu) i kopia zapasowa.
7. **Powiadomienia push** (Web Push + klucze VAPID + funkcja Supabase grupy): nowa wiadomość / odpowiedź do mnie /
   termin pracy domowej / nowe streszczenie / ogłoszenie. Ustawienia już są w aplikacji (zgoda, kategorie, wibracja,
   dźwięk, wyciszenie, godziny ciszy — `services/notifications.ts`); iPhone: działa po „Do ekranu początkowego”
   (iOS 16.4+) — ekran powitalny pokazuje, jak to zrobić. Licznik nieprzeczytanych na ikonie (Badging API).

## FAZA 3 — Konfigurator startowy

Kreator w aplikacji (przy pierwszym uruchomieniu bez konfiguracji): wklej URL i klucz publiczny Supabase →
sprawdzenie połączenia → wgranie schematu → e-mail admina → podstawowy `group.yml` → gotowe.
Instrukcja krok po kroku: fork repo, włączenie Pages, konto Supabase.

## Wygląd — konfiguracja bez grzebania w kodzie

Motywy tapety: `frontend/src/themes/` (plik = motyw). Emotki, reakcje, kolory awatarów, ikony i nazwy ekranów,
kategorie mediów: `frontend/src/config/ui.config.ts`. Kolory jasny/ciemny: zmienne `--t-*` w `index.css`.
Instrukcja: `docs/WYGLAD.md`. Docelowo część tych ustawień przechodzi do `group.yml` (sekcja `wyglad`).

## FAZA 4 — Dopracowanie

Powiadomienia (nowe zajęcia, termin pracy, wiadomość), obecność, eksport streszczeń, kolejne grupy jako osobne
kopie („utwórz grupę jak X”), opcjonalne udostępnienie wpisu z dzienniczka (tylko z woli uczestnika).

## Przed prawdziwym startem (poza kodem)

- Regulamin + polityka prywatności — weryfikacja prawna (dane zdrowotne, RODO art. 9).
- Kto jest administratorem danych (prowadząca / ośrodek) i umowa powierzenia z Supabase.

## Pomysły na później (Bartek 08.10)

- **Ekran czekania na akceptację = mała interaktywna gierka na tapecie** „na zabicie nudy” (np. łapanie płatków wiśni, układanie kamyków) — bez danych, działa przed wpuszczeniem. Motyw ekranów wejścia = ten sam katalog `src/themes/`.
