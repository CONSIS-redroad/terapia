// PATH: src/App.tsx | REQ-ID: TERAPIA-APP-01 (powłoka z Luna2)
import React, { useState } from 'react';
import { Eye, RotateCcw, Users } from 'lucide-react';
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
  const { panels, toggleCollapse, toggleVisibility, reorderPanels, movePanelStep, resetLayout } = usePanelLayout();
  const [draggedId, setDraggedId] = useState<PanelId | null>(null);
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const setProfile = (p: Profile) => { setProfileState(p); saveProfile(p); };
  const pub = publicView(profile);
  // „Ty” jako członek grupy — wyłącznie z danych, które uczestnik pokazał (publicView).
  const me: Member = { id: g.currentUserId, name: pub.name, role: 'participant', status: 'approved', emoji: profile.emoji, color: profile.color, photo: pub.usePhoto ? profile.photoDataUrl : undefined, about: pub.about || undefined };
  const members = [...g.members, me];
  const visible = panels.filter(p => p.isVisible);
  const hiddenCount = panels.length - visible.length;
  const pendingCount = members.filter(m => m.status === 'pending').length;

  const content = (id: PanelId) => {
    switch (id) {
      case 'profile': return <ProfilePanel profile={profile} onChange={setProfile} onClear={() => { clearProfile(); setProfileState(DEFAULT_PROFILE); }} isDemo={g.isDemo} />;
      case 'meetings': return <MeetingsPanel meetings={g.meetings} />;
      case 'announcements': return <AnnouncementsPanel items={g.announcements} members={members} />;
      case 'chat': return <ChatPanel messages={g.messages} members={members} currentUserId={g.currentUserId} isDemo={g.isDemo} onSend={g.sendMessage} />;
      case 'materials': return <MaterialsPanel items={g.materials} meetings={g.meetings} />;
      case 'members': return <MembersPanel members={members} isDemo={g.isDemo} onSetStatus={g.setMemberStatus} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#070b10] text-zinc-100 relative">
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse at 30% 0%, rgba(56,189,248,0.10) 0%, transparent 55%), radial-gradient(ellipse at 90% 80%, rgba(167,139,250,0.08) 0%, transparent 50%)' }} />

      <main className="relative z-10 max-w-[1040px] mx-auto px-4 py-4">
        <header className="sticky top-4 z-40 max-w-[820px] mx-auto px-4 py-2 rounded-full bg-[#06080d]/70 backdrop-blur-3xl border border-white/[0.08] shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 pl-2 select-none">
            <span className="w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.7)]" />
            <span className="font-extrabold text-sm tracking-[0.25em]">TERAPIA</span>
            {g.isDemo && <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 border border-amber-300/25">DEMO</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-100 border border-amber-300/20" title="Osoby czekające na akceptację">
                <Users className="w-3 h-3" />{pendingCount}
              </span>
            )}
            {hiddenCount > 0 && (
              <button onClick={resetLayout} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.1] cursor-pointer" title="Pokaż ukryte panele">
                <Eye className="w-3 h-3" />{hiddenCount}
              </button>
            )}
            {g.isDemo && (
              <button onClick={g.resetDemo} className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] cursor-pointer" title="Przywróć dane demo">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        <section className="pt-10 pb-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{g.group?.name ?? '…'}</h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-xl mx-auto">{g.group?.description}</p>
          <p className="mt-1 text-xs text-zinc-500">{g.group?.schedule}</p>
          {g.isDemo && (
            <p className="mt-4 inline-block text-[11px] px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-100/90 border border-amber-300/20">
              Dane przykładowe — wszystkie osoby i rozmowy są zmyślone.
            </p>
          )}
        </section>

        <div className="space-y-4 pb-16">
          {visible.map((p, idx) => (
            <PanelContainer
              key={p.id} config={p} canMoveUp={idx > 0} canMoveDown={idx < visible.length - 1}
              onToggleCollapse={() => toggleCollapse(p.id)} onHide={() => toggleVisibility(p.id)}
              onMoveUp={() => movePanelStep(p.id, 'up')} onMoveDown={() => movePanelStep(p.id, 'down')}
              onDragStart={() => setDraggedId(p.id)} onDragOver={e => e.preventDefault()}
              onDrop={() => { if (draggedId) { reorderPanels(draggedId, p.id); setDraggedId(null); } }}
            >
              {g.loading ? <div className="p-4 text-sm text-zinc-500">Wczytywanie…</div> : content(p.id)}
            </PanelContainer>
          ))}
        </div>

        <footer className="pb-8 text-center text-[11px] text-zinc-600">
          TERAPIA · faza 0 (demo) · wygląd na bazie Luna2
        </footer>
      </main>
      <PWAReloadPrompt />
    </div>
  );
}
