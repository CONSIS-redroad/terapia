// PATH: src/services/groupData.ts | REQ-ID: TERAPIA-DATA-01
// JEDYNE miejsce, z którego ekrany biorą dane grupy.
// FAZA 0: źródło demo (dane fikcyjne + zmiany tylko w tej przeglądarce).
// FAZA 1: ten sam interfejs zaimplementuje Supabase — ekrany się nie zmieniają.
import type { Announcement, Attachment, Group, Homework, Material, Meeting, Member, MembershipStatus, Message } from '../types/group';
import {
  DEMO_ANNOUNCEMENTS, DEMO_CURRENT_USER_ID, DEMO_GROUP, DEMO_HOMEWORK, DEMO_MATERIALS,
  DEMO_MEETINGS, DEMO_MEMBERS, DEMO_MESSAGES,
} from '../demo/demoData';

export interface GroupDataSource {
  readonly isDemo: boolean;
  currentUserId(): string;
  group(): Promise<Group>;
  members(): Promise<Member[]>;
  setMemberStatus(memberId: string, status: MembershipStatus): Promise<void>;
  addMember(name: string, email: string): Promise<Member>;
  meetings(): Promise<Meeting[]>;
  /** Admin: streszczenie, rozwinięcie, zdjęcia z sali. */
  updateMeeting(id: string, patch: Partial<Meeting>): Promise<void>;
  homework(): Promise<Homework[]>;
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
  resetDemo?(): void;
}

const LOCAL_KEY = 'terapia_demo_local_v1';
/** Pliki wysłane w tej karcie (adresy blob:) — żyją do odświeżenia strony. */
const liveBlobs = new Set<string>();

interface LocalState {
  extraMessages: Message[];
  memberStatus: Record<string, MembershipStatus>;
  addedMembers?: Member[];
  meetingPatch?: Record<string, Partial<Meeting>>;
  messagePatch?: Record<string, Partial<Message>>;
  hwDone?: Record<string, boolean>;
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
  async group() { return DEMO_GROUP; }

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
    return DEMO_MEETINGS.map(m => ({ ...m, ...(patch[m.id] ?? {}) })).sort((a, b) => a.date.localeCompare(b.date));
  }

  async updateMeeting(id: string, patch: Partial<Meeting>) {
    const s = readLocal();
    s.meetingPatch = { ...(s.meetingPatch ?? {}), [id]: { ...(s.meetingPatch?.[id] ?? {}), ...patch } };
    writeLocal(s);
  }

  async homework() { return DEMO_HOMEWORK; }
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

  resetDemo() {
    try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignoruj */ }
  }
}

export const groupData: GroupDataSource = new DemoSource();
