// PATH: src/types/panelLayout.ts | REQ-ID: PANEL-TYPES-01 (z Luna2, panele TERAPIA)
export type PanelId = 'meetings' | 'announcements' | 'chat' | 'materials' | 'members';

export interface PanelConfig {
  id: PanelId;
  title: string;
  isCollapsed: boolean;
  isVisible: boolean;
}

export const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'meetings', title: 'Kalendarz zajęć', isCollapsed: false, isVisible: true },
  { id: 'announcements', title: 'Ogłoszenia', isCollapsed: false, isVisible: true },
  { id: 'chat', title: 'Rozmowa grupy', isCollapsed: false, isVisible: true },
  { id: 'materials', title: 'Materiały', isCollapsed: false, isVisible: true },
  { id: 'members', title: 'Admin — wpuszczanie i uczestnicy', isCollapsed: false, isVisible: true },
];
