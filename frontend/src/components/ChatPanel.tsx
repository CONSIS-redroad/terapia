// PATH: src/components/ChatPanel.tsx | REQ-ID: TERAPIA-CHAT-02
// Czat „trochę jak WhatsApp” (Bartek 08.10): odpowiedź na wiadomość, reakcje emotkami, panel emotek,
// załączniki (20 MB/plik, 40 MB/osobę), admin usuwa pliki, ogłoszenia prowadzącej przypięte na górze.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerUpLeft, Download, File as FileIcon, FileText, Film, Image as ImageIcon, Music, Paperclip, Pin, Send, Smile, Trash2, X } from 'lucide-react';
import type { Announcement, Attachment, Member, Message } from '../types/group';
import { fmtRelative } from '../services/format';
import { ACCEPT, checkFile, fmtSize, MAX_USER_TOTAL, toAttachment } from '../services/files';
import { Avatar } from './ProfilePanel';

const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EMOJI = ['😊', '🙂', '😉', '😄', '😂', '🥲', '😅', '😌', '🤗', '🤔', '😮', '😢', '😭', '😔', '😤', '😴', '🥰', '😍',
  '👍', '👎', '👏', '🙏', '💪', '🤝', '👋', '✌️', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '✨', '🌸', '🌿', '☀️', '🌧️', '🍵', '🎉', '✅', '❓'];

interface Props {
  messages: Message[]; members: Member[]; announcements: Announcement[];
  currentUserId: string; isAdmin: boolean; isDemo: boolean;
  onSend: (body: string, opts: { replyTo?: string; attachment?: Attachment }) => void;
  onReact: (id: string, emoji: string) => void;
  onDeleteAttachment: (id: string, by: 'admin' | 'author') => void;
  onDeleteMessage: (id: string, by: 'admin' | 'author', reason?: string) => void;
}

const nameOf = (members: Member[], id: string) => members.find(m => m.id === id)?.name ?? 'Uczestnik';

const FileChip: React.FC<{ a: Attachment; mine: boolean }> = ({ a, mine }) => {
  const Icon = a.kind === 'pdf' || a.kind === 'txt' ? FileText : a.kind === 'video' ? Film : a.kind === 'audio' ? Music : a.kind === 'image' ? ImageIcon : FileIcon;
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}
      onClick={e => { if (a.url.startsWith('#demo')) { e.preventDefault(); alert(a.url === '#demo-wygasl' ? 'Demo — plik był tylko w tej karcie do odświeżenia strony.' : 'Demo — plik przykładowy, nie ma go naprawdę.'); } }}
      className={`mt-1 flex items-center gap-2.5 p-2 rounded-xl border ${mine ? 'border-sky-400/30 bg-sky-500/10' : 'border-line bg-surf2'}`}>
      <span className="w-10 h-10 rounded-lg bg-surf flex items-center justify-center shrink-0 text-acc"><Icon className="w-5 h-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg truncate">{a.name}</span>
        <span className="block text-xs text-mut">{a.kind.toUpperCase()} · {fmtSize(a.size)}</span>
      </span>
      <Download className="w-4 h-4 text-mut shrink-0" />
    </a>
  );
};

