// PATH: src/services/groupData.ts | REQ-ID: TERAPIA-DATA-01
// JEDYNE miejsce, z którego ekrany biorą dane grupy.
// FAZA 0: źródło demo (dane fikcyjne + zmiany tylko w tej przeglądarce).
// FAZA 1: ten sam interfejs zaimplementuje Supabase — ekrany się nie zmieniają.
import type { Announcement, Group, Material, Meeting, Member, MembershipStatus, Message } from '../types/group';
import {
  DEMO_ANNOUNCEMENTS, DEMO_CURRENT_USER_ID, DEMO_GROUP, DEMO_MATERIALS,
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
  materials(): Promise<Material[]>;
  announcements(): Promise<Announcement[]>;
  messages(): Promise<Message[]>;
  sendMessage(body: string): Promise<Message>;
  resetDemo?(): void;
}

const LOCAL_KEY = 'terapia_demo_local_v1';

interface LocalState {
  extraMessages: Message[];
  memberStatus: Record<string, MembershipStatus>;
  addedMembers?: Member[];
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

  async meetings() { return [...DEMO_MEETINGS].sort((a, b) => a.date.localeCompare(b.date)); }
  async materials() { return [...DEMO_MATERIALS].sort((a, b) => b.addedAt.localeCompare(a.addedAt)); }
  async announcements() {
    return [...DEMO_ANNOUNCEMENTS].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date));
  }

  async messages() {
    return [...DEMO_MESSAGES, ...readLocal().extraMessages].sort((a, b) => a.date.localeCompare(b.date));
  }

  async sendMessage(body: string) {
    const msg: Message = {
      id: `local-${Date.now()}`,
      authorId: this.currentUserId(),
      date: new Date().toISOString(),
      body: body.trim().slice(0, 2000),
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
