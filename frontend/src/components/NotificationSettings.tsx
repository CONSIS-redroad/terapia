// PATH: src/components/NotificationSettings.tsx | REQ-ID: TERAPIA-NOTIF-02 (zakładka „Powiadomienia” w Ustawieniach)
import React, { useEffect, useState } from 'react';
import { BellOff, BellRing, Moon, Send, Smartphone, Vibrate, Volume2 } from 'lucide-react';
import {
  CATEGORY_LABELS, isIOSNotInstalled, isMutedNow, muteUntilFor, notify, permissionState, requestPermission,
  useNotifSettings, type NotifCategory, type PermissionStateX,
} from '../services/notifications';

const row = 'flex items-center justify-between gap-3 p-3 rounded-xl border border-line bg-surf';
const pill = (on: boolean) => `tap px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border disabled:opacity-50 disabled:cursor-not-allowed ${on ? 'bg-sky-500/20 text-acc border-sky-400/30' : 'bg-surf text-mut border-line hover:bg-surf2'}`;
const head = 'block text-xs uppercase tracking-widest text-mut font-semibold mb-2';

const PERM_TEXT: Record<PermissionStateX, { label: string; desc: string; cls: string }> = {
  granted: { label: 'Zgoda udzielona', desc: 'Telefon może pokazywać powiadomienia z aplikacji.', cls: 'text-ok' },
  default: { label: 'Brak zgody', desc: 'Aplikacja jeszcze nie pytała o zgodę. Włącz poniżej — telefon zapyta raz.', cls: 'text-warn' },
  denied: { label: 'Zgoda odrzucona', desc: 'Powiadomienia są zablokowane w ustawieniach przeglądarki lub telefonu.', cls: 'text-bad' },
  unsupported: { label: 'Niedostępne', desc: 'Ta przeglądarka nie obsługuje powiadomień.', cls: 'text-mut' },
};

/** Duży wiersz-przełącznik (≥44 px), cały klikalny. */
const ToggleRow: React.FC<{ label: string; hint?: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }> =
  ({ label, hint, on, disabled, onChange, icon }) => (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className={`tap w-full ${row} text-left cursor-pointer hover:bg-surf2 disabled:opacity-50 disabled:cursor-not-allowed`}>
      <span className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-mut shrink-0">{icon}</span>}
        <span className="text-sm font-semibold text-fg2">{label}{hint && <span className="block text-xs font-normal text-mut2">{hint}</span>}</span>
      </span>
      <span aria-hidden className={`relative shrink-0 w-11 h-6 rounded-full border transition-colors ${on ? 'bg-sky-500/20 border-sky-400/30' : 'bg-surf2 border-line'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${on ? 'left-5 bg-sky-500' : 'left-0.5 bg-surf border border-line'}`} />
      </span>
    </button>
  );

const fmtUntil = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `dziś do ${time}` : `do ${d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}, ${time}`;
};

