# Import treści grupy do Supabase

Treści grupy (lektury, nagrania, PDF-y z zajęć) **nie trafiają do tego repozytorium** — repo jest publiczne,
a materiały są cudze (prawa autorskie) i prywatne. Paczka importu powstaje lokalnie w folderze
**`prywatne/`**, który jest wykluczony z gita (`.gitignore`).

## Jak złożyć paczkę

```
python tools/import/stary_projekt.py --zrodlo "<folder starego projektu>" --zajecia "domowa luty=2026-02-17"
```

Wynik: `prywatne/supabase-import/`

```
manifest.json                      co importować (wiersze materials + treść lektur + mapa plików)
files/admin/lektury/<slug>/…       pliki lektur → bucket group-files, klucz = ścieżka od files/
files/admin/zajecia/<data>/…       PDF-y z zajęć
```

## manifest.json

| Pole | Co to |
|---|---|
| `lektury[].material` | kolumny `public.materials` (`title, kind, category, author, note, added_at`) + `meeting_date` do dopasowania `meeting_id` |
| `lektury[].tresc` | treść do czytania w aplikacji: `lead`, `sections[{title, paragraphs, bullets, after, quotes}]` |
| `lektury[].linki` | `[{url, title, comment}]` — YouTube dostaje miniaturę |
| `lektury[].obraz_glowny`, `galeria`, `nagranie`, `pliki` | pliki: `{path, zrodlo, bajty, sha256, za_duzy}` |
| `materialy_zajec[]` | PDF-y zajęć: `material` + `plik` |
| `suma_bajtow`, `plikow`, `za_duze` | kontrola przed wgraniem (limit 20 MB/plik, 1 GB projekt) |

## Zmiany schematu potrzebne przed importem (ETAP I)

1. `materials.kind` += `'lektura'`; nowa kolumna `body jsonb` (treść `tresc` + `linki`), `cover_path`, `audio_path`, `gallery text[]`.
2. **Nagranie lektora w Storage** (wyjątek od D007 „audio tylko linkiem”): krótkie MP3 lektury (do 20 MB) wgrywa admin.
3. EPUB/DOCX: dziś schemat zna tylko `pdf` — dodać rodzaj `file` (pobieranie) albo trzymać jako `pdf`.

## Wgranie (po zmianach schematu)

Pliki: Storage API kontem admina (zalogowany) — ścieżki `admin/…` liczą się do puli grupy, nie do 40 MB uczestnika.
Wiersze: `insert into materials …` z manifestu. Skrypt wgrywający dopisze faza 2 / ETAP I.
