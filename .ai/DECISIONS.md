# Decyzje
D001: Kalendarz jest osią systemu.
D002: Prywatny dzienniczek nie jest automatycznie dostępny terapeucie.
D003: Każdy główny moduł ma INDEX.md i module.yml.
D004: Google Drive jest adapterem magazynu.
D005 (2026-10-08): Backend = Supabase (plan darmowy, region UE), baza kodu = **Luna2** (`CONSIS-redroad/Luna2`: React 19 + Vite + Tailwind, PWA, i18n PL, panele/okna, kalendarz) z warstwą danych przepiętą na Supabase. Atomic CRM odrzucony 08.10 (za ciężki — react-admin, moduły firmowe); z doświadczenia Aliny bierzemy tylko wzorce RLS/keepalive/backup. Firebase, Hostido i gotowce Google (Classroom/Sites) odrzucone.
D006 (2026-10-08): Logowanie Google lub link na e-mail; KAŻDE dołączenie do grupy akceptuje admin (status `pending` → `approved`), do akceptu zero danych grupy (RLS).
D007 (2026-10-08): Pliki w Supabase Storage (1 GB free) tylko dla materiałów wrzucanych raz (PDF, karty pracy, obrazy) z limitem rozmiaru pliku. Wideo i audio (mp4/mp3) NIE na naszym serwerze — wyłącznie link do zewnętrznego źródła (YouTube, Vimeo, Dysk autora itd.).
D008 (2026-10-08): Najpierw FAZA 0 — publiczne demo bez logowania, wyłącznie fikcyjne dane, za wymienną warstwą danych (później Supabase).
D009 (2026-10-08): Panel zarządzania ludźmi (wpuszczanie, dodawanie, usuwanie) widzi WYŁĄCZNIE admin; w fazie 1 egzekwuje to baza (RLS), przełącznik widoku istnieje tylko w demo.
D010 (2026-10-08): Materiał zawsze należy do konkretnych zajęć cyklu; kalendarz jest główną drogą do materiałów (D001: kalendarz = oś).
D011 (2026-10-08): Profil uczestnika — pseudonim domyślnie; reszta (zdjęcie, imię, opis) widoczna dla grupy tylko po włączeniu przez uczestnika. Dwa motywy: jasny i ciemny.
D012 (2026-10-08): Najważniejsze są Kalendarz i Media. Medium ma kategorię (zajecia/ksiazka/poradnik/podcast/film/inne) i OPCJONALNE powiązanie z zajęciami — bez powiązania = „luźne”.
D013 (2026-10-08): Tapeta = motyw z folderu `frontend/src/themes/` (jeden plik na motyw + wpis w `index.ts`), wybór w Ustawieniach użytkownika; ruch tła jak w Luna2 (paralaksa + obracanie przeciąganiem), do wyłączenia; szanuje „ogranicz ruch” w systemie.
