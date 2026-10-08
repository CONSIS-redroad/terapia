// PATH: src/types/group.ts | REQ-ID: TERAPIA-TYPES-01
// Kontrakty zgodne z `schemas/*.schema.yml` (wersja robocza). W fazie 1 te same typy wypełnia Supabase.

export type Role = 'therapist' | 'participant';
export type MembershipStatus = 'pending' | 'approved' | 'blocked' | 'removed';

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
  email?: string; // widzi tylko admin
  /** Faza 2: imię zaproponowane przez uczestnika — czeka na zatwierdzenie admina. */
  pendingName?: string;
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
  link?: string; // (nieużywane w UI — Bartek 08.10: bez „Dołącz online”)
  /** Krótko: co było przedmiotem zajęć (dla nieobecnych). */
  summary?: string;
  /** Rozwinięcie „Więcej”: przebieg, ćwiczenia, wnioski. */
  details?: string;
  /** Zdjęcia z sali (np. tablica) — dodaje prowadząca/admin. */
  photos?: { url: string; caption: string; id?: string }[]; // id = wiersz w bazie (faza 2)
  /** Harmonogram: odwołane (nie liczy się do serii, treści zostają). */
  cancelled?: boolean;
  /** Krótka uwaga admina, np. „zastępczo w środę”. */
  note?: string;
}

/** Praca domowa: zadana na zajęciach `givenAt`, do oddania/omówienia na zajęciach `dueAt`. */
export interface Homework {
  id: string;
  givenAt: string; // id zajęć
  dueAt: string;   // id zajęć
  title: string;
  description: string;
}

export type MaterialKind = 'pdf' | 'image' | 'video' | 'audio' | 'link';
/** Kategoria w bibliotece mediów. 'zajecia' = materiał roboczy do zajęć (karta pracy itp.). */
export type MediaCategory = 'zajecia' | 'ksiazka' | 'poradnik' | 'podcast' | 'film' | 'inne';

export interface Material {
  id: string;
  title: string;
  kind: MaterialKind;
  category: MediaCategory;
  author?: string;
  url: string; // pdf/obraz: plik w magazynie; wideo/audio: ZAWSZE link zewnętrzny (D007)
  addedAt: string;
  meetingId?: string; // brak = materiał luźny
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

export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'txt';

export interface Attachment {
  name: string;
  type: string;
  size: number; // bajty — do limitu 20 MB/plik i 40 MB/osobę
  kind: AttachmentKind;
  url: string;
}

export interface Message {
  id: string;
  authorId: string;
  date: string;
  body: string;
  replyTo?: string;                      // id wiadomości, na którą to odpowiedź
  reactions?: Record<string, string[]>;  // emotka -> kto zareagował
  attachment?: Attachment;
  attachmentDeleted?: 'admin' | 'author';
  /** Moderacja: wiadomość usunięta (treść znika, zostaje ślad). */
  deleted?: { by: 'admin' | 'author'; reason?: string };
}
