// PATH: src/components/AudioPlayer.tsx | REQ-ID: TERAPIA-AUDIO-01
// Odtwarzacz nagrania lektora (ETAP I): graj/pauza, przewijanie, ±15 s, tempo 0,75–1,5,
// pamięta miejsce per nagranie (localStorage, w try/catch), Media Session (tytuł i przyciski na ekranie blokady).
import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';

const RATES = [0.75, 1, 1.25, 1.5];

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === '') localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* prywatne okno / zablokowane dane strony */ }
  return null;
}

export const AudioPlayer: React.FC<{
  src: string;
  /** stały klucz nagrania (np. id lektury) — podpisany adres zmienia się co godzinę, więc nie on jest kluczem */
  storageKey: string;
  title: string;
  artist?: string;
  artwork?: string;
}> = ({ src, storageKey, title, artist, artwork }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(() => {
    const r = Number(store('terapia_audio_rate'));
    return RATES.includes(r) ? r : 1;
  });
  const [err, setErr] = useState('');
  const posKey = `terapia_audio_pos:${storageKey}`;
  const lastSave = useRef(0);

  // przywróć miejsce po wczytaniu metadanych
  const onMeta = () => {
    const a = ref.current;
    if (!a) return;
    setDur(a.duration);
    a.playbackRate = rate;
    const saved = Number(store(posKey));
    if (saved > 0 && isFinite(a.duration) && saved < a.duration - 3) { a.currentTime = saved; setTime(saved); }
  };

  const onTime = () => {
    const a = ref.current;
    if (!a) return;
    setTime(a.currentTime);
    const now = Date.now();
    if (now - lastSave.current > 4000) { lastSave.current = now; store(posKey, String(Math.floor(a.currentTime))); }
  };

  const seek = (t: number) => {
    const a = ref.current;
    if (!a) return;
    const max = isFinite(a.duration) ? a.duration : t;
    a.currentTime = Math.max(0, Math.min(max, t));
    setTime(a.currentTime);
    store(posKey, String(Math.floor(a.currentTime)));
  };
  const skip = (d: number) => seek((ref.current?.currentTime ?? 0) + d);

  const toggle = async () => {
    const a = ref.current;
    if (!a) return;
    setErr('');
    if (a.paused) {
      try { await a.play(); } catch { setErr('Nie udało się odtworzyć nagrania. Spróbuj ponownie.'); }
    } else a.pause();
  };

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
    store('terapia_audio_rate', String(rate));
  }, [rate]);

  // Media Session — ekran blokady / słuchawki
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({ title, artist: artist || 'Grupa — archiwum', album: 'Powrót do przeszłości', artwork: artwork ? [{ src: artwork, sizes: '512x512' }] : [] });
      ms.setActionHandler('play', () => { void ref.current?.play(); });
      ms.setActionHandler('pause', () => ref.current?.pause());
      ms.setActionHandler('seekbackward', () => skip(-15));
      ms.setActionHandler('seekforward', () => skip(15));
      ms.setActionHandler('seekto', d => { if (typeof d.seekTime === 'number') seek(d.seekTime); });
    } catch { /* starsze przeglądarki nie znają części akcji */ }
    return () => {
      try {
        for (const a of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto'] as MediaSessionAction[]) ms.setActionHandler(a, null);
      } catch { /* jw. */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, artist, artwork]);

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  // zapisz miejsce przy wyjściu z widoku
  useEffect(() => {
    const a = ref.current; // przy odmontowaniu ref bywa już wyczyszczony — bierzemy element teraz
    return () => {
      if (a && a.currentTime > 0) store(posKey, a.ended ? '' : String(Math.floor(a.currentTime)));
    };
  }, [posKey]);

  const btn = 'tap min-w-11 h-11 inline-flex items-center justify-center rounded-full border border-line bg-surf text-fg hover:bg-surf2 cursor-pointer';

  return (
    <div className="rounded-xl bg-surf border border-line p-3 space-y-2 min-w-0" aria-label={`Nagranie: ${title}`}>
      <audio ref={ref} src={src} preload="metadata"
        onLoadedMetadata={onMeta} onTimeUpdate={onTime}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); store(posKey, ''); }}
        onError={() => setErr('Nagranie jest chwilowo niedostępne.')} />

      <div className="flex items-center gap-2 min-w-0">
        <button type="button" onClick={() => skip(-15)} className={btn} aria-label="Cofnij 15 sekund"><RotateCcw className="w-5 h-5" /></button>
        <button type="button" onClick={toggle} aria-label={playing ? 'Pauza' : 'Odtwórz'}
          className="tap min-w-12 h-12 inline-flex items-center justify-center rounded-full bg-sky-500/20 text-acc border border-sky-400/30 hover:bg-sky-500/30 cursor-pointer">
          {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        <button type="button" onClick={() => skip(15)} className={btn} aria-label="Do przodu 15 sekund"><RotateCw className="w-5 h-5" /></button>
        <span className="ml-auto text-sm text-mut tabular-nums shrink-0">{fmt(time)} / {fmt(dur)}</span>
      </div>

      <input type="range" min={0} max={dur || 0} step={1} value={Math.min(time, dur || 0)}
        onChange={e => seek(Number(e.target.value))} aria-label="Przewijanie nagrania"
        className="w-full min-w-0 accent-sky-500 cursor-pointer" />

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tempo czytania">
        <span className="text-sm text-mut mr-1">Tempo</span>
        {RATES.map(r => (
          <button key={r} type="button" onClick={() => setRate(r)} aria-pressed={rate === r}
            className={`tap min-w-11 px-3 rounded-full border text-sm cursor-pointer ${rate === r ? 'bg-sky-500/20 text-acc border-sky-400/30' : 'bg-surf text-fg2 border-line hover:bg-surf2'}`}>
            {r.toString().replace('.', ',')}×
          </button>
        ))}
      </div>
      {err && <p className="text-sm text-bad" role="alert">{err}</p>}
    </div>
  );
};
