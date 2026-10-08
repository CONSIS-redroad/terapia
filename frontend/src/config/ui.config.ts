// PATH: src/config/ui.config.ts | REQ-ID: TERAPIA-UI-CONFIG-01
// JEDNO miejsce konfiguracji wyglądu: emotki, ikonki, nazwy ekranów, kategorie mediów, marka.
// Jak zmieniać:
//  - emotki: dopisz/usuń znak w tablicy (to zwykły tekst, wklejasz emotkę jak literę);
//  - ikonki: nazwy z https://lucide.dev/icons — zaimportuj ją niżej z 'lucide-react' i wstaw w pole `icon`;
//  - kolory i tło interfejsu NIE tutaj — te żyją w motywach (src/themes + klasy bg-panel/text-fg itd.).
// Po zmianie: `npx tsc --noEmit` (typy pilnują, żeby żadnego ekranu ani kategorii nie zabrakło).
import {
  BookOpen, History, CalendarCog, CalendarDays, Clapperboard, ClipboardCheck, FileText, Headphones, Library, LifeBuoy,
  MessagesSquare, ScrollText, Shapes, ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PanelId } from '../types/panelLayout';
import type { MediaCategory } from '../types/group';

// ─── Marka ───────────────────────────────────────────────────────────────────
/** Nazwa aplikacji i kolor kropki-akcentu przy logo (hex). */
export const BRAND = {
  appName: 'TERAPIA',
  accentDot: '#7dd3fc',
} as const;

// ─── Czat ────────────────────────────────────────────────────────────────────
/** Szybkie reakcje pod wiadomością (pasek po stuknięciu w dymek). Najlepiej 5–7 sztuk — więcej się zawija. */
export const CHAT_QUICK_REACTIONS: string[] = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export interface EmojiCategory {
  /** Nazwa zakładki w panelu emotek. */
  label: string;
  /** Emotki tej zakładki — kolejność = kolejność w siatce. */
  emoji: string[];
}

/** Panel emotek przy polu wiadomości: zakładki kategorii. Nową kategorię dodajesz kolejnym obiektem `{ label, emoji }`. */
export const CHAT_EMOJI_PICKER: EmojiCategory[] = [
  { label: 'Uśmiechy', emoji: ['😊', '🙂', '😉', '😄', '😂', '🥲', '😅', '😌', '🤗', '🤔', '😮', '😢', '😭', '😔', '😤', '😴', '🥰', '😍'] },
  { label: 'Gesty', emoji: ['👍', '👎', '👏', '🙏', '💪', '🤝', '👋', '✌️'] },
  { label: 'Serca', emoji: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤍'] },
  { label: 'Natura', emoji: ['🌸', '🌿', '☀️', '🌧️'] },
  { label: 'Inne', emoji: ['✨', '🍵', '🎉', '✅', '❓'] },
];

// ─── Profil / awatar ─────────────────────────────────────────────────────────
/** Emotki do wyboru jako awatar (gdy ktoś nie wgrywa zdjęcia). */
export const AVATAR_EMOJIS: string[] = ['🌿', '🌊', '🌙', '☀️', '🌸', '🍀', '🦉', '🐢', '🦋', '🌻', '⭐', '🍂'];
/** Kolory tła kółka awatara (hex). */
export const AVATAR_COLORS: string[] = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#94a3b8'];

// ─── Nawigacja ekranów ───────────────────────────────────────────────────────
/** Krótka nazwa + ikonka każdego ekranu (karuzela na telefonie, przyciski nawigacji). Klucz = id panelu — wszystkie wymagane. */
export const NAV_SCREENS: Record<PanelId, { label: string; icon: LucideIcon }> = {
  meetings: { label: 'Kalendarz', icon: CalendarDays },
  homework: { label: 'Prace', icon: ClipboardCheck },
  materials: { label: 'Media', icon: Library },
  chat: { label: 'Czat', icon: MessagesSquare },
  rules: { label: 'Zasady', icon: ScrollText },
  members: { label: 'Admin', icon: ShieldCheck },
  schedule: { label: 'Terminy', icon: CalendarCog },
  archive: { label: 'Archiwum', icon: History },
};

// ─── Biblioteka mediów ───────────────────────────────────────────────────────
export interface MediaCategoryDef {
  id: MediaCategory;
  label: string;
  icon: LucideIcon;
}

/** Kategorie w bibliotece mediów (kolejność = kolejność filtrów). Ostatnia ('inne') to kategoria zapasowa. */
export const MEDIA_CATEGORIES: MediaCategoryDef[] = [
  { id: 'zajecia', label: 'Do zajęć', icon: FileText },
  { id: 'ksiazka', label: 'Książki', icon: BookOpen },
  { id: 'poradnik', label: 'Poradniki', icon: LifeBuoy },
  { id: 'podcast', label: 'Podcasty', icon: Headphones },
  { id: 'film', label: 'Filmy', icon: Clapperboard },
  { id: 'inne', label: 'Inne', icon: Shapes },
];
