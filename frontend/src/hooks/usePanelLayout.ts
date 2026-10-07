// PATH: src/hooks/usePanelLayout.ts | VERSION: 2.4.0 | REQ-ID: PANEL-HOOK-01
import { useState, useEffect } from 'react';
import { PanelConfig, PanelId, DEFAULT_PANELS } from '../types/panelLayout';

const STORAGE_KEY = 'terapia_panels_config_v2';

export function usePanelLayout() {
  const [panels, setPanels] = useState<PanelConfig[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_PANELS;
      const parsed = JSON.parse(raw);
      const saved = (parsed as PanelConfig[]).filter(p => DEFAULT_PANELS.some(d => d.id === p.id)).map(p => ({ ...DEFAULT_PANELS.find(d => d.id === p.id)!, isCollapsed: p.isCollapsed, isVisible: p.isVisible }));
      return [...saved, ...DEFAULT_PANELS.filter(d => !saved.some(p => p.id === d.id))];
    } catch {
      return DEFAULT_PANELS;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(panels)); } catch {}
  }, [panels]);

  const toggleCollapse = (id: PanelId) => setPanels(prev => prev.map(p => p.id === id ? { ...p, isCollapsed: !p.isCollapsed } : p));
  const toggleVisibility = (id: PanelId) => setPanels(prev => prev.map(p => p.id === id ? { ...p, isVisible: !p.isVisible } : p));

  const reorderPanels = (sourceId: PanelId, targetId: PanelId) => {
    if (sourceId === targetId) return;
    setPanels(prev => {
      const next = [...prev];
      const srcIdx = next.findIndex(p => p.id === sourceId);
      const tgtIdx = next.findIndex(p => p.id === targetId);
      if (srcIdx < 0 || tgtIdx < 0) return prev;
      const [moved] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, moved);
      return next;
    });
  };

  const movePanelStep = (id: PanelId, dir: 'up' | 'down') => {
    setPanels(prev => {
      const idx = prev.findIndex(p => p.id === id);
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const resetLayout = () => setPanels(DEFAULT_PANELS);

  return { panels, toggleCollapse, toggleVisibility, reorderPanels, movePanelStep, resetLayout };
}
