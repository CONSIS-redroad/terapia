// PATH: src/components/PWAInstallButton.tsx | REQ-ID: PWA-BTN-02 (z Luna2, kolory motywu + instrukcja dla komputera)
import React, { useState } from 'react';
import { Download, Laptop, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstalled, isInstallable, triggerInstall } = usePWAInstall();
  const [help, setHelp] = useState(false);

  if (isInstalled) return null;

  return (
    <>
      <button
        onClick={() => (isInstallable ? triggerInstall() : setHelp(true))}
        className="flex items-center justify-center gap-1.5 text-xs font-semibold min-w-10 h-10 lg:h-auto lg:min-w-0 px-2.5 lg:py-1 rounded-full bg-sky-500/15 text-acc border border-sky-400/30 hover:bg-sky-500/25 cursor-pointer" aria-label="Zainstaluj aplikację"
        title="Zainstaluj na telefonie, tablecie lub komputerze"
      >
        <Download className="w-5 h-5 lg:w-3 lg:h-3" /><span className="hidden sm:inline">Zainstaluj</span>
      </button>

      {help && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setHelp(false)}>
          <div className="bg-bg rounded-2xl border border-line shadow-2xl max-w-sm w-full p-5 text-fg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-bold text-sm">Zainstaluj TERAPIA</h3>
              <button onClick={() => setHelp(false)} className="p-1 rounded-lg hover:bg-surf2 text-mut cursor-pointer" aria-label="Zamknij"><X className="w-4 h-4" /></button>
            </div>
            <div className="py-3 text-xs text-fg2 space-y-2">
              <div className="p-2.5 bg-surf rounded-xl flex items-start gap-2">
                <Share className="w-4 h-4 text-acc shrink-0 mt-0.5" />
                <span><strong>iPhone / iPad (Safari):</strong> przycisk „Udostępnij”, potem <strong>„Do ekranu początkowego”</strong>.</span>
              </div>
              <div className="p-2.5 bg-surf rounded-xl flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-acc shrink-0 mt-0.5" />
                <span><strong>Android (Chrome):</strong> menu ⋮, potem <strong>„Zainstaluj aplikację”</strong>.</span>
              </div>
              <div className="p-2.5 bg-surf rounded-xl flex items-start gap-2">
                <Laptop className="w-4 h-4 text-acc shrink-0 mt-0.5" />
                <span><strong>Komputer (Chrome / Edge):</strong> ikona instalacji na końcu paska adresu albo menu, potem <strong>„Zainstaluj TERAPIA”</strong>.</span>
              </div>
            </div>
            <button onClick={() => setHelp(false)} className="w-full py-2 rounded-xl bg-sky-500/20 text-acc border border-sky-400/30 font-semibold text-xs cursor-pointer">Rozumiem</button>
          </div>
        </div>
      )}
    </>
  );
};
