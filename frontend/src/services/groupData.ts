// PATH: src/services/groupData.ts | REQ-ID: TERAPIA-DATA-01
// JEDYNE miejsce, z którego ekrany biorą dane grupy.
// FAZA 0: źródło demo (dane fikcyjne + zmiany tylko w tej przeglądarce).
// FAZA 2: ten sam interfejs implementuje Supabase (services/supabaseSource.ts) — ekrany się nie zmieniają.
// Wybór źródła: zmienna budowania VITE_DATA_SOURCE=supabase (+ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY); brak = demo.
import type { Announcement, Attachment, Group, Homework, Material, Meeting, MeetingNote, Member, MembershipStatus, Message, ProgramTopic } from '../types/group';
import {
  DEMO_ANNOUNCEMENTS, DEMO_CURRENT_USER_ID, DEMO_GROUP, DEMO_HOMEWORK, DEMO_MATERIALS,
  DEMO_MEETINGS, DEMO_MEMBERS, DEMO_MESSAGES, DEMO_PROGRAM, DEMO_PROGRAM_NAME,
} from '../demo/demoData';
import { DATA_MODE } from './supabaseClient';
import { clipUnits, isEncrypted, type NoteKeyRecord } from './noteCrypto';
import { URL_SAFE_MAX, filterQueryString, migrationFilter } from './noteMigration';
import { vaultSetSource } from './noteVault';
import { SupabaseSource } from './supabaseSource';

