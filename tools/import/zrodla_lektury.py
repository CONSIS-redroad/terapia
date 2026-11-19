# PATH: tools/import/zrodla_lektury.py | REQ-ID: TERAPIA-IMPORT-04
"""Źródło lektury do przycisku „Źródło” w czytniku (0.15.0): skan PDF / zdjęcie → obrazy stron w Storage grupy
+ `body.zrodla` i `section.zrodlo = {z, s}` w `archive_items` (s = strona PLIKU, nie numer z druku — Bartek 19.11).

KONFIGURACJA (treść grupy → trzymaj w `prywatne/zrodla/<slug>.json`, NIE w repo):
{
  "slug": "porozumiewanie-sie-z-drugim-czlowiekiem",
  "zrodla": [
    {"id": "p", "name": "15. Porozumiewanie się… (skan)", "pdf": "admin/materials/<uuid>.pdf",
     "transkrypcja": "C:/…/transkrypcja.json",             # opcjonalnie: do trybu „auto”
     "obroc": {"5": 90}},                                    # opcjonalnie: strona 5 pliku obrócona o 90° w lewo (skan bokiem)
    {"id": "t", "name": "Tablica z zajęć", "obraz": "admin/meetings/<id>/<uuid>.jpg"}   # zdjęcie = jedna strona
  ],
  "sekcje": ["p:1", "p:1", "p:auto", "p:druk-3", null, …]   # jedna pozycja na sekcję body.sections (w kolejności)
}
  "p:5"      — strona 5 pliku
  "p:auto"   — strona transkrypcji (pages[].pdf_page), na której jest początek tekstu sekcji
  "p:druk-3" — numer z druku (section.page) minus 3 (skan zaczyna się od wcześniejszej strony)
  null       — bez źródła (czytnik weźmie najbliższą wcześniejszą sekcję)

Użycie:
  python tools/import/zrodla_lektury.py prywatne/zrodla/<slug>.json            # próba: pobiera, renderuje, wypisuje mapę
  python tools/import/zrodla_lektury.py prywatne/zrodla/<slug>.json --wgraj    # + obrazy do Storage + zapis body
Po ponownym `wgraj_archiwum.py` tej lektury (nadpisuje body) — uruchom to jeszcze raz.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

if not os.environ.get('TERAPIA_SUPABASE_TOKEN'):
    os.environ['TERAPIA_SUPABASE_TOKEN'] = subprocess.run(['rrv', 'get', 'TERAPIA_SUPABASE_TOKEN'], capture_output=True, text=True).stdout.strip()
sys.path.insert(0, str(Path(__file__).parent))
import wgraj_archiwum as w  # noqa: E402

MAX_W = 1240          # px — czytelny skan A4 na telefonie i komputerze
JPEG_Q = 72
TMP = Path(__file__).resolve().parents[2] / 'prywatne' / 'zrodla_tmp'


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '', s.replace('ł', 'l'))


def sql(q: str):
    h = {'Authorization': 'Bearer ' + w.management_token(), 'User-Agent': 'terapia-import', 'Content-Type': 'application/json'}
    st, r = w._http('POST', f'https://api.supabase.com/v1/projects/{w.DEF_REF}/database/query', h, json.dumps({'query': q}).encode())
    if st not in (200, 201):
        sys.exit(f'SQL {st}: {str(r)[:300]}')
    return r


def lit(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def pobierz(key: str, path: str) -> bytes:
    st, data = w._http('GET', f'https://{w.DEF_REF}.supabase.co/storage/v1/object/{w.BUCKET}/{path}', {'Authorization': 'Bearer ' + key, 'apikey': key})
    if st != 200:
        sys.exit(f'Nie pobrałem {path}: {st}')
    return data if isinstance(data, bytes) else bytes(data)


def strony_pdf(pdf: bytes, obroc: dict | None = None) -> list[bytes]:
    import io
    import fitz  # PyMuPDF
    from PIL import Image
    out = []
    with fitz.open(stream=pdf, filetype='pdf') as d:
        for i, p in enumerate(d, 1):
            kat = int((obroc or {}).get(str(i), 0))
            bok = p.rect.height if kat in (90, 270) else p.rect.width     # po obrocie szerokością staje się wysokość
            zoom = min(3.0, MAX_W / bok)
            pm = p.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            im = Image.frombytes('RGB', (pm.width, pm.height), pm.samples)
            if kat:
                im = im.rotate(kat, expand=True)                           # PIL: dodatni kąt = w lewo
            buf = io.BytesIO(); im.save(buf, 'JPEG', quality=JPEG_Q, optimize=True)
            out.append(buf.getvalue())
    return out


def tekst_sekcji(s: dict) -> str:
    for b in s.get('blocks') or []:
        t = b.get('text') or ' '.join(b.get('items') or [])
        if t and not t.startswith('Schemat — '):
            return t
    return s.get('title') or ''


def main() -> None:
    cfg = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    wgraj = '--wgraj' in sys.argv
    slug = cfg['slug']
    rows = sql(f"select body from public.archive_items where slug={lit(slug)}")
    if not rows:
        sys.exit(f'Brak lektury {slug}')
    body = rows[0]['body']
    secs = body.get('sections') or []
    if len(cfg['sekcje']) != len(secs):
        sys.exit(f'Konfiguracja ma {len(cfg["sekcje"])} pozycji, lektura {len(secs)} sekcji.')

    key = w.secret_key(w.DEF_REF)
    TMP.mkdir(parents=True, exist_ok=True)
    zrodla, liczba, transk = [], {}, {}
    for z in cfg['zrodla']:
        if z.get('pdf'):
            obrazy = strony_pdf(pobierz(key, z['pdf']), z.get('obroc'))
            sciezki = [f'admin/lektury/{slug}/zrodlo/{z["id"]}-{i + 1}.jpg' for i in range(len(obrazy))]
            for sc, im in zip(sciezki, obrazy):
                (TMP / sc.replace('/', '__')).write_bytes(im)
                if wgraj:
                    st = w.Projekt(w.DEF_REF, key).upload(sc, im, 'image/jpeg')[0]
                    if st not in (200, 201):
                        sys.exit(f'Upload {sc}: {st}')
            zrodla.append({'id': z['id'], 'name': z['name'], 'path': z['pdf'], 'strony': sciezki})
        else:
            zrodla.append({'id': z['id'], 'name': z['name'], 'path': '', 'strony': [z['obraz']]})
        liczba[z['id']] = len(zrodla[-1]['strony'])
        if z.get('transkrypcja'):
            d = json.loads(Path(z['transkrypcja']).read_text(encoding='utf-8'))
            transk[z['id']] = [(p['pdf_page'], norm(json.dumps(p, ensure_ascii=False))) for p in d['pages']]

    print(f'{slug}: źródła ' + ', '.join(f'{k}={v} str.' for k, v in liczba.items()))
    for i, (s, spec) in enumerate(zip(secs, cfg['sekcje'])):
        s.pop('zrodlo', None)
        if spec:
            zid, how = spec.split(':', 1)
            if zid not in liczba:
                sys.exit(f'Sekcja {i + 1}: nieznane źródło {zid}')
            if how == 'auto':
                igla = norm(tekst_sekcji(s))[:40]
                traf = [n for n, t in transk.get(zid, []) if igla and igla in t]
                if not traf:
                    sys.exit(f'Sekcja {i + 1} „{s.get("title")}”: nie znalazłem tekstu w transkrypcji {zid} — podaj stronę ręcznie')
                n = traf[0]
            elif how.startswith('druk-'):
                n = int(re.match(r'\d+', str(s.get('page') or '')).group(0)) - int(how[5:])
            else:
                n = int(how)
            if not 1 <= n <= liczba[zid]:
                sys.exit(f'Sekcja {i + 1}: strona {n} poza plikiem {zid} (1–{liczba[zid]})')
            s['zrodlo'] = {'z': zid, 's': n}
        print(f'  {i + 1:>2}. {str(s.get("title") or "(bez tytułu)")[:60]:<60} druk s. {s.get("page") or "-":<4} → {s.get("zrodlo")}')
    body['zrodla'] = zrodla
    if not wgraj:
        print(f'PRÓBA — obrazy w {TMP}; zapis: dodaj --wgraj')
        return
    tag = '$zr$'
    js = json.dumps(body, ensure_ascii=False)
    assert tag not in js
    r = sql(f"update public.archive_items set body = {tag}{js}{tag}::jsonb where slug={lit(slug)} returning slug, jsonb_array_length(body->'zrodla') zrodla")
    print('zapisano:', r)


if __name__ == '__main__':
    main()
