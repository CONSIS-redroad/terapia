// PATH: src/services/supabaseSource.ts | REQ-ID: TERAPIA-DATA-02
// FAZA 2: implementacja GroupDataSource na Supabase grupy. Ekrany się nie zmieniają — ten sam interfejs co demo.
// Uprawnienia egzekwuje BAZA (RLS + funkcje w 0001_init.sql); tutaj tylko tłumaczenie wierszy na typy aplikacji.
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GroupDataSource } from './groupData';
import type { Announcement, Attachment, Group, Homework, Material, Meeting, Member, MembershipStatus, Message } from '../types/group';
import { FILES_BUCKET, supabase } from './supabaseClient';

const sb = () => {
  if (!supabase) throw new Error('Brak konfiguracji Supabase');
  return supabase;
};

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

/** Plik z adresu blob:/data: (tak przychodzą z ekranów) → Blob do wysłania. */
async function toBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

function safeName(name: string): string {
  return name.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'plik';
}

const SIGNED_TTL = 60 * 60; // podpisane adresy plików ważne 1 h (bucket jest prywatny)

export class SupabaseSource implements GroupDataSource {
  readonly isDemo = false;
  private uid = '';
  private signed = new Map<string, { url: string; until: number }>();

  /** Ustawia AuthGate po zalogowaniu — zanim pokaże ekrany. */
  setUser(uid: string) { this.uid = uid; }
  currentUserId() { return this.uid; }

  private async signedUrls(paths: string[]): Promise<Record<string, string>> {
    const now = Date.now();
    const need = [...new Set(paths)].filter(p => (this.signed.get(p)?.until ?? 0) < now + 60_000);
    if (need.length) {
      const { data, error } = await sb().storage.from(FILES_BUCKET).createSignedUrls(need, SIGNED_TTL);
      if (error) throw new Error(error.message);
      for (const d of data ?? []) if (d.path && d.signedUrl) this.signed.set(d.path, { url: d.signedUrl, until: now + SIGNED_TTL * 1000 });
    }
    return Object.fromEntries(paths.map(p => [p, this.signed.get(p)?.url ?? '#brak-pliku']));
  }

  private async upload(path: string, blob: Blob, type: string) {
    const { error } = await sb().storage.from(FILES_BUCKET).upload(path, blob, { contentType: type || 'application/octet-stream', upsert: false });
    if (error) {
      const msg = /40 MB|53400|quota/i.test(error.message) ? 'Przekroczysz swój limit 40 MB — usuń któryś ze swoich plików.'
        : /maximum allowed size|too large|413/i.test(error.message) ? 'Plik jest większy niż 20 MB.' : error.message;
      throw new Error(msg);
    }
  }

  async group(): Promise<Group> {
    const g = must(await sb().from('group_info').select('*').eq('id', 1).maybeSingle()) as Record<string, string> | null;
    return { id: 'grupa', name: g?.name ?? 'Grupa', description: g?.description ?? '', schedule: g?.schedule ?? '' };
  }

  async members(): Promise<Member[]> {
    const rows = must(await sb().rpc('group_members')) as Array<Record<string, string | null>>;
    const list: Member[] = rows.map(r => ({
      id: r.id!, name: r.name!, role: r.role as Member['role'], status: r.status as MembershipStatus,
      joinedAt: r.joined_at ?? undefined, emoji: r.emoji ?? undefined, color: r.color ?? undefined,
      photo: r.photo_url ?? undefined, about: r.about || undefined, email: r.email ?? undefined,
    }));
    // admin: propozycje zmiany imienia (kolumna pending_name widoczna tylko dla admina przez RLS tabeli members)
    const pn = await sb().from('members').select('id,pending_name').not('pending_name', 'is', null);
    if (!pn.error && pn.data) for (const r of pn.data as Array<{ id: string; pending_name: string }>) {
      const m = list.find(x => x.id === r.id); if (m) m.pendingName = r.pending_name;
    }
    // admin widzi też zaproszenia osób, które jeszcze się nie zalogowały
    const inv = await sb().from('invites').select('email,name,invited_at');
    if (!inv.error && inv.data) {
      const known = new Set(list.map(m => (m.email ?? '').toLowerCase()));
      for (const i of inv.data as Array<{ email: string; name: string; invited_at: string }>) {
        if (known.has(i.email)) continue;
        list.push({ id: `invite:${i.email}`, name: i.name || i.email, email: i.email, role: 'participant', status: 'approved', joinedAt: i.invited_at, emoji: '✉️', color: '#94a3b8', about: 'Zaproszenie — jeszcze się nie zalogował(a)' });
      }
    }
    return list;
  }