export interface GroupDataSource {
  readonly isDemo: boolean;
  currentUserId(): string;
  group(): Promise<Group>;
  members(): Promise<Member[]>;
  setMemberStatus(memberId: string, status: MembershipStatus): Promise<void>;
  addMember(name: string, email: string): Promise<Member>;
  /** Admin: nadaj/zmień imię (np. rozróżnienie „Ania K.”). */
  renameMember?(memberId: string, name: string): Promise<void>;
  /** Admin: zatwierdź albo odrzuć imię zaproponowane przez uczestnika. */
  decideName?(memberId: string, accept: boolean): Promise<void>;
  meetings(): Promise<Meeting[]>;
  /** Admin: streszczenie, rozwinięcie, zdjęcia z sali. */
  updateMeeting(id: string, patch: Partial<Meeting>): Promise<void>;
  /** Admin (Harmonogram): dodaj spotkania (seria albo pojedyncze). */
  addMeetings(list: Omit<Meeting, 'id'>[]): Promise<void>;
  /** Admin: usuń spotkanie na stałe (zwykle lepiej „odwołaj”). */
  deleteMeeting(id: string): Promise<void>;
  homework(): Promise<Homework[]>;
  /** Admin: dodaj / zmień / usuń pracę domową. */
  addHomework(h: Omit<Homework, 'id'>): Promise<void>;
  updateHomework(id: string, patch: Partial<Homework>): Promise<void>;
  deleteHomework(id: string): Promise<void>;
  /** „Zrobione” — prywatne dla uczestnika. */
  homeworkDone(): Promise<Record<string, boolean>>;
  toggleHomeworkDone(id: string): Promise<void>;
  materials(): Promise<Material[]>;
  announcements(): Promise<Announcement[]>;
  messages(): Promise<Message[]>;
  sendMessage(body: string, opts?: { replyTo?: string; attachment?: Attachment }): Promise<Message>;
  react(messageId: string, emoji: string): Promise<void>;
  /** Autor (swój) albo admin (każdy) — sam plik; wiadomość zostaje. */
  deleteAttachment(messageId: string, by: 'admin' | 'author'): Promise<void>;
  /** Moderacja: admin usuwa wiadomość niezgodną z zasadami (zostaje ślad „usunięta”). */
  deleteMessage(messageId: string, by: 'admin' | 'author', reason?: string): Promise<void>;
  /** PRYWATNE notatki zalogowanego do zajęć (klucz = id zajęć). Admin też widzi tylko swoje.
   *  `null` = funkcji nie ma (baza bez migracji 0009). Inny błąd odczytu RZUCA — ekran blokuje edycję (nie nadpisze starej notatki). */
  myNotes(): Promise<Record<string, MeetingNote> | null>;
  /** Zapisz moją notatkę. NIGDY nie kasuje — pusty tytuł i pusta treść = błąd (usuwanie tylko przez deleteMyNote).
   *  `dekId` = id klucza, którym zaszyfrowano (D042); baza odrzuca szyfrogram nieaktualnym kluczem → Error('KEY_STALE…'). */
  saveMyNote(meetingId: string, title: string, note: string, dekId?: string | null): Promise<MeetingNote>;
  /** Migracja starej JAWNEJ notatki: zapis WARUNKOWY — tylko gdy wiersz ma wciąż `updated_at` z migawki (O1: inne urządzenie
   *  mogło ją zmigrować/zmienić). Warunek BEZ treści (R2-1: treść w URL = 400/414 i wyciek do logów). `null` = zmieniona, nic nie nadpisano. */
  migrateMyNote(meetingId: string, expectedUpdatedAt: string, sealed: { title: string; note: string }, dekId: string): Promise<MeetingNote | null>;
  /** Świadome usunięcie mojej notatki (przycisk „Usuń moją notatkę” z potwierdzeniem). */
  deleteMyNote(meetingId: string): Promise<void>;
  // ── Szyfrowanie notatek (D042, migracja 0016). Pola notatek mogą przychodzić/wychodzić jako szyfrogram „rr1:…” —
  //    źródło NIE przycina ich i nie zagląda w treść; szyfruje/odszyfrowuje wyłącznie przeglądarka (noteVault).
  /** Mój owinięty klucz notatek; null = PIN nieustawiony; 'unavailable' = baza bez 0016 (notatki jawne jak dotąd). */
  noteKey(): Promise<NoteKeyRecord | null | 'unavailable'>;
  /** Pierwsze ustawienie PIN-u. Już jest (inne urządzenie) → Error('KEY_EXISTS'). */
  createNoteKey(rec: NoteKeyRecord): Promise<void>;
  /** Zmiana PIN-u — tylko gdy w bazie wciąż jest `oldWrapped`; inaczej Error('KEY_CHANGED'). */
  replaceNoteKey(oldWrapped: string, rec: NoteKeyRecord): Promise<void>;
  /** „Nie pamiętam PIN-u”: usuń WSZYSTKIE moje notatki i mój klucz — jedną transakcją (funkcja note_keys_reset, 0016). */
  resetMyNotes(): Promise<void>;
  /** Oficjalny program cyklu (kolejność wg `position`). */
  program(): Promise<ProgramTopic[]>;
  /** Admin: zapisz cały program (nazwa + lista w tej kolejności; brak tematu na liście = usunięty). */
  saveProgram(name: string, list: { id?: string; title: string; note?: string }[]): Promise<void>;
  resetDemo?(): void;
  /** Supabase: zajętość plików na osobę (bajty) — panel limitów admina. */
  storageUsage?(): Promise<Record<string, number>>;
  /** Supabase: zmiany na żywo (czat). Zwraca funkcję wyłączającą. */
  subscribe?(onChange: () => void): () => void;
}

const LOCAL_KEY = 'terapia_demo_local_v1';
/** Pliki wysłane w tej karcie (adresy blob:) — żyją do odświeżenia strony. */
const liveBlobs = new Set<string>();

interface LocalState {
  extraMessages: Message[];
  memberStatus: Record<string, MembershipStatus>;
  addedMembers?: Member[];
  meetingPatch?: Record<string, Partial<Meeting>>;
  addedMeetings?: Meeting[];
  deletedMeetings?: string[];
  messagePatch?: Record<string, Partial<Message>>;
  hwDone?: Record<string, boolean>;
  addedHomework?: Homework[];
  hwPatch?: Record<string, Partial<Homework>>;
  deletedHomework?: string[];
  myNotes?: Record<string, MeetingNote>;
  /** Demo: owinięty klucz notatek (jak wiersz note_keys) — notatki w demo też są szyfrowane. */
  noteKey?: NoteKeyRecord;
  program?: ProgramTopic[];
  programName?: string;
}

