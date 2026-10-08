// PATH: src/components/MediaLibrary.tsx | REQ-ID: TERAPIA-MEDIA-01
// Biblioteka mediów: szukanie, kategorie, data dodania, powiązanie z zajęciami (albo luźne).
import React, { useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Clapperboard, ExternalLink, FileText, Headphones, LifeBuoy, Link2, Search, Shapes, X } from 'lucide-react';
import type { Material, MediaCategory, Meeting } from '../types/group';
import { fmtShort } from '../services/format';

export const CATEGORIES: { id: MediaCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'zajecia', label: 'Do zajęć', icon: FileText },
  { id: 'ksiazka', label: 'Książki', icon: BookOpen },
  { id: 'poradnik', label: 'Poradniki', icon: LifeBuoy },
  { id: 'podcast', label: 'Podcasty', icon: Headphones },
  { id: 'film', label: 'Filmy', icon: Clapperboard },
  { id: 'inne', label: 'Inne', icon: Shapes },
];
const catOf = (id: MediaCategory) => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[5];

const FORMAT: Record<Material['kind'], string> = { pdf: 'PDF', image: 'obraz', video: 'film · link', audio: 'nagranie · link', link: 'link' };

type When = 'all' | '7' | '30' | 'from';
type Link = 'all' | 'loose' | string; // string = id zajęć

const sel = 'max-w-full min-w-0 truncate bg-surf border border-line rounded-full px-3 py-1.5 text-xs text-fg focus:outline-none focus:border-sky-400/40';

