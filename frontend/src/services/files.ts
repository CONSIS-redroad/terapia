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

/** KOMPRESJA ZDJĘĆ przed wysłaniem (Bartek 12.10: „do zdjęć kompresja sensowna”): dłuższy bok max 1920 px, JPEG 0,82
 *  (jak komunikatory — ostre na telefonie, ~0,3–0,8 MB zamiast 3–8 MB). Obrót z EXIF uwzględniony. GIF (animacja),
 *  SVG i pliki, których przeglądarka nie odczyta (np. HEIC w Chrome), idą bez zmian; wynik większy od oryginału = oryginał. */
const MAX_SIDE = 1920, JPEG_Q = 0.82;
export async function compressImage(f: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 300 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' });
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return f;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);      // PNG z przezroczystością → białe tło w JPEG
    ctx.drawImage(bmp, 0, 0, w, h); bmp.close();
    const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/jpeg', JPEG_Q));
    if (!blob || blob.size >= f.size) return f;
    return new File([blob], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: f.lastModified });
  } catch { return f; }
}

/** MINIATURA do listy czatu (Bartek 12.10: „czat pokazuje miniaturki, a ładuje większe zdjęcie”): dłuższy bok 640 px,
 *  JPEG 0,72 (~30–80 kB) — ostra w dymku 240 px także na ekranie 3×. Małe zdjęcie (<150 kB) i nieczytelne
 *  (GIF, HEIC w Chrome) → null: czat pokaże wtedy sam plik. */
export const THUMB_SUFFIX = '.min.jpg';
const THUMB_SIDE = 640, THUMB_Q = 0.72;
export async function makeThumb(b: Blob): Promise<Blob | null> {
  if (!/^image\/(jpeg|png|webp)$/.test(b.type) || b.size < 150 * 1024) return null;
  try {
    const bmp = await createImageBitmap(b, { imageOrientation: 'from-image' });
    const k = Math.min(1, THUMB_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) { bmp.close(); return null; }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h); bmp.close();
    const t = await new Promise<Blob | null>(res => c.toBlob(res, 'image/jpeg', THUMB_Q));
    return t && t.size < b.size / 2 ? t : null;   // nic nie zyskujemy → bez miniatury
  } catch { return null; }
}
