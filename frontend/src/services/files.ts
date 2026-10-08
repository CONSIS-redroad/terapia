// PATH: src/services/files.ts | REQ-ID: TERAPIA-FILES-01
// Załączniki w czacie (Bartek 08.10): zdjęcia, pdf, doc, docx, txt, mp4 itp.; limit 20 MB na plik, 40 MB łącznie na osobę.
import type { Attachment, AttachmentKind } from '../types/group';

export const MAX_FILE = 20 * 1024 * 1024;
export const MAX_USER_TOTAL = 40 * 1024 * 1024;

/** Lista dla <input accept>. Rozszerzenia + typy — telefony różnie podają typ pliku. */
export const ACCEPT = [
  'image/*', 'video/mp4', 'video/quicktime', 'video/webm', 'audio/*',
  '.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt', '.xls', '.xlsx', '.ods', '.ppt', '.pptx', '.odp',
].join(',');

const OK_EXT = /\.(jpe?g|png|gif|webp|heic|heif|mp4|mov|webm|m4a|mp3|wav|ogg|pdf|docx?|odt|rtf|txt|xlsx?|ods|pptx?|odp)$/i;

export function kindOf(name: string, type: string): AttachmentKind {
  if (type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(name)) return 'video';
  if (type.startsWith('audio/') || /\.(m4a|mp3|wav|ogg)$/i.test(name)) return 'audio';
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (/\.txt$/i.test(name) || type === 'text/plain') return 'txt';
  return 'doc';
}

export function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} kB`;
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Sprawdzenie przed wysłaniem: typ, 20 MB na plik, 40 MB łącznie. Zwraca komunikat błędu albo null. */
export function checkFile(f: File, usedBytes: number): string | null {
  if (!OK_EXT.test(f.name) && !/^(image|video|audio)\//.test(f.type)) return `Tego typu pliku nie można wysłać (${f.name}). Dozwolone: zdjęcia, wideo, nagrania, PDF, dokumenty, TXT.`;
  if (f.size > MAX_FILE) return `Plik ma ${fmtSize(f.size)} — limit to 20 MB na plik.`;
  if (usedBytes + f.size > MAX_USER_TOTAL) return `Przekroczysz swój limit 40 MB (zajęte ${fmtSize(usedBytes)}). Usuń któryś ze swoich plików albo wyślij link.`;
  return null;
}

/** W demo plik żyje tylko w tej karcie przeglądarki (adres blob:) — nic nie jest wysyłane na serwer. */
export function toAttachment(f: File): Attachment {
  return { name: f.name.slice(0, 120), type: f.type || 'application/octet-stream', size: f.size, kind: kindOf(f.name, f.type), url: URL.createObjectURL(f) };
}
