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
}

const EMPTY: GroupState = {
  loading: true, group: null, members: [], meetings: [], materials: [], announcements: [], messages: [], homework: [], hwDone: {},
};

export function useGroup() {
  const [state, setState] = useState<GroupState>(EMPTY);

  const load = useCallback(async () => {
    const [group, members, meetings, materials, announcements, messages, homework, hwDone] = await Promise.all([
      groupData.group(), groupData.members(), groupData.meetings(),
      groupData.materials(), groupData.announcements(), groupData.messages(),
      groupData.homework(), groupData.homeworkDone(),
    ]);
    setState({ loading: false, group, members, meetings, materials, announcements, messages, homework, hwDone });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sendMessage = async (body: string, opts: { replyTo?: string; attachment?: Attachment } = {}) => {
    if (!body.trim() && !opts.attachment) return;
    await groupData.sendMessage(body, opts);
    await load();
  };
  const react = async (id: string, emoji: string) => { await groupData.react(id, emoji); await load(); };
  const deleteAttachment = async (id: string, by: 'admin' | 'author') => { await groupData.deleteAttachment(id, by); await load(); };
  const deleteMessage = async (id: string, by: 'admin' | 'author', reason?: string) => { await groupData.deleteMessage(id, by, reason); await load(); };

  const setMemberStatus = async (id: string, status: MembershipStatus) => {
    await groupData.setMemberStatus(id, status);
    await load();
  };

  const addMember = async (name: string, email: string) => {
    await groupData.addMember(name, email);
    await load();
  };

  const updateMeeting = async (id: string, patch: Partial<Meeting>) => { await groupData.updateMeeting(id, patch); await load(); };
  const toggleHomeworkDone = async (id: string) => { await groupData.toggleHomeworkDone(id); await load(); };

  const resetDemo = async () => {
    groupData.resetDemo?.();
    await load();
  };

  return {
    ...state,
    isDemo: groupData.isDemo,
    currentUserId: groupData.currentUserId(),
    sendMessage, react, deleteAttachment, deleteMessage, setMemberStatus, addMember, updateMeeting, toggleHomeworkDone, resetDemo,
  };
}
