// PATH: src/components/ReadingView.tsx | REQ-ID: TERAPIA-READING-01
// Ekran czytania wpisu archiwum (ETAP I): okładka, nagranie lektora, tekst (sekcje, wypunktowania, cytaty),
// galeria z powiększeniem, linki (YouTube z miniaturą), pliki (PDF w nowej karcie, inne rozszerzenia = pobierz).
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, File, FileArchive, FileAudio, FileImage, FileText, FileVideo, Link2, Play, X } from 'lucide-react';
import type { ArchiveFile, ArchiveImage, ArchiveItem } from '../services/archive';
import { youtubeId } from '../services/archive';
import { fmtSize } from '../services/files';
import { AudioPlayer } from './AudioPlayer';

export function fmtArchiveDate(d?: string): string {
  if (!d) return '';
  const dt = new Date(`${d.slice(0, 10)}T12:00:00`);
  if (isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt);
}

function FileIcon({ ext, className }: { ext: string; className?: string }) {
  if (ext === 'pdf' || ['doc', 'docx', 'odt', 'rtf', 'txt', 'epub'].includes(ext)) return <FileText className={className} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return <FileImage className={className} />;
  if (['mp3', 'm4a', 'wav', 'ogg'].includes(ext)) return <FileAudio className={className} />;
  if (['mp4', 'mov', 'webm'].includes(ext)) return <FileVideo className={className} />;
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive className={className} />;
  return <File className={className} />;
}

const EXT_LABEL: Record<string, string> = { pdf: 'PDF', epub: 'EPUB — czytnik e-booków', docx: 'Word', doc: 'Word', odt: 'dokument', txt: 'tekst' };

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

/** Podpisany adres Supabase z `download=` — przeglądarka zapisze plik pod jego nazwą (atrybut download nie działa między domenami). */
function downloadUrl(url: string, name: string): string {
  return url.includes('/storage/v1/object/sign/') ? `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(name)}` : url;
}

function FileRow({ f }: { f: ArchiveFile }) {
  const isPdf = f.ext === 'pdf';
  const missing = !f.url;
  const href = missing ? undefined : isPdf ? f.url : downloadUrl(f.url, f.name);
  return (
    <li>
      <a href={href} target={isPdf ? '_blank' : undefined} rel="noopener noreferrer"
        download={isPdf || missing ? undefined : f.name} aria-disabled={missing}
        className={`tap flex items-center gap-3 rounded-xl bg-surf border border-line px-3 py-2 min-w-0 ${missing ? 'opacity-60' : 'hover:bg-surf2'}`}>
        <span className="w-10 h-10 rounded-lg bg-surf2 flex items-center justify-center shrink-0 text-acc"><FileIcon ext={f.ext} className="w-5 h-5" /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-base text-fg break-words">{f.name}</span>
          <span className="block text-sm text-mut">
            {EXT_LABEL[f.ext] ?? (f.ext ? f.ext.toUpperCase() : 'plik')}{f.size ? ` · ${fmtSize(f.size)}` : ''}
            {missing ? ' · niedostępny' : isPdf ? ' · otwórz' : ' · pobierz'}
          </span>
        </span>
        {isPdf ? <ExternalLink className="w-5 h-5 text-mut shrink-0" /> : <Download className="w-5 h-5 text-mut shrink-0" />}
      </a>
    </li>
  );
}

function LinkRow({ url, title, comment }: { url: string; title: string; comment?: string }) {
  const yt = youtubeId(url);
  return (
    <li>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="tap flex items-center gap-3 rounded-xl bg-surf border border-line px-3 py-2 hover:bg-surf2 min-w-0">
        {yt
          ? <span className="relative w-28 max-w-[40%] aspect-video rounded-lg overflow-hidden bg-surf2 shrink-0">
              <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center"><Play className="w-7 h-7 text-acc drop-shadow" /></span>
            </span>
          : <span className="w-10 h-10 rounded-lg bg-surf2 flex items-center justify-center shrink-0 text-acc"><Link2 className="w-5 h-5" /></span>}
        <span className="flex-1 min-w-0">
          <span className="block text-base text-fg break-words">{title}</span>
          {comment && <span className="block text-sm text-mut break-words">{comment}</span>}
          <span className="block text-sm text-mut2 truncate">{yt ? 'YouTube · otworzy się w nowej karcie' : hostOf(url)}</span>
        </span>
        <ExternalLink className="w-5 h-5 text-mut shrink-0" />
      </a>
    </li>
  );
}

