// PATH: src/components/SettingsModal.tsx | REQ-ID: TERAPIA-SETTINGS-01 (układ z Luna2: zakładki w oknie)
import React, { useEffect, useState } from 'react';
import { Bell, Database, Eye, EyeOff, Image as ImageIcon, LayoutGrid, Lock, Monitor, Moon, RotateCcw, Settings, Sun, Trash2, User, X } from 'lucide-react';
import { ProfilePanel } from './ProfilePanel';
import { NotificationSettings } from './NotificationSettings';
import type { Profile } from '../services/profile';
import { THEMES } from '../themes';
import type { WallpaperSettings } from '../hooks/useWallpaper';
import type { ThemeMode } from '../hooks/useTheme';
import type { PanelConfig, PanelId } from '../types/panelLayout';
import { APP_VERSION } from '../services/appUpdate';

type Tab = 'profile' | 'look' | 'notif' | 'panels' | 'data';

interface Props {
  initialTab?: Tab;
  onClose: () => void;
  profile: Profile; onProfile: (p: Profile) => void; onClearProfile: () => void;
  mode: ThemeMode; onMode: (m: ThemeMode) => void;
  wallpaper: WallpaperSettings; onWallpaper: (w: WallpaperSettings) => void; onResetWallpaper: () => void;
  panels: PanelConfig[]; onTogglePanel: (id: PanelId) => void; onResetPanels: () => void;
  isDemo: boolean; onResetDemo: () => void;
  isAdmin?: boolean; groupName?: string;
  /** Faza 2, tylko admin: usuń całą grupę (potwierdzenie = nazwa grupy). */
  onWipeGroup?: (confirmName: string) => Promise<void>;
}

/** Strefa niebezpieczna admina: usunięcie CAŁEJ grupy po wpisaniu jej nazwy (nie „usuń moje konto” — Bartek 08.10). */
const WipeGroup: React.FC<{ groupName: string; onWipe: (n: string) => Promise<void> }> = ({ groupName, onWipe }) => {
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ok = txt.trim() === groupName.trim() && groupName.trim() !== '';
  return (
    <div className="p-3 rounded-xl border border-rose-400/30 bg-rose-500/5 space-y-2">
      <span className="flex items-center gap-1.5 font-semibold text-bad text-sm"><Trash2 className="w-4 h-4" />Usuń całą grupę</span>
      <p>Kasuje wszystkie wiadomości, pliki, zajęcia, materiały, prace domowe i listę uczestników. Zostaje tylko lista adminów i same konta logowania. <strong className="text-fg">Nie da się tego cofnąć.</strong></p>
      <label className="block text-mut" htmlFor="wipe-confirm">Żeby potwierdzić, wpisz nazwę grupy: <strong className="text-fg">{groupName}</strong></label>
      <input id="wipe-confirm" value={txt} onChange={e => setTxt(e.target.value)} autoComplete="off"
        className="tap w-full rounded-xl border border-line bg-surf px-3 text-base text-fg" />
      <button disabled={!ok || busy}
        onClick={async () => { setErr(''); setBusy(true); try { await onWipe(txt); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); } }}
        className="tap flex items-center gap-1.5 px-4 rounded-xl bg-rose-500/15 border border-rose-400/40 text-bad font-semibold hover:bg-rose-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
        <Trash2 className="w-4 h-4" />{busy ? 'Usuwam…' : 'Usuń grupę na zawsze'}
      </button>
      {err && <p role="alert" className="text-bad">{err}</p>}
    </div>
  );
};

const row = 'flex items-center justify-between gap-3 p-3 rounded-xl border border-line bg-surf';
const pill = (on: boolean) => `px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${on ? 'bg-sky-500/20 text-acc border-sky-400/30' : 'bg-surf text-mut border-line hover:bg-surf2'}`;

