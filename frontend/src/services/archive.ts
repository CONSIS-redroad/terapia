// PATH: src/services/archive.ts | REQ-ID: TERAPIA-ARCHIVE-01
// Archiwum „Powrót do przeszłości” (ETAP I): treści starej TERAPII — lektury do czytania, PDF-y z zajęć, nagranie lektora.
// Prawdziwe treści żyją WYŁĄCZNIE w Supabase grupy (tabela archive_items z 0003_archiwum.sql + prywatny bucket group-files).
// Demo dostaje JEDNĄ zmyśloną lekturę z własnym tekstem — bez prawdziwych plików i bez nagrania.
import { DATA_MODE, FILES_BUCKET, supabase } from './supabaseClient';

export type ArchiveKind = 'lektura' | 'pdf' | 'obraz' | 'audio' | 'wideo_link' | 'link';

export interface ArchiveSection {
  title?: string;
  paragraphs?: string[];
  bullets?: string[];
  after?: string;
  quotes?: string[];
}

export interface ArchiveLink { url: string; title: string; comment?: string }

export interface ArchiveFile {
  name: string;
  /** podpisany adres (ważny ~1 h) albo '' gdy pliku brak */
  url: string;
  size: number;
  ext: string;
}

export interface ArchiveImage { url: string; name: string }

export interface ArchiveItem {
  id: string;
  kind: ArchiveKind;
  category: string;
  title: string;
  author?: string;
  note?: string;
  lead?: string;
  sections: ArchiveSection[];
  links: ArchiveLink[];
  cover?: string;
  audio?: string;
  gallery: ArchiveImage[];
  files: ArchiveFile[];
  /** data z dawnej TERAPII (RRRR-MM-DD) */
  date?: string;
  meetingId?: string;
}

const SIGNED_TTL = 60 * 60;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const strs = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string' && x.trim() !== '');

export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,6})$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

/** Identyfikator filmu YouTube z adresu (watch?v=, youtu.be/, shorts/, embed/) albo null. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(u.pathname);
      return m ? m[1] : null;
    }
  } catch { /* zły adres */ }
  return null;
}

function sections(body: unknown): ArchiveSection[] {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return arr<Record<string, unknown>>(b.sections).map(s => ({
    title: str(s.title) || undefined,
    paragraphs: strs(s.paragraphs),
    bullets: strs(s.bullets),
    after: str(s.after) || undefined,
    quotes: strs(s.quotes),
  }));
}

function links(v: unknown): ArchiveLink[] {
  return arr<Record<string, unknown>>(v)
    .filter(l => str(l.url).startsWith('https://'))
    .map(l => ({ url: str(l.url), title: str(l.title) || str(l.url), comment: str(l.comment) || undefined }));
}

// ───────────────────────── Supabase ─────────────────────────

async function signAll(paths: string[]): Promise<Record<string, string>> {
  if (!supabase || !paths.length) return {};
  const uniq = [...new Set(paths)];
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrls(uniq, SIGNED_TTL);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

async function loadFromSupabase(): Promise<ArchiveItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('archive_items')
    .select('id,kind,category,title,author,note,lead,body,links,cover_path,audio_path,gallery,files,source_date,meeting_id,sort')
    .order('sort', { ascending: true })
    .order('source_date', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  const paths: string[] = [];
  for (const r of rows) {
    if (str(r.cover_path)) paths.push(str(r.cover_path));
    if (str(r.audio_path)) paths.push(str(r.audio_path));
    paths.push(...strs(r.gallery));
    for (const f of arr<Record<string, unknown>>(r.files)) if (str(f.path)) paths.push(str(f.path));
  }
  const urls = await signAll(paths);
  const signed = (p: unknown) => (str(p) ? urls[str(p)] ?? '' : '');

  return rows.map(r => ({
    id: str(r.id),
    kind: (str(r.kind) || 'lektura') as ArchiveKind,
    category: str(r.category) || 'inne',
    title: str(r.title),
    author: str(r.author) || undefined,
    note: str(r.note) || undefined,
    lead: str(r.lead) || undefined,
    sections: sections(r.body),
    links: links(r.links),
    cover: signed(r.cover_path) || undefined,
    audio: signed(r.audio_path) || undefined,
    gallery: strs(r.gallery).map(p => ({ url: signed(p), name: p.split('/').pop() ?? '' })).filter(g => g.url),
    files: arr<Record<string, unknown>>(r.files).map(f => {
      const name = str(f.name) || str(f.path).split('/').pop() || 'plik';
      return { name, url: signed(f.path), size: typeof f.size === 'number' ? f.size : 0, ext: extOf(name) || extOf(str(f.path)) };
    }),
    date: str(r.source_date) || undefined,
    meetingId: str(r.meeting_id) || undefined,
  }));
}

// ───────────────────────── demo (zmyślone, bez plików) ─────────────────────────

const DEMO: ArchiveItem[] = [{
  id: 'demo-lektura-latarnia',
  kind: 'lektura',
  category: 'inne',
  title: 'Latarnik z Małej Wyspy',
  author: 'tekst przykładowy (demo)',
  note: 'Przykładowa lektura — w wersji grupy tu są materiały z dawnych zajęć.',
  lead: 'Na małej wyspie stała latarnia, a w niej mieszkał latarnik, który co wieczór zapalał światło — nie dla siebie, tylko dla tych, którzy płynęli po ciemku.',
  sections: [
    {
      title: 'Światło dla innych',
      paragraphs: [
        'Przez wiele lat latarnik wierzył, że jeśli przestanie choć na jedną noc, wszystkie statki rozbiją się o skały. Nie spał, nie jadł o stałych porach, nie odwiedzał brzegu.',
        'Pewnej zimy zachorował. Leżał i słuchał wiatru, pewien, że rano zobaczy wraki. Rano morze było spokojne, a statki — jak zawsze — znalazły drogę.',
      ],
    },
    {
      title: 'Co zauważył',
      paragraphs: ['Kiedy wyzdrowiał, zapisał na kartce kilka zdań i przypiął je nad schodami:'],
      bullets: [
        'Mogę pomagać, nie biorąc na siebie całego morza.',
        'Moje zmęczenie też jest ważne.',
        'Inni mają własne mapy i własne światła.',
      ],
      quotes: ['„Świecę dalej — ale już nie zamiast siebie.”'],
      after: 'To opowiadanie jest wymyślone na potrzeby wersji pokazowej aplikacji.',
    },
  ],
  links: [],
  gallery: [],
  files: [],
  date: '2026-02-15',
}];

/** Wpisy archiwum: Supabase grupy (podpisane adresy plików, ważne ~1 h) albo zmyślona lektura w demo. */
export async function loadArchive(): Promise<ArchiveItem[]> {
  if (DATA_MODE === 'demo' || !supabase) return DEMO;
  return loadFromSupabase();
}
