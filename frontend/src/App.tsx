// PATH: src/App.tsx | REQ-ID: TERAPIA-APP-02 (powłoka z Luna2)
// Układ jak w Luna2: pierwszy ekran = sama tapeta z nazwą grupy; panele dopiero po przewinięciu.
// Komputer: siatka paneli (kalendarz = sedno, media zwijane). Telefon/tablet: karuzela ekranów przesuwanych palcem.
import React, { useEffect, useRef, useState } from 'react';
import { BookHeart, CalendarDays, ChevronDown, Eye, Library, Megaphone, MessagesSquare, Settings, ShieldCheck, User, Users } from 'lucide-react';
import { Wallpaper } from './components/Wallpaper';
import { SettingsModal } from './components/SettingsModal';
import { Avatar } from './components/ProfilePanel';
import { Carousel, CarouselHandle, Slide } from './components/Carousel';
import { useIsDark, useWallpaper } from './hooks/useWallpaper';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useTheme } from './hooks/useTheme';
import { usePanelLayout } from './hooks/usePanelLayout';
import { useGroup } from './hooks/useGroup';
import { PanelContainer } from './components/PanelContainer';
import { PWAReloadPrompt } from './components/PWAReloadPrompt';
import { AnnouncementsPanel, ChatPanel, MeetingsPanel, MembersPanel } from './components/panels';
import { MediaLibrary } from './components/MediaLibrary';
import type { PanelId } from './types/panelLayout';
import type { Member } from './types/group';
import { clearProfile, DEFAULT_PROFILE, loadProfile, Profile, publicView, saveProfile } from './services/profile';

/** Prywatny dzienniczek samoobserwacji — osobna aplikacja (GitHub Pages). */
export const DZIENNICZEK_URL = 'https://consis-redroad.github.io/dzienniczek/';

const SHORT: Record<PanelId, { label: string; icon: React.FC<{ className?: string }> }> = {
  meetings: { label: 'Kalendarz', icon: CalendarDays },
  materials: { label: 'Media', icon: Library },
  announcements: { label: 'Ogłoszenia', icon: Megaphone },
  chat: { label: 'Rozmowa', icon: MessagesSquare },
  members: { label: 'Admin', icon: ShieldCheck },
};

