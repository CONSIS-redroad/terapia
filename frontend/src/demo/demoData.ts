// PATH: src/demo/demoData.ts | REQ-ID: TERAPIA-DEMO-01
// WYŁĄCZNIE DANE FIKCYJNE (FAZA 0). Imiona, rozmowy i spotkania są zmyślone.
// Daty liczone względem „dziś”, żeby demo zawsze wyglądało świeżo.
import type { Announcement, Group, Material, Meeting, Member, Message } from '../types/group';

// Dni kalendarzowe (setDate), nie mnożenie 24 h — inaczej zmiana czasu (koniec X) przesuwa datę o dzień.
function at(daysFromToday: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Najbliższy czwartek (lub dziś, jeśli czwartek) przesunięty o `weeks` tygodni. */
function thursday(weeks: number, hour = 18): string {
  const now = new Date();
  const delta = (4 - now.getDay() + 7) % 7;
  return at(delta + weeks * 7, hour);
}

export const DEMO_GROUP: Group = {
  id: 'demo-grupa-1',
  name: 'Grupa wsparcia „Krok po kroku”',
  description: 'Przykładowa grupa terapeutyczna — 8 spotkań o radzeniu sobie ze stresem i napięciem.',
  schedule: 'czwartki 18:00–19:30',
};

export const DEMO_MEMBERS: Member[] = [
  { id: 'm-ter', name: 'Anna (prowadząca)', role: 'therapist', status: 'approved', joinedAt: at(-40, 12), emoji: '🦉', color: '#38bdf8' },
  { id: 'm-1', name: 'Kasia', role: 'participant', status: 'approved', joinedAt: at(-35, 10), emoji: '🌸', color: '#f472b6' },
  { id: 'm-2', name: 'Wędrowiec', role: 'participant', status: 'approved', joinedAt: at(-35, 11), emoji: '🐢', color: '#34d399' },
  { id: 'm-3', name: 'Ola', role: 'participant', status: 'approved', joinedAt: at(-30, 9), emoji: '🌊', color: '#a78bfa' },
  { id: 'm-4', name: 'M.', role: 'participant', status: 'approved', joinedAt: at(-28, 20), emoji: '🍀', color: '#fbbf24' },
  { id: 'm-5', name: 'Słonecznik', role: 'participant', status: 'approved', joinedAt: at(-21, 19), emoji: '🌻', color: '#fbbf24' },
  { id: 'm-6', name: 'Piotr', role: 'participant', status: 'pending', joinedAt: at(-1, 21) },
  { id: 'm-7', name: 'Magda', role: 'participant', status: 'pending', joinedAt: at(0, 8) },
];

export const DEMO_MEETINGS: Meeting[] = [
  { id: 'sp-1', date: thursday(-3), durationMin: 90, topic: 'Poznajmy się — zasady grupy', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-2', date: thursday(-2), durationMin: 90, topic: 'Skąd się bierze napięcie?', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-3', date: thursday(-1), durationMin: 90, topic: 'Oddech i ciało', place: 'online', link: 'https://meet.example.com/demo' },
  { id: 'sp-4', date: thursday(0), durationMin: 90, topic: 'Myśli automatyczne', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-5', date: thursday(1), durationMin: 90, topic: 'Granice i asertywność', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-6', date: thursday(2), durationMin: 90, topic: 'Sen i odpoczynek', place: 'online', link: 'https://meet.example.com/demo' },
  { id: 'sp-7', date: thursday(3), durationMin: 90, topic: 'Plan na trudne dni', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-8', date: thursday(4), durationMin: 90, topic: 'Podsumowanie i pożegnanie', place: 'Sala 2, ul. Przykładowa 1' },
];

export const DEMO_MATERIALS: Material[] = [
  { id: 'mt-1', title: 'Zasady grupy (1 strona)', kind: 'pdf', url: '#demo-plik', addedAt: at(-21, 12), meetingId: 'sp-1' },
  { id: 'mt-2', title: 'Karta pracy: mapa napięcia w ciele', kind: 'pdf', url: '#demo-plik', addedAt: at(-14, 12), meetingId: 'sp-2' },
  { id: 'mt-3', title: 'Ćwiczenie oddechowe 4-7-8 (nagranie)', kind: 'audio', url: 'https://example.com/nagranie-demo', addedAt: at(-7, 12), meetingId: 'sp-3', note: 'Link zewnętrzny — nagrania nie trzymamy na naszym serwerze.' },
  { id: 'mt-4', title: 'Film: jak działa reakcja stresowa', kind: 'video', url: 'https://www.youtube.com/', addedAt: at(-7, 13), meetingId: 'sp-3', note: 'Film na YouTube.' },
  { id: 'mt-5', title: 'Dzienniczek myśli — wzór', kind: 'pdf', url: '#demo-plik', addedAt: at(-1, 9), meetingId: 'sp-4' },
  { id: 'mt-6', title: 'Grafika: koło emocji', kind: 'image', url: '#demo-plik', addedAt: at(-1, 9), meetingId: 'sp-4' },
];

export const DEMO_ANNOUNCEMENTS: Announcement[] = [
  { id: 'og-1', authorId: 'm-ter', date: at(-1, 10), pinned: true, title: 'Czwartek — zabierzcie wypełnioną kartę', body: 'Na najbliższym spotkaniu omawiamy „Dzienniczek myśli”. Wzór jest w Materiałach. Wystarczą 2–3 sytuacje z tygodnia.' },
  { id: 'og-2', authorId: 'm-ter', date: at(-6, 18), title: 'Spotkanie 3 było online', body: 'Dziękuję za obecność. Nagranie ćwiczenia oddechowego dodałam do Materiałów (link).' },
  { id: 'og-3', authorId: 'm-ter', date: at(-20, 9), title: 'Witajcie w grupie', body: 'Tu znajdziecie terminy spotkań, materiały i rozmowę grupy. Prywatny dzienniczek pozostaje tylko Wasz — nie widzę go.' },
];

export const DEMO_MESSAGES: Message[] = [
  { id: 'r-1', authorId: 'm-1', date: at(-3, 19, 12), body: 'Ćwiczenie 4-7-8 przed snem naprawdę pomaga, zasnęłam szybciej niż zwykle.' },
  { id: 'r-2', authorId: 'm-2', date: at(-3, 19, 40), body: 'U mnie przy liczeniu do 7 się gubię 😅 ale próbuję dalej.' },
  { id: 'r-3', authorId: 'm-ter', date: at(-3, 20, 5), body: 'Wędrowcze, można zacząć od 3-4-5 i wydłużać. Liczy się regularność, nie rekord.' },
  { id: 'r-4', authorId: 'm-3', date: at(-2, 8, 30), body: 'Czy kartę z myślami mamy wypełniać codziennie, czy wystarczy kilka razy?' },
  { id: 'r-5', authorId: 'm-ter', date: at(-2, 9, 2), body: 'Kilka sytuacji w tygodniu wystarczy. Najlepiej te, które wywołały silniejszą emocję.' },
  { id: 'r-6', authorId: 'm-5', date: at(-1, 21, 15), body: 'Do zobaczenia w czwartek! Będę 5 minut później, przepraszam z góry.' },
];

/** W demo „Ty” to uczestnik  (profil z panelu „Mój profil”). Panel akceptacji pokazany jako podgląd widoku prowadzącej. */
export const DEMO_CURRENT_USER_ID = 'me';