  async setMemberStatus(memberId: string, status: MembershipStatus) {
    if (memberId.startsWith('invite:')) {
      if (status === 'removed' || status === 'blocked') must(await sb().from('invites').delete().eq('email', memberId.slice(7)));
      return;
    }
    const r = await sb().from('members').update({ status }).eq('id', memberId);
    if (r.error) throw new Error(/members_name_unique|duplicate key/i.test(r.error.message)
      ? 'W grupie jest już osoba o tym imieniu — najpierw nadaj rozróżnienie (np. „Ania K.”), potem wpuść.' : r.error.message);
  }

  async renameMember(memberId: string, name: string) {
    const r = await sb().from('members').update({ name: name.trim().slice(0, 40), pending_name: null }).eq('id', memberId);
    if (r.error) throw new Error(/members_name_unique|duplicate key/i.test(r.error.message) ? 'To imię ma już ktoś w grupie — dodaj rozróżnienie (np. inicjał).' : r.error.message);
  }

  async decideName(memberId: string, accept: boolean) {
    const m = must(await sb().from('members').select('pending_name').eq('id', memberId).single()) as { pending_name: string | null };
    if (accept && m.pending_name) return this.renameMember(memberId, m.pending_name);
    must(await sb().from('members').update({ pending_name: null }).eq('id', memberId));
  }

  async addMember(name: string, email: string): Promise<Member> {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Podaj poprawny e-mail');
    must(await sb().from('invites').upsert({ email: e, name: name.trim().slice(0, 40) }));
    return { id: `invite:${e}`, name: name.trim() || e, email: e, role: 'participant', status: 'approved' };
  }

  async meetings(): Promise<Meeting[]> {
    const rows = must(await sb().from('meetings').select('*, meeting_photos(id,path,caption,created_at)').order('starts_at')) as Array<Record<string, unknown>>;
    const paths = rows.flatMap(r => ((r.meeting_photos as Array<{ path: string }>) ?? []).map(p => p.path));
    const urls = paths.length ? await this.signedUrls(paths) : {};
    return rows.map(r => ({
      id: r.id as string, date: r.starts_at as string, durationMin: r.duration_min as number,
      topic: r.topic as string, place: r.place as string,
      summary: (r.summary as string) || undefined, details: (r.details as string) || undefined,
      cancelled: !!r.cancelled, note: (r.note as string) || undefined,
      photos: ((r.meeting_photos as Array<{ id: string; path: string; caption: string; created_at: string }>) ?? [])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(p => ({ id: p.id, url: urls[p.path], caption: p.caption })),
    }));
  }

