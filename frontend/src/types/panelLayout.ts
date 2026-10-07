// PATH: src/types/panelLayout.ts | REQ-ID: PANEL-TYPES-01 (z Luna2, panele TERAPIA)
export type PanelId = 'profile' | 'meetings' | 'announcements' | 'chat' | 'materials' | 'members';

export interface PanelConfig {
  id: PanelId;
  title: string;
  isCollapsed: boolean;
  isVisible: boolean;
}

export const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'profile', title: 'Mój profil', isCollapsed: true, isVisible: true },
  { id: 'meetings', title: 'Spotkania', isCollapsed: false, isVisible: true },
  { id: 'announcements', title: 'Ogłoszenia', isCollapsed: false, isVisible: true },
  { id: 'chat', title: 'Rozmowa grupy', isCollapsed: false, isVisible: true },
  { id: 'materials', title: 'Materiały', isCollapsed: false, isVisible: true },
  { id: 'members', title: 'Uczestnicy i akceptacja (prowadząca)', isCollapsed: false, isVisible: true },
];
