// PATH: src/components/panels.tsx | REQ-ID: TERAPIA-PANELS-01
// Zawartość paneli grupy. Wygląd w języku Luna2: ciemne, półprzezroczyste karty, drobna typografia.
import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarDays, MapPin, Video, FileText, Image as ImageIcon, Music, Link2, Pin, Send,
  Check, X, Clock, ExternalLink, Shield,
} from 'lucide-react';
import type { Announcement, Material, Meeting, Member, MembershipStatus, Message } from '../types/group';
import { fmtDayLong, fmtRelative, fmtShort, fmtTime, isPast } from '../services/format';
import { Avatar } from './ProfilePanel';

const card = 'rounded-xl bg-surf border border-line';

function nameOf(members: Member[], id: string) {
  return members.find(m => m.id === id)?.name ?? 'Uczestnik';
}

/* ---------- Spotkania ---------- */
export const MeetingsPanel: React.FC<{ meetings: Meeting[] }> = ({ meetings }) => {
  const next = meetings.find(m => !isPast(m.date, m.durationMin));
  return (
    <div className="p-4 space-y-3">
      {next && (
        <div className={`${card} p-4 bg-gradient-to-br from-sky-500/[0.08] to-transparent`}>
          <div className="text-[10px] uppercase tracking-widest text-acc font-semibold">Najbliższe spotkanie</div>
          <div className="mt-1 text-lg font-bold text-fg">{next.topic}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg2">
            <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-mut" />{fmtDayLong(next.date)}, {fmtTime(next.date)}</span>
            <span className="flex items-center gap-1.5">{next.place === 'online' ? <Video className="w-3.5 h-3.5 text-mut" /> : <MapPin className="w-3.5 h-3.5 text-mut" />}{next.place}</span>
          </div>
          {next.link && (
            <a href={next.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-sky-500/20 text-acc border border-sky-400/30 hover:bg-sky-500/30">
              <Video className="w-3.5 h-3.5" /> Dołącz online
            </a>
          )}
        </div>
      )}
      <ol className="space-y-1.5">
        {meetings.map((m, i) => {
          const past = isPast(m.date, m.durationMin);
          const isNext = next?.id === m.id;
          return (
            <li key={m.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isNext ? 'bg-surf' : ''} ${past ? 'opacity-50' : ''}`}>
              <span className="w-6 text-center text-[11px] font-mono text-mut2">{i + 1}</span>
              <span className="w-24 shrink-0 text-xs text-mut">{fmtShort(m.date)} · {fmtTime(m.date)}</span>
              <span className="flex-1 text-sm text-fg2 truncate">{m.topic}</span>
              {m.place === 'online' && <Video className="w-3.5 h-3.5 text-mut2 shrink-0" aria-label="online" />}
              {past && <Check className="w-3.5 h-3.5 text-ok shrink-0" aria-label="odbyło się" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/* ---------- Ogłoszenia ---------- */
export const AnnouncementsPanel: React.FC<{ items: Announcement[]; members: Member[] }> = ({ items, members }) => (
  <div className="p-4 space-y-3">
    {items.map(a => (
      <article key={a.id} className={`${card} p-4 ${a.pinned ? 'border-amber-300/20' : ''}`}>
        <div className="flex items-center gap-2 text-[11px] text-mut2">
          {a.pinned && <Pin className="w-3 h-3 text-warn" />}
          <span>{nameOf(members, a.authorId)}</span><span>·</span><span>{fmtRelative(a.date)}</span>
        </div>
        <h4 className="mt-1 text-sm font-bold text-fg">{a.title}</h4>
        <p className="mt-1 text-sm text-fg2 leading-relaxed whitespace-pre-line">{a.body}</p>
      </article>
    ))}
  </div>
);

/* ---------- Rozmowa ---------- */
export const ChatPanel: React.FC<{
  messages: Message[]; members: Member[]; currentUserId: string; isDemo: boolean; onSend: (body: string) => void;
}> = ({ messages, members, currentUserId, isDemo, onSend }) => {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="flex flex-col">
      <div ref={listRef} className="max-h-[420px] overflow-y-auto p-4 space-y-3">
        {messages.map(m => {
          const mine = m.authorId === currentUserId;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine && (() => { const a = members.find(x => x.id === m.authorId); return <Avatar emoji={a?.emoji} color={a?.color} photo={a?.photo} size={26} />; })()}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-sky-500/20 border border-sky-400/20 rounded-br-md' : 'bg-surf border border-line rounded-bl-md'}`}>
                <div className="text-[10px] text-mut mb-0.5">{mine ? `Ty (${nameOf(members, m.authorId)})` : nameOf(members, m.authorId)} · {fmtRelative(m.date)}</div>
                {/* Tekst renderowany jako tekst (React escapuje) — nigdy jako HTML. */}
                <div className="text-sm text-fg whitespace-pre-line break-words">{m.body}</div>
              </div>
              {mine && (() => { const a = members.find(x => x.id === m.authorId); return <Avatar emoji={a?.emoji} color={a?.color} photo={a?.photo} size={26} />; })()}
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 p-3 border-t border-line">
        <input
          value={text} onChange={e => setText(e.target.value)} maxLength={2000}
          placeholder="Napisz do grupy…" aria-label="Wiadomość do grupy"
          className="flex-1 bg-surf border border-line rounded-full px-4 py-2 text-sm text-fg placeholder:text-mut2 focus:outline-none focus:border-sky-400/40"
        />
        <button type="submit" disabled={!text.trim()} className="p-2.5 rounded-full bg-sky-500/25 text-acc border border-sky-400/30 disabled:opacity-30 hover:bg-sky-500/35 cursor-pointer" aria-label="Wyślij">
          <Send className="w-4 h-4" />
        </button>
      </form>
      {isDemo && <p className="px-4 pb-3 text-[11px] text-mut2">Demo: Twoje wiadomości zostają tylko w tej przeglądarce i nikt ich nie widzi.</p>}
    </div>
  );
};

/* ---------- Materiały ---------- */
const KIND_ICON: Record<Material['kind'], React.ReactNode> = {
  pdf: <FileText className="w-4 h-4 text-bad" />,
  image: <ImageIcon className="w-4 h-4 text-acc" />,
  video: <Video className="w-4 h-4 text-acc" />,
  audio: <Music className="w-4 h-4 text-ok" />,
  link: <Link2 className="w-4 h-4 text-fg2" />,
};
const KIND_LABEL: Record<Material['kind'], string> = { pdf: 'PDF', image: 'Obraz', video: 'Film (link)', audio: 'Nagranie (link)', link: 'Link' };

export const MaterialsPanel: React.FC<{ items: Material[]; meetings: Meeting[] }> = ({ items, meetings }) => (
  <div className="p-4 space-y-2">
    {items.map(m => {
      const external = m.kind === 'video' || m.kind === 'audio' || m.kind === 'link';
      const meeting = meetings.find(s => s.id === m.meetingId);
      return (
        <a
          key={m.id} href={m.url} target={external ? '_blank' : undefined} rel="noopener noreferrer"
          onClick={e => { if (m.url.startsWith('#demo')) { e.preventDefault(); alert('Demo — w wersji docelowej tu otworzy się plik.'); } }}
          className={`${card} flex items-center gap-3 px-3 py-2.5 hover:bg-surf2 transition-colors`}
        >
          <span className="w-8 h-8 rounded-lg bg-surf flex items-center justify-center shrink-0">{KIND_ICON[m.kind]}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm text-fg truncate">{m.title}</span>
            <span className="block text-[11px] text-mut2 truncate">
              {KIND_LABEL[m.kind]} · dodano {fmtShort(m.addedAt)}{meeting ? ` · do spotkania „${meeting.topic}”` : ''}
            </span>
          </span>
          {external && <ExternalLink className="w-3.5 h-3.5 text-mut2 shrink-0" />}
        </a>
      );
    })}
    <p className="pt-1 text-[11px] text-mut2">Pliki PDF i obrazy trzymamy u siebie. Filmy i nagrania zawsze jako link do zewnętrznego źródła.</p>
  </div>
);

/* ---------- Uczestnicy i akceptacja ---------- */
export const MembersPanel: React.FC<{
  members: Member[]; isDemo: boolean; onSetStatus: (id: string, s: MembershipStatus) => void;
}> = ({ members, isDemo, onSetStatus }) => {
  const pending = members.filter(m => m.status === 'pending');
  const approved = members.filter(m => m.status === 'approved');
  return (
    <div className="p-4 space-y-4">
      <div>
        {isDemo && <p className="mb-3 text-[11px] text-mut2">Podgląd widoku prowadzącej (admin). Uczestnik tego panelu nie widzi.</p>}
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-warn font-semibold">
          <Clock className="w-3.5 h-3.5" /> Czekają na akceptację ({pending.length})
        </div>
        {pending.length === 0 && <p className="mt-2 text-sm text-mut2">Nikt nie czeka.</p>}
        <ul className="mt-2 space-y-1.5">
          {pending.map(m => (
            <li key={m.id} className={`${card} flex items-center gap-3 px-3 py-2`}>
              <span className="flex-1 text-sm text-fg">{m.name}<span className="ml-2 text-[11px] text-mut2">zgłoszenie {m.joinedAt ? fmtRelative(m.joinedAt) : ''}</span></span>
              <button onClick={() => onSetStatus(m.id, 'approved')} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-ok border border-emerald-400/30 hover:bg-emerald-500/30 cursor-pointer"><Check className="w-3.5 h-3.5" />Przyjmij</button>
              <button onClick={() => onSetStatus(m.id, 'blocked')} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surf text-fg2 border border-line hover:bg-surf2 cursor-pointer"><X className="w-3.5 h-3.5" />Odrzuć</button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-widest text-mut font-semibold">W grupie ({approved.length})</div>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {approved.map(m => (
            <li key={m.id} title={m.about || undefined} className={`flex items-center gap-1.5 text-xs pl-1 pr-2.5 py-1 rounded-full border ${m.role === 'therapist' ? 'bg-sky-500/15 border-sky-400/25 text-acc' : 'bg-surf border-line text-fg2'}`}><Avatar emoji={m.emoji} color={m.color} photo={m.photo} size={20} />{m.name}</li>
          ))}
        </ul>
      </div>
      <p className="flex items-start gap-2 text-[11px] text-mut2">
        <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Osoba niezaakceptowana nie widzi niczego z grupy. Prywatny dzienniczek uczestnika nigdy nie jest widoczny przez członkostwo w grupie.
        {isDemo ? ' (W demo przyciski działają tylko w tej przeglądarce.)' : ''}
      </p>
    </div>
  );
};
