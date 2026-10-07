// PATH: src/components/PanelContainer.tsx | VERSION: 3.2.0 | REQ-ID: PANEL-HOVER-01
import React, { useState } from 'react';
import { GripVertical, ChevronDown, ChevronUp, ArrowUp, ArrowDown, EyeOff } from 'lucide-react';
import { PanelConfig } from '../types/panelLayout';


interface ContainerProps {
  config: PanelConfig; canMoveUp: boolean; canMoveDown: boolean;
  onToggleCollapse: () => void; onHide: () => void; onMoveUp: () => void; onMoveDown: () => void;
  onDragStart: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void;
  children: React.ReactNode;
}

export const PanelContainer: React.FC<ContainerProps> = ({
  config, canMoveUp, canMoveDown, onToggleCollapse, onHide, onMoveUp, onMoveDown, onDragStart, onDragOver, onDrop, children
}) => {
  const [isOver, setIsOver] = useState(false);
  const title = config.title;

  return (
    <section
      draggable onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); setIsOver(true); onDragOver(e); }}
      onDragLeave={() => setIsOver(false)} onDrop={e => { setIsOver(false); onDrop(e); }}
      className={`group mb-5 rounded-2xl transition-all duration-300 backdrop-blur-md ${isOver ? 'border border-zinc-400 scale-[1.005]' : 'border border-white/[0.08]'}`}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-950/40 backdrop-blur-xl rounded-t-2xl border-b border-white/[0.06] select-none">
        <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-200">
          <GripVertical className="w-3.5 h-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">{title}</h3>
        </div>
        <div className="flex items-center gap-1 text-zinc-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
          <button onClick={onMoveUp} disabled={!canMoveUp} className="p-1 rounded-md hover:bg-zinc-800 disabled:opacity-20 cursor-pointer" title="Przesuń wyżej"><ArrowUp className="w-3.5 h-3.5" /></button>
          <button onClick={onMoveDown} disabled={!canMoveDown} className="p-1 rounded-md hover:bg-zinc-800 disabled:opacity-20 cursor-pointer" title="Przesuń niżej"><ArrowDown className="w-3.5 h-3.5" /></button>
          <button onClick={onToggleCollapse} className="p-1 rounded-md hover:bg-zinc-800 text-zinc-300 cursor-pointer" title="Zwiń / rozwiń">
            {config.isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-zinc-300" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onHide} className="p-1 rounded-md hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer" title="Ukryj panel"><EyeOff className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {!config.isCollapsed && <div className="transition-all duration-300">{children}</div>}
    </section>
  );
};
