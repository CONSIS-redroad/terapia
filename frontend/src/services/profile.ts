// PATH: src/services/profile.ts | REQ-ID: TERAPIA-PROFILE-01
// Profil uczestnika. Zasada: grupa domyślnie widzi TYLKO pseudonim i awatar-ikonkę.
// Wszystko więcej uczestnik włącza sam (przełączniki „pokaż grupie”).
// FAZA 0: profil żyje tylko w tej przeglądarce (jak dzienniczek). FAZA 1: tabela `profiles` w Supabase
// + pola widoczności egzekwowane po stronie bazy (RLS / widok), nie tylko w interfejsie.

export type AvatarKind = 'emoji' | 'photo' | 'google';

export interface Profile {
  pseudonym: string;
  avatarKind: AvatarKind;
  emoji: string;
  color: string;
  photoDataUrl?: string; // własne zdjęcie — w demo tylko lokalnie, nigdzie nie wysyłane
  realName: string;
  about: string;
  show: { photo: boolean; realName: boolean; about: boolean };
}

export const EMOJIS = ['🌿', '🌊', '🌙', '☀️', '🌸', '🍀', '🦉', '🐢', '🦋', '🌻', '⭐', '🍂'];
export const COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#94a3b8'];

const KEY = 'terapia_profile_v1';

export const DEFAULT_PROFILE: Profile = {
  pseudonym: '', // imię — wymagane, uzupełnia ekran powitalny
  avatarKind: 'emoji',
  emoji: '🌿',
  color: '#38bdf8',
  realName: '',
  about: '',
  show: { photo: false, realName: false, about: false },
};

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw), show: { ...DEFAULT_PROFILE.show, ...JSON.parse(raw).show } };
  } catch { /* prywatne okno — działa bez zapisu */ }
  return DEFAULT_PROFILE;
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignoruj */ }
}

export function clearProfile() {
  try { localStorage.removeItem(KEY); } catch { /* ignoruj */ }
}

/** Jak profil wygląda OCZAMI GRUPY — jedyna funkcja, z której ma korzystać widok grupy. */
export function publicView(p: Profile) {
  return {
    name: p.show.realName && p.realName.trim() ? `${p.pseudonym} (${p.realName.trim()})` : p.pseudonym,
    usePhoto: p.show.photo && p.avatarKind === 'photo' && !!p.photoDataUrl,
    about: p.show.about ? p.about.trim() : '',
  };
}

/** Zmniejsza zdjęcie do 160 px, żeby nie zapchać pamięci przeglądarki. */
export function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('To nie jest obraz.')); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 160;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) { reject(new Error('Brak canvas.')); return; }
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Nie udało się wczytać obrazu.')); };
    img.src = url;
  });
}