/** Flagi WYŁĄCZNIE dla testów demo (localStorage); w wersji z bazą nieużywane. */
function testFlag(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}

function readLocal(): LocalState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as LocalState;
  } catch { /* prywatne okno / zablokowany storage — demo działa bez zapisu */ }
  return { extraMessages: [], memberStatus: {} };
}

function writeLocal(state: LocalState) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch { /* ignoruj */ }
}

class DemoSource implements GroupDataSource {
  readonly isDemo = true;
  currentUserId() { return DEMO_CURRENT_USER_ID; }
  async group() { return { ...DEMO_GROUP, programName: readLocal().programName ?? DEMO_PROGRAM_NAME }; }

  async members() {
    const { memberStatus } = readLocal();
    const { addedMembers = [] } = readLocal();
    return [...DEMO_MEMBERS, ...addedMembers].map(m => (memberStatus[m.id] ? { ...m, status: memberStatus[m.id] } : m));
  }

  async setMemberStatus(memberId: string, status: MembershipStatus) {
    const s = readLocal();
    s.memberStatus[memberId] = status;
    writeLocal(s);
  }

  async addMember(name: string, email: string) {
    const m: Member = { id: `local-m-${Date.now()}`, name: name.trim().slice(0, 40) || 'Nowa osoba', email: email.trim().slice(0, 120), role: 'participant', status: 'approved', joinedAt: new Date().toISOString(), emoji: '🙂', color: '#94a3b8' };
    const s = readLocal();
    s.addedMembers = [...(s.addedMembers ?? []), m];
    writeLocal(s);
    return m;
  }

  async meetings() {
    const patch = readLocal().meetingPatch ?? {};
    const { addedMeetings = [], deletedMeetings = [] } = readLocal();
    return [...DEMO_MEETINGS, ...addedMeetings].filter(m => !deletedMeetings.includes(m.id))
      .map(m => ({ ...m, ...(patch[m.id] ?? {}) })).sort((a, b) => a.date.localeCompare(b.date));
  }

  async addMeetings(list: Omit<Meeting, 'id'>[]) {
    const s = readLocal();
    s.addedMeetings = [...(s.addedMeetings ?? []), ...list.map((m, i) => ({ ...m, id: `local-mt-${Date.now()}-${i}` }))];
    writeLocal(s);
  }

  async deleteMeeting(id: string) {
    const s = readLocal();
    s.deletedMeetings = [...(s.deletedMeetings ?? []), id];
    writeLocal(s);
  }

  async updateMeeting(id: string, patch: Partial<Meeting>) {
    const s = readLocal();
    s.meetingPatch = { ...(s.meetingPatch ?? {}), [id]: { ...(s.meetingPatch?.[id] ?? {}), ...patch } };
    writeLocal(s);
  }