export const MediaLibrary: React.FC<{ items: Material[]; meetings: Meeting[]; onOpenMeeting: (id: string) => void }> = ({ items, meetings, onOpenMeeting }) => {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<MediaCategory | 'all'>('all');
  const [when, setWhen] = useState<When>('all');
  const [from, setFrom] = useState('');
  const [link, setLink] = useState<Link>('all');
  const [sort, setSort] = useState<'new' | 'old' | 'az'>('new');

  const meetingNo = (id?: string) => meetings.findIndex(m => m.id === id);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const now = Date.now();
    const minDate = when === '7' ? now - 7 * 864e5 : when === '30' ? now - 30 * 864e5 : when === 'from' && from ? new Date(from).getTime() : 0;
    const res = items.filter(m => {
      if (cat !== 'all' && m.category !== cat) return false;
      if (link === 'loose' && m.meetingId) return false;
      if (link !== 'all' && link !== 'loose' && m.meetingId !== link) return false;
      if (minDate && new Date(m.addedAt).getTime() < minDate) return false;
      if (needle) {
        const meet = meetings.find(s => s.id === m.meetingId);
        const hay = `${m.title} ${m.note ?? ''} ${m.author ?? ''} ${meet?.topic ?? ''} ${catOf(m.category).label}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    return res.sort((a, b) => sort === 'az' ? a.title.localeCompare(b.title, 'pl') : sort === 'old' ? a.addedAt.localeCompare(b.addedAt) : b.addedAt.localeCompare(a.addedAt));
  }, [items, meetings, q, cat, when, from, link, sort]);

  const count = (c: MediaCategory) => items.filter(m => m.category === c).length;
  const active = q || cat !== 'all' || when !== 'all' || link !== 'all';
  const clear = () => { setQ(''); setCat('all'); setWhen('all'); setFrom(''); setLink('all'); };

  return (
    <div className="p-4 space-y-3">
      {/* szukaj */}
      <label className="flex items-center gap-2 bg-surf border border-line rounded-full px-3 py-2 focus-within:border-sky-400/40">
        <Search className="w-4 h-4 text-mut shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Szukaj: tytuł, autor, temat zajęć…" aria-label="Szukaj w mediach"
          className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-mut2 focus:outline-none" />
        {q && <button onClick={() => setQ('')} className="text-mut hover:text-fg cursor-pointer" aria-label="Wyczyść szukanie"><X className="w-4 h-4" /></button>}
      </label>

      {/* kategorie */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kategorie">
        <button onClick={() => setCat('all')} aria-pressed={cat === 'all'}
          className={`text-xs px-3 py-1 rounded-full border cursor-pointer ${cat === 'all' ? 'bg-sky-500/20 text-acc border-sky-400/30' : 'bg-surf text-fg2 border-line hover:bg-surf2'}`}>Wszystkie · {items.length}</button>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}
            className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full border cursor-pointer ${cat === c.id ? 'bg-sky-500/20 text-acc border-sky-400/30' : 'bg-surf text-fg2 border-line hover:bg-surf2'}`}>
            <c.icon className="w-3.5 h-3.5" />{c.label} · {count(c.id)}
          </button>
        ))}
      </div>

      {/* filtry */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${sel} w-full sm:w-auto`} value={link} onChange={e => setLink(e.target.value)} aria-label="Powiązanie z zajęciami">
          <option value="all">Wszystkie zajęcia i luźne</option>
          <option value="loose">Tylko luźne (bez zajęć)</option>
          {meetings.map((m, i) => <option key={m.id} value={m.id}>Zajęcia {i + 1}: {m.topic}</option>)}
        </select>
        <select className={sel} value={when} onChange={e => setWhen(e.target.value as When)} aria-label="Data dodania">
          <option value="all">Dodane kiedykolwiek</option>
          <option value="7">Ostatnie 7 dni</option>
          <option value="30">Ostatnie 30 dni</option>
          <option value="from">Od wybranej daty…</option>
        </select>
        {when === 'from' && <input type="date" className={sel} value={from} onChange={e => setFrom(e.target.value)} aria-label="Dodane od" />}
        <select className={sel} value={sort} onChange={e => setSort(e.target.value as 'new' | 'old' | 'az')} aria-label="Sortowanie">
          <option value="new">Najnowsze</option>
          <option value="old">Najstarsze</option>
          <option value="az">A–Z</option>
        </select>
        {active && <button onClick={clear} className="text-xs text-mut hover:text-fg underline cursor-pointer">wyczyść filtry</button>}
        <span className="ml-auto text-[11px] text-mut2">{filtered.length} z {items.length}</span>
      </div>

      {/* wyniki */}
      {filtered.length === 0
        ? <p className="py-6 text-center text-sm text-mut2">Nic nie pasuje. Zmień filtry albo wyszukiwanie.</p>
        : (
          <ul className="grid gap-2 md:grid-cols-2">
            {filtered.map(m => {
              const c = catOf(m.category);
              const no = meetingNo(m.meetingId);
              const external = m.kind !== 'pdf' && m.kind !== 'image';
              return (
                <li key={m.id} className="rounded-xl bg-surf border border-line hover:bg-surf2 transition-colors">
                  <a href={m.url} target={external ? '_blank' : undefined} rel="noopener noreferrer"
                    onClick={e => { if (m.url.startsWith('#demo')) { e.preventDefault(); alert('Demo — w wersji docelowej tu otworzy się plik.'); } }}
                    className="flex items-start gap-3 px-3 pt-2.5 pb-1.5">
                    <span className="w-9 h-9 rounded-lg bg-surf2 flex items-center justify-center shrink-0 text-acc"><c.icon className="w-4 h-4" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-fg leading-snug">{m.title}</span>
                      {m.author && <span className="block text-xs text-fg2">{m.author}</span>}
                      <span className="block text-[11px] text-mut2">{c.label} · {FORMAT[m.kind]} · dodano {fmtShort(m.addedAt)}</span>
                      {m.note && <span className="block text-[11px] text-mut mt-0.5">{m.note}</span>}
                    </span>
                    {external ? <ExternalLink className="w-3.5 h-3.5 text-mut2 shrink-0 mt-1" /> : <Link2 className="w-3.5 h-3.5 text-mut2 shrink-0 mt-1" />}
                  </a>
                  <div className="px-3 pb-2.5 pl-[3.75rem]">
                    {no >= 0
                      ? <button onClick={() => onOpenMeeting(meetings[no].id)} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-sky-500/10 text-acc border border-sky-400/25 hover:bg-sky-500/20 cursor-pointer" title="Pokaż w kalendarzu">
                          <CalendarDays className="w-3 h-3" />Zajęcia {no + 1}: {meetings[no].topic}
                        </button>
                      : <span className="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-surf2 text-mut border border-line">luźne — bez zajęć</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      <p className="text-[11px] text-mut2">PDF i obrazy trzymamy u siebie; filmy, nagrania, podcasty i książki zawsze jako link do zewnętrznego źródła.</p>
    </div>
  );
};
