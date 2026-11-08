// PATH: src/components/HomeworkLinks.tsx | REQ-ID: TERAPIA-HOMEWORK-02
// Przyciski przy pracy domowej (Bartek 08.11): materiał wyjściowy (PDF z zajęć) i nasza wersja w czytniku z lektorem.
import React, { useState } from 'react';
import { FileText, Headphones } from 'lucide-react';
import type { Homework, Material } from '../types/group';
import { loadArchive, type ArchiveItem } from '../services/archive';
import { ReaderView } from './ReaderView';

export const HomeworkLinks: React.FC<{ h: Homework; materials: Material[] }> = ({ h, materials }) => {
  const [item, setItem] = useState<ArchiveItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mat = h.materialId ? materials.find(m => m.id === h.materialId && m.url) : undefined;
  if (!mat && !h.archiveId) return null;

  const openReader = async () => {
    setErr(''); setBusy(true);
    try {
      const it = (await loadArchive()).find(x => x.id === h.archiveId);
      if (it) setItem(it); else setErr('Nie znalazłem tego tekstu w archiwum.');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Nie udało się otworzyć tekstu.'); }
    setBusy(false);
  };

  const btn = 'tap inline-flex items-center gap-1.5 text-sm font-semibold px-3 rounded-full border cursor-pointer';
  return (
    <>
      <span className="mt-2 flex flex-wrap gap-1.5">
        {h.archiveId && (
          <button type="button" onClick={() => void openReader()} disabled={busy}
            className={`${btn} bg-sky-500/15 text-acc border-sky-400/30 hover:bg-sky-500/25 disabled:opacity-60`}>
            <Headphones className="w-4 h-4" />{busy ? 'Otwieram…' : 'Czytaj z lektorem'}
          </button>
        )}
        {mat && (
          <a href={mat.url} target="_blank" rel="noopener noreferrer" className={`${btn} bg-surf text-fg2 border-line hover:bg-surf2`}>
            <FileText className="w-4 h-4" />Oryginał (PDF)
          </a>
        )}
      </span>
      {err && <span className="block mt-1 text-sm text-bad" role="alert">{err}</span>}
      {item && <ReaderView item={item} onClose={() => setItem(null)} />}
    </>
  );
};
