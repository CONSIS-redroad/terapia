# Zapasowe kolumny w bazie (zapas1 … zapas10)

Bartek 12.10.2026: „daj dodatkowe 10 kolumn na przyszłość, żeby co chwila nie bawić się w SQL; jak coś dojdzie,
skorzystasz, zanotujesz, a kiedyś tam zmiana nazw kolumn”.

Migracja `supabase/migrations/0009_notatki_program.sql` dodała po 10 kolumn `text` (nullable) do tabel
`meeting_notes`, `program_topics` i `meetings`. Prawa dostępu = prawa tabeli (RLS bez zmian).

**Zasady:**
1. Zanim użyjesz kolumny zapasowej — wpisz ją tutaj (do czego, od kiedy, który plik kodu ją czyta/pisze).
2. Typ to `text`: liczby/daty/JSON zapisuj jako tekst i parsuj w aplikacji (`supabaseSource.ts`).
3. Gdy przy którejś okazji i tak robisz migrację — zmień nazwę używanej kolumny na właściwą
   (`alter table … rename column zapasN to …`) i przenieś wiersz do sekcji „Przemianowane”.

| tabela.kolumna | do czego użyta | od kiedy |
|---|---|---|
| `meeting_notes.zapas1` | — wolna | — |
| `meeting_notes.zapas2` | — wolna | — |
| `meeting_notes.zapas3` | — wolna | — |
| `meeting_notes.zapas4` | — wolna | — |
| `meeting_notes.zapas5` | — wolna | — |
| `meeting_notes.zapas6` | — wolna | — |
| `meeting_notes.zapas7` | — wolna | — |
| `meeting_notes.zapas8` | — wolna | — |
| `meeting_notes.zapas9` | — wolna | — |
| `meeting_notes.zapas10` | — wolna | — |
| `program_topics.zapas1` | — wolna | — |
| `program_topics.zapas2` | — wolna | — |
| `program_topics.zapas3` | — wolna | — |
| `program_topics.zapas4` | — wolna | — |
| `program_topics.zapas5` | — wolna | — |
| `program_topics.zapas6` | — wolna | — |
| `program_topics.zapas7` | — wolna | — |
| `program_topics.zapas8` | — wolna | — |
| `program_topics.zapas9` | — wolna | — |
| `program_topics.zapas10` | — wolna | — |
| `meetings.zapas1` | — wolna | — |
| `meetings.zapas2` | — wolna | — |
| `meetings.zapas3` | — wolna | — |
| `meetings.zapas4` | — wolna | — |
| `meetings.zapas5` | — wolna | — |
| `meetings.zapas6` | — wolna | — |
| `meetings.zapas7` | — wolna | — |
| `meetings.zapas8` | — wolna | — |
| `meetings.zapas9` | — wolna | — |
| `meetings.zapas10` | — wolna | — |

## Przemianowane

| było | jest | migracja |
|---|---|---|
| — | — | — |
