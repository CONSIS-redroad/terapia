// PATH: src/components/PWAInstallButton.tsx | VERSION: 1.1.0 | REQ-ID: PWA-BTN-01
import React, { useState } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstalled, isIOS, isInstallable, triggerInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) return null;

  const handleClick = () => {
    if (isInstallable) {
      triggerInstall();
    } else {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#24302b] hover:bg-[#141a17] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        title="Zainstaluj aplikację na telefonie Android lub Apple iOS"
      >
        <Download className="w-3.5 h-3.5 text-[#e8dfcb]" />
        <span>Zainstaluj aplikację</span>
      </button>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#d9dfd9] shadow-2xl max-w-sm w-full p-5 text-[#24302b]">
            <div className="flex items-center justify-between pb-3 border-b border-[#d9dfd9]">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#6b9080]" />
                <h3 className="font-bold text-sm">Instalacja na iOS / Android</h3>
              </div>
              <button onClick={() => setShowIOSModal(false)} className="p-1 rounded-lg hover:bg-[#eef2ed] text-[#718078] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-3 text-xs text-[#718078] space-y-2">
              <p className="text-[#24302b] font-medium">Aby dodać LunaWeather na ekran telefonu:</p>
              <div className="p-2.5 bg-[#f5f3ef] rounded-xl flex items-start gap-2">
                <Share className="w-4 h-4 text-[#6b9080] shrink-0 mt-0.5" />
                <span><strong>Apple iOS (Safari):</strong> Kliknij przycisk „Udostępnij” na dole paska, a następnie wybierz <strong>„Do ekranu początkowego”</strong>.</span>
              </div>
              <div className="p-2.5 bg-[#f5f3ef] rounded-xl">
                <span><strong>Android (Chrome):</strong> Kliknij menu z trzema kropkami w rogu i wybierz <strong>„Zainstaluj aplikację”</strong>.</span>
              </div>
            </div>
            <button onClick={() => setShowIOSModal(false)} className="w-full py-2 rounded-xl bg-[#6b9080] text-white font-semibold text-xs cursor-pointer">
              Rozumiem
            </button>
          </div>
        </div>
      )}
    </>
  );
};