export const NotificationSettings: React.FC = () => {
  const [s, update] = useNotifSettings();
  const [perm, setPerm] = useState<PermissionStateX>(() => permissionState());
  const [msg, setMsg] = useState<string | null>(null);
  const [, tick] = useState(0);
  const iosNoInstall = isIOSNotInstalled();

  // Odśwież stan zgody po powrocie do aplikacji (np. z ustawień telefonu) i zegar wyciszenia co minutę
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') setPerm(permissionState()); };
    document.addEventListener('visibilitychange', onVis);
    const id = window.setInterval(() => tick(x => x + 1), 60_000);
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearInterval(id); };
  }, []);

  const enable = async () => {
    setMsg(null);
    const r = await requestPermission();
    setPerm(r);
    if (r === 'granted') update({ enabled: true });
    else if (r === 'denied') setMsg('Zgoda odrzucona — instrukcja włączenia poniżej.');
  };

  const sendTest = async () => {
    setMsg(null);
    const ok = await notify(s, 'announcements', 'Powiadomienie testowe', 'Tak będą wyglądać powiadomienia z grupy.', { force: true });
    setMsg(ok ? 'Wysłano. Jeśli nic nie widać — sprawdź tryb „Nie przeszkadzać” w telefonie.' : 'Nie udało się pokazać powiadomienia — sprawdź zgodę.');
  };

  const granted = perm === 'granted';
  const active = granted && s.enabled;
  const mutedUntil = s.muteUntil && Date.parse(s.muteUntil) > Date.now() ? s.muteUntil : undefined;
  const mutedNow = isMutedNow(s);
  const p = PERM_TEXT[perm];

  return (
    <div className="px-4 space-y-4">
      {/* Stan zgody */}
      <div className={`${row} flex-col items-stretch`}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm text-fg2">
            <span className="font-semibold">Zgoda telefonu: </span><span className={`font-semibold ${p.cls}`}>{p.label}</span>
            <span className="block text-xs text-mut2">{p.desc}</span>
          </span>
          {active && <span className="shrink-0 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-ok">Włączone{mutedNow ? ' · wyciszone' : ''}</span>}
        </div>

        {perm === 'default' && !iosNoInstall && (
          <button onClick={enable} className="tap mt-1 flex items-center justify-center gap-2 px-4 rounded-xl bg-sky-500/20 border border-sky-400/30 text-acc text-sm font-semibold cursor-pointer hover:bg-sky-500/30">
            <BellRing className="w-4 h-4" />Włącz powiadomienia
          </button>
        )}
        {granted && (
          <ToggleRow label="Powiadomienia z aplikacji" hint="główny wyłącznik" on={s.enabled} onChange={v => update({ enabled: v })}
            icon={s.enabled ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />} />
        )}
      </div>

      {iosNoInstall && (
        <div className="p-3 rounded-xl border border-line bg-amber-400/10 text-sm text-fg2 space-y-1">
          <p className="flex items-center gap-1.5 font-semibold text-warn"><Smartphone className="w-4 h-4" />iPhone / iPad: najpierw zainstaluj aplikację</p>
          <p className="text-xs">W zwykłej karcie Safari powiadomienia nie działają. Użyj przycisku <strong>Zainstaluj</strong> albo w Safari stuknij <strong>Udostępnij → Do ekranu początkowego</strong>, a potem otwórz aplikację z ikony na ekranie i wróć tutaj.</p>
        </div>
      )}

      {perm === 'denied' && (
        <div className="p-3 rounded-xl border border-line bg-amber-400/10 text-xs text-fg2 space-y-1">
          <p className="text-sm font-semibold text-bad">Jak włączyć z powrotem</p>
          <p><strong>Android (Chrome):</strong> Ustawienia telefonu → Aplikacje → ta aplikacja (lub Chrome) → Powiadomienia → Zezwalaj. W przeglądarce: kłódka obok adresu → Uprawnienia → Powiadomienia.</p>
          <p><strong>iPhone:</strong> Ustawienia → Powiadomienia → ta aplikacja → Pozwalaj na powiadomienia.</p>
          <p><strong>Komputer:</strong> kłódka obok adresu strony → Powiadomienia → Zezwalaj, potem odśwież stronę.</p>
        </div>
      )}

      {msg && <p className="text-xs text-mut" role="status">{msg}</p>}

      {/* Kategorie */}
      <div>
        <span className={head}>O czym powiadamiać</span>
        <div className="space-y-2">
          {(Object.keys(CATEGORY_LABELS) as NotifCategory[]).map(c => (
            <ToggleRow key={c} label={CATEGORY_LABELS[c]} on={s.categories[c]} disabled={!active}
              onChange={v => update({ categories: { ...s.categories, [c]: v } })} />
          ))}
        </div>
      </div>

      {/* Sposób */}
      <div>
        <span className={head}>Jak</span>
        <div className="space-y-2">
          <ToggleRow label="Wibracja" hint="na Androidzie; iPhone wibruje wg własnych ustawień" on={s.vibrate} disabled={!active}
            onChange={v => update({ vibrate: v })} icon={<Vibrate className="w-4 h-4" />} />
          <ToggleRow label="Dźwięk" on={s.sound} disabled={!active} onChange={v => update({ sound: v })} icon={<Volume2 className="w-4 h-4" />} />
        </div>
      </div>

      {/* Wyciszenie */}
      <div>
        <span className={head}>Wycisz</span>
        <div className={`${row} flex-col items-stretch`}>
          <div className="flex flex-wrap gap-1.5">
            <button disabled={!active} className={pill(false)} onClick={() => update({ muteUntil: muteUntilFor(1) })}>1 h</button>
            <button disabled={!active} className={pill(false)} onClick={() => update({ muteUntil: muteUntilFor(8) })}>8 h</button>
            <button disabled={!active} className={pill(false)} onClick={() => update({ muteUntil: muteUntilFor('tomorrow') })}>Do jutra (7:00)</button>
            <button disabled={!mutedUntil} className={pill(!mutedUntil)} onClick={() => update({ muteUntil: undefined })}>Wyłącz wyciszenie</button>
          </div>
          <p className="text-xs text-mut2">{mutedUntil ? <>Wyciszone <strong className="text-fg">{fmtUntil(mutedUntil)}</strong>.</> : 'Nie wyciszono.'}</p>
        </div>
      </div>

      {/* Godziny ciszy */}
      <div className="space-y-2">
        <ToggleRow label="Godziny ciszy" hint="codziennie, np. w nocy" on={s.quietHours.on} disabled={!active}
          onChange={v => update({ quietHours: { ...s.quietHours, on: v } })} icon={<Moon className="w-4 h-4" />} />
        {s.quietHours.on && (
          <div className={`${row} flex-wrap`}>
            <label className="flex items-center gap-2 text-sm text-fg2">od
              <input type="time" value={s.quietHours.from} disabled={!active}
                onChange={e => e.target.value && update({ quietHours: { ...s.quietHours, from: e.target.value } })}
                className="tap px-2 rounded-lg bg-surf2 border border-line text-fg text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-fg2">do
              <input type="time" value={s.quietHours.to} disabled={!active}
                onChange={e => e.target.value && update({ quietHours: { ...s.quietHours, to: e.target.value } })}
                className="tap px-2 rounded-lg bg-surf2 border border-line text-fg text-sm" />
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mut2">W wersji demo powiadomienia pokazuje tylko otwarta aplikacja; powiadomienia przy zamkniętej aplikacji dojdą z serwerem.</p>
        <button onClick={sendTest} disabled={!granted}
          className="tap flex items-center gap-1.5 px-4 rounded-xl bg-surf border border-line text-sm font-semibold text-fg hover:bg-surf2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <Send className="w-4 h-4" />Wyślij powiadomienie testowe
        </button>
      </div>
    </div>
  );
};
