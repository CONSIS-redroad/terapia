// PATH: src/components/ArchivePanel.tsx | REQ-ID: TERAPIA-ARCHIVE-02
// Zakładka „Powrót do przeszłości” (ETAP I, Bartek 08.10): archiwum starej TERAPII — lektury, materiały z zajęć,
// nagranie lektora. Lista kart (okładka, tytuł, data) → klik otwiera ReadingView. Dane: services/archive.ts.
import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, FileText, Headphones, History, Link2, RefreshCw } from 'lucide-react';
import { loadArchive, type ArchiveItem } from '../services/archive';
import { ReadingView, fmtArchiveDate } from './ReadingView';

const KIND_LABEL: Record<ArchiveItem['kind'], string> = {
  lektura: 'lektura', pdf: 'materiał z zajęć', obraz: 'obraz', audio: 'nagranie', wideo_link: 'film · link', link: 'link',
};

function KindIcon({ item }: { item: ArchiveItem }) {
  const c = 'w-6 h-6';
  if (item.kind === 'lektura') return <BookOpen className={c} />;
  if (item.kind === 'audio') return <Headphones className={c} />;
  if (item.kind === 'link' || item.kind === 'wideo_link') return <Link2 className={c} />;
  return <FileText className={c} />;
}

export const ArchivePanel: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setErr('');
    loadArchive().then(setItems).catch((e: unknown) => {
      setErr(e instanceof Error ? e.message : 'Nie udało się wczytać archiwum.');
      setItems(prev => prev ?? []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // podpisane adresy plików wygasają po ~1 h — przy powrocie do aplikacji po długiej przerwie odśwież
  useEffect(() => {
    let hidden = 0;
    const vis = () => {
      if (document.visibilityState === 'hidden') hidden = Date.now();
      else if (hidden && Date.now() - hidden > 45 * 60_000) load();
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [load]);

  const open = items?.find(i => i.id === openId);
  if (open) return <ReadingView item={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="p-4 space-y-3 min-w-0">
      <header className="flex items-start gap-3 min-w-0">
        <span className="w-11 h-11 rounded-xl bg-surf2 flex items-center justify-center shrink-0 text-acc"><History className="w-6 h-6" /></span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-fg">Powrót do przeszłości</h2>
          <p className="text-sm text-mut">Lektury i materiały z wcześniejszych spotkań — do przeczytania, posłuchania i pobrania.</p>
        </div>
        <button type="button" onClick={load} aria-label="Odśwież archiwum"
          className="tap min-w-11 h-11 inline-flex items-center justify-center rounded-full border border-line bg-surf text-fg2 hover:bg-surf2 cursor-pointer shrink-0">
          <RefreshCw className="w-5 h-5" />
        </button>
      </header>

      {err && <p className="text-sm text-bad" role="alert">{err}</p>}

      {items === null
        ? <p className="py-6 text-center text-base text-mut">Wczytuję archiwum…</p>
        : items.length === 0
          ? <p className="py-6 text-center text-base text-mut">Archiwum jest puste.{isAdmin ? ' Wgraj paczkę narzędziem tools/import/wgraj_archiwum.py.' : ''}</p>
          : (
            <ul className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 min-w-0">
              {items.map(it => (
                <li key={it.id} className="min-w-0">
                  <button type="button" onClick={() => setOpenId(it.id)}
                    className="tap w-full text-left flex items-center gap-3 rounded-xl bg-surf border border-line p-2.5 hover:bg-surf2 cursor-pointer min-w-0">
                    {it.cover
                      ? <img src={it.cover} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-line" />
                      : <span className="w-16 h-16 rounded-lg bg-surf2 flex items-center justify-center shrink-0 text-acc"><KindIcon item={it} /></span>}
                    <span className="flex-1 min-w-0">
                      <span className="block text-base font-semibold text-fg leading-snug break-words">{it.title}</span>
                      {it.author && <span className="block text-sm text-fg2 truncate">{it.author}</span>}
                      <span className="block text-sm text-mut">
                        {[fmtArchiveDate(it.date), KIND_LABEL[it.kind]].filter(Boolean).join(' · ')}
                        {it.audio ? ' · z nagraniem' : ''}
                      </span>
                    </span>
                    {it.audio && <Headphones className="w-5 h-5 text-acc shrink-0" aria-label="z nagraniem" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
    </div>
  );
};