export const SettingsModal: React.FC<Props> = (p) => {
  const [tab, setTab] = useState<Tab>(p.initialTab ?? 'profile');
  const w = p.wallpaper;
  const setW = (patch: Partial<WallpaperSettings>) => p.onWallpaper({ ...w, ...patch });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') p.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  const tabs = [
    { id: 'profile' as const, label: 'Profil', icon: User },
    { id: 'look' as const, label: 'Wygląd', icon: ImageIcon },
    { id: 'notif' as const, label: 'Powiadomienia', short: 'Powiad.', icon: Bell },
    { id: 'panels' as const, label: 'Panele', icon: LayoutGrid },
    { id: 'data' as const, label: 'Dane', icon: Database },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4" onClick={p.onClose}>
      <div role="dialog" aria-modal="true" aria-label="Ustawienia"
        className="bg-panel backdrop-blur-2xl border border-line sm:rounded-2xl rounded-t-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col text-fg"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-mut" /><h3 className="font-bold text-sm">Ustawienia</h3></div>
          <button onClick={p.onClose} className="p-1 rounded-lg hover:bg-surf2 text-mut cursor-pointer" aria-label="Zamknij"><X className="w-4 h-4" /></button>
        </div>

        {/* 5 zakładek: na wąskim telefonie ikona nad krótką etykietą, w razie czego przewijanie w poziomie */}
        <div role="tablist" className="shrink-0 flex gap-1 mx-3 sm:mx-5 my-3 p-1 rounded-xl bg-surf border border-line overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} title={t.label}
              className={`tap flex-1 min-w-[3.75rem] shrink-0 py-1.5 px-1.5 sm:px-2 rounded-lg text-xs font-semibold cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 whitespace-nowrap ${tab === t.id ? 'bg-surf2 text-fg shadow-sm' : 'text-mut hover:text-fg'}`}>
              <t.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="sm:hidden">{'short' in t ? t.short : t.label}</span><span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-1 pb-4">
          {tab === 'profile' && <ProfilePanel profile={p.profile} onChange={p.onProfile} onClear={p.onClearProfile} isDemo={p.isDemo} />}

          {tab === 'look' && (
            <div className="px-4 space-y-4">
              <div className={row}>
                <span className="text-xs font-semibold text-fg2">Motyw</span>
                <div className="flex gap-1">
                  <button className={pill(p.mode === 'system')} onClick={() => p.onMode('system')}><Monitor className="w-3.5 h-3.5 inline mr-1" />Jak urządzenie</button>
                  <button className={pill(p.mode === 'light')} onClick={() => p.onMode('light')}><Sun className="w-3.5 h-3.5 inline mr-1" />Jasny</button>
                  <button className={pill(p.mode === 'dark')} onClick={() => p.onMode('dark')}><Moon className="w-3.5 h-3.5 inline mr-1" />Ciemny</button>
                </div>
              </div>

              <div>
                <span className="block text-xs uppercase tracking-widest text-mut font-semibold mb-2">Tapeta</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => setW({ themeId: t.id })} aria-pressed={w.themeId === t.id}
                      className={`p-2 rounded-xl border text-left cursor-pointer flex flex-col gap-1.5 ${w.themeId === t.id ? 'border-sky-400/60 bg-surf2' : 'border-line bg-surf hover:bg-surf2'}`}>
                      <span className="w-full h-16 rounded-lg overflow-hidden relative" style={{ background: t.preview }}>
                        <span className="absolute inset-0"><t.Scene dark={false} /></span>
                      </span>
                      <span className="text-xs font-semibold text-fg truncate">{t.name}</span>
                      <span className="text-xs text-mut2 leading-snug">{t.description}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-mut2">Kolejne motywy dochodzą jako osobne pliki w folderze motywów — pojawią się tu same.</p>
              </div>

              <div className={row}>
                <span className="text-xs font-semibold text-fg2">Opady (płatki, deszcz)</span>
                <div className="flex gap-1">
                  <button className={pill(!w.particles)} onClick={() => setW({ particles: false })}>Wył.</button>
                  {[['Mało', 0.5], ['Średnio', 1], ['Dużo', 1.6]].map(([l, v]) => (
                    <button key={l as string} className={pill(w.particles && w.density === v)} onClick={() => setW({ particles: true, density: v as number })}>{l}</button>
                  ))}
                </div>
              </div>

              <div className={row}>
                <span className="text-xs font-semibold text-fg2">Ruch tła<span className="block text-xs font-normal text-mut2">paralaksa i obracanie przeciąganiem, jak w Luna</span></span>
                <div className="flex gap-1">
                  <button className={pill(w.motion)} onClick={() => setW({ motion: true })}>Wł.</button>
                  <button className={pill(!w.motion)} onClick={() => setW({ motion: false })}>Wył.</button>
                </div>
              </div>

              <div className={row}>
                <label htmlFor="veil" className="text-xs font-semibold text-fg2">Wyciszenie tła<span className="block text-xs font-normal text-mut2">więcej = spokojniej i czytelniej</span></label>
                <input id="veil" type="range" min={0} max={0.6} step={0.05} value={w.veil} onChange={e => setW({ veil: Number(e.target.value) })} className="w-40 accent-sky-500" />
              </div>

              <div className="flex justify-end">
                <button onClick={p.onResetWallpaper} className="flex items-center gap-1.5 text-xs font-semibold text-mut hover:text-fg cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />Domyślny wygląd</button>
              </div>
            </div>
          )}

          {tab === 'notif' && <NotificationSettings />}

          {tab === 'panels' && (
            <div className="px-4 space-y-2">
              <p className="text-xs text-mut">Włącz lub ukryj panele. Kolejność zmienisz przeciągając panel albo strzałkami w jego nagłówku.</p>
              {p.panels.map(x => (
                <div key={x.id} className={row}>
                  <span className={`text-xs font-semibold ${x.isVisible ? 'text-fg' : 'text-mut2 line-through'}`}>{x.title}</span>
                  <button onClick={() => p.onTogglePanel(x.id)} className={pill(x.isVisible)}>
                    {x.isVisible ? <><Eye className="w-3.5 h-3.5 inline mr-1" />Widoczny</> : <><EyeOff className="w-3.5 h-3.5 inline mr-1" />Ukryty</>}
                  </button>
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <button onClick={p.onResetPanels} className="flex items-center gap-1.5 text-xs font-semibold text-mut hover:text-fg cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />Domyślny układ</button>
              </div>
            </div>
          )}

          {tab === 'data' && (
            <div className="px-4 space-y-3 text-xs text-fg2">
              <div className={`${row} items-start flex-col`}>
                <span className="flex items-center gap-1.5 font-semibold text-fg"><Lock className="w-3.5 h-3.5" />Twoje dane</span>
                <p>{p.isDemo ? 'To jest wersja demo: profil, ustawienia i Twoje wiadomości zapisują się tylko w tej przeglądarce i nigdzie nie są wysyłane.' : 'Grupa widzi tylko to, co sam(a) włączysz w profilu.'}</p>
                <p>Prywatny dzienniczek samoobserwacji jest osobny — członkostwo w grupie nie daje do niego dostępu.</p>
                <p className="text-mut">Wersja aplikacji: <strong className="text-fg">{APP_VERSION}</strong> — aktualizuje się sama przy otwarciu.</p>
              </div>
              {!p.isDemo && p.isAdmin && p.onWipeGroup && <WipeGroup groupName={p.groupName ?? ''} onWipe={p.onWipeGroup} />}
              <div className="flex flex-wrap gap-2">
                {p.isDemo && (
                  <button onClick={() => { if (confirm('Usunąć profil zapisany w tej przeglądarce?')) p.onClearProfile(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-400/25 text-bad hover:bg-rose-500/20 cursor-pointer"><Trash2 className="w-3.5 h-3.5" />Wyczyść mój profil</button>
                )}
                {p.isDemo && (
                  <button onClick={() => { if (confirm('Przywrócić przykładowe dane demo (rozmowy, uczestników)?')) p.onResetDemo(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surf border border-line hover:bg-surf2 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />Przywróć dane demo</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
