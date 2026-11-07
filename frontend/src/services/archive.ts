// PATH: src/services/archive.ts | REQ-ID: TERAPIA-ARCHIVE-01
// Archiwum „Powrót do przeszłości” (ETAP I): treści starej TERAPII — lektury do czytania, PDF-y z zajęć, nagranie lektora.
// Prawdziwe treści żyją WYŁĄCZNIE w Supabase grupy (tabela archive_items z 0003_archiwum.sql + prywatny bucket group-files).
// Demo dostaje JEDNĄ zmyśloną lekturę z własnym tekstem — bez prawdziwych plików i bez nagrania.
import { DATA_MODE, FILES_BUCKET, supabase } from './supabaseClient';

export type ArchiveKind = 'lektura' | 'pdf' | 'obraz' | 'audio' | 'wideo_link' | 'link';

/** Blok tekstu czytnika (od 0.11, czytnik): kolejność jak w oryginale. Gdy sekcja ma `blocks`, stare pola są pomijane. */
export type ArchiveBlock =
  | { t: 'p'; text: string }
  | { t: 'quote'; text: string }      // ramka-cytat (wcięty, kursywa)
  | { t: 'callout'; text: string }    // wyróżnienie „z gazety” — krótkie zdanie z tekstu, duże
  | { t: 'ul'; items: string[] }
  | { t: 'img'; url: string; caption?: string };

export interface ArchiveSection {
  title?: string;
  paragraphs?: string[];
  bullets?: string[];
  after?: string;
  quotes?: string[];
  /** numer strony oryginału, od której zaczyna się sekcja (układ gazetowy dzieli na arkusze) */
  page?: string;
  blocks?: ArchiveBlock[];
}

/** Dane „okładki” materiału do czytania (wszystko opcjonalne). */
export interface ArchiveReadMeta {
  source?: string;     // np. „Remedium · grudzień 1993, s. 4–9”
  epigraph?: string;   // motto / cytat na otwarcie
  agenda?: string[];   // „w artykule”
  endnote?: string[];  // dopisek na końcu (skąd tekst, kto przygotował)
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
  read?: ArchiveReadMeta;
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
/** tylko obiekty (null, liczby, napisy w tablicy z bazy nie mogą wywrócić archiwum) */
const objs = (v: unknown): Record<string, unknown>[] => arr(v).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x));

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

type Sign = (path: unknown) => string;
const noSign: Sign = () => '';

/** Ścieżki obrazów osadzonych w tekście (do podpisania razem z resztą plików). */
function blockImagePaths(body: unknown): string[] {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return objs(b.sections).flatMap(s => objs(s.blocks)).filter(x => x.t === 'img' && str(x.path)).map(x => str(x.path));
}

function blocks(v: unknown, sign: Sign): ArchiveBlock[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: ArchiveBlock[] = [];
  for (const x of objs(v)) {
    const text = str(x.text).trim();
    if ((x.t === 'p' || x.t === 'quote' || x.t === 'callout') && text) out.push({ t: x.t, text });
    else if (x.t === 'ul') { const items = strs(x.items); if (items.length) out.push({ t: 'ul', items }); }
    else if (x.t === 'img') {
      // TYLKO obraz z magazynu grupy (path → podpisany adres Supabase). Adresów z danych nie przyjmujemy — obcy serwer
      // zobaczyłby IP uczestników (adwersarz 07.11: „/\\evil.example/…” przechodził przez filtr ścieżki).
      const url = str(x.path) ? sign(x.path) : '';
      if (url) out.push({ t: 'img', url, caption: str(x.caption) || undefined });
    }
  }
  return out.length ? out : undefined;   // pusta lista = jak brak (stare pola sekcji zostają widoczne)
}

function sections(body: unknown, sign: Sign = noSign): ArchiveSection[] {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return objs(b.sections).map(s => ({
    title: str(s.title) || undefined,
    paragraphs: strs(s.paragraphs),
    bullets: strs(s.bullets),
    after: str(s.after) || undefined,
    quotes: strs(s.quotes),
    page: str(s.page) || (typeof s.page === 'number' ? String(s.page) : undefined),
    blocks: blocks(s.blocks, sign),
  }));
}

function readMeta(body: unknown): ArchiveReadMeta | undefined {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const m: ArchiveReadMeta = { source: str(b.source) || undefined, epigraph: str(b.epigraph) || undefined, agenda: strs(b.agenda), endnote: strs(b.endnote) };
  return m.source || m.epigraph || m.agenda?.length || m.endnote?.length ? m : undefined;
}

