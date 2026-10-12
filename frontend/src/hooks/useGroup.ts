// PATH: src/hooks/useGroup.ts | REQ-ID: TERAPIA-HOOK-01
import { useCallback, useEffect, useState } from 'react';
import { groupData } from '../services/groupData';
import type { Announcement, Attachment, Group, Homework, Material, Meeting, MeetingNote, Member, MembershipStatus, Message, ProgramTopic } from '../types/group';

export interface GroupState {
  loading: boolean;
  group: Group | null;
  members: Member[];
  meetings: Meeting[];
  materials: Material[];
  announcements: Announcement[];
  messages: Message[];
  homework: Homework[];
  hwDone: Record<string, boolean>;
  /** Zajętość plików na osobę (Supabase; w demo liczona z wiadomości w App). */
  usage: Record<string, number> | null;
  /** Moje prywatne notatki do zajęć (klucz = id zajęć). */
  myNotes: Record<string, MeetingNote>;
  /** Odczyt notatek: ok · unavailable (baza bez 0009 — sekcja ukryta) · error (odczyt padł — edycja ZABLOKOWANA, żeby nie nadpisać starej). */
  notesStatus: 'ok' | 'unavailable' | 'error';
  /** Oficjalny program cyklu. */
  program: ProgramTopic[];
  /** Odczyt programu padł — admin nie może go edytować (zapis z pustej listy skasowałby tematy). */
  programError: boolean;
}

type NotesLoad = Pick<GroupState, 'myNotes' | 'notesStatus'>;
type ProgramLoad = Pick<GroupState, 'program' | 'programError'>;

const EMPTY: GroupState = {
  loading: true, group: null, members: [], meetings: [], materials: [], announcements: [], messages: [], homework: [], hwDone: {}, usage: null, myNotes: {}, notesStatus: 'ok', program: [], programError: false,
};

export function useGroup() {
  const [state, setState] = useState<GroupState>(EMPTY);

  const load = useCallback(async () => {
    const [group, members, meetings, materials, announcements, messages, homework, hwDone, usage, notes, prog] = await Promise.all([
      groupData.group(), groupData.members(), groupData.meetings(),
      groupData.materials(), groupData.announcements(), groupData.messages(),
      groupData.homework(), groupData.homeworkDone(),
      groupData.storageUsage ? groupData.storageUsage() : Promise.resolve(null),
      // błąd odczytu notatek ≠ „brak notatek”: osobny stan, ekran blokuje edycję
      groupData.myNotes().then(
        (r): NotesLoad => ({ myNotes: r ?? {}, notesStatus: r === null ? 'unavailable' : 'ok' }),
        (): NotesLoad => ({ myNotes: {}, notesStatus: 'error' })),
      groupData.program().then(
        (r): ProgramLoad => ({ program: r, programError: false }),
        (): ProgramLoad => ({ program: [], programError: true })),
    ]);
    setState({ loading: false, group, members, meetings, materials, announcements, messages, homework, hwDone, usage, ...notes, ...prog });
  }, []);

  useEffect(() => { void load(); }, [load]);
  // Supabase: czat na żywo (nowe wiadomości, reakcje, pliki innych osób)
  useEffect(() => groupData.subscribe?.(() => { void load(); }), [load]);

  const sendMessage = async (body: string, opts: { replyTo?: string; attachment?: Attachment } = {}) => {
    if (!body.trim() && !opts.attachment) return;
    try { await groupData.sendMessage(body, opts); }
    catch (e) { alert(`Nie wysłano: ${e instanceof Error ? e.message : String(e)}`); } // np. limit 40 MB pilnowany przez bazę
    await load();
  };
  const react = async (id: string, emoji: string) => { await groupData.react(id, emoji); await load(); };
  const deleteAttachment = async (id: string, by: 'admin' | 'author') => { await groupData.deleteAttachment(id, by); await load(); };
  const deleteMessage = async (id: string, by: 'admin' | 'author', reason?: string) => { await groupData.deleteMessage(id, by, reason); await load(); };

  const setMemberStatus = (id: string, status: MembershipStatus) => guard(() => groupData.setMemberStatus(id, status));

  const guard = async (f: () => Promise<void> | undefined) => {
    try { await f(); } catch (e) { alert(e instanceof Error ? e.message : String(e)); } // np. dwa takie same imiona
    await load();
  };
  const renameMember = (id: string, name: string) => guard(() => groupData.renameMember?.(id, name));
  const decideName = (id: string, accept: boolean) => guard(() => groupData.decideName?.(id, accept));

  const addMember = async (name: string, email: string) => {
    await groupData.addMember(name, email);
    await load();
  };

  const updateMeeting = async (id: string, patch: Partial<Meeting>) => { await groupData.updateMeeting(id, patch); await load(); };
  const addMeetings = async (list: Omit<Meeting, 'id'>[]) => { await groupData.addMeetings(list); await load(); };
  const deleteMeeting = async (id: string) => { await groupData.deleteMeeting(id); await load(); };
  // praca domowa: błąd NIE jest połykany — edytor pokazuje go i zostaje otwarty, wpisany tekst nie ginie (adwersarz 12.10)
  // błąd ODŚWIEŻENIA po udanym zapisie nie może udawać „Nie zapisano” (inaczej ponowne „Zapisz” robi dubel)
  const keep = async (f: () => Promise<void>) => {
    try { await f(); } catch (e) { void load().catch(() => { /* odświeżenie później */ }); throw e; }
    try { await load(); } catch { /* zapisane; dane odświeżą się przy następnym wczytaniu */ }
  };
  const addHomework = (h: Omit<Homework, 'id'>) => keep(() => groupData.addHomework(h));
  const updateHomework = (id: string, p: Partial<Homework>) => keep(() => groupData.updateHomework(id, p));
  const deleteHomework = (id: string) => guard(() => groupData.deleteHomework(id));
  const toggleHomeworkDone = async (id: string) => { await groupData.toggleHomeworkDone(id); await load(); };

  /** Moja notatka: zapis BEZ przeładowania całej grupy (pole tekstowe nie miga). Błąd leci do ekranu (stan zapisu). */
  const saveMyNote = async (meetingId: string, title: string, note: string) => {
    const saved = await groupData.saveMyNote(meetingId, title, note);
    setState(s => ({ ...s, myNotes: { ...s.myNotes, [meetingId]: saved } }));
  };
  /** Świadome usunięcie mojej notatki (przycisk z potwierdzeniem w karcie) — autozapis nigdy nie kasuje. */
  const deleteMyNote = async (meetingId: string) => {
    await groupData.deleteMyNote(meetingId);
    setState(s => { const myNotes = { ...s.myNotes }; delete myNotes[meetingId]; return { ...s, myNotes }; });
  };
  const saveProgram = (name: string, list: { id?: string; title: string; note?: string }[]) => guard(() => groupData.saveProgram(name, list));

  const resetDemo = async () => {
    groupData.resetDemo?.();
    await load();
  };

  return {
    ...state,
    isDemo: groupData.isDemo,
    currentUserId: groupData.currentUserId(),
    sendMessage, react, deleteAttachment, deleteMessage, setMemberStatus, renameMember, decideName, addMember, updateMeeting, addMeetings, deleteMeeting, addHomework, updateHomework, deleteHomework, toggleHomeworkDone, saveMyNote, deleteMyNote, saveProgram, resetDemo,
  };
}
