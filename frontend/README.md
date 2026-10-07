# TERAPIA — frontend (faza 0: demo)

Powłoka i panele na bazie `CONSIS-redroad/Luna2` (React 19 + Vite + Tailwind + PWA).
Faza 0: **bez logowania, wyłącznie dane fikcyjne** (`src/demo/demoData.ts`).

- Ekrany biorą dane tylko z `src/services/groupData.ts` (interfejs `GroupDataSource`) — w fazie 1 podmiana na Supabase.
- Profil uczestnika: `src/services/profile.ts` — grupa domyślnie widzi tylko pseudonim i ikonkę; resztę uczestnik włącza sam
  (`publicView()` = jedyne źródło tego, co widzi grupa). W fazie 1 widoczność egzekwuje baza (RLS), nie tylko UI.
- Uruchomienie: `npm install` → `npm run dev` (port 3000) · `npx tsc --noEmit` · `npm run build`.
- Wydanie: GitHub Actions `.github/workflows/pages.yml` → https://consis-redroad.github.io/terapia/