/** Bloki sekcji w kolejności czytania — nowe `blocks` albo stare pola (akapity → lista → cytaty → dopisek). */
export function sectionBlocks(s: ArchiveSection): ArchiveBlock[] {
  if (s.blocks?.length) return s.blocks;
  return [
    ...(s.paragraphs ?? []).map(text => ({ t: 'p', text }) as ArchiveBlock),
    ...(s.bullets?.length ? [{ t: 'ul', items: s.bullets } as ArchiveBlock] : []),
    ...(s.quotes ?? []).map(text => ({ t: 'quote', text }) as ArchiveBlock),
    ...(s.after ? [{ t: 'p', text: s.after } as ArchiveBlock] : []),
  ];
}

/** Czy wpis ma tekst do czytania (czytnik). */
export function hasReadableText(it: ArchiveItem): boolean {
  return !!it.lead || it.sections.some(s => sectionBlocks(s).length > 0);
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
    paths.push(...blockImagePaths(r.body));
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
    sections: sections(r.body, signed),
    read: readMeta(r.body),
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
  read: {
    source: 'Opowiadanie przykładowe (demo)',
    epigraph: '„Świecę dalej — ale już nie zamiast siebie.”',
    agenda: ['Światło dla innych', 'Noc, w której nie zapalił', 'Co zauważył', 'Nowe zasady latarni'],
    endnote: ['To opowiadanie jest wymyślone na potrzeby wersji pokazowej aplikacji. W wersji grupy w tym miejscu są materiały z zajęć.'],
  },
  sections: [
    {
      title: 'Światło dla innych', page: '1',
      blocks: [
        { t: 'p', text: 'Przez wiele lat latarnik wierzył, że jeśli przestanie choć na jedną noc, wszystkie statki rozbiją się o skały. Nie spał, nie jadł o stałych porach, nie odwiedzał brzegu. Kiedy ktoś pytał, jak się czuje, odpowiadał, że to nieważne — ważne, żeby światło świeciło.' },
        { t: 'p', text: 'Znał każdą skałę i każdy prąd. Znał też na pamięć głosy rybaków, którzy wołali do niego z łodzi. Swojego głosu prawie nie słyszał, bo prawie nic o sobie nie mówił.' },
        { t: 'callout', text: 'Można świecić dla innych, nie gasnąc samemu' },
        { t: 'p', text: 'Wieczorami siadał przy oknie i liczył światła statków. Gdy któryś spóźniał się choć kwadrans, nie mógł usiedzieć w miejscu. Chodził po schodach w górę i w dół, jakby jego kroki mogły przyciągnąć łódź do brzegu.' },
      ],
    },
    {
      title: 'Noc, w której nie zapalił', page: '1',
      blocks: [
        { t: 'p', text: 'Pewnej zimy zachorował. Leżał i słuchał wiatru, pewien, że rano zobaczy wraki. Po raz pierwszy od lat nie wszedł na górę. Wstyd i lęk ściskały go mocniej niż gorączka.' },
        { t: 'quote', text: 'Myślałem, że jeśli mnie nie będzie, wszystko się zawali. A rano morze było spokojne.' },
        { t: 'p', text: 'Rano morze było spokojne, a statki — jak zawsze — znalazły drogę. Kapitanowie mieli mapy, kompasy i własne latarnie na dziobach. Niektórzy w ogóle nie zauważyli, że w nocy było ciemniej.' },
      ],
    },
    {
      title: 'Co zauważył', page: '2',
      blocks: [
        { t: 'img', url: `${import.meta.env.BASE_URL}themes/ksiezyc.webp`, caption: 'Noc nad wyspą (ilustracja przykładowa).' },
        { t: 'p', text: 'Kiedy wyzdrowiał, zapisał na kartce kilka zdań i przypiął je nad schodami:' },
        { t: 'ul', items: ['Mogę pomagać, nie biorąc na siebie całego morza.', 'Moje zmęczenie też jest ważne.', 'Inni mają własne mapy i własne światła.'] },
        { t: 'p', text: 'Zdziwił się, jak trudno było napisać drugie zdanie. Pisał je trzy razy, bo za każdym razem ręka chciała dopisać „ale”.' },
      ],
    },
    {
      title: 'Nowe zasady latarni', page: '2',
      blocks: [
        { t: 'p', text: 'Odtąd zapalał światło o zmierzchu i gasił o świcie — tak, jak każe regulamin latarni. W dzień spał, a w niedziele płynął łodzią na ląd, do ludzi. Zaczął mówić o sobie, najpierw niewiele, potem trochę więcej.' },
        { t: 'callout', text: 'Troska o siebie nie jest zdradą tych, o których się troszczymy' },
        { t: 'p', text: 'Latarnia świeciła tak samo jasno jak wcześniej. Różnica była jedna: latarnik też w niej mieszkał, a nie tylko pilnował światła.' },
      ],
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
