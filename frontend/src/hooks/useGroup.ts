// PATH: src/hooks/useGroup.ts | REQ-ID: TERAPIA-HOOK-01
import { useCallback, useEffect, useState } from 'react';
import { groupData } from '../services/groupData';
import type { Announcement, Attachment, Group, Homework, Material, Meeting, Member, MembershipStatus, Message } from '../types/group';

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
}

const EMPTY: GroupState = {
  loading: true, group: null, members: [], meetings: [], materials: [], announcements: [], messages: [], homework: [], hwDone: {}, usage: null,
};

export function useGroup() {
  const [state, setState] = useState<GroupState>(EMPTY);

  const load = useCallback(async () => {
    const [group, members, meetings, materials, announcements, messages, homework, hwDone, usage] = await Promise.all([
      groupData.group(), groupData.members(), groupData.meetings(),
      groupData.materials(), groupData.announcements(), groupData.messages(),
      groupData.homework(), groupData.homeworkDone(),
      groupData.storageUsage ? groupData.storageUsage() : Promise.resolve(null),
    ]);
    setState({ loading: false, group, members, meetings, materials, announcements, messages, homework, hwDone, usage });
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
  const addHomework = (h: Omit<Homework, 'id'>) => guard(() => groupData.addHomework(h));
  const updateHomework = (id: string, p: Partial<Homework>) => guard(() => groupData.updateHomework(id, p));
  const deleteHomework = (id: string) => guard(() => groupData.deleteHomework(id));
  const toggleHomeworkDone = async (id: string) => { await groupData.toggleHomeworkDone(id); await load(); };

  const resetDemo = async () => {
    groupData.resetDemo?.();
    await load();
  };

  return {
    ...state,
    isDemo: groupData.isDemo,
    currentUserId: groupData.currentUserId(),
    sendMessage, react, deleteAttachment, deleteMessage, setMemberStatus, renameMember, decideName, addMember, updateMeeting, addMeetings, deleteMeeting, addHomework, updateHomework, deleteHomework, toggleHomeworkDone, resetDemo,
  };
}
