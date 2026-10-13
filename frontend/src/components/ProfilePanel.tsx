// PATH: src/components/ProfilePanel.tsx | REQ-ID: TERAPIA-PROFILE-UI-01
import React, { useEffect, useRef, useState } from 'react';
import { Camera, Eye, EyeOff, Lock, Trash2 } from 'lucide-react';
import { Profile, publicView, shrinkImage } from '../services/profile';
import { AVATAR_COLORS as COLORS, AVATAR_EMOJIS as EMOJIS } from '../config/ui.config';
import { validateFirstName } from './Onboarding';

/** Awatar: miniatura zdjęcia albo ikonka. Obraz, który nie jest miniaturą (> 1024 px — wpisany z pominięciem aplikacji)
 *  albo się nie wczyta, zastępujemy ikonką (adwersarz 13.10 D1). */
export const Avatar: React.FC<{ emoji?: string; color?: string; photo?: string; size?: number }> = ({ emoji = '🙂', color = '#94a3b8', photo, size = 28 }) => {
  const [bad, setBad] = useState<string | null>(null);
  return photo && bad !== photo
    ? <img src={photo} alt="" decoding="async" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }}
        onError={() => setBad(photo)} onLoad={e => { const i = e.currentTarget; if (i.naturalWidth > 1024 || i.naturalHeight > 1024) setBad(photo); }} />
    : <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: `${color}33`, border: `1px solid ${color}66`, fontSize: size * 0.55 }}>{emoji}</span>;
};

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
    className={`tap inline-flex items-center gap-1.5 text-sm px-3.5 min-h-11 rounded-full border cursor-pointer ${on ? 'bg-emerald-500/15 border-emerald-400/30 text-ok' : 'bg-surf border-line text-mut'}`}>
    {on ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}{on ? `${label}: grupa widzi` : `${label}: tylko Ty i prowadząca`}
  </button>
);

const input = 'w-full bg-surf border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-mut2 focus:outline-none focus:border-sky-400/40';
const label = 'block text-xs uppercase tracking-widest text-mut font-semibold mb-1.5';

