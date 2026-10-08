// PATH: src/App.tsx | REQ-ID: TERAPIA-APP-02 (powłoka z Luna2)
// Układ jak w Luna2: pierwszy ekran = sama tapeta z nazwą grupy; panele dopiero po przewinięciu.
// Komputer: siatka paneli (kalendarz = sedno, media zwijane). Telefon/tablet: karuzela ekranów przesuwanych palcem.
import React, { useEffect, useRef, useState } from 'react';
import { BookHeart, CalendarDays, ChevronDown, ClipboardCheck, Eye, Library, Megaphone, MessagesSquare, Settings, ShieldCheck, User, Users } from 'lucide-react';
import { HomeworkPanel } from './components/HomeworkPanel';
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
import { APP_BUILD, APP_VERSION, UpdateGuard } from './services/appUpdate';
import { AnnouncementsPanel, ChatPanel, MeetingsPanel, MembersPanel } from './components/panels';
import { MediaLibrary } from './components/MediaLibrary';
import type { PanelId } from './types/panelLayout';
import type { Member } from './types/group';
import { clearProfile, DEFAULT_PROFILE, loadProfile, Profile, publicView, saveProfile } from './services/profile';

/** Prywatny dzienniczek samoobserwacji — osobna aplikacja (GitHub Pages). */
export const DZIENNICZEK_URL = 'https://consis-redroad.github.io/dzienniczek/';