function Lightbox({ img, onClose }: { img: ArchiveImage; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Powiększony obraz" onClick={onClose}
      className="fixed inset-0 z-50 bg-bg/95 flex items-center justify-center p-4">
      <button type="button" onClick={onClose} aria-label="Zamknij"
        className="tap absolute top-3 right-3 min-w-11 h-11 inline-flex items-center justify-center rounded-full bg-panel border border-line text-fg cursor-pointer">
        <X className="w-6 h-6" />
      </button>
      <img src={img.url} alt={img.name} className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
    </div>
  );
}

const h2 = 'text-lg font-semibold text-fg';

export const ReadingView: React.FC<{ item: ArchiveItem; onBack?: () => void }> = ({ item, onBack }) => {
  const [zoom, setZoom] = useState<ArchiveImage | null>(null);
  const date = fmtArchiveDate(item.date);
  const images: ArchiveImage[] = [...(item.cover ? [{ url: item.cover, name: item.title }] : []), ...item.gallery];

  return (
    <article className="p-4 space-y-4 min-w-0 max-w-2xl mx-auto">
      {onBack && (
        <button type="button" onClick={onBack} className="tap inline-flex items-center gap-2 text-base text-acc cursor-pointer">
          <ArrowLeft className="w-5 h-5" />Powrót do listy
        </button>
      )}

      <header className="space-y-1 min-w-0">
        <h1 className="text-xl font-semibold text-fg leading-snug break-words">{item.title}</h1>
        {item.author && <p className="text-base text-fg2">{item.author}</p>}
        <p className="text-sm text-mut">{[date, item.note].filter(Boolean).join(' · ')}</p>
      </header>

      {item.cover && (
        <button type="button" onClick={() => setZoom(images[0])} className="block w-60 max-w-full rounded-xl overflow-hidden border border-line bg-surf cursor-zoom-in" aria-label="Powiększ obraz">
          <img src={item.cover} alt={item.title} className="w-full h-auto block" />
        </button>
      )}

      {item.audio && (
        <section className="space-y-2">
          <h2 className={h2}>Posłuchaj</h2>
          <AudioPlayer src={item.audio} storageKey={item.id} title={item.title} artist={item.author} artwork={item.cover} />
        </section>
      )}

      {item.lead && <p className="text-lg text-fg leading-relaxed break-words">{item.lead}</p>}

      {item.sections.map((s, i) => (
        <section key={i} className="space-y-2 min-w-0">
          {s.title && <h2 className={h2}>{s.title}</h2>}
          {s.paragraphs?.map((p, j) => <p key={j} className="text-base text-fg leading-relaxed break-words">{p}</p>)}
          {!!s.bullets?.length && (
            <ul className="list-disc pl-6 space-y-1">
              {s.bullets.map((b, j) => <li key={j} className="text-base text-fg leading-relaxed break-words">{b}</li>)}
            </ul>
          )}
          {s.quotes?.map((q, j) => (
            <blockquote key={j} className="border-l-4 border-sky-400/40 bg-surf rounded-r-lg pl-3 pr-2 py-2 text-base italic text-fg2 break-words">{q}</blockquote>
          ))}
          {s.after && <p className="text-base text-fg2 leading-relaxed break-words">{s.after}</p>}
        </section>
      ))}

      {item.gallery.length > 0 && (
        <section className="space-y-2">
          <h2 className={h2}>Obrazy</h2>
          <ul className="grid grid-cols-2 gap-2 min-w-0">
            {item.gallery.map((g, i) => (
              <li key={i} className="min-w-0">
                <button type="button" onClick={() => setZoom(g)} aria-label={`Powiększ: ${g.name}`}
                  className="block w-full aspect-square rounded-xl overflow-hidden border border-line bg-surf cursor-zoom-in">
                  <img src={g.url} alt={g.name} className="w-full h-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {item.links.length > 0 && (
        <section className="space-y-2">
          <h2 className={h2}>Linki</h2>
          <ul className="grid grid-cols-1 gap-2 min-w-0">{item.links.map((l, i) => <LinkRow key={i} {...l} />)}</ul>
        </section>
      )}

      {item.files.length > 0 && (
        <section className="space-y-2">
          <h2 className={h2}>Pliki</h2>
          <ul className="grid grid-cols-1 gap-2 min-w-0">{item.files.map((f, i) => <FileRow key={i} f={f} />)}</ul>
        </section>
      )}

      {zoom && <Lightbox img={zoom} onClose={() => setZoom(null)} />}
    </article>
  );
};
