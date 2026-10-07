// PATH: src/services/format.ts | REQ-ID: TERAPIA-FORMAT-01
const TZ = 'Europe/Warsaw';

export function fmtDayLong(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date(iso));
}

export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
}

export function fmtShort(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso));
}

export function fmtRelative(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'przed chwilą';
  if (diffMin < 60) return `${diffMin} min temu`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h} godz. temu`;
  return `${fmtShort(iso)}, ${fmtTime(iso)}`;
}

export function isPast(iso: string, durationMin = 0): boolean {
  return new Date(iso).getTime() + durationMin * 60000 < Date.now();
}