function useIsMobile() {
  const q = '(max-width: 1023px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

export default function App() {
  const g = useGroup();
  const theme = useTheme();
  const wall = useWallpaper();
  const dark = useIsDark();
  const mobile = useIsMobile();
  const carousel = useRef<CarouselHandle>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [meetingId, setMeetingId] = useState<string | undefined>();
  // FAZA 0: przełącznik widoku tylko w demo. FAZA 1: rola z bazy (członkostwo + RLS), bez przełącznika.
  const [isAdmin, setIsAdmin] = useState<boolean>(() => { try { return localStorage.getItem('terapia_demo_view') === 'admin'; } catch { return false; } });
  const setView = (admin: boolean) => { setIsAdmin(admin); try { localStorage.setItem('terapia_demo_view', admin ? 'admin' : 'user'); } catch { /* ignoruj */ } };
  const { panels, toggleCollapse, toggleVisibility, reorderPanels, movePanelStep, resetLayout } = usePanelLayout();
  const [draggedId, setDraggedId] = useState<PanelId | null>(null);
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const setProfile = (p: Profile) => { setProfileState(p); saveProfile(p); };
  const pub = publicView(profile);
  // „Ty” jako członek grupy — wyłącznie z danych, które uczestnik pokazał (publicView).
  const me: Member = { id: g.currentUserId, name: pub.name, role: 'participant', status: 'approved', emoji: profile.emoji, color: profile.color, photo: pub.usePhoto ? profile.photoDataUrl : undefined, about: pub.about || undefined };
  const members = [...g.members, me];
  const allowed = (id: PanelId) => id !== 'members' || isAdmin;
  const visible = panels.filter(p => p.isVisible && allowed(p.id));
  const hiddenCount = panels.filter(p => !p.isVisible && allowed(p.id)).length;
  const pendingCount = members.filter(m => m.status === 'pending').length;

  const openMeeting = (id: string) => {
    setMeetingId(id);
    if (mobile) { carousel.current?.goTo('meetings'); return; }
    const cal = panels.find(x => x.id === 'meetings');
    if (cal && !cal.isVisible) toggleVisibility('meetings');
    if (cal?.isCollapsed) toggleCollapse('meetings');
    setTimeout(() => document.getElementById('panel-meetings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const toContent = () => document.getElementById('tresc')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const content = (id: PanelId) => {
    if (g.loading) return <div className="p-4 text-sm text-mut2">Wczytywanie…</div>;
    switch (id) {
      case 'meetings': return <MeetingsPanel meetings={g.meetings} materials={g.materials} selectedId={meetingId} onSelect={setMeetingId} />;
      case 'announcements': return <AnnouncementsPanel items={g.announcements} members={members} />;
      case 'chat': return <ChatPanel messages={g.messages} members={members} currentUserId={g.currentUserId} isDemo={g.isDemo} onSend={g.sendMessage} />;
      case 'materials': return <MediaLibrary items={g.materials} meetings={g.meetings} onOpenMeeting={openMeeting} />;
      case 'members': return <MembersPanel members={members} onSetStatus={g.setMemberStatus} onAdd={g.addMember} selfId={g.currentUserId} />;
    }
  };

  const slides: Slide[] = visible.map(p => ({
    id: p.id, label: SHORT[p.id].label, icon: SHORT[p.id].icon,
    badge: p.id === 'members' ? pendingCount : undefined, content: content(p.id),
  }));

  return (
    <div className="min-h-[100dvh] text-fg relative overflow-x-clip">
      <Wallpaper settings={wall.settings} dark={dark} />

      <main className="relative z-10 max-w-[1240px] mx-auto px-3 sm:px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <header className="sticky top-[max(0.75rem,env(safe-area-inset-top))] z-40 max-w-[820px] mx-auto px-3 sm:px-4 py-2 rounded-full bg-head backdrop-blur-3xl border border-line shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 pl-1 sm:pl-2 select-none min-w-0">
            <span className="w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.7)] shrink-0" />
            <span className="font-extrabold text-sm tracking-[0.2em] sm:tracking-[0.25em]">TERAPIA</span>
            {g.isDemo && <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-amber-400/15 text-warn border border-amber-300/25">DEMO</span>}
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <a href={DZIENNICZEK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-ok border border-emerald-400/30 hover:bg-emerald-500/25" title="Mój prywatny dzienniczek (osobna aplikacja)">
              <BookHeart className="w-3.5 h-3.5" /><span className="hidden sm:inline">Dzienniczek</span>
            </a>
            <PWAInstallButton />
            {isAdmin && pendingCount > 0 && !mobile && (
              <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-400/10 text-warn border border-amber-300/20" title="Osoby czekające na akceptację">
                <Users className="w-3 h-3" />{pendingCount}
              </span>
            )}
            {hiddenCount > 0 && !mobile && (
              <button onClick={resetLayout} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-surf border border-line text-fg2 hover:bg-surf2 cursor-pointer" title="Pokaż ukryte panele">
                <Eye className="w-3 h-3" />{hiddenCount}
              </button>
            )}
            <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 pl-0.5 pr-1.5 sm:pr-2 py-0.5 rounded-full hover:bg-surf2 cursor-pointer" title="Mój profil i ustawienia" aria-label="Mój profil i ustawienia">
              <Avatar emoji={profile.emoji} color={profile.color} photo={profile.avatarKind === 'photo' ? profile.photoDataUrl : undefined} size={26} />
              <span className="hidden sm:inline text-xs font-semibold text-fg2 max-w-[8rem] truncate">{profile.pseudonym}</span>
              <Settings className="w-3.5 h-3.5 text-mut" />
            </button>
          </div>
        </header>

        {/* EKRAN STARTOWY — sama tapeta i nazwa (jak w Luna2) */}
        <section className="min-h-[calc(100dvh-5.5rem)] flex flex-col items-center justify-between text-center py-6 select-none" aria-label="Start">
          <div className="h-6" />
          <div className="flex flex-col items-center">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-fg drop-shadow-[0_2px_18px_var(--t-bg)]">{g.group?.name ?? '…'}</h1>
            <p className="mt-3 text-sm sm:text-base text-fg2 max-w-xl drop-shadow-[0_1px_10px_var(--t-bg)]">{g.group?.schedule}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button onClick={toContent} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full bg-head backdrop-blur-xl border border-line shadow-sm hover:bg-surf2 cursor-pointer">
                <CalendarDays className="w-4 h-4 text-acc" />Kalendarz grupy
              </button>
              <a href={DZIENNICZEK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full bg-head backdrop-blur-xl border border-line shadow-sm hover:bg-surf2">
                <BookHeart className="w-4 h-4 text-ok" />Mój dzienniczek ↗
              </a>
            </div>
            <p className="mt-2 text-[11px] text-mut drop-shadow-[0_1px_8px_var(--t-bg)]">Dzienniczek jest prywatny i osobny — grupa go nie widzi.</p>
            {g.isDemo && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="inline-flex p-0.5 rounded-full bg-head backdrop-blur-xl border border-line text-[11px]" role="group" aria-label="Widok demo">
                  <button onClick={() => setView(false)} aria-pressed={!isAdmin} className={`flex items-center gap-1 px-3 py-1 rounded-full cursor-pointer ${!isAdmin ? 'bg-surf2 text-fg font-semibold' : 'text-mut'}`}><User className="w-3 h-3" />Uczestnik</button>
                  <button onClick={() => setView(true)} aria-pressed={isAdmin} className={`flex items-center gap-1 px-3 py-1 rounded-full cursor-pointer ${isAdmin ? 'bg-surf2 text-fg font-semibold' : 'text-mut'}`}><ShieldCheck className="w-3 h-3" />Admin</button>
                </div>
                <span className="text-[11px] px-3 py-1 rounded-full bg-amber-400/10 text-warn border border-amber-300/20 backdrop-blur">Demo — wszystkie osoby i rozmowy są zmyślone.</span>
              </div>
            )}
          </div>
          <button onClick={toContent} className="group flex flex-col items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-mut hover:text-fg cursor-pointer" aria-label="Przewiń do treści">
            Przewiń
            <span className="w-8 h-8 rounded-full bg-head backdrop-blur-md border border-line flex items-center justify-center animate-bounce"><ChevronDown className="w-4 h-4" /></span>
          </button>
        </section>

        <div id="tresc" className="scroll-mt-20 pt-2">
          <div className="mb-4 flex justify-center">
            <div className="inline-block px-4 py-2 rounded-2xl bg-head backdrop-blur-xl border border-line text-center">
              <div className="text-sm font-bold">{g.group?.name}</div>
              <div className="text-[11px] text-mut">{g.group?.description}</div>
            </div>
          </div>

          {mobile ? (
            <div className="pb-[max(4rem,env(safe-area-inset-bottom))]">
              <Carousel ref={carousel} slides={slides} stickyTop="calc(max(0.75rem, env(safe-area-inset-top)) + 3.25rem)" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 items-start pb-16">
              {visible.map((p, idx) => (
                <div key={p.id} id={`panel-${p.id}`} className={`min-w-0 scroll-mt-24 ${p.id === 'members' || p.id === 'meetings' || p.id === 'materials' ? 'lg:col-span-2' : ''}`}>
                  <PanelContainer
                    config={p} canMoveUp={idx > 0} canMoveDown={idx < visible.length - 1}
                    onToggleCollapse={() => toggleCollapse(p.id)} onHide={() => toggleVisibility(p.id)}
                    onMoveUp={() => movePanelStep(p.id, 'up')} onMoveDown={() => movePanelStep(p.id, 'down')}
                    onDragStart={() => setDraggedId(p.id)} onDragOver={e => e.preventDefault()}
                    onDrop={() => { if (draggedId) { reorderPanels(draggedId, p.id); setDraggedId(null); } }}
                  >
                    {content(p.id)}
                  </PanelContainer>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="pb-8 text-center text-[11px] text-mut2">
          TERAPIA · faza 0 (demo) · wygląd na bazie Luna2 · <a href={DZIENNICZEK_URL} target="_blank" rel="noopener noreferrer" className="underline">Dzienniczek</a>
        </footer>
      </main>
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          profile={profile} onProfile={setProfile} onClearProfile={() => { clearProfile(); setProfileState(DEFAULT_PROFILE); }}
          mode={theme.mode} onMode={theme.setMode}
          wallpaper={wall.settings} onWallpaper={wall.setSettings} onResetWallpaper={wall.reset}
          panels={panels.filter(x => allowed(x.id))} onTogglePanel={toggleVisibility} onResetPanels={resetLayout}
          isDemo={g.isDemo} onResetDemo={g.resetDemo}
        />
      )}
      <PWAReloadPrompt />
    </div>
  );
}
