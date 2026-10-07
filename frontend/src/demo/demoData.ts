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

/** Najbliższy wtorek (lub dziś, jeśli wtorek) przesunięty o `weeks` tygodni. */
function tuesday(weeks: number, hour = 18): string {
  const now = new Date();
  const delta = (2 - now.getDay() + 7) % 7;
  return at(delta + weeks * 7, hour);
}

export const DEMO_GROUP: Group = {
  id: 'demo-grupa-1',
  name: 'Grupa wsparcia „Krok po kroku”',
  description: 'Przykładowa grupa terapeutyczna — cykl 24 zajęć o radzeniu sobie ze stresem i napięciem.',
  schedule: 'wtorki 18:00–19:30 · cykl 24 zajęć',
};

export const DEMO_MEMBERS: Member[] = [
  { id: 'm-ter', name: 'Anna (prowadząca)', role: 'therapist', status: 'approved', joinedAt: at(-40, 12), emoji: '🦉', color: '#38bdf8' },
  { id: 'm-1', name: 'Kasia', role: 'participant', status: 'approved', joinedAt: at(-35, 10), emoji: '🌸', color: '#f472b6' },
  { id: 'm-2', name: 'Wędrowiec', role: 'participant', status: 'approved', joinedAt: at(-35, 11), emoji: '🐢', color: '#34d399', email: 'wedrowiec@example.com' },
  { id: 'm-3', name: 'Ola', role: 'participant', status: 'approved', joinedAt: at(-30, 9), emoji: '🌊', color: '#a78bfa' },
  { id: 'm-4', name: 'M.', role: 'participant', status: 'approved', joinedAt: at(-28, 20), emoji: '🍀', color: '#fbbf24' },
  { id: 'm-5', name: 'Słonecznik', role: 'participant', status: 'approved', joinedAt: at(-21, 19), emoji: '🌻', color: '#fbbf24' },
  { id: 'm-6', name: 'Piotr', role: 'participant', status: 'pending', joinedAt: at(-1, 21), email: 'piotr@example.com', emoji: '🙂', color: '#94a3b8' },
  { id: 'm-7', name: 'Magda', role: 'participant', status: 'pending', joinedAt: at(0, 8), email: 'magda@example.com', emoji: '🙂', color: '#94a3b8' },
];

