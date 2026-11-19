# PATH: tools/import/ocr9_zrodla.py | REQ-ID: TERAPIA-IMPORT-05
"""Skan źródła lektury → OCR9 → podmiana PDF-a w Storage (Bartek 19.11: „materiał zawsze mini OCR9 — obróci strony,
da warstwę tekstu; przepuszczaj pliki i podmieniaj”).

Kolejność dla NOWEGO materiału ze skanu: (1) ten skrypt, (2) `zrodla_lektury.py` (obrazy stron do czytnika).
OCR9 sam obraca strony 90/270 (autorotate). Gdy autorotate strony NIE wykryje (19.11: rozkładówki skanowane bokiem
w „Porozumiewaniu”, str. 5 w jedną stronę, 6–8 w drugą), w konfiguracji źródła `"obroc": {"5": 90, "6": 270}` = obrót
strony PDF zgodnie z ruchem wskazówek zegara PRZED OCR9 (bezstratnie, /Rotate). Sprawdź podgląd stron po OCR9.

Bierze PDF-y z `prywatne/zrodla/<slug>.json` (pole `pdf`) albo podane ścieżki Storage.
Oryginał zostaje w `prywatne/zrodla_ocr9/oryginaly/` (kopia przed podmianą), wynik OCR9 obok (`*_ocr9.pdf`).
OCR9 lokalnie na MSI (`--local`): dispatch TOMKA nie widzi dysku C: MSI, a treść grupy nie idzie na Z:.

Użycie:
  python tools/import/ocr9_zrodla.py prywatne/zrodla/<slug>.json            # próba: pobiera + OCR9, nic nie podmienia
  python tools/import/ocr9_zrodla.py prywatne/zrodla/<slug>.json --podmien  # + wgranie *_ocr9.pdf w miejsce oryginału
  python tools/import/ocr9_zrodla.py admin/materials/<uuid>.pdf --podmien   # pojedynczy plik
Zmienna OCR9_DIR (domyślnie C:/BartsGda4/OCR9).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

if not os.environ.get('TERAPIA_SUPABASE_TOKEN'):
    os.environ['TERAPIA_SUPABASE_TOKEN'] = subprocess.run(['rrv', 'get', 'TERAPIA_SUPABASE_TOKEN'], capture_output=True, text=True).stdout.strip()
sys.path.insert(0, str(Path(__file__).parent))
import wgraj_archiwum as w  # noqa: E402

OCR9 = Path(os.environ.get('OCR9_DIR', 'C:/BartsGda4/OCR9'))
DIR = Path(__file__).resolve().parents[2] / 'prywatne' / 'zrodla_ocr9' / 'oryginaly'


def tekst_stron(pdf: Path) -> list[int]:
    import fitz
    with fitz.open(pdf) as d:
        return [len(p.get_text().strip()) for p in d]


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    podmien = '--podmien' in sys.argv
    sciezki: list[str] = []
    obroc: dict[str, dict] = {}
    for a in args:
        if a.endswith('.json'):
            for z in json.loads(Path(a).read_text(encoding='utf-8'))['zrodla']:
                if z.get('pdf'):
                    sciezki.append(z['pdf'])
                    if z.get('obroc'):
                        obroc[z['pdf']] = z['obroc']
        else:
            sciezki.append(a)
    if not sciezki:
        sys.exit(__doc__)
    key = w.secret_key(w.DEF_REF)
    DIR.mkdir(parents=True, exist_ok=True)
    for sp in sciezki:
        orig = DIR / Path(sp).name
        if not orig.exists():
            st, data = w._http('GET', f'https://{w.DEF_REF}.supabase.co/storage/v1/object/{w.BUCKET}/{sp}', {'Authorization': 'Bearer ' + key, 'apikey': key})
            if st != 200:
                sys.exit(f'Nie pobrałem {sp}: {st}')
            orig.write_bytes(data)
        wejscie = orig
        if sp in obroc:                     # obrót ręczny przed OCR9 — bezstratny /Rotate, osobny folder (OCR9 pamięta po nazwie)
            import fitz
            wejscie = DIR.parent / 'obrocone' / orig.name
            wejscie.parent.mkdir(exist_ok=True)
            if not wejscie.exists():
                with fitz.open(orig) as d:
                    for n, kat in obroc[sp].items():
                        d[int(n) - 1].set_rotation((d[int(n) - 1].rotation + int(kat)) % 360)
                    d.save(wejscie)
        wynik = wejscie.with_name(wejscie.stem + '_ocr9.pdf')
        if not wynik.exists():
            r = subprocess.run([sys.executable, 'cli_mill.py', '--file', str(wejscie), '--local', '--force', '--force-ocr', '--no-chroma'],
                               cwd=OCR9, capture_output=True, text=True, encoding='utf-8', errors='replace')
            if not wynik.exists():
                sys.exit(f'OCR9 nie dał {wynik.name}:\n{(r.stdout + r.stderr)[-1500:]}')
        przed, po = tekst_stron(orig), tekst_stron(wynik)
        puste = [i + 1 for i, n in enumerate(po) if n < 20]
        print(f'{sp}: {len(po)} str., tekst przed {sum(przed)} zn. → po {sum(po)} zn.' + (f', strony bez tekstu: {puste}' if puste else ''))
        if len(po) != len(przed):
            sys.exit(f'  liczba stron się zmieniła ({len(przed)} → {len(po)}) — nie podmieniam')
        if podmien:
            st = w.Projekt(w.DEF_REF, key).upload(sp, wynik.read_bytes(), 'application/pdf')[0]
            if st not in (200, 201):
                sys.exit(f'  podmiana {sp}: {st}')
            print('  podmieniono w Storage')
    if not podmien:
        print('PRÓBA — nic nie podmieniono; dodaj --podmien. Potem zrodla_lektury.py … --wgraj (nowe obrazy stron).')


if __name__ == '__main__':
    main()
