# Instrukcja dla admina grupy — krok po kroku, bez znajomości programowania

> **Stan:** dziś (wersja 0.9) aplikacja działa jako **demo** — nic nie trzeba zakładać, wystarczy otworzyć
> https://consis-redroad.github.io/terapia/ . Kroki 2–6 (Supabase, logowanie) zaczną działać po **fazie 2**
> (prawdziwe dane). Instrukcja jest napisana już teraz, żeby było wiadomo, co Cię czeka.
> Nazwy przycisków na stronach GitHuba, Supabase i Google czasem się zmieniają — szukaj podobnie brzmiących.

**Ile to trwa:** ok. 45 minut, jednorazowo. **Czego potrzebujesz:** komputer, adres e-mail (najlepiej Gmail),
menedżer haseł albo zeszyt na hasła. **Koszt:** 0 zł (darmowe plany).

---

## Słowniczek (5 słów, które się przewiną)

| Słowo | Po ludzku |
|---|---|
| **GitHub** | strona, na której leży aplikacja (jej „pliki”) i która ją publikuje w internecie za darmo |
| **Supabase** | darmowy „sejf” grupy: konta uczestników, wiadomości, pliki. Każda grupa ma **swój** sejf |
| **Klucz publiczny (anon / publishable)** | adres do sejfu, który **może** być w aplikacji. Bezpieczny |
| **Klucz tajny (service_role / secret)** | klucz-wytrych do sejfu. **NIGDY nikomu, nigdzie nie wklejaj** |
| **group.yml** | jeden plik z ustawieniami grupy: nazwa, Twój e-mail admina, dni i godziny zajęć, zasady |

---

## KROK 1 — Własna kopia aplikacji na GitHubie

1. Wejdź na **github.com** → **Sign up** → załóż konto (e-mail, hasło, nazwa). Włącz logowanie dwuetapowe
   (Settings → Password and authentication → Two-factor) — to Twoje dane uczestników, warto.
2. Otwórz **github.com/CONSIS-redroad/terapia** → przycisk **Fork** (u góry po prawej) → **Create fork**.
   Masz teraz własną kopię: `github.com/<Twoja-nazwa>/terapia`.
3. W swojej kopii: **Settings** → **Pages** → w polu *Source* wybierz **GitHub Actions**.
4. Zakładka **Actions** → jeśli GitHub pyta, kliknij **I understand… enable workflows**.
5. Po 2–5 minutach strona grupy działa pod adresem: `https://<Twoja-nazwa>.github.io/terapia/`
   **Zapisz ten adres** — to link, który dostaną uczestnicy.

## KROK 2 — Sejf grupy w Supabase *(po fazie 2)*

1. Wejdź na **supabase.com** → **Start your project** → **Continue with GitHub** (zalogujesz się kontem z kroku 1).
2. **New project**:
   - *Name*: np. `terapia-krok-po-kroku`
   - *Database password*: kliknij **Generate**, **skopiuj i zapisz** w menedżerze haseł (nikomu nie podawaj)
   - *Region*: **Central EU (Frankfurt)** — dane zostają w Unii
   - *Plan*: **Free**
3. **Create new project** → poczekaj ok. 2 minuty, aż projekt się przygotuje.

## KROK 3 — Wgranie „szuflad” do sejfu *(po fazie 2)*

1. W Supabase po lewej: **SQL Editor** → **New query**.
2. W swojej kopii na GitHubie otwórz plik `supabase/migrations/0001_init.sql` → przycisk **Copy raw file**.
3. Wklej do okna SQL Editor → **Run**. Ma się pojawić „Success”. To robi się **raz**.
4. Wpisz siebie jako admina (zamień adres na swój, małymi literami) → **Run**:
   `insert into public.admins (email) values ('twoj.adres@gmail.com');`

## KROK 4 — Logowanie uczestników *(po fazie 2)*

**A. Logowanie linkiem na e-mail (działa od razu):**
1. Supabase → **Authentication** → **URL Configuration**.
2. *Site URL*: wklej adres strony grupy (np. `https://twoja-nazwa.github.io/terapia/grupa/`).
3. *Redirect URLs* → **Add URL** → ten sam adres. **Save**.
4. Uwaga: darmowa wysyłka maili ma mały limit na godzinę — przy pierwszym zapraszaniu wpuszczaj ludzi
   partiami albo poproś o pomoc w podpięciu własnej skrzynki do wysyłki.

**B. Przycisk „Zaloguj przez Google” (opcjonalnie, wygodniejsze):**
1. Wejdź na **console.cloud.google.com** → utwórz projekt (np. „Terapia”).
2. **APIs & Services** → **OAuth consent screen** → *External* → nazwa aplikacji, Twój e-mail → zapisz.
3. **Credentials** → **Create credentials** → **OAuth client ID** → *Web application*.
4. *Authorized redirect URIs* → **Add URI** → `https://<kod-projektu>.supabase.co/auth/v1/callback`
   (kod projektu widać w adresie Supabase i w Project Settings).
5. **Create** → skopiuj **Client ID** i **Client secret**.
6. Supabase → **Authentication** → **Providers** → **Google** → włącz, wklej oba → **Save**.

## KROK 5 — Połączenie aplikacji z sejfem *(po fazie 2)*

