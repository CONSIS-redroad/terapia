// PATH: src/services/readingSync.ts | REQ-ID: TERAPIA-CZYTNIK-KONTO
// Miejsce czytania przy koncie (migracja 0015, Bartek 08.11): ten sam procent na telefonie i komputerze.
// Tylko wersja grupy i prawdziwe pozycje Archiwum (uuid); błędy ciche — czytnik działa dalej z pamięcią urządzenia.
import { DATA_MODE, supabase } from './supabaseClient';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const on = (id: string) => DATA_MODE === 'supabase' && !!supabase && UUID.test(id);

/** Miejsce z konta: { p: 0–1, at: ms } albo null (brak, demo, błąd). */
export async function pullReading(id: string): Promise<{ p: number; at: number } | null> {
  if (!on(id)) return null;
  try {
    const r = await supabase!.from('reading_positions').select('p, updated_at').eq('item_id', id).maybeSingle();
    if (r.error || !r.data) return null;
    const p = Number(r.data.p), at = Date.parse(r.data.updated_at as string);
    return Number.isFinite(p) && Number.isFinite(at) ? { p: Math.min(1, Math.max(0, p)), at } : null;
  } catch { return null; }
}

let chain: Promise<void> = Promise.resolve();
/** Zapis na konto — kolejno (starszy zapis nie nadpisze nowszego). */
export function pushReading(id: string, p: number): void {
  if (!on(id)) return;
  chain = chain.then(async () => {
    try {
      await supabase!.from('reading_positions')
        .upsert({ item_id: id, p: Math.round(p * 1000) / 1000, updated_at: new Date().toISOString() }, { onConflict: 'member_id,item_id' });
    } catch { /* bez sieci — zostaje kopia na urządzeniu */ }
  });
}