const SHORT: Record<PanelId, { label: string; icon: React.FC<{ className?: string }> }> = {
  meetings: { label: 'Kalendarz', icon: CalendarDays },
  homework: { label: 'Prace', icon: ClipboardCheck },
  materials: { label: 'Media', icon: Library },
  announcements: { label: 'Tablica', icon: Megaphone },
  chat: { label: 'Czat', icon: MessagesSquare },
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
  const hwTodo = g.homework.filter(h => !g.hwDone[h.id] && g.meetings.some(m => m.id === h.dueAt && new Date(m.date).getTime() + m.durationMin * 60000 > Date.now())).length;

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
      case 'meetings': return <MeetingsPanel meetings={g.meetings} materials={g.materials} homework={g.homework} hwDone={g.hwDone} onToggleDone={g.toggleHomeworkDone} isAdmin={isAdmin} onUpdateMeeting={g.updateMeeting} selectedId={meetingId} onSelect={setMeetingId} />;
      case 'homework': return <HomeworkPanel homework={g.homework} meetings={g.meetings} done={g.hwDone} onToggleDone={g.toggleHomeworkDone} onOpenMeeting={openMeeting} />;
      case 'announcements': return <AnnouncementsPanel items={g.announcements} members={members} />;
      case 'chat': return <ChatPanel messages={g.messages} members={members} currentUserId={g.currentUserId} isDemo={g.isDemo} onSend={g.sendMessage} />;
      case 'materials': return <MediaLibrary items={g.materials} meetings={g.meetings} onOpenMeeting={openMeeting} />;
      case 'members': return <MembersPanel members={members} onSetStatus={g.setMemberStatus} onAdd={g.addMember} selfId={g.currentUserId} />;
    }
  };

  const slides: Slide[] = visible.map(p => ({
    id: p.id, label: SHORT[p.id].label, icon: SHORT[p.id].icon,
    badge: p.id === 'members' ? pendingCount : p.id === 'homework' ? hwTodo : undefined, content: content(p.id),
  }));

  return (
    <div className="min-h-[100dvh] text-fg relative overflow-x-clip">
      <Wallpaper settings={wall.settings} dark={dark} />

      <main className="relative z-10 max-w-[1240px] mx-auto px-3 sm:px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <header className="sticky top-[max(0.75rem,env(safe-area-inset-top))] z-40 max-w-[820px] mx-auto px-3 sm:px-4 py-2 rounded-full bg-head backdrop-blur-3xl border border-line shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 pl-1 sm:pl-2 select-none min-w-0">
            <span className="w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.7)] shrink-0" />
            <span className="font-extrabold text-sm tracking-[0.2em] sm:tracking-[0.25em]">TERAPIA</span>
            {g.isDemo && <span className="hidden sm:inline text-xs font-mono tracking-wider px-2 py-0.5 rounded-full bg-amber-400/15 text-warn border border-amber-300/25">DEMO</span>}
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <a href={DZIENNICZEK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs font-semibold min-w-10 h-10 lg:h-auto lg:min-w-0 px-2.5 lg:py-1 rounded-full bg-emerald-500/15 text-ok border border-emerald-400/30 hover:bg-emerald-500/25" title="Mój prywatny dzienniczek (osobna aplikacja)" aria-label="Mój dzienniczek">
              <BookHeart className="w-5 h-5 lg:w-3.5 lg:h-3.5" /><span className="hidden sm:inline">Dzienniczek</span>
            </a>
            <PWAInstallButton />
            {isAdmin && pendingCount > 0 && !mobile && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-400/10 text-warn border border-amber-300/20" title="Osoby czekające na akceptację">
                <Users className="w-3 h-3" />{pendingCount}
              </span>
            )}
            {hiddenCount > 0 && !mobile && (
              <button onClick={resetLayout} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surf border border-line text-fg2 hover:bg-surf2 cursor-pointer" title="Pokaż ukryte panele">
                <Eye className="w-3 h-3" />{hiddenCount}
              </button>
            )}
            <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 pl-0.5 pr-1.5 sm:pr-2 py-0.5 rounded-full hover:bg-surf2 cursor-pointer" title="Mój profil i ustawienia" aria-label="Mój profil i ustawienia">
              <Avatar emoji={profile.emoji} color={profile.color} photo={profile.avatarKind === 'photo' ? profile.photoDataUrl : undefined} size={mobile ? 36 : 26} />
              <span className="hidden sm:inline text-xs font-semibold text-fg2 max-w-[8rem] truncate">{profile.pseudonym}</span>
              <Settings className="w-5 h-5 lg:w-3.5 lg:h-3.5 text-mut" />
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
              <button onClick={toContent} className="tap flex items-center gap-2 text-base font-semibold px-5 py-2.5 rounded-full bg-head backdrop-blur-xl border border-line shadow-sm hover:bg-surf2 cursor-pointer">
                <CalendarDays className="w-4 h-4 text-acc" />Kalendarz grupy
              </button>
              <a href={DZIENNICZEK_URL} target="_blank" rel="noopener noreferrer" className="tap flex items-center gap-2 text-base font-semibold px-5 py-2.5 rounded-full bg-head backdrop-blur-xl border border-line shadow-sm hover:bg-surf2">
                <BookHeart className="w-4 h-4 text-ok" />Mój dzienniczek ↗
              </a>
            </div>
            <p className="mt-2 text-xs text-mut drop-shadow-[0_1px_8px_var(--t-bg)]">Dzienniczek jest prywatny i osobny — grupa go nie widzi.</p>
            {g.isDemo && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="inline-flex p-0.5 rounded-full bg-head backdrop-blur-xl border border-line text-xs" role="group" aria-label="Widok demo">
                  <button onClick={() => setView(false)} aria-pressed={!isAdmin} className={`flex items-center gap-1 px-3 py-1 rounded-full cursor-pointer ${!isAdmin ? 'bg-surf2 text-fg font-semibold' : 'text-mut'}`}><User className="w-3 h-3" />Uczestnik</button>
                  <button onClick={() => setView(true)} aria-pressed={isAdmin} className={`flex items-center gap-1 px-3 py-1 rounded-full cursor-pointer ${isAdmin ? 'bg-surf2 text-fg font-semibold' : 'text-mut'}`}><ShieldCheck className="w-3 h-3" />Admin</button>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-amber-400/10 text-warn border border-amber-300/20 backdrop-blur">Demo — wszystkie osoby i rozmowy są zmyślone.</span>
              </div>
            )}
          </div>
          <button onClick={toContent} className="group flex flex-col items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-mut hover:text-fg cursor-pointer" aria-label="Przewiń do treści">
            Przewiń
            <span className="w-8 h-8 rounded-full bg-head backdrop-blur-md border border-line flex items-center justify-center animate-bounce"><ChevronDown className="w-4 h-4" /></span>
          </button>
        </section>

        <div id="tresc" className="scroll-mt-20 pt-2">
          <div className="mb-4 hidden lg:flex justify-center">
            <div className="inline-block px-4 py-2 rounded-2xl bg-head backdrop-blur-xl border border-line text-center">
              <div className="text-sm font-bold">{g.group?.name}</div>
              <div className="text-xs text-mut">{g.group?.description}</div>
            </div>
          </div>

          {mobile ? (
            <div className="pb-[max(4rem,env(safe-area-inset-bottom))]">
              <Carousel ref={carousel} slides={slides} />
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

        <footer className="pb-8 text-center text-xs text-mut2">
          TERAPIA · wersja {APP_VERSION} ({APP_BUILD.slice(6, 8)}.{APP_BUILD.slice(4, 6)} {APP_BUILD.slice(9, 11)}:{APP_BUILD.slice(11, 13)} UTC) · faza 0 (demo) · <a href={DZIENNICZEK_URL} target="_blank" rel="noopener noreferrer" className="underline">Dzienniczek</a>
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
      <UpdateGuard />
    </div>
  );
}
