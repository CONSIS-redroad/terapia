// PATH: src/components/panels.tsx | REQ-ID: TERAPIA-PANELS-01
// Zawartość paneli grupy. Wygląd w języku Luna2: ciemne, półprzezroczyste karty, drobna typografia.
import React, { useEffect, useRef, useState } from 'react';
import { Pencil,
  CalendarDays, ChevronLeft, ChevronRight, MapPin, Video, FileText, Image as ImageIcon, Music, Link2, Pin, Send,
  Check, X, Clock, ExternalLink, Shield, UserPlus, UserMinus, Undo2,
} from 'lucide-react';
import type { Announcement, Homework, Material, Meeting, Member, MembershipStatus, Message } from '../types/group';
import { fmtDayLong, fmtRelative, fmtShort, fmtTime, isPast } from '../services/format';
import { Avatar } from './ProfilePanel';
import { LessonCard } from './LessonCard';
import { fmtSize, MAX_USER_TOTAL } from '../services/files';

const card = 'rounded-xl bg-surf border border-line';

function nameOf(members: Member[], id: string) {
  return members.find(m => m.id === id)?.name ?? 'Uczestnik';
}

/* ---------- Spotkania: kalendarz cyklu ---------- */
const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export const MeetingsPanel: React.FC<{
  meetings: Meeting[]; materials: Material[]; homework: Homework[]; hwDone: Record<string, boolean>;
  onToggleDone: (id: string) => void; isAdmin: boolean; onUpdateMeeting: (id: string, patch: Partial<Meeting>) => void;
  selectedId?: string; onSelect?: (id: string) => void;
}> = ({ meetings, materials, homework, hwDone, onToggleDone, isAdmin, onUpdateMeeting, selectedId: ctrlId, onSelect }) => {
  const next = meetings.find(m => !isPast(m.date, m.durationMin)) ?? meetings[meetings.length - 1];
  const [ownId, setOwnId] = useState<string | undefined>(next?.id);
  const selectedId = ctrlId ?? ownId;
  const setSelectedId = (id: string) => { setOwnId(id); onSelect?.(id); };
  const selected = meetings.find(m => m.id === selectedId) ?? next;
  const selIdx = selected ? meetings.indexOf(selected) : -1;
  const [month, setMonth] = useState(() => {
    const d = selected ? new Date(selected.date) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // wybór z zewnątrz (biblioteka) → pokaż miesiąc tych zajęć
  useEffect(() => {
    if (!ctrlId) return;
    const m = meetings.find(x => x.id === ctrlId);
    if (m) { const d = new Date(m.date); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }
  }, [ctrlId, meetings]);

  if (!selected) return <div className="p-4 text-sm text-mut2">Brak zajęć.</div>;

  const byDay = new Map(meetings.map(m => [dayKey(new Date(m.date)), m]));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // poniedziałek = 0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const today = dayKey(new Date());
  const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(month);
  const shiftMonth = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const select = (m: Meeting) => {
    setSelectedId(m.id);
    const d = new Date(m.date);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <div className="p-3 sm:p-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      {/* kalendarz miesiąca */}
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-full hover:bg-surf2 text-mut cursor-pointer" aria-label="Poprzedni miesiąc"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-fg capitalize">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-full hover:bg-surf2 text-mut cursor-pointer" aria-label="Następny miesiąc"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map(w => <div key={w} className="text-xs uppercase tracking-wider text-mut2 py-1">{w}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const m = byDay.get(dayKey(d));
            const isSel = m?.id === selected.id;
            const isToday = dayKey(d) === today;
            const mPast = m ? isPast(m.date, m.durationMin) : false;
            const hwDue = m ? homework.some(h => h.dueAt === m.id) : false;
            return (
              <button
                key={d.getDate()} disabled={!m} onClick={() => m && select(m)}
                aria-label={m ? `${d.getDate()} — zajęcia: ${m.topic}` : `${d.getDate()}`}
                className={`relative aspect-square min-h-10 rounded-lg text-sm flex flex-col items-center justify-center transition-colors
                  ${m ? 'cursor-pointer hover:bg-surf2 text-fg font-semibold' : 'text-mut2 cursor-default'}
                  ${isSel ? 'bg-sky-500/20 ring-1 ring-sky-400/50' : ''} ${isToday && !isSel ? 'ring-1 ring-line' : ''}`}
              >
                {d.getDate()}
                {m && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${mPast ? 'bg-mut2' : 'bg-sky-400'} ${hwDue && !mPast ? 'ring-2 ring-amber-400' : ''}`} />}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-mut2">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400" />zajęcia</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-mut2" />odbyte</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 ring-2 ring-amber-400" />termin pracy</span>
          <span className="ml-auto">{meetings.filter(m => isPast(m.date, m.durationMin)).length} z {meetings.length} za nami</span>
        </div>
      </div>

      {/* karta wybranych zajęć: praca domowa, streszczenie (dla nieobecnych), materiały */}
      <LessonCard
        key={selected.id}
        meeting={selected} index={selIdx} total={meetings.length} isNext={selected.id === next?.id}
        meetings={meetings} materials={materials} homework={homework} done={hwDone} onToggleDone={onToggleDone}
        isAdmin={isAdmin} onUpdate={onUpdateMeeting}
        onPrev={selIdx > 0 ? () => select(meetings[selIdx - 1]) : undefined}
        onNext={selIdx < meetings.length - 1 ? () => select(meetings[selIdx + 1]) : undefined}
        onOpenMeeting={id => { const x = meetings.find(y => y.id === id); if (x) select(x); }}
      />
    </div>
  );
};

/* ---------- Ogłoszenia ---------- */
export const AnnouncementsPanel: React.FC<{ items: Announcement[]; members: Member[] }> = ({ items, members }) => (
  <div className="p-4 space-y-3">
    {items.map(a => (
      <article key={a.id} className={`${card} p-4 ${a.pinned ? 'border-amber-300/20' : ''}`}>
        <div className="flex items-center gap-2 text-xs text-mut2">
          {a.pinned && <Pin className="w-3 h-3 text-warn" />}
          <span>{nameOf(members, a.authorId)}</span><span>·</span><span>{fmtRelative(a.date)}</span>
        </div>
        <h4 className="mt-1 text-sm font-bold text-fg">{a.title}</h4>
        <p className="mt-1 text-sm text-fg2 leading-relaxed whitespace-pre-line">{a.body}</p>
      </article>
    ))}
  </div>
);

/* Rozmowa: components/ChatPanel.tsx (czat jak WhatsApp) */

/* ---------- Materiały ---------- */
const KIND_ICON: Record<Material['kind'], React.ReactNode> = {
  pdf: <FileText className="w-4 h-4 text-bad" />,
  image: <ImageIcon className="w-4 h-4 text-acc" />,
  video: <Video className="w-4 h-4 text-acc" />,
  audio: <Music className="w-4 h-4 text-ok" />,
  link: <Link2 className="w-4 h-4 text-fg2" />,
};
const KIND_LABEL: Record<Material['kind'], string> = { pdf: 'PDF', image: 'Obraz', video: 'Film (link)', audio: 'Nagranie (link)', link: 'Link' };

const openMaterial = (e: React.MouseEvent, m: Material) => {
  if (m.url.startsWith('#demo')) { e.preventDefault(); alert('Demo — w wersji docelowej tu otworzy się plik.'); }
};

export const MaterialRow: React.FC<{ m: Material; meetingLabel?: string }> = ({ m, meetingLabel }) => {
  const external = m.kind === 'video' || m.kind === 'audio' || m.kind === 'link';
  return (
    <a href={m.url} target={external ? '_blank' : undefined} rel="noopener noreferrer" onClick={e => openMaterial(e, m)}
      className={`${card} flex items-center gap-3 px-3 py-2.5 hover:bg-surf2 transition-colors`}>
      <span className="w-8 h-8 rounded-lg bg-surf flex items-center justify-center shrink-0">{KIND_ICON[m.kind]}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-fg truncate">{m.title}</span>
        <span className="block text-xs text-mut2 truncate">{KIND_LABEL[m.kind]}{meetingLabel ? ` · ${meetingLabel}` : ''}{m.note ? ` · ${m.note}` : ''}</span>
      </span>
      {external && <ExternalLink className="w-3.5 h-3.5 text-mut2 shrink-0" />}
    </a>
  );
};

export const MaterialsPanel: React.FC<{ items: Material[]; meetings: Meeting[] }> = ({ items, meetings }) => {
  const label = (id?: string) => {
    const i = meetings.findIndex(s => s.id === id);
    return i < 0 ? undefined : `zajęcia ${i + 1}: ${meetings[i].topic} (${fmtShort(meetings[i].date)})`;
  };
  return (
    <div className="p-4 space-y-2">
      {items.map(m => <MaterialRow key={m.id} m={m} meetingLabel={label(m.meetingId)} />)}
      <p className="pt-1 text-xs text-mut2">Każdy materiał jest przypięty do zajęć — widać go też w kalendarzu po kliknięciu dnia. PDF i obrazy trzymamy u siebie, filmy i nagrania zawsze jako link.</p>
    </div>
  );
};

/* ---------- Admin: wpuszczanie, dodawanie, usuwanie ---------- */
export const MembersPanel: React.FC<{
  members: Member[]; onSetStatus: (id: string, s: MembershipStatus) => void;
  onAdd: (name: string, email: string) => void; selfId: string;
  usage: Record<string, number>;
  /** Faza 2: admin nadaje imię (rozróżnienie przy dwóch „Aniach”). */
  onRename?: (id: string, name: string) => void;
  /** Faza 2: zatwierdzenie/odrzucenie imienia zaproponowanego przez uczestnika. */
  onNameDecision?: (id: string, accept: boolean) => void;
}> = ({ members, onSetStatus, onAdd, selfId, usage, onRename, onNameDecision }) => {
  const nameKey = (s: string) => s.trim().toLocaleLowerCase('pl-PL');
  const takenBy = (m: Member) => members.find(x => x.id !== m.id && x.status === 'approved' && nameKey(x.name) === nameKey(m.name));
  const rename = (m: Member) => {
    const v = prompt(`Nowe imię dla „${m.name}” (np. z inicjałem: „${m.name.split(' ')[0]} K.”):`, m.name);
    if (v && v.trim() && v.trim() !== m.name && onRename) onRename(m.id, v.trim());
  };
  const proposals = members.filter(m => m.pendingName);
  const groupBytes = Object.values(usage).reduce((s, b) => s + b, 0);
  const pending = members.filter(m => m.status === 'pending');
  const approved = members.filter(m => m.status === 'approved');
  const removed = members.filter(m => m.status === 'removed' || m.status === 'blocked');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !email.trim()) return;
    onAdd(name, email); setName(''); setEmail('');
  };
  const inp = 'flex-1 min-w-[9rem] bg-surf border border-line rounded-full px-3 py-1.5 text-sm text-fg placeholder:text-mut2 focus:outline-none focus:border-sky-400/40';

  return (
    <div className="p-4 space-y-5">
      <p className="flex items-center gap-1.5 text-xs text-mut2"><Shield className="w-3.5 h-3.5" />Ten panel widzi tylko admin. Uczestnicy go nie widzą.</p>
      <div className="rounded-xl bg-surf border border-line p-3">
        <div className="flex items-baseline justify-between text-sm"><span className="font-semibold text-fg">Pliki całej grupy</span><span className="text-fg2">{fmtSize(groupBytes)} z 1 GB</span></div>
        <div className="mt-1.5 h-2 rounded-full bg-surf2 overflow-hidden"><div className="h-full bg-sky-400" style={{ width: `${Math.min(100, (groupBytes / (1024 * 1024 * 1024)) * 100)}%` }} /></div>
        <p className="mt-1.5 text-xs text-mut">Darmowe konto Supabase grupy = 1 GB. Limit 40 MB na osobę × do 20 osób = maks. 800 MB.</p>
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-warn font-semibold">
          <Clock className="w-3.5 h-3.5" /> Czekają na wpuszczenie ({pending.length})
        </div>
        {pending.length === 0 && <p className="mt-2 text-sm text-mut2">Nikt nie czeka.</p>}
        <ul className="mt-2 space-y-1.5">
          {pending.map(m => (
            <li key={m.id} className={`${card} flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2`}>
              <span className="flex-1 min-w-[10rem] text-sm text-fg">{m.name}
                <span className="block text-xs text-mut2">{m.email ? `${m.email} · ` : ''}zgłoszenie {m.joinedAt ? fmtRelative(m.joinedAt) : ''}</span>
                {takenBy(m) && <span className="block text-xs text-warn">W grupie jest już „{takenBy(m)!.name}” — nadaj rozróżnienie przed wpuszczeniem.</span>}
              </span>
              {onRename && <button onClick={() => rename(m)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surf text-fg2 border border-line hover:bg-surf2 cursor-pointer"><Pencil className="w-3.5 h-3.5" />Imię</button>}
              <button onClick={() => onSetStatus(m.id, 'approved')} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-ok border border-emerald-400/30 hover:bg-emerald-500/30 cursor-pointer"><Check className="w-3.5 h-3.5" />Wpuść</button>
              <button onClick={() => onSetStatus(m.id, 'blocked')} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surf text-fg2 border border-line hover:bg-surf2 cursor-pointer"><X className="w-3.5 h-3.5" />Odrzuć</button>
            </li>
          ))}
        </ul>
      </div>

      {proposals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-warn font-semibold"><Pencil className="w-3.5 h-3.5" /> Prośby o zmianę imienia ({proposals.length})</div>
          <ul className="mt-2 space-y-1.5">
            {proposals.map(m => (
              <li key={m.id} className={`${card} flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2`}>
                <span className="flex-1 min-w-[10rem] text-sm text-fg">„{m.name}” chce się nazywać <strong>„{m.pendingName}”</strong>
                  <span className="block text-xs text-mut2">Do czasu zatwierdzenia grupa widzi stare imię.</span>
                </span>
                <button onClick={() => onNameDecision?.(m.id, true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-ok border border-emerald-400/30 hover:bg-emerald-500/30 cursor-pointer"><Check className="w-3.5 h-3.5" />Zatwierdź</button>
                <button onClick={() => onNameDecision?.(m.id, false)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surf text-fg2 border border-line hover:bg-surf2 cursor-pointer"><X className="w-3.5 h-3.5" />Odrzuć</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-widest text-mut font-semibold">W grupie ({approved.length})</div>
        <ul className="mt-2 space-y-0.5">
          {approved.map(m => (
            <li key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surf">
              <Avatar emoji={m.emoji} color={m.color} photo={m.photo} size={26} />
              <span className="flex-1 min-w-0 text-sm text-fg truncate">
                {m.name}
                {m.role === 'therapist' && <span className="ml-1.5 text-xs text-acc">prowadząca</span>}
                {m.id === selfId && <span className="ml-1.5 text-xs text-mut2">(Ty)</span>}
                {m.email && <span className="block text-xs text-mut2 truncate">{m.email}</span>}
                <span className="mt-1 flex items-center gap-2">
                  <span className="w-24 h-1.5 rounded-full bg-surf2 overflow-hidden"><span className={`block h-full ${(usage[m.id] ?? 0) > MAX_USER_TOTAL * 0.8 ? 'bg-amber-400' : 'bg-sky-400'}`} style={{ width: `${Math.min(100, ((usage[m.id] ?? 0) / MAX_USER_TOTAL) * 100)}%` }} /></span>
                  <span className="text-xs text-mut">pliki {fmtSize(usage[m.id] ?? 0)} / 40 MB</span>
                </span>
              </span>
              {onRename && <button onClick={() => rename(m)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full text-fg2 border border-line hover:bg-surf2 cursor-pointer" title="Zmień imię"><Pencil className="w-3.5 h-3.5" /><span className="hidden sm:inline">Imię</span></button>}
              {m.role !== 'therapist' && m.id !== selfId && (
                <button
                  onClick={() => { if (confirm(`Usunąć „${m.name}” z grupy? Straci dostęp do wszystkiego w grupie.`)) onSetStatus(m.id, 'removed'); }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-full text-bad border border-rose-400/25 hover:bg-rose-500/10 cursor-pointer" title="Usuń z grupy">
                  <UserMinus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Usuń</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <span className="w-full text-xs uppercase tracking-widest text-mut font-semibold">Dodaj osobę</span>
        <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Imię lub pseudonim" maxLength={40} aria-label="Imię nowej osoby" />
        <input className={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e-mail (Google lub inny)" maxLength={120} aria-label="E-mail nowej osoby" />
        <button type="submit" className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-sky-500/20 text-acc border border-sky-400/30 hover:bg-sky-500/30 cursor-pointer"><UserPlus className="w-3.5 h-3.5" />Dodaj</button>
      </form>

      {removed.length > 0 && (
        <details>
          <summary className="text-xs text-mut cursor-pointer">Usunięci i odrzuceni ({removed.length})</summary>
          <ul className="mt-1.5 space-y-1">
            {removed.map(m => (
              <li key={m.id} className="flex items-center gap-2 text-sm text-mut px-2 py-1">
                <span className="flex-1">{m.name}</span>
                <button onClick={() => onSetStatus(m.id, 'approved')} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-line hover:bg-surf2 cursor-pointer"><Undo2 className="w-3 h-3" />Przywróć</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