  async homework() {
    const { addedHomework = [], hwPatch = {}, deletedHomework = [] } = readLocal();
    return [...DEMO_HOMEWORK, ...addedHomework].filter(h => !deletedHomework.includes(h.id)).map(h => ({ ...h, ...(hwPatch[h.id] ?? {}) }));
  }
  async addHomework(h: Omit<Homework, 'id'>) {
    const s = readLocal(); s.addedHomework = [...(s.addedHomework ?? []), { ...h, id: `local-hw-${Date.now()}` }]; writeLocal(s);
  }
  async updateHomework(id: string, patch: Partial<Homework>) {
    const s = readLocal(); s.hwPatch = { ...(s.hwPatch ?? {}), [id]: { ...(s.hwPatch?.[id] ?? {}), ...patch } }; writeLocal(s);
  }
  async deleteHomework(id: string) {
    const s = readLocal(); s.deletedHomework = [...(s.deletedHomework ?? []), id]; writeLocal(s);
  }
  async homeworkDone() { return readLocal().hwDone ?? {}; }
  async toggleHomeworkDone(id: string) {
    const s = readLocal();
    s.hwDone = { ...(s.hwDone ?? {}), [id]: !(s.hwDone ?? {})[id] };
    writeLocal(s);
  }
  async materials() { return [...DEMO_MATERIALS].sort((a, b) => b.addedAt.localeCompare(a.addedAt)); }
  async announcements() {
    return [...DEMO_ANNOUNCEMENTS].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date));
  }

  async messages() {
    const { extraMessages, messagePatch = {} } = readLocal();
    return [...DEMO_MESSAGES, ...extraMessages]
      .map(m => ({ ...m, ...(messagePatch[m.id] ?? {}) }))
      // pliki z tej sesji żyją jako blob: — po odświeżeniu nie istnieją, więc pokazujemy je jako niedostępne
      .map(m => (m.attachment?.url.startsWith('blob:') && !liveBlobs.has(m.attachment.url) ? { ...m, attachment: { ...m.attachment, url: '#demo-wygasl' } } : m))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private patchMessage(id: string, patch: Partial<Message>) {
    const s = readLocal();
    s.messagePatch = { ...(s.messagePatch ?? {}), [id]: { ...(s.messagePatch?.[id] ?? {}), ...patch } };
    writeLocal(s);
  }

  async react(messageId: string, emoji: string) {
    const me = this.currentUserId();
    const msg = (await this.messages()).find(m => m.id === messageId);
    if (!msg) return;
    const r: Record<string, string[]> = Object.fromEntries(Object.entries(msg.reactions ?? {}).map(([k, v]) => [k, v.filter(x => x !== me)]));
    const had = (msg.reactions?.[emoji] ?? []).includes(me);
    if (!had) r[emoji] = [...(r[emoji] ?? []), me]; // jedna reakcja na osobę — jak w WhatsAppie
    this.patchMessage(messageId, { reactions: r });
  }

  async deleteAttachment(messageId: string, by: 'admin' | 'author') { this.patchMessage(messageId, { attachmentDeleted: by }); }

  async deleteMessage(messageId: string, by: 'admin' | 'author', reason?: string) {
    this.patchMessage(messageId, { deleted: { by, reason }, body: '', attachmentDeleted: by, reactions: {} });
  }

  async sendMessage(body: string, opts: { replyTo?: string; attachment?: Attachment } = {}) {
    if (opts.attachment?.url.startsWith('blob:')) liveBlobs.add(opts.attachment.url);
    const msg: Message = {
      id: `local-${Date.now()}`,
      authorId: this.currentUserId(),
      date: new Date().toISOString(),
      body: body.trim().slice(0, 2000),
      replyTo: opts.replyTo,
      attachment: opts.attachment,
    };
    const s = readLocal();
    s.extraMessages.push(msg);
    writeLocal(s);
    return msg;
  }

  async myNotes() {
    const fail = testFlag('terapia_test_notes_fail');
    if (fail) throw new Error(fail); // test: błąd odczytu (sieć / brak uprawnień) — ekran ma zablokować edycję
    return readLocal().myNotes ?? {};
  }
  async saveMyNote(meetingId: string, title: string, note: string, dekId?: string | null) {
    // test: sztuczne opóźnienie zapisu (wyścig autozapisu) — localStorage 'terapia_test_save_delay' = ms
    const delay = Number(testFlag('terapia_test_save_delay')) || 0;
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
    const failSave = testFlag('terapia_test_save_fail'); // test: zapis pada (sieć) — blokada ma pokazać trwały komunikat (O4)
    if (failSave) throw new Error(failSave);
    const t = clipTitle(title); const n = clipNote(note);
    if (!t && !n.trim()) throw new Error('Pusta notatka — nic nie zapisano (usuwanie tylko przyciskiem).');
    const s = readLocal();
    demoNoteGuard(s, t, n, dekId);
    const saved: MeetingNote = { meetingId, title: t, note: n, updatedAt: new Date().toISOString() };
    s.myNotes = { ...(s.myNotes ?? {}), [meetingId]: saved }; writeLocal(s);
    return saved;
  }
  async migrateMyNote(meetingId: string, expectedUpdatedAt: string, sealed: { title: string; note: string }, dekId: string) {
    const delay = Number(testFlag('terapia_test_save_delay')) || 0;
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
    const failSave = testFlag('terapia_test_save_fail');
    if (failSave) throw new Error(failSave);
    // demo udaje bramkę: ten sam warunek co w Supabase musi zmieścić się w URL (R2-1)
    if (filterQueryString(migrationFilter(meetingId, DEMO_CURRENT_USER_ID, expectedUpdatedAt)).length > URL_SAFE_MAX) throw new Error('HTTP 414 (za długi adres)');
    const s = readLocal();
    const cur = s.myNotes?.[meetingId];
    if (!cur || cur.updatedAt !== expectedUpdatedAt) return null; // zmieniona w międzyczasie — nie nadpisuj
    demoNoteGuard(s, sealed.title, sealed.note, dekId);
    const saved: MeetingNote = { meetingId, title: sealed.title, note: sealed.note, updatedAt: new Date().toISOString() };
    s.myNotes = { ...(s.myNotes ?? {}), [meetingId]: saved }; writeLocal(s);
    return saved;
  }
  async deleteMyNote(meetingId: string) {
    const s = readLocal();
    const notes = { ...(s.myNotes ?? {}) };
    delete notes[meetingId];
    s.myNotes = notes; writeLocal(s);
  }
  async noteKey() { return readLocal().noteKey ?? null; }
  async createNoteKey(rec: NoteKeyRecord) {
    const s = readLocal();
    if (s.noteKey) throw new Error('KEY_EXISTS');
    s.noteKey = rec; writeLocal(s);
  }
  async replaceNoteKey(oldWrapped: string, rec: NoteKeyRecord) {
    const s = readLocal();
    if (s.noteKey?.wrappedDek !== oldWrapped) throw new Error('KEY_CHANGED');
    s.noteKey = rec; writeLocal(s);
  }
  async resetMyNotes() {
    const s = readLocal();
    delete s.myNotes; delete s.noteKey; writeLocal(s); // jeden zapis = „jedna transakcja” jak note_keys_reset
  }
  async program() { return [...(readLocal().program ?? DEMO_PROGRAM)].sort((a, b) => a.position - b.position); }
  async saveProgram(name: string, list: { id?: string; title: string; note?: string }[]) {
    const s = readLocal();
    s.programName = name.trim().slice(0, 200);
    s.program = list.filter(x => x.title.trim()).map((x, i) => ({ id: x.id ?? `local-prog-${Date.now()}-${i}`, position: i + 1, title: x.title.trim().slice(0, 200), note: x.note?.trim() || undefined }));
    writeLocal(s);
  }

  resetDemo() {
    try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignoruj */ }
  }
}

