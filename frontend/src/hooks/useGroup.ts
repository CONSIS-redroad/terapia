// PATH: src/hooks/useGroup.ts | REQ-ID: TERAPIA-HOOK-01
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { groupData } from '../services/groupData';
import { STALE_MSG, isPlainNote, vaultCheckFresh, vaultGeneration, vaultInit, vaultNotice, vaultOpen, vaultSeal, vaultState, vaultSubscribe } from '../services/noteVault';
import { notatekGen } from '../services/noteMigration';
import { clipUnits } from '../services/noteCrypto';
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
  /** Odczyt notatek: ok · unavailable (baza bez 0009 — sekcja ukryta) · error (odczyt padł — edycja ZABLOKOWANA, żeby nie nadpisać starej)
   *  · locked (D042: notatki zaszyfrowane, PIN nieustawiony / nieodblokowany / jeszcze odszyfrowuję — sekcja pokazuje PIN). */
  notesStatus: 'ok' | 'unavailable' | 'error' | 'locked';
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

/** Hook stanu sejfu notatek (ekrany: NoteLock). */
export function useNoteVault() {
  return useSyncExternalStore(vaultSubscribe, vaultState, vaultState);
}

export function useGroup() {
  const [state, setState] = useState<GroupState>(EMPTY);
  // D042: notatki z bazy w postaci ZAPISANEJ (szyfrogram albo stara jawna); do ekranu idą odszyfrowane tylko przy odblokowanym sejfie
  const rawNotes = useRef<Record<string, MeetingNote> | null | 'error'>({});
  const migratedGen = useRef(-1);
  const vault = useNoteVault();
  /** Surowe notatki → to, co widzi ekran (wg stanu sejfu). Odczyt padł → error; sejf niegotowy → locked (nic jawnego). */
  const viewNotes = useCallback(async (raw: Record<string, MeetingNote> | null | 'error'): Promise<NotesLoad> => {
    rawNotes.current = raw;
    if (raw === 'error') return { myNotes: {}, notesStatus: 'error' };
    if (raw === null) return { myNotes: {}, notesStatus: 'unavailable' };
    const v = vaultState().status;
    if (v === 'error') return { myNotes: {}, notesStatus: 'error' };
    if (v === 'unlocked' || v === 'unavailable') {
      // świeżo odblokowane, a migracja jeszcze nie przeszła — nie pokazuj edytora (żeby nie pisać na wersji sprzed migracji)
      if (v === 'unlocked' && migratedGen.current !== vaultGeneration()) return { myNotes: {}, notesStatus: 'locked' };
      const open = await vaultOpen(raw);
      // nieczytelna notatka przy odblokowanym sejfie: najpierw sprawdź, czy NASZ klucz jest aktualny (O2 — inne urządzenie
      // zrobiło „Nie pamiętam PIN-u”). Nieaktualny → blokada, a NIE przycisk „Usuń” przy cudzych-dla-nas, ważnych notatkach.
      if (v === 'unlocked' && Object.values(open).some(n => n.unreadable) && !(await vaultCheckFresh()))
        return { myNotes: {}, notesStatus: 'locked' };
      return { myNotes: open, notesStatus: 'ok' };
    }
    return { myNotes: {}, notesStatus: 'locked' };
  }, []);
  // Lista członków niesie miniatury zdjęć (do 40 KB/osobę, 0011) — przy zdarzeniach czatu (każda wiadomość, reakcja)
  // NIE pobieramy jej od nowa, tylko gdy minęła minuta; pełne wczytanie (start, zmiany admina) zawsze odświeża.
  const membersCache = useRef<{ list: Member[]; at: number } | null>(null);
  const loadMembers = useCallback(async (chatOnly: boolean) => {
    const c = membersCache.current;
    if (chatOnly && c && Date.now() - c.at < 60_000) return c.list;
    const list = await groupData.members();
    membersCache.current = { list, at: Date.now() };
    return list;
  }, []);

  const load = useCallback(async (chatOnly = false) => {
    const [group, members, meetings, materials, announcements, messages, homework, hwDone, usage, notes, prog] = await Promise.all([
      groupData.group(), loadMembers(chatOnly), groupData.meetings(),
      groupData.materials(), groupData.announcements(), groupData.messages(),
      groupData.homework(), groupData.homeworkDone(),
      groupData.storageUsage ? groupData.storageUsage() : Promise.resolve(null),
      // błąd odczytu notatek ≠ „brak notatek”: osobny stan, ekran blokuje edycję
      groupData.myNotes().then(r => viewNotes(r), () => viewNotes('error')),
      groupData.program().then(
        (r): ProgramLoad => ({ program: r, programError: false }),
        (): ProgramLoad => ({ program: [], programError: true })),
    ]);
    setState({ loading: false, group, members, meetings, materials, announcements, messages, homework, hwDone, usage, ...notes, ...prog });
  }, [loadMembers, viewNotes]);

  useEffect(() => { void load(); }, [load]);
  // sejf notatek: rekord klucza zalogowanej osoby (w Supabase uid jest ustawiony, zanim ekrany się pokażą)
  useEffect(() => { void vaultInit(); }, []);
  // Zmiana stanu sejfu → przelicz widok notatek. Po odblokowaniu: ENCRYPT-ON-UNLOCK — stare jawne notatki szyfrujemy
  // i zapisujemy (kontrola odszyfrowania przed zapisem; błąd jednej nie zatrzymuje reszty i niczego nie kasuje).
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (vault.status === 'unlocked' && migratedGen.current !== vaultGeneration()) {
        const gen = vaultGeneration();
        let raw: Record<string, MeetingNote> | null = null;
        try { raw = await groupData.myNotes(); } catch { /* odczyt padł — niżej stan error */ }
        if (raw) {
          const failed: string[] = [];
          for (const n of Object.values(raw).filter(isPlainNote)) {
            try {
              if (!n.updatedAt) throw new Error('brak updated_at');
              const plain = (await vaultOpen({ [n.meetingId]: n }))[n.meetingId];
              if (!plain || plain.unreadable) continue;
              const sealed = await vaultSeal(n.meetingId, plain.title, plain.note);
              // O1: zapis WARUNKOWY — tylko gdy wiersz ma wciąż updated_at z naszej migawki (R2-1: warunek bez treści);
              // inaczej inne urządzenie już ją zmigrowało/zmieniło → nie nadpisujemy, bierzemy stan z bazy
              const done = await groupData.migrateMyNote(n.meetingId, n.updatedAt, sealed, sealed.dekId ?? '');
              if (done) raw[n.meetingId] = done;
              else { const fresh = await groupData.myNotes(); if (fresh) raw = fresh; }
            } catch (e) {
              // zostaje jawna — spróbujemy przy następnym odblokowaniu; NIE po cichu (R2-1). Log BEZ treści notatki.
              failed.push(n.meetingId);
              console.warn('[notatki] migracja do szyfrogramu nieudana', { zajecia: n.meetingId, blad: (e instanceof Error ? e.message : String(e)).slice(0, 80) });
            }
          }
          if (failed.length) vaultNotice(`Nie udało się zaszyfrować ${failed.length} ${notatekGen(failed.length)} — zostają jak były; spróbujemy przy następnym odblokowaniu.`);
        }
        if (vaultGeneration() === gen) migratedGen.current = gen;
        const view = await viewNotes(raw ?? 'error');
        if (alive) setState(s => ({ ...s, ...view }));
        return;
      }
      const view = await viewNotes(rawNotes.current);
      if (alive) setState(s => (s.loading ? s : { ...s, ...view }));
    })();
    return () => { alive = false; };
  }, [vault.status, viewNotes]);
  // Supabase: czat na żywo (nowe wiadomości, reakcje, pliki innych osób)
  useEffect(() => groupData.subscribe?.(() => { void load(true); }), [load]);

  const sendMessage = async (body: string, opts: { replyTo?: string; attachment?: Attachment } = {}) => {
    if (!body.trim() && !opts.attachment) return;
    try { await groupData.sendMessage(body, opts); }
    catch (e) { alert(`Nie wysłano: ${e instanceof Error ? e.message : String(e)}`); } // np. limit 40 MB pilnowany przez bazę
    await load(true);
  };
  const react = async (id: string, emoji: string) => { await groupData.react(id, emoji); await load(true); };
  const deleteAttachment = async (id: string, by: 'admin' | 'author') => { await groupData.deleteAttachment(id, by); await load(true); };
  const deleteMessage = async (id: string, by: 'admin' | 'author', reason?: string) => { await groupData.deleteMessage(id, by, reason); await load(true); };

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
    // limity i „pusta = błąd” liczone na JAWNYM tekście (szyfrogram jest dłuższy i nigdy pusty)
    const t = clipUnits(title.trim(), 200); const n = clipUnits(note, 20000); // po pełnych znakach (emoji)
    if (!t && !n.trim()) throw new Error('Pusta notatka — nic nie zapisano (usuwanie tylko przyciskiem).');
    const sealed = await vaultSeal(meetingId, t, n);   // zablokowane → błąd; NIGDY nie wyślemy jawnie do zaszyfrowanej bazy
    let saved: MeetingNote;
    try {
      saved = await groupData.saveMyNote(meetingId, sealed.title, sealed.note, sealed.dekId);
    } catch (e) {
      // baza odrzuciła nieaktualny klucz (O2): tekst zostaje w edytorze, komunikat mówi, co zrobić
      if (/KEY_STALE/.test(e instanceof Error ? e.message : String(e))) throw new Error(`${STALE_MSG} Skopiuj najpierw wpisany tekst.`);
      throw e;
    }
    if (rawNotes.current && rawNotes.current !== 'error') rawNotes.current = { ...rawNotes.current, [meetingId]: saved };
    const open = vaultState().status === 'unlocked' || vaultState().status === 'unavailable';
    if (open) setState(s => ({ ...s, myNotes: { ...s.myNotes, [meetingId]: { ...saved, title: t, note: n } } }));
  };
  /** Świadome usunięcie mojej notatki (przycisk z potwierdzeniem w karcie) — autozapis nigdy nie kasuje. */
  const deleteMyNote = async (meetingId: string) => {
    await groupData.deleteMyNote(meetingId);
    if (rawNotes.current && rawNotes.current !== 'error') { const raw = { ...rawNotes.current }; delete raw[meetingId]; rawNotes.current = raw; }
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