export const ProfilePanel: React.FC<{ profile: Profile; saving?: boolean; onChange: (p: Profile) => void; onClear: () => void; isDemo: boolean }> = ({ profile: p, saving, onChange, onClear, isDemo }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  // Imię: pole żyje lokalnie, do profilu (i bazy) idzie dopiero po wyjściu z pola — nie każda litera jako propozycja
  // dla admina (adwersarz 13.10 W3). Spoza pola (np. admin zatwierdził) — pole bierze nowe imię, gdy nie piszesz.
  const [nameText, setNameText] = useState(p.pseudonym);
  const [nameFocus, setNameFocus] = useState(false);
  useEffect(() => { if (!nameFocus) setNameText(p.pseudonym); }, [p.pseudonym, nameFocus]);
  const set = (patch: Partial<Profile>) => onChange({ ...p, ...patch });
  const pub = publicView(p);

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setErr(''); set({ photoDataUrl: await shrinkImage(f), avatarKind: 'photo' }); }
    catch (x) { setErr((x as Error).message); }
  };

  return (
    <div className="p-4 grid gap-5 sm:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <div>
          <label className={label} htmlFor="pseudo">Imię (wymagane — widzi je grupa)</label>
          <input id="pseudo" className={input} maxLength={30} value={nameText} onFocus={() => setNameFocus(true)} onChange={e => setNameText(e.target.value)}
            onBlur={e => { setNameFocus(false); const v = e.target.value.trim(); if (validateFirstName(v)) setNameText(p.pseudonym); else if (v !== p.pseudonym) set({ pseudonym: v }); }} />
          <p className="mt-1 text-xs text-mut2">Minimum, które widzi grupa: imię (może być zdrobnienie). Reszta — tylko jeśli sam(a) włączysz.</p>
        </div>

        <div>
          <span className={label}>Awatar</span>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map(em => (
              <button key={em} type="button" onClick={() => set({ emoji: em, avatarKind: 'emoji' })}
                className={`w-11 h-11 rounded-full text-xl cursor-pointer border ${p.emoji === em ? 'border-sky-300/70 bg-surf2' : 'border-line bg-surf hover:bg-surf2'}`}>{em}</button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button key={c} type="button" aria-label={`Kolor ${c}`} onClick={() => set({ color: c })}
                className={`w-10 h-10 rounded-full cursor-pointer ${p.color === c ? 'ring-2 ring-fg/60' : ''}`} style={{ background: c }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="tap flex items-center gap-1.5 text-sm px-3.5 min-h-11 rounded-full bg-surf border border-line text-fg2 hover:bg-surf2 cursor-pointer">
              <Camera className="w-4 h-4" /> {p.photoDataUrl ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          </div>
          {err && <p className="mt-1 text-sm text-bad">{err}</p>}
          {p.photoDataUrl && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-mut">
              <Avatar photo={p.photoDataUrl} size={44} />
              <Toggle on={p.show.photo} onChange={v => set({ show: { ...p.show, photo: v } })} label="Zdjęcie" />
              <button type="button" onClick={() => set({ photoDataUrl: undefined, avatarKind: 'emoji', show: { ...p.show, photo: false } })} className="tap min-h-11 px-2 underline cursor-pointer">Usuń zdjęcie</button>
            </div>
          )}
          <p className="mt-1 text-xs text-mut2">Zdjęcie zmniejszamy w telefonie do małej miniatury — duży plik nigdzie nie wychodzi. Bez zdjęcia grupa widzi ikonkę.</p>
        </div>

        <div>
          <label className={label} htmlFor="realname">Imię i nazwisko</label>
          <input id="realname" className={input} maxLength={60} value={p.realName} placeholder="nieobowiązkowe" onChange={e => set({ realName: e.target.value })} />
          <div className="mt-1.5"><Toggle on={p.show.realName} onChange={v => set({ show: { ...p.show, realName: v } })} label="Imię" /></div>
        </div>

        <div>
          <label className={label} htmlFor="about">Kilka słów o mnie</label>
          <textarea id="about" className={`${input} resize-none`} rows={3} maxLength={300} value={p.about} placeholder="nieobowiązkowe" onChange={e => set({ about: e.target.value })} />
          <div className="mt-1.5"><Toggle on={p.show.about} onChange={v => set({ show: { ...p.show, about: v } })} label="Opis" /></div>
          <p className="mt-1 text-xs text-mut2">Grupa widzi Twój profil po stuknięciu w Twoje imię lub ikonkę w czacie.</p>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl bg-surf border border-line p-3">
          <div className="text-xs uppercase tracking-widest text-mut2 font-semibold mb-2">Tak widzi Cię grupa</div>
          <div className="flex items-center gap-2.5">
            <Avatar emoji={p.emoji} color={p.color} photo={pub.usePhoto ? p.photoDataUrl : undefined} size={40} />
            <span className="text-sm font-semibold text-fg break-words">{pub.name}</span>
          </div>
          {pub.about && <p className="mt-2 text-xs text-fg2 whitespace-pre-line">{pub.about}</p>}
        </div>

        <div className="rounded-xl bg-surf border border-line p-3 text-xs text-mut space-y-2">
          <div className="flex items-center gap-1.5 text-fg2 font-semibold"><Lock className="w-3.5 h-3.5" /> Twoje dane{saving && <span className="ml-auto font-normal text-mut" role="status">Zapisuję…</span>}</div>
          <p>{isDemo ? 'W demo profil jest zapisany tylko w tej przeglądarce i nigdzie nie jest wysyłany.' : 'Grupa widzi tylko to, co włączysz. Prowadząca (admin) widzi cały Twój profil.'}</p>
          <p>Twój prywatny dzienniczek samoobserwacji jest osobny — członkostwo w grupie nie daje do niego dostępu.</p>
          {isDemo && (
            <button type="button" onClick={() => { if (confirm('Usunąć profil zapisany w tej przeglądarce?')) onClear(); }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-400/20 text-bad hover:bg-rose-500/20 cursor-pointer">
              <Trash2 className="w-3 h-3" /> Wyczyść mój profil
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};