export const ChatPanel: React.FC<Props> = ({ messages, members, announcements, currentUserId, isAdmin, isDemo, onSend, onReact, onDeleteAttachment, onDeleteMessage }) => {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);   // wiadomość z otwartymi akcjami
  const [flash, setFlash] = useState<string | null>(null);     // podświetlenie po skoku do cytatu
  const [zoom, setZoom] = useState<string | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const used = useMemo(() => messages.filter(m => m.authorId === currentUserId && m.attachment && !m.attachmentDeleted)
    .reduce((s, m) => s + (m.attachment?.size ?? 0), 0), [messages, currentUserId]);
  const pinned = useMemo(() => [...announcements].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date)), [announcements]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages.length]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el || !listRef.current) return;
    listRef.current.scrollTo({ top: el.offsetTop - 60, behavior: 'smooth' });
    setFlash(id); setTimeout(() => setFlash(null), 1600);
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const problem = checkFile(f, used);
    if (problem) { setErr(problem); setFile(null); return; }
    setErr(''); setFile(f);
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && !file) return;
    if (file) { const problem = checkFile(file, used); if (problem) { setErr(problem); return; } }
    onSend(text, { replyTo: replyTo ?? undefined, attachment: file ? toAttachment(file) : undefined });
    setText(''); setFile(null); setReplyTo(null); setErr(''); setEmojiOpen(false);
  };

  const addEmoji = (em: string) => {
    const el = inputRef.current;
    const pos = el?.selectionStart ?? text.length;
    setText(t => t.slice(0, pos) + em + t.slice(pos));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + em.length, pos + em.length); });
  };

  const replyMsg = replyTo ? messages.find(m => m.id === replyTo) : undefined;

  return (
    <div className="flex flex-col">
      {/* przypięte ogłoszenia prowadzącej */}
      {pinned.length > 0 && (
        <div className="mx-3 mt-1 mb-1 rounded-xl border border-amber-300/30 bg-amber-400/10">
          <button onClick={() => setPinsOpen(v => !v)} aria-expanded={pinsOpen} className="tap w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer">
            <Pin className="w-4 h-4 text-warn shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-xs uppercase tracking-wider text-warn font-semibold">Przypięte ogłoszenia · {pinned.length}</span>
              {!pinsOpen && <span className="block text-sm text-fg truncate">{pinned[0].title}</span>}
            </span>
          </button>
          {pinsOpen && (
            <ul className="px-3 pb-3 space-y-2">
              {pinned.map(a => (
                <li key={a.id} className="rounded-lg bg-surf border border-line p-2.5">
                  <div className="text-xs text-mut">{nameOf(members, a.authorId)} · {fmtRelative(a.date)}</div>
                  <div className="text-sm font-bold text-fg">{a.title}</div>
                  <div className="text-sm text-fg2 whitespace-pre-line">{a.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* wiadomości */}
      <div ref={listRef} className="relative h-[min(60dvh,560px)] overflow-y-auto overflow-x-hidden px-3 py-3 space-y-2.5" onClick={() => setActive(null)}>
        {messages.map(m => {
          const mine = m.authorId === currentUserId;
          const a = members.find(x => x.id === m.authorId);
          const quoted = m.replyTo ? messages.find(x => x.id === m.replyTo) : undefined;
          const reacts = Object.entries(m.reactions ?? {}).filter(([, ids]) => ids.length > 0);
          const canDeleteFile = !!m.attachment && !m.attachmentDeleted && !m.deleted && (isAdmin || mine);
          if (m.deleted) {
            return (
              <div key={m.id} id={`msg-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[82%] rounded-2xl px-3.5 py-2 border border-dashed border-line text-sm italic text-mut">
                  🚫 Wiadomość usunięta{m.deleted.by === 'admin' ? ' przez prowadzącą — niezgodna z zasadami grupy' : ' przez autora'}{m.deleted.reason ? ` (${m.deleted.reason})` : ''}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} id={`msg-${m.id}`} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine && <Avatar emoji={a?.emoji} color={a?.color} photo={a?.photo} size={30} />}
              <div className={`max-w-[82%] min-w-0 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  onClick={e => { e.stopPropagation(); setActive(active === m.id ? null : m.id); }}
                  className={`max-w-full min-w-0 overflow-hidden rounded-2xl px-3.5 py-2 cursor-pointer transition-shadow ${mine ? 'bg-sky-500/20 border border-sky-400/25 rounded-br-md' : 'bg-surf border border-line rounded-bl-md'} ${flash === m.id ? 'ring-2 ring-amber-400' : ''}`}>
                  <div className="text-xs text-mut mb-0.5">{mine ? 'Ty' : nameOf(members, m.authorId)} · {fmtRelative(m.date)}</div>
                  {quoted && (
                    <button onClick={e => { e.stopPropagation(); jumpTo(quoted.id); }}
                      className="mb-1.5 block w-full min-w-0 max-w-full overflow-hidden text-left border-l-4 border-sky-400/70 bg-black/5 rounded-md px-2 py-1 cursor-pointer">
                      <span className="block text-xs font-semibold text-acc">{quoted.authorId === currentUserId ? 'Ty' : nameOf(members, quoted.authorId)}</span>
                      <span className="block text-sm text-fg2 truncate">{quoted.body || (quoted.attachment ? `📎 ${quoted.attachment.name}` : '…')}</span>
                    </button>
                  )}
                  {m.attachment && !m.attachmentDeleted && (
                    m.attachment.kind === 'image'
                      ? <button onClick={e => { e.stopPropagation(); setZoom(m.attachment!.url); }} className="block mt-1 cursor-zoom-in"><img src={m.attachment.url} alt={m.attachment.name} className="block w-60 max-w-full h-auto max-h-72 object-cover rounded-xl border border-line" /></button>
                      : m.attachment.kind === 'video'
                        ? <video src={m.attachment.url} controls playsInline preload="metadata" className="mt-1 block w-64 max-w-full max-h-72 rounded-xl border border-line" onClick={e => e.stopPropagation()} />
                        : <FileChip a={m.attachment} mine={mine} />
                  )}
                  {m.attachmentDeleted && <div className="mt-1 text-sm italic text-mut">🗑 Plik usunięty{m.attachmentDeleted === 'admin' ? ' przez prowadzącą' : ''}</div>}
                  {/* tekst renderowany jako tekst — nigdy jako HTML */}
                  {m.body && <div className="text-base lg:text-sm text-fg whitespace-pre-line break-words">{m.body}</div>}
                </div>
                {reacts.length > 0 && (
                  <div className={`-mt-1.5 flex flex-wrap gap-1 ${mine ? 'justify-end pr-2' : 'pl-2'}`}>
                    {reacts.map(([em, ids]) => (
                      <button key={em} onClick={() => onReact(m.id, em)} title={ids.map(id => (id === currentUserId ? 'Ty' : nameOf(members, id))).join(', ')}
                        className={`px-1.5 h-7 rounded-full text-sm border shadow-sm cursor-pointer ${ids.includes(currentUserId) ? 'bg-sky-500/20 border-sky-400/40' : 'bg-head border-line'}`}>
                        {em}{ids.length > 1 ? <span className="ml-0.5 text-xs text-fg2">{ids.length}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
                {active === m.id && (
                  <div className="mt-1 flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-head border border-line shadow-lg" onClick={e => e.stopPropagation()}>
                    {QUICK.map(em => (
                      <button key={em} onClick={() => { onReact(m.id, em); setActive(null); }} className="w-10 h-10 text-xl rounded-full hover:bg-surf2 cursor-pointer" aria-label={`Reakcja ${em}`}>{em}</button>
                    ))}
                    <button onClick={() => { setReplyTo(m.id); setActive(null); inputRef.current?.focus(); }} className="tap flex items-center gap-1 px-3 rounded-full text-sm text-fg hover:bg-surf2 cursor-pointer"><CornerUpLeft className="w-4 h-4" />Odpowiedz</button>
                    {canDeleteFile && (
                      <button onClick={() => { if (confirm(`Usunąć plik „${m.attachment!.name}”?`)) { onDeleteAttachment(m.id, isAdmin && !mine ? 'admin' : 'author'); setActive(null); } }}
                        className="tap flex items-center gap-1 px-3 rounded-full text-sm text-bad hover:bg-rose-500/10 cursor-pointer"><Trash2 className="w-4 h-4" />Usuń plik</button>
                    )}
                    {(isAdmin || mine) && (
                      <button onClick={() => {
                        if (isAdmin && !mine) {
                          const reason = prompt('Usunąć wiadomość niezgodną z zasadami grupy? Możesz podać krótki powód (widoczny dla grupy) albo zostawić puste.', 'obraźliwa treść');
                          if (reason !== null) { onDeleteMessage(m.id, 'admin', reason.trim() || undefined); setActive(null); }
                        } else if (confirm('Usunąć tę wiadomość?')) { onDeleteMessage(m.id, 'author'); setActive(null); }
                      }} className="tap flex items-center gap-1 px-3 rounded-full text-sm text-bad hover:bg-rose-500/10 cursor-pointer">
                        <Trash2 className="w-4 h-4" />{isAdmin && !mine ? 'Usuń wiadomość (zasady)' : 'Usuń wiadomość'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {mine && <Avatar emoji={a?.emoji} color={a?.color} photo={a?.photo} size={30} />}
            </div>
          );
        })}
      </div>

      {/* pisanie */}
      <div className="border-t border-line p-2.5 space-y-2">
        {replyMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-surf border-l-4 border-sky-400/70 px-3 py-1.5">
            <CornerUpLeft className="w-4 h-4 text-acc shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-acc">Odpowiedź do: {replyMsg.authorId === currentUserId ? 'Ty' : nameOf(members, replyMsg.authorId)}</span>
              <span className="block text-sm text-fg2 truncate">{replyMsg.body || replyMsg.attachment?.name}</span>
            </span>
            <button onClick={() => setReplyTo(null)} className="tap w-10 flex items-center justify-center text-mut cursor-pointer" aria-label="Anuluj odpowiedź"><X className="w-4 h-4" /></button>
          </div>
        )}
        {file && (
          <div className="flex items-center gap-2 rounded-xl bg-surf border border-line px-3 py-1.5">
            <Paperclip className="w-4 h-4 text-acc shrink-0" />
            <span className="flex-1 min-w-0 text-sm text-fg truncate">{file.name} · {fmtSize(file.size)}</span>
            <button onClick={() => setFile(null)} className="tap w-10 flex items-center justify-center text-mut cursor-pointer" aria-label="Usuń załącznik"><X className="w-4 h-4" /></button>
          </div>
        )}
        {err && <p className="text-sm text-bad px-1">{err}</p>}
        {emojiOpen && (
          <div className="grid grid-cols-9 gap-0.5 p-1.5 rounded-xl bg-surf border border-line max-h-40 overflow-y-auto">
            {EMOJI.map(em => <button key={em} onClick={() => addEmoji(em)} className="h-10 text-xl rounded-lg hover:bg-surf2 cursor-pointer" aria-label={em}>{em}</button>)}
          </div>
        )}
        <form onSubmit={submit} className="flex items-end gap-1.5">
          <button type="button" onClick={() => setEmojiOpen(v => !v)} aria-pressed={emojiOpen} className={`tap w-11 h-11 shrink-0 flex items-center justify-center rounded-full cursor-pointer ${emojiOpen ? 'text-acc bg-sky-500/15' : 'text-mut hover:bg-surf2'}`} aria-label="Emotki"><Smile className="w-5 h-5" /></button>
          <button type="button" onClick={() => fileRef.current?.click()} className="tap w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-mut hover:bg-surf2 cursor-pointer" aria-label="Dołącz plik"><Paperclip className="w-5 h-5" /></button>
          <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={pickFile} />
          <textarea ref={inputRef} rows={1} value={text} maxLength={2000}
            onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 1024px)').matches) { e.preventDefault(); submit(); } }}
            placeholder="Wiadomość" aria-label="Wiadomość do grupy"
            className="flex-1 min-w-0 resize-none bg-surf border border-line rounded-3xl px-4 py-2.5 text-base text-fg placeholder:text-mut2 focus:outline-none focus:border-sky-400/40" />
          <button type="submit" disabled={!text.trim() && !file} className="tap w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-sky-500/30 text-acc border border-sky-400/40 disabled:opacity-30 cursor-pointer" aria-label="Wyślij"><Send className="w-5 h-5" /></button>
        </form>
        <div className="flex items-center gap-2 px-1">
          <div className="flex-1 h-1.5 rounded-full bg-surf2 overflow-hidden" aria-hidden="true"><div className="h-full bg-sky-400" style={{ width: `${Math.min(100, (used / MAX_USER_TOTAL) * 100)}%` }} /></div>
          <span className="text-xs text-mut">Twoje pliki: {fmtSize(used)} / 40 MB · do 20 MB na plik</span>
        </div>
        {isDemo && <p className="px-1 text-xs text-mut2">Demo: wiadomości i pliki zostają tylko w tej przeglądarce (pliki — do odświeżenia strony).</p>}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[90] bg-black/85 flex items-center justify-center p-3" onClick={() => setZoom(null)} role="dialog" aria-label="Zdjęcie">
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
};
