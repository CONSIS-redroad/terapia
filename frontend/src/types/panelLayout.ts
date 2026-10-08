// PATH: src/types/panelLayout.ts | REQ-ID: PANEL-TYPES-01 (z Luna2, panele TERAPIA)
export type PanelId = 'meetings' | 'homework' | 'chat' | 'materials' | 'rules' | 'members';

export interface PanelConfig {
  id: PanelId;
  title: string;
  isCollapsed: boolean;
  isVisible: boolean;
}

export const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'meetings', title: 'Kalendarz zajęć', isCollapsed: false, isVisible: true },
  { id: 'homework', title: 'Prace domowe', isCollapsed: false, isVisible: true },
  { id: 'chat', title: 'Czat grupy', isCollapsed: false, isVisible: true },
  { id: 'materials', title: 'Media — biblioteka (rozwiń)', isCollapsed: true, isVisible: true },
  { id: 'rules', title: 'Zasady grupy i regulamin', isCollapsed: false, isVisible: true },
  { id: 'members', title: 'Admin — wpuszczanie, uczestnicy, limity', isCollapsed: false, isVisible: true },
];
