// PATH: src/services/noteMigration.ts | REQ-ID: TERAPIA-CRYPTO-04
// Warunek zapisu przy migracji starej JAWNEJ notatki do szyfrogramu (D042, adwersarz runda 2 / R2-1).
// Warunek NIE może zawierać treści notatki: PostgREST wkłada filtry do adresu URL żądania PATCH — długa notatka
// (polskie znaki ×6 po zakodowaniu) dawała HTTP 400/414 i notatka nigdy się nie szyfrowała, a treść leciała w URL (logi).
// Zamiast treści: `updated_at` z migawki — zmiana notatki na innym urządzeniu zmienia `updated_at` (wyzwalacz touch, 0009),
// więc warunek dalej chroni przed nadpisaniem nowszej treści (O1).
// Plik bez importów — test jednostkowy (`npm test`) sprawdza, że zbudowane zapytanie nie niesie treści.

/** Bezpieczny rozmiar części zapytania w URL (zmierzone na bramce grupy: ~18 KB przechodzi, ~30 KB = 400, 72 KB = 414). */
export const URL_SAFE_MAX = 16_000;

export type Filter = [column: string, value: string];

/** Filtry (wszystkie „równa się”) warunkowej migracji: wiersz osoby i zajęć, niezmieniony od migawki. */
export function migrationFilter(meetingId: string, memberId: string, updatedAt: string): Filter[] {
  return [['meeting_id', meetingId], ['member_id', memberId], ['updated_at', updatedAt]];
}

/** Jak PostgREST zapisze te filtry w URL (`kolumna=eq.wartość`) — do kontroli rozmiaru i treści. */
export function filterQueryString(filters: Filter[]): string {
  return filters.map(([c, v]) => `${encodeURIComponent(c)}=eq.${encodeURIComponent(v)}`).join('&');
}

/** Polska odmiana do komunikatu „nie udało się zaszyfrować N notatek”. */
export const notatekGen = (n: number) => (n === 1 ? 'notatki' : 'notatek');