1. Supabase → **Project Settings** → **API** (albo *Data API*): skopiuj
   - **Project URL** (np. `https://abcd1234.supabase.co`)
   - **anon / publishable key** (długi ciąg znaków) — **NIE** `service_role` / `secret`!
2. GitHub → Twoja kopia → **Settings** → **Secrets and variables** → **Actions** → zakładka **Variables** →
   **New repository variable**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = klucz publiczny
3. Zakładka **Actions** → ostatnie zadanie → **Re-run all jobs**. Po kilku minutach strona łączy się z sejfem.

## KROK 6 — Ustawienia grupy (`group.yml`)

1. GitHub → Twoja kopia → folder `config` → plik `group.yml` (na start: skopiuj `group.example.yml`
   jako `group.yml` — przycisk **Add file → Create new file**, wklej treść).
2. Kliknij **ołówek** (Edit) i zmień:
   - `nazwa`, `opis`
   - `admini:` → **Twój e-mail** (ten, którym będziesz się logować). Może być kilka osób.
   - `zajecia:` dzień, godziny, data startu, liczba zajęć, miejsce, przerwy (np. święta)
   - `zasady:` — Twoje zasady grupy. **Jeśli zmieniasz zasady, zmień też `wersja`** — wtedy wszyscy zaakceptują je ponownie.
3. **Commit changes** → po 2–5 minutach strona ma nowe ustawienia (uczestnicy dostaną je sami przy otwarciu).

Możesz też poprosić AI (np. Claude) z otwartym plikiem: „przenieś zajęcia na środy 17:00, dodaj przerwę 24.12”
— AI poprawi plik, Ty sprawdzasz i zatwierdzasz (Commit).

## KROK 7 — Pierwsze wejście jako admin

1. Otwórz stronę grupy → **Zaloguj** → podaj **e-mail z `admini`** (albo „Zaloguj przez Google” tym kontem).
2. Wpisz imię, zaakceptuj zasady → widzisz dodatkową zakładkę **Admin**.
3. Na telefonie: przycisk **Zainstaluj** (iPhone: Udostępnij → „Do ekranu początkowego”) — wtedy działają powiadomienia.

## KROK 8 — Zaproszenie uczestników

1. Wyślij uczestnikom **link do strony** (SMS, mail, WhatsApp).
2. Każdy loguje się i trafia do **Admin → Czekają na wpuszczenie**.
3. Klikasz **Wpuść** (albo **Odrzuć**). Dopiero po wpuszczeniu osoba widzi grupę.
4. Poproś uczestników o zainstalowanie aplikacji i włączenie powiadomień (Ustawienia → Powiadomienia).

---

## Codzienna obsługa (5 minut po zajęciach)

| Co | Gdzie |
|---|---|
| Streszczenie zajęć dla nieobecnych | Kalendarz → dzień zajęć → **Edytuj** przy streszczeniu |
| Zdjęcie tablicy z sali | Kalendarz → zajęcia → **Więcej** → **Dodaj zdjęcie z sali** (otworzy aparat) |
| Praca domowa z terminem | Kalendarz → zajęcia → praca domowa (termin = konkretne następne zajęcia) |
| Ogłoszenie dla wszystkich | Czat → przypięte ogłoszenia |
| Obraźliwa wiadomość / niewłaściwy plik | Czat → stuknij wiadomość → **Usuń wiadomość (zasady)** / **Usuń plik** |
| Ktoś odchodzi z grupy | Admin → **Usuń** przy osobie (można przywrócić) |
| Miejsce na pliki | Admin → pasek „Pliki całej grupy” i limity osób (40 MB na osobę) |

## Gdy coś nie działa

| Problem | Co zrobić |
|---|---|
| Nie przychodzi mail z linkiem | Sprawdź SPAM; odczekaj (limit maili na godzinę); użyj logowania Google |
| „Projekt wstrzymany / paused” w Supabase | Darmowy sejf usypia po tygodniu bez ruchu → Supabase → projekt → **Restore** (dane zostają) |
| Strona się nie zmieniła po edycji `group.yml` | GitHub → **Actions** → czy ostatnie zadanie ma zielony znaczek; czerwony = błąd w pliku (literówka, wcięcia) |
| Ktoś nie widzi grupy | Admin → czy jest wpuszczony; czy loguje się tym samym e-mailem |
| Zgubione hasło do bazy | Supabase → Project Settings → Database → **Reset database password** |

## Bezpieczeństwo — 5 zasad

1. **Klucza tajnego (`service_role` / `secret`) i hasła bazy nie wklejasz nigdzie** — ani w GitHubie, ani w czacie, ani AI.
2. Repozytorium jest publiczne: **żadnych danych uczestników w plikach** (`group.yml` ma tylko nazwę, harmonogram, zasady, e-maile adminów).
3. Logowanie dwuetapowe na GitHubie, Supabase i Google.
4. Admin to tylko osoby prowadzące — nie dopisuj uczestników do `admini`.
5. Przed prawdziwym startem: regulamin i polityka prywatności do przejrzenia przez prawnika (dane zdrowotne).

W razie kłopotu: zrzut ekranu + opis „co klikałem” → do osoby, która pomaga z aplikacją.