export const DEMO_MEETINGS: Meeting[] = [
  { id: 'sp-1', date: tuesday(-6), durationMin: 90, topic: 'Poznajmy się — zasady grupy', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-2', date: tuesday(-5), durationMin: 90, topic: 'Skąd się bierze napięcie?', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-3', date: tuesday(-4), durationMin: 90, topic: 'Oddech i ciało', place: 'online', link: 'https://meet.example.com/demo' },
  { id: 'sp-4', date: tuesday(-3), durationMin: 90, topic: 'Myśli automatyczne', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-5', date: tuesday(-2), durationMin: 90, topic: 'Emocje — jak je nazywać', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-6', date: tuesday(-1), durationMin: 90, topic: 'Granice i asertywność', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-7', date: tuesday(0), durationMin: 90, topic: 'Sen i odpoczynek', place: 'online', link: 'https://meet.example.com/demo' },
  { id: 'sp-8', date: tuesday(1), durationMin: 90, topic: 'Ruch a nastrój', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-9', date: tuesday(2), durationMin: 90, topic: 'Relacje w rodzinie', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-10', date: tuesday(3), durationMin: 90, topic: 'Złość — co z nią robić', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-11', date: tuesday(4), durationMin: 90, topic: 'Lęk i unikanie', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-12', date: tuesday(5), durationMin: 90, topic: 'Samokrytyka i życzliwość dla siebie', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-13', date: tuesday(6), durationMin: 90, topic: 'Przerwa w połowie — podsumowanie', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-14', date: tuesday(7), durationMin: 90, topic: 'Nawyki i małe kroki', place: 'online', link: 'https://meet.example.com/demo' },
  { id: 'sp-15', date: tuesday(8), durationMin: 90, topic: 'Praca i obowiązki', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-16', date: tuesday(9), durationMin: 90, topic: 'Samotność i bliskość', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-17', date: tuesday(10), durationMin: 90, topic: 'Trudne rozmowy', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-18', date: tuesday(11), durationMin: 90, topic: 'Wartości — co jest ważne', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-19', date: tuesday(12), durationMin: 90, topic: 'Uważność na co dzień', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-20', date: tuesday(13), durationMin: 90, topic: 'Nawroty i gorsze dni', place: 'online', link: 'https://meet.example.com/demo' },
  { id: 'sp-21', date: tuesday(14), durationMin: 90, topic: 'Wsparcie — kogo mam obok', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-22', date: tuesday(15), durationMin: 90, topic: 'Plan na trudne dni', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-23', date: tuesday(16), durationMin: 90, topic: 'Co się zmieniło?', place: 'Sala 2, ul. Przykładowa 1' },
  { id: 'sp-24', date: tuesday(17), durationMin: 90, topic: 'Pożegnanie i dalsza droga', place: 'Sala 2, ul. Przykładowa 1' },
];

export const DEMO_MATERIALS: Material[] = [
  { id: 'mt-1', title: 'Zasady grupy (1 strona)', kind: 'pdf', url: '#demo-plik', addedAt: tuesday(-6, 12), meetingId: 'sp-1' },
  { id: 'mt-2', title: 'Karta pracy: mapa napięcia w ciele', kind: 'pdf', url: '#demo-plik', addedAt: tuesday(-5, 12), meetingId: 'sp-2' },
  { id: 'mt-3', title: 'Ćwiczenie oddechowe 4-7-8 (nagranie)', kind: 'audio', url: 'https://example.com/nagranie-demo', addedAt: tuesday(-4, 12), meetingId: 'sp-3', note: 'Link zewnętrzny — nagrania nie trzymamy na naszym serwerze.' },
  { id: 'mt-4', title: 'Film: jak działa reakcja stresowa', kind: 'video', url: 'https://www.youtube.com/', addedAt: tuesday(-4, 13), meetingId: 'sp-3' },
  { id: 'mt-5', title: 'Dzienniczek myśli — wzór', kind: 'pdf', url: '#demo-plik', addedAt: tuesday(-3, 9), meetingId: 'sp-4' },
  { id: 'mt-6', title: 'Grafika: koło emocji', kind: 'image', url: '#demo-plik', addedAt: tuesday(-2, 9), meetingId: 'sp-5' },
  { id: 'mt-7', title: 'Lista praw asertywnych', kind: 'pdf', url: '#demo-plik', addedAt: tuesday(-1, 9), meetingId: 'sp-6' },
  { id: 'mt-8', title: 'Higiena snu — 10 zasad', kind: 'pdf', url: '#demo-plik', addedAt: tuesday(0, 9), meetingId: 'sp-7' },
  { id: 'mt-9', title: 'Relaksacja przed snem (nagranie)', kind: 'audio', url: 'https://example.com/relaks-demo', addedAt: tuesday(0, 9), meetingId: 'sp-7' },
  { id: 'mt-10', title: 'Plan na trudne dni — szablon', kind: 'pdf', url: '#demo-plik', addedAt: tuesday(-6, 12), meetingId: 'sp-22', note: 'Dodany z wyprzedzeniem.' },
];

export const DEMO_ANNOUNCEMENTS: Announcement[] = [
  { id: 'og-1', authorId: 'm-ter', date: at(-1, 10), pinned: true, title: 'Wtorek — przeczytajcie zasady snu', body: 'Na najbliższych zajęciach rozmawiamy o śnie. „Higiena snu — 10 zasad” jest w kalendarzu przy tych zajęciach.' },
  { id: 'og-2', authorId: 'm-ter', date: at(-6, 18), title: 'Spotkanie 3 było online', body: 'Dziękuję za obecność. Nagranie ćwiczenia oddechowego dodałam do Materiałów (link).' },
  { id: 'og-3', authorId: 'm-ter', date: at(-20, 9), title: 'Witajcie w grupie', body: 'Tu znajdziecie terminy spotkań, materiały i rozmowę grupy. Prywatny dzienniczek pozostaje tylko Wasz — nie widzę go.' },
];

export const DEMO_MESSAGES: Message[] = [
  { id: 'r-1', authorId: 'm-1', date: at(-3, 19, 12), body: 'Ćwiczenie 4-7-8 przed snem naprawdę pomaga, zasnęłam szybciej niż zwykle.' },
  { id: 'r-2', authorId: 'm-2', date: at(-3, 19, 40), body: 'U mnie przy liczeniu do 7 się gubię 😅 ale próbuję dalej.' },
  { id: 'r-3', authorId: 'm-ter', date: at(-3, 20, 5), body: 'Wędrowcze, można zacząć od 3-4-5 i wydłużać. Liczy się regularność, nie rekord.' },
  { id: 'r-4', authorId: 'm-3', date: at(-2, 8, 30), body: 'Czy kartę z myślami mamy wypełniać codziennie, czy wystarczy kilka razy?' },
  { id: 'r-5', authorId: 'm-ter', date: at(-2, 9, 2), body: 'Kilka sytuacji w tygodniu wystarczy. Najlepiej te, które wywołały silniejszą emocję.' },
  { id: 'r-6', authorId: 'm-5', date: at(-1, 21, 15), body: 'Do zobaczenia we wtorek! Będę 5 minut później, przepraszam z góry.' },
];

/** W demo „Ty” to uczestnik  (profil z panelu „Mój profil”). Panel akceptacji pokazany jako podgląd widoku prowadzącej. */
export const DEMO_CURRENT_USER_ID = 'me';
