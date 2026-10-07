// PATH: src/App.tsx | REQ-ID: TERAPIA-APP-01 (powłoka z Luna2)
import React, { useState } from 'react';
import { Eye, Settings, ShieldCheck, User, Users } from 'lucide-react';
import { Wallpaper } from './components/Wallpaper';
import { SettingsModal } from './components/SettingsModal';
import { Avatar } from './components/ProfilePanel';
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

export default function App() {
  const g = useGroup();
  const theme = useTheme();
  const wall = useWallpaper();
  const dark = useIsDark();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [meetingId, setMeetingId] = useState<string | undefined>();
  const openMeeting = (id: string) => {
    setMeetingId(id);
    const cal = panels.find(x => x.id === 'meetings');
    if (cal && !cal.isVisible) toggleVisibility('meetings');
    if (cal?.isCollapsed) toggleCollapse('meetings');
    setTimeout(() => document.getElementById('panel-meetings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
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

  const content = (id: PanelId) => {
    switch (id) {
      case 'meetings': return <MeetingsPanel meetings={g.meetings} materials={g.materials} selectedId={meetingId} onSelect={setMeetingId} />;
      case 'announcements': return <AnnouncementsPanel items={g.announcements} members={members} />;
      case 'chat': return <ChatPanel messages={g.messages} members={members} currentUserId={g.currentUserId} isDemo={g.isDemo} onSend={g.sendMessage} />;
      case 'materials': return <MediaLibrary items={g.materials} meetings={g.meetings} onOpenMeeting={openMeeting} />;
      case 'members': return <MembersPanel members={members} onSetStatus={g.setMemberStatus} onAdd={g.addMember} selfId={g.currentUserId} />;
    }
  };

  return (
    <div className="min-h-screen text-fg relative">
      <Wallpaper settings={wall.settings} dark={dark} />

      <main className="relative z-10 max-w-[1240px] mx-auto px-4 py-4">
        <header className="sticky top-4 z-40 max-w-[820px] mx-auto px-4 py-2 rounded-full bg-head backdrop-blur-3xl border border-line shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 pl-2 select-none">
            <span className="w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.7)]" />
            <span className="font-extrabold text-sm tracking-[0.25em]">TERAPIA</span>
            {g.isDemo && <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-amber-400/15 text-warn border border-amber-300/25">DEMO</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <PWAInstallButton />
            {isAdmin && pendingCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-400/10 text-warn border border-amber-300/20" title="Osoby czekające na akceptację">
                <Users className="w-3 h-3" />{pendingCount}
              </span>
            )}
            {hiddenCount > 0 && (
              <button onClick={resetLayout} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-surf border border-line text-fg2 hover:bg-surf2 cursor-pointer" title="Pokaż ukryte panele">
                <Eye className="w-3 h-3" />{hiddenCount}
              </button>
            )}
            <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full hover:bg-surf2 cursor-pointer" title="Mój profil i ustawienia" aria-label="Mój profil i ustawienia">
              <Avatar emoji={profile.emoji} color={profile.color} photo={profile.avatarKind === 'photo' ? profile.photoDataUrl : undefined} size={26} />
              <span className="hidden sm:inline text-xs font-semibold text-fg2 max-w-[8rem] truncate">{profile.pseudonym}</span>
              <Settings className="w-3.5 h-3.5 text-mut" />
            </button>
          </div>
        </header>

        {g.isDemo && (
          <div className="mt-4 flex justify-center">
            <div className="inline-flex p-0.5 rounded-full bg-surf border border-line text-[11px]" role="group" aria-label="Widok demo">
              <button onClick={() => setView(false)} aria-pressed={!isAdmin} className={`flex items-center gap-1 px-3 py-1 rounded-full cursor-pointer ${!isAdmin ? 'bg-surf2 text-fg font-semibold' : 'text-mut'}`}><User className="w-3 h-3" />Uczestnik</button>
              <button onClick={() => setView(true)} aria-pressed={isAdmin} className={`flex items-center gap-1 px-3 py-1 rounded-full cursor-pointer ${isAdmin ? 'bg-surf2 text-fg font-semibold' : 'text-mut'}`}><ShieldCheck className="w-3 h-3" />Admin</button>
            </div>
          </div>
        )}

        <section className="pt-8 pb-6 text-center"><div className="inline-block max-w-2xl px-6 py-5 rounded-3xl bg-head backdrop-blur-xl border border-line shadow-sm">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{g.group?.name ?? '…'}</h1>
          <p className="mt-2 text-sm text-mut max-w-xl mx-auto">{g.group?.description}</p>
          <p className="mt-1 text-xs text-mut2">{g.group?.schedule}</p>
          {g.isDemo && (
            <p className="mt-4 inline-block text-[11px] px-3 py-1.5 rounded-full bg-amber-400/10 text-warn border border-amber-300/20">
              Dane przykładowe — wszystkie osoby i rozmowy są zmyślone.
            </p>
          )}
        </div></section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 items-start pb-16">
          {visible.map((p, idx) => (
            <div key={p.id} id={`panel-${p.id}`} className={`scroll-mt-24 ${p.id === 'members' || p.id === 'meetings' || p.id === 'materials' ? 'lg:col-span-2' : ''}`}>
            <PanelContainer
              config={p} canMoveUp={idx > 0} canMoveDown={idx < visible.length - 1}
              onToggleCollapse={() => toggleCollapse(p.id)} onHide={() => toggleVisibility(p.id)}
              onMoveUp={() => movePanelStep(p.id, 'up')} onMoveDown={() => movePanelStep(p.id, 'down')}
              onDragStart={() => setDraggedId(p.id)} onDragOver={e => e.preventDefault()}
              onDrop={() => { if (draggedId) { reorderPanels(draggedId, p.id); setDraggedId(null); } }}
            >
              {g.loading ? <div className="p-4 text-sm text-mut2">Wczytywanie…</div> : content(p.id)}
            </PanelContainer>
            </div>
          ))}
        </div>

        <footer className="pb-8 text-center text-[11px] text-mut2">
          TERAPIA · faza 0 (demo) · wygląd na bazie Luna2
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
