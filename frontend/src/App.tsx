// PATH: src/App.tsx | REQ-ID: TERAPIA-APP-01 (powłoka z Luna2)
import React, { useState } from 'react';
import { Eye, Monitor, Moon, RotateCcw, ShieldCheck, Sun, User, Users } from 'lucide-react';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useTheme } from './hooks/useTheme';
import { usePanelLayout } from './hooks/usePanelLayout';
import { useGroup } from './hooks/useGroup';
import { PanelContainer } from './components/PanelContainer';
import { PWAReloadPrompt } from './components/PWAReloadPrompt';
import { AnnouncementsPanel, ChatPanel, MaterialsPanel, MeetingsPanel, MembersPanel } from './components/panels';
import type { PanelId } from './types/panelLayout';
import type { Member } from './types/group';
import { ProfilePanel } from './components/ProfilePanel';
import { clearProfile, DEFAULT_PROFILE, loadProfile, Profile, publicView, saveProfile } from './services/profile';

export default function App() {
  const g = useGroup();
  const theme = useTheme();
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
      case 'profile': return <ProfilePanel profile={profile} onChange={setProfile} onClear={() => { clearProfile(); setProfileState(DEFAULT_PROFILE); }} isDemo={g.isDemo} />;
      case 'meetings': return <MeetingsPanel meetings={g.meetings} materials={g.materials} />;
      case 'announcements': return <AnnouncementsPanel items={g.announcements} members={members} />;
      case 'chat': return <ChatPanel messages={g.messages} members={members} currentUserId={g.currentUserId} isDemo={g.isDemo} onSend={g.sendMessage} />;
      case 'materials': return <MaterialsPanel items={g.materials} meetings={g.meetings} />;
      case 'members': return <MembersPanel members={members} onSetStatus={g.setMemberStatus} onAdd={g.addMember} selfId={g.currentUserId} />;
    }
  };

  return (
    <div className="min-h-screen bg-bg text-fg relative">
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse at 30% 0%, var(--t-glow1) 0%, transparent 55%), radial-gradient(ellipse at 90% 80%, var(--t-glow2) 0%, transparent 50%)' }} />

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
            <button onClick={theme.cycle} className="p-1.5 rounded-full text-mut hover:text-fg hover:bg-surf2 cursor-pointer"
              title={theme.mode === 'system' ? 'Motyw: jak w urządzeniu (kliknij: jasny)' : theme.mode === 'light' ? 'Motyw: jasny (kliknij: ciemny)' : 'Motyw: ciemny (kliknij: jak w urządzeniu)'}
              aria-label="Zmień motyw jasny / ciemny">
              {theme.mode === 'system' ? <Monitor className="w-4 h-4" /> : theme.mode === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {g.isDemo && (
              <button onClick={g.resetDemo} className="p-1.5 rounded-full text-mut hover:text-fg hover:bg-surf2 cursor-pointer" title="Przywróć dane demo">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
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

        <section className="pt-10 pb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{g.group?.name ?? '…'}</h1>
          <p className="mt-2 text-sm text-mut max-w-xl mx-auto">{g.group?.description}</p>
          <p className="mt-1 text-xs text-mut2">{g.group?.schedule}</p>
          {g.isDemo && (
            <p className="mt-4 inline-block text-[11px] px-3 py-1.5 rounded-full bg-amber-400/10 text-warn border border-amber-300/20">
              Dane przykładowe — wszystkie osoby i rozmowy są zmyślone.
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 items-start pb-16">
          {visible.map((p, idx) => (
            <div key={p.id} className={p.id === 'profile' || p.id === 'members' || p.id === 'meetings' ? 'lg:col-span-2' : ''}>
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
      <PWAReloadPrompt />
    </div>
  );
}