/** Przycięcie jawnego pola notatki (limity jak w bazie 0009). Szyfrogram „rr1:…” przechodzi BEZ zmian —
 *  przycięcie albo trim zniszczyłyby go (limit dla szyfrogramu pilnuje baza, 0016). */
export const clipTitle = (t: string) => (isEncrypted(t) ? t : clipUnits(t.trim(), 200));
export const clipNote = (n: string) => (isEncrypted(n) ? n : clipUnits(n, 20000));

/** Demo udaje wyzwalacz bazy meeting_notes_require_enc (0016) — te same odmowy co na żywo. */
function demoNoteGuard(s: LocalState, title: string, note: string, dekId?: string | null) {
  const key = s.noteKey;
  const fields = [title, note].filter(x => x !== '');
  if (fields.some(x => isEncrypted(x)) && (!key || dekId !== key.dekId))
    throw new Error('KEY_STALE: Klucz notatek zmienił się na innym urządzeniu — odblokuj notatki ponownie.');
  if (key && fields.some(x => !isEncrypted(x)))
    throw new Error('Notatki są szyfrowane — odśwież aplikację (stara wersja próbowała zapisać jawnie).');
}

/** Jedno źródło danych całej aplikacji — demo albo Supabase grupy (decyduje build). */
export const groupData: GroupDataSource = DATA_MODE === 'supabase' ? new SupabaseSource() : new DemoSource();
vaultSetSource(groupData); // sejf notatek (D042) korzysta z tego samego źródła
/** Dostęp do implementacji Supabase (logowanie ustawia zalogowanego użytkownika). */
export const supabaseSource = groupData instanceof SupabaseSource ? groupData : null;
