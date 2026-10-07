// PATH: src/hooks/useGroup.ts | REQ-ID: TERAPIA-HOOK-01
import { useCallback, useEffect, useState } from 'react';
import { groupData } from '../services/groupData';
import type { Announcement, Group, Material, Meeting, Member, MembershipStatus, Message } from '../types/group';

export interface GroupState {
  loading: boolean;
  group: Group | null;
  members: Member[];
  meetings: Meeting[];
  materials: Material[];
  announcements: Announcement[];
  messages: Message[];
}

const EMPTY: GroupState = {
  loading: true, group: null, members: [], meetings: [], materials: [], announcements: [], messages: [],
};

export function useGroup() {
  const [state, setState] = useState<GroupState>(EMPTY);

  const load = useCallback(async () => {
    const [group, members, meetings, materials, announcements, messages] = await Promise.all([
      groupData.group(), groupData.members(), groupData.meetings(),
      groupData.materials(), groupData.announcements(), groupData.messages(),
    ]);
    setState({ loading: false, group, members, meetings, materials, announcements, messages });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sendMessage = async (body: string) => {
    if (!body.trim()) return;
    await groupData.sendMessage(body);
    await load();
  };

  const setMemberStatus = async (id: string, status: MembershipStatus) => {
    await groupData.setMemberStatus(id, status);
    await load();
  };

  const addMember = async (name: string, email: string) => {
    await groupData.addMember(name, email);
    await load();
  };

  const resetDemo = async () => {
    groupData.resetDemo?.();
    await load();
  };

  return {
    ...state,
    isDemo: groupData.isDemo,
    currentUserId: groupData.currentUserId(),
    sendMessage, setMemberStatus, addMember, resetDemo,
  };
}
