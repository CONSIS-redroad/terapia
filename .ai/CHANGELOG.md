# Changelog

## 2026-10-07 — Szkielet
- utworzono szkielet platformy, roadmapę, dokumentację AI, bezpieczeństwa, model danych i moduły.

## 2026-10-07 — Window Manager
- dodano niezależny moduł `modules/window-manager`
- design oparto na komponentach paneli i modali z `CONSIS-redroad/Luna2`
- dodano drag, resize, z-index, minimize, maximize, close
- dodano persystencję układu w localStorage
- dodano fallback mobile full-screen
- nie powiązano modułu z żadnym modułem domenowym TERAPIA

## 2026-10-08 — Plan i decyzje
- `docs/PLAN-SKLADANIA.md` (fazy 1–4), decyzje D005–D007 (Supabase + Atomic CRM, akceptacja admina, pliki/wideo).
- 2026-10-08: D005 poprawione — baza kodu Luna2 zamiast Atomic CRM.

## 2026-10-08 — Faza 0: demo
- `frontend/` = Luna2 przerobiona na panel grupy: Mój profil (pseudonim, awatar ikonka/zdjęcie, przełączniki „pokaż grupie”), Spotkania, Ogłoszenia, Rozmowa grupy, Materiały, Uczestnicy i akceptacja (podgląd prowadzącej).
- Dane fikcyjne za warstwą `services/groupData.ts`; usunięte Firebase/three/pogoda/księżyc.
- GitHub Pages przez Actions. Testy: tsc 0, build 0, headless (desktop + 390 px) bez błędów konsoli; poprawiony błąd dat przy zmianie czasu.
- 2026-10-08: tryb jasny i ciemny (zmienne motywu w `index.css`, przełącznik: jak w urządzeniu → jasny → ciemny).
- 2026-10-08: tryb admina (tylko admin widzi panel: wpuść / odrzuć / dodaj osobę / usuń / przywróć), w demo przełącznik „Uczestnik / Admin”.
- 2026-10-08: kalendarz zajęć — cykl (demo: 24 wtorki), kropki w dniach zajęć, klik = temat, miejsce, link i materiały TYCH zajęć; każdy materiał przypięty do zajęć (`meetingId`).
- 2026-10-08: telefon / tablet / komputer — układ 2 kolumny od 1024 px, przycisk „Zainstaluj” (PWA) z instrukcją dla iOS, Androida i komputera.
