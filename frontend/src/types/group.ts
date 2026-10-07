// PATH: src/types/group.ts | REQ-ID: TERAPIA-TYPES-01
// Kontrakty zgodne z `schemas/*.schema.yml` (wersja robocza). W fazie 1 te same typy wypełnia Supabase.

export type Role = 'therapist' | 'participant';
export type MembershipStatus = 'pending' | 'approved' | 'blocked';

export interface Member {
  id: string;
  name: string;
  role: Role;
  status: MembershipStatus;
  joinedAt?: string; // ISO date
  emoji?: string;
  color?: string;
  photo?: string;
  about?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  schedule: string; // opis cyklu, np. „czwartki 18:00–19:30”
}

export interface Meeting {
  id: string;
  date: string; // ISO datetime
  durationMin: number;
  topic: string;
  place: string; // sala albo „online”
  link?: string; // link do spotkania online
}

export type MaterialKind = 'pdf' | 'image' | 'video' | 'audio' | 'link';

export interface Material {
  id: string;
  title: string;
  kind: MaterialKind;
  url: string; // pdf/obraz: plik w magazynie; wideo/audio: ZAWSZE link zewnętrzny (D007)
  addedAt: string;
  meetingId?: string;
  note?: string;
}

export interface Announcement {
  id: string;
  authorId: string;
  date: string;
  title: string;
  body: string;
  pinned?: boolean;
}

export interface Message {
  id: string;
  authorId: string;
  date: string;
  body: string;
}