  async updateMeeting(id: string, patch: Partial<Meeting>) {
    const row: Record<string, unknown> = {};
    if ('summary' in patch) row.summary = patch.summary ?? '';
    if ('details' in patch) row.details = patch.details ?? '';
    if ('topic' in patch) row.topic = patch.topic ?? '';
    if ('place' in patch) row.place = patch.place ?? '';
    if (patch.date) row.starts_at = patch.date;
    if (patch.durationMin) row.duration_min = patch.durationMin;
    if ('cancelled' in patch) row.cancelled = !!patch.cancelled;
    if ('note' in patch) row.note = (patch.note ?? '').slice(0, 300);
    if (Object.keys(row).length) must(await sb().from('meetings').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id));
    if (patch.photos) {
      const current = must(await sb().from('meeting_photos').select('id,path').eq('meeting_id', id)) as Array<{ id: string; path: string }>;
      const keepIds = new Set(patch.photos.map(p => p.id).filter(Boolean));
      const gone = current.filter(c => !keepIds.has(c.id));
      if (gone.length) {
        await sb().storage.from(FILES_BUCKET).remove(gone.map(g => g.path));
        must(await sb().from('meeting_photos').delete().in('id', gone.map(g => g.id)));
      }
      for (const p of patch.photos) {
        if (p.id) continue; // już w bazie
        const blob = await toBlob(p.url);
        const path = `admin/meetings/${id}/${crypto.randomUUID()}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
        await this.upload(path, blob, blob.type || 'image/jpeg');
        must(await sb().from('meeting_photos').insert({ meeting_id: id, path, caption: p.caption ?? '' }));
      }
    }
  }

  async addMeetings(list: Omit<Meeting, 'id'>[]) {
    if (!list.length) return;
    must(await sb().from('meetings').insert(list.map(m => ({
      starts_at: m.date, duration_min: m.durationMin, topic: m.topic ?? '', place: m.place ?? '',
      cancelled: !!m.cancelled, note: (m.note ?? '').slice(0, 300),
    }))));
  }

  async deleteMeeting(id: string) {
    must(await sb().from('meetings').delete().eq('id', id));
  }

  async homework(): Promise<Homework[]> {
    const rows = must(await sb().from('homework').select('*').order('created_at')) as Array<Record<string, string>>;
    return rows.map(r => ({ id: r.id, givenAt: r.given_meeting, dueAt: r.due_meeting, title: r.title, description: r.description }));
  }

  async addHomework(h: Omit<Homework, 'id'>) {
    must(await sb().from('homework').insert({ title: h.title, description: h.description, given_meeting: h.givenAt, due_meeting: h.dueAt }));
  }

  async updateHomework(id: string, p: Partial<Homework>) {
    const row: Record<string, unknown> = {};
    if (p.title !== undefined) row.title = p.title;
    if (p.description !== undefined) row.description = p.description;
    if (p.givenAt) row.given_meeting = p.givenAt;
    if (p.dueAt) row.due_meeting = p.dueAt;
    must(await sb().from('homework').update(row).eq('id', id));
  }

  async deleteHomework(id: string) {
    must(await sb().from('homework').delete().eq('id', id));
  }

  async homeworkDone(): Promise<Record<string, boolean>> {
    const rows = must(await sb().from('homework_done').select('homework_id').eq('member_id', this.uid)) as Array<{ homework_id: string }>;
    return Object.fromEntries(rows.map(r => [r.homework_id, true]));
  }

  async toggleHomeworkDone(id: string) {
    const done = await this.homeworkDone();
    if (done[id]) must(await sb().from('homework_done').delete().eq('homework_id', id).eq('member_id', this.uid));
    else must(await sb().from('homework_done').insert({ homework_id: id, member_id: this.uid }));
  }

  async materials(): Promise<Material[]> {
    const rows = must(await sb().from('materials').select('*').order('added_at', { ascending: false })) as Array<Record<string, string | null>>;
    const paths = rows.map(r => r.path).filter((p): p is string => !!p);
    const urls = paths.length ? await this.signedUrls(paths) : {};
    return rows.map(r => ({
      id: r.id!, title: r.title!, kind: r.kind as Material['kind'], category: r.category as Material['category'],
      author: r.author || undefined, url: r.path ? urls[r.path] : r.url!, addedAt: r.added_at!,
      meetingId: r.meeting_id ?? undefined, note: r.note || undefined,
    }));
  }

  async announcements(): Promise<Announcement[]> {
    const rows = must(await sb().from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })) as Array<Record<string, string | boolean>>;
    return rows.map(r => ({ id: r.id as string, authorId: (r.author_id as string) ?? '', date: r.created_at as string, title: r.title as string, body: r.body as string, pinned: !!r.pinned }));
  }

  async messages(): Promise<Message[]> {
    const [msgs, atts, reacts] = await Promise.all([
      sb().from('messages').select('*').order('created_at').limit(1000),
      sb().from('attachments').select('*'),
      sb().from('reactions').select('message_id,member_id,emoji'),
    ]);
    const mrows = must(msgs) as Array<Record<string, string | null>>;
    const arows = must(atts) as Array<Record<string, string | number | null>>;
    const rrows = must(reacts) as Array<{ message_id: string; member_id: string; emoji: string }>;
    const live = arows.filter(a => !a.deleted_at).map(a => a.path as string);
    const urls = live.length ? await this.signedUrls(live) : {};
    const byMsg = new Map(arows.map(a => [a.message_id as string, a]));
    const reactions = new Map<string, Record<string, string[]>>();
    for (const r of rrows) {
      const m = reactions.get(r.message_id) ?? {};
      (m[r.emoji] ??= []).push(r.member_id);
      reactions.set(r.message_id, m);
    }
    return mrows.map(m => {
      const a = byMsg.get(m.id!);
      const msg: Message = {
        id: m.id!, authorId: m.author_id!, date: m.created_at!, body: m.body ?? '',
        replyTo: m.reply_to ?? undefined, reactions: reactions.get(m.id!) ?? {},
      };
      if (a) {
        msg.attachment = { name: a.name as string, type: a.mime as string, size: Number(a.size), kind: a.kind as Attachment['kind'], url: a.deleted_at ? '#usuniety' : urls[a.path as string] };
        if (a.deleted_by) msg.attachmentDeleted = a.deleted_by as 'admin' | 'author';
      }
      if (m.deleted_by) msg.deleted = { by: m.deleted_by as 'admin' | 'author', reason: m.deleted_reason ?? undefined };
      return msg;
    });
  }

  async sendMessage(body: string, opts: { replyTo?: string; attachment?: Attachment } = {}): Promise<Message> {
    let uploadedPath: string | null = null;
    if (opts.attachment) {
      const blob = await toBlob(opts.attachment.url);
      uploadedPath = `${this.uid}/${crypto.randomUUID()}-${safeName(opts.attachment.name)}`;
      await this.upload(uploadedPath, blob, opts.attachment.type); // limit 20/40 MB pilnuje baza — błąd = nic nie wysłane
    }
    const ins = await sb().from('messages').insert({ body: body.trim().slice(0, 2000), reply_to: opts.replyTo ?? null }).select('*').single();
    if (ins.error) {
      if (uploadedPath) await sb().storage.from(FILES_BUCKET).remove([uploadedPath]);
      throw new Error(ins.error.message);
    }
    const row = ins.data as Record<string, string>;
    if (opts.attachment && uploadedPath) {
      const a = opts.attachment;
      const r = await sb().from('attachments').insert({ message_id: row.id, path: uploadedPath, name: a.name.slice(0, 120), mime: a.type || 'application/octet-stream', size: a.size, kind: a.kind });
      if (r.error) {
        await sb().storage.from(FILES_BUCKET).remove([uploadedPath]);
        await sb().rpc('delete_message', { p_id: row.id });
        throw new Error(r.error.message);
      }
    }
    return { id: row.id, authorId: row.author_id, date: row.created_at, body: row.body, replyTo: row.reply_to ?? undefined };
  }

  async react(messageId: string, emoji: string) {
    const cur = must(await sb().from('reactions').select('emoji').eq('message_id', messageId).eq('member_id', this.uid).maybeSingle()) as { emoji: string } | null;
    if (cur?.emoji === emoji) must(await sb().from('reactions').delete().eq('message_id', messageId).eq('member_id', this.uid));
    else must(await sb().from('reactions').upsert({ message_id: messageId, member_id: this.uid, emoji })); // jedna reakcja na osobę
  }

  async deleteAttachment(messageId: string, _by: 'admin' | 'author') {
    const a = must(await sb().from('attachments').select('path').eq('message_id', messageId).maybeSingle()) as { path: string } | null;
    if (a) await sb().storage.from(FILES_BUCKET).remove([a.path]); // zwalnia limit (zajętość liczona z magazynu)
    must(await sb().rpc('delete_attachment', { p_message_id: messageId }));
  }

  async deleteMessage(messageId: string, _by: 'admin' | 'author', reason?: string) {
    const a = must(await sb().from('attachments').select('path,deleted_at').eq('message_id', messageId).maybeSingle()) as { path: string; deleted_at: string | null } | null;
    if (a && !a.deleted_at) await sb().storage.from(FILES_BUCKET).remove([a.path]);
    must(await sb().rpc('delete_message', { p_id: messageId, p_reason: reason ?? null }));
  }

  /** Zajętość plików na osobę (admin: wszyscy; uczestnik: tylko on). */
  async storageUsage(): Promise<Record<string, number>> {
    const r = await sb().rpc('storage_usage');
    if (r.error || !r.data) return {};
    return Object.fromEntries((r.data as Array<{ member_id: string; used: number }>).map(x => [x.member_id, Number(x.used)]));
  }

  /** Admin: usuń CAŁĄ grupę (treści + członkostwa). Najpierw pliki przez Storage API, potem baza (wipe_group). */
  async wipeGroup(confirmName: string) {
    // potwierdzenie sprawdzamy PRZED kasowaniem plików (baza i tak sprawdza drugi raz)
    if (confirmName.trim() !== (await this.group()).name.trim()) throw new Error('Wpisana nazwa nie zgadza się z nazwą grupy.');
    const all: string[] = [];
    const walk = async (prefix: string) => {
      const { data, error } = await sb().storage.from(FILES_BUCKET).list(prefix, { limit: 1000 });
      if (error) throw new Error(error.message);
      for (const it of data ?? []) {
        const p = prefix ? `${prefix}/${it.name}` : it.name;
        if (it.id) all.push(p); else await walk(p); // brak id = folder
      }
    };
    await walk('');
    for (let i = 0; i < all.length; i += 100) {
      const { error } = await sb().storage.from(FILES_BUCKET).remove(all.slice(i, i + 100));
      if (error) throw new Error(error.message);
    }
    must(await sb().rpc('wipe_group', { p_confirm: confirmName }));
  }

  /** Czat na żywo: każda zmiana wiadomości/reakcji/plików = odśwież. Zwraca funkcję wyłączającą. */
  subscribe(onChange: () => void): () => void {
    let t: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(t); t = setTimeout(onChange, 250); };
    const ch: RealtimeChannel = sb().channel('grupa-czat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, bump)
      .subscribe();
    return () => { clearTimeout(t); void sb().removeChannel(ch); };
  }
}
