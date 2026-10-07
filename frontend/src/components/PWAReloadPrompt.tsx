// PATH: src/components/PWAReloadPrompt.tsx | VERSION: 2.1.0 | REQ-ID: PWA-RELOAD-01
import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export const PWAReloadPrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-[#0f1720] border border-[#38bdf8]/40 rounded-2xl shadow-2xl text-white max-w-sm flex items-center justify-between gap-3 animate-fade-in">
      <div>
        <p className="text-xs font-black text-white">Dostępna nowa wersja!</p>
        <p className="text-[11px] text-[#94a3b8]">Odśwież, aby załadować aktualizację.</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => updateServiceWorker(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#059669] hover:bg-[#10b981] text-white text-xs font-bold rounded-xl cursor-pointer shadow-md"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Odśwież
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="p-1 rounded-lg hover:bg-white/10 text-[#94a3b8] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
