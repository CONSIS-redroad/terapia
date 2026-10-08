// PATH: src/demo/rules.ts | REQ-ID: TERAPIA-RULES-01
// Zasady grupy + regulamin korzystania (WERSJA ROBOCZA — do weryfikacji prawnej przed startem).
// Zmiana treści = podbij RULES_VERSION, żeby aplikacja poprosiła o ponowną akceptację.

export const RULES_VERSION = '2026-10-08';

export interface RuleItem { title: string; body: string }

/** Numery kryzysowe — wspólne dla zasad, panelu i onboardingu. */
export const CRISIS_LINES: { label: string; number: string; tel: string; note?: string }[] = [
  { label: 'Numer alarmowy', number: '112', tel: '112', note: 'zagrożenie życia lub zdrowia' },
  { label: 'Kryzysowy Telefon Zaufania', number: '116 123', tel: '116123' },
  { label: 'Centrum Wsparcia (całodobowo)', number: '800 70 2222', tel: '800702222' },
];

export const GROUP_RULES: RuleItem[] = [
  {
    title: 'Co tu mówimy, zostaje tu',
    body: 'Historie, imiona i szczegóły, którymi dzielą się inni, nie wychodzą poza grupę. Nie robimy zrzutów ekranu cudzych wiadomości ani nie przekazujemy ich dalej.',
  },
  {
    title: 'Mówimy o sobie',
    body: 'Opowiadamy o własnych doświadczeniach i uczuciach („ja czuję”, „u mnie było”), zamiast oceniać lub tłumaczyć innych.',
  },
  {
    title: 'Szacunek bez ocen',
    body: 'Każdy ma prawo do swoich przeżyć i swojego tempa. Słuchamy uważnie, nie wyśmiewamy, nie krytykujemy, nie dajemy rad, o które nikt nie prosił.',
  },
  {
    title: 'Można powiedzieć „pas”',
    body: 'Nie musisz odpowiadać na każde pytanie ani dzielić się wszystkim. Twoje „nie teraz” jest w porządku i nikt nie będzie naciskał.',
  },
  {
    title: 'Punktualność i nieobecności',
    body: 'Staramy się przychodzić na czas. Jeśli nie możesz być na spotkaniu albo się spóźnisz — daj znać prowadzącej, najlepiej wcześniej.',
  },
  {
    title: 'Czat to nie pomoc w kryzysie',
    body: 'Grupa wspiera, ale nie zastąpi pomocy w nagłej sytuacji. W kryzysie dzwoń: 112, 116 123 (Kryzysowy Telefon Zaufania) lub 800 70 2222 (Centrum Wsparcia).',
  },
  {
    title: 'Twój dzienniczek jest tylko Twój',
    body: 'Prywatny dzienniczek samoobserwacji nie jest widoczny dla grupy. Sam decydujesz, czy i co z niego opowiesz.',
  },
];

export const APP_TERMS: RuleItem[] = [
  {
    title: 'Wersja robocza',
    body: 'Ten regulamin jest wersją roboczą — do weryfikacji prawnej przed startem aplikacji. Ostateczna treść może się zmienić; poprosimy wtedy o ponowną akceptację.',
  },
  {
    title: '1. Dostęp do grupy',
    body: 'Do grupy dołączasz tylko po akceptacji prowadzącej lub administratora. Dostęp jest osobisty — nie udostępniaj go innym osobom.',
  },
  {
    title: '2. Co widzi grupa',
    body: 'W grupie zawsze widoczne jest co najmniej Twoje imię — jest obowiązkowe (może być zdrobnienie). Nazwisko, zdjęcie i opis pokazujemy tylko wtedy, gdy sam je włączysz w ustawieniach profilu.',
  },
  {
    title: '3. Odpowiedzialność za treści',
    body: 'Za treść wiadomości i przesłane pliki odpowiada osoba, która je przesłała. Nie wolno przesyłać: cudzych danych osobowych (np. zdjęć, adresów, numerów innych osób bez ich zgody), cudzych utworów bez prawa do ich udostępniania, treści obraźliwych, nienawistnych ani nielegalnych.',
  },
  {
    title: '4. Pliki i limity',
    body: 'Możesz przesyłać zdjęcia, wideo, nagrania głosowe, PDF, dokumenty i pliki TXT. Limit: do 20 MB na jeden plik i do 40 MB łącznie na osobę. Starsze pliki możesz usunąć, żeby zrobić miejsce.',
  },
  {
    title: '5. Moderacja',
    body: 'Administrator może usunąć wiadomość lub plik niezgodny z zasadami grupy albo regulaminem, a w poważnych lub powtarzających się przypadkach — zablokować dostęp do grupy.',
  },
  {
    title: '6. Prywatność i bezpieczeństwo',
    body: 'Informacje o zdrowiu są danymi wrażliwymi — dziel się nimi świadomie. Aplikacja nie jest narzędziem pomocy w nagłych wypadkach: w kryzysie dzwoń 112, 116 123 lub 800 70 2222. Dzienniczek samoobserwacji to osobna aplikacja — grupa go nie widzi.',
  },
  {
    title: '7. Usunięcie konta i danych',
    body: 'W każdej chwili możesz poprosić prowadzącą lub administratora o usunięcie konta i swoich danych. Usuniemy je bez zbędnej zwłoki.',
  },
];
