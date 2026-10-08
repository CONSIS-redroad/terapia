# PATH: tools/import/wgraj_archiwum.py | REQ-ID: TERAPIA-IMPORT-02
"""Wgrywa paczkę starej TERAPII (ETAP I) do archiwum „Powrót do przeszłości” w Supabase GRUPY.

Źródło: paczka z `stary_projekt.py` — `prywatne/supabase-import/` (manifest.json + files/admin/...).
Cel:    Storage `group-files` → `admin/archiwum/<ścieżka z paczki bez admin/>`
        tabela `public.archive_items` (migracja 0003) — upsert po `slug` (ponowne uruchomienie = aktualizacja).

TREŚCI GRUPY NIE TRAFIAJĄ DO REPO — skrypt czyta paczkę z dysku i wysyła ją wyłącznie do Supabase.

Uprawnienia: token Management API w zmiennej środowiskowej TERAPIA_SUPABASE_TOKEN (osoba z dostępem do projektu).
Klucz serwisowy projektu jest pobierany z Management API WYŁĄCZNIE do pamięci — nie jest zapisywany ani wypisywany.

Użycie:
  python tools/import/wgraj_archiwum.py --paczka "C:/.../prywatne/supabase-import" [--ref <projekt>] [--na-sucho]
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEF_REF = 'saxrwnubdylaicnliwyc'
BUCKET = 'group-files'
PREFIKS = 'admin/archiwum/'
LIMIT_PLIKU = 20 * 1024 * 1024

mimetypes.add_type('application/epub+zip', '.epub')
mimetypes.add_type('application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx')
mimetypes.add_type('audio/mpeg', '.mp3')


def _http(method: str, url: str, headers: dict, data: bytes | None = None, timeout: int = 180):
    r = urllib.request.Request(url, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as x:
            b = x.read()
            return x.status, (json.loads(b) if b and b[:1] in b'[{' else b)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')[:500]


def management_token() -> str:
    raw = os.environ.get('TERAPIA_SUPABASE_TOKEN', '')
    if not raw:
        sys.exit('Brak zmiennej TERAPIA_SUPABASE_TOKEN (token Management API Supabase).')
    return 'sbp_' + raw.split('_')[-1]  # zmienna może mieć własny przedrostek — liczy się ostatni człon


def secret_key(ref: str) -> str:
    st, keys = _http('GET', f'https://api.supabase.com/v1/projects/{ref}/api-keys?reveal=true',
                     {'Authorization': 'Bearer ' + management_token(), 'User-Agent': 'terapia-import'})
    if st != 200 or not isinstance(keys, list):
        sys.exit(f'Nie udało się pobrać kluczy projektu (HTTP {st}).')
    for k in keys:
        if k.get('type') == 'secret' and k.get('api_key'):
            return k['api_key']
    for k in keys:  # starsze projekty: service_role JWT
        if k.get('name') == 'service_role' and k.get('api_key'):
            return k['api_key']
    sys.exit('Projekt nie ma klucza serwisowego.')


class Projekt:
    def __init__(self, ref: str, key: str):
        self.url = f'https://{ref}.supabase.co'
        self._key = key

    def _h(self, extra: dict | None = None) -> dict:
        h = {'apikey': self._key, 'Authorization': 'Bearer ' + self._key}
        if extra:
            h.update(extra)
        return h

    def upload(self, path: str, data: bytes, mime: str):
        q = urllib.parse.quote(path)
        return _http('POST', f'{self.url}/storage/v1/object/{BUCKET}/{q}', self._h({'Content-Type': mime, 'x-upsert': 'true'}), data)

    def meetings(self) -> list[dict]:
        st, r = _http('GET', f'{self.url}/rest/v1/meetings?select=id,starts_at', self._h())
        return r if st == 200 and isinstance(r, list) else []

    def upsert(self, rows: list[dict]):
        return _http('POST', f'{self.url}/rest/v1/archive_items?on_conflict=slug',
                     self._h({'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal'}),
                     json.dumps(rows, ensure_ascii=False).encode('utf-8'))

    def count(self) -> str:
        st, _ = _http('HEAD', f'{self.url}/rest/v1/archive_items?select=id', self._h({'Prefer': 'count=exact'}))
        return str(st)


def cel(path: str) -> str:
    """admin/lektury/x/main.jpg → admin/archiwum/lektury/x/main.jpg"""
    rest = path[len('admin/'):] if path.startswith('admin/') else path
    return PREFIKS + rest


def slugify(s: str) -> str:
    s = s.lower()
    for a, b in zip('ąćęłńóśźż', 'acelnoszz'):
        s = s.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:80] or 'pozycja'


def only_https(links: list[dict]) -> list[dict]:
    return [{'url': l['url'], 'title': l.get('title', '') or l['url'], 'comment': l.get('comment', '')}
            for l in links or [] if str(l.get('url', '')).startswith('https://')]


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding='utf-8')  # type: ignore[attr-defined]
    except Exception:
        pass
    ap = argparse.ArgumentParser(description='Wgranie archiwum starej TERAPII do Supabase grupy')
    ap.add_argument('--paczka', required=True, help='folder prywatne/supabase-import (manifest.json + files/)')
    ap.add_argument('--ref', default=DEF_REF, help='ref projektu Supabase grupy')
    ap.add_argument('--na-sucho', action='store_true', help='tylko pokaż, co zostałoby wgrane')
    a = ap.parse_args()

    root = Path(a.paczka)
    man = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    files_dir = root / 'files'

    pliki: dict[str, Path] = {}   # ścieżka w Storage → plik lokalny
    def plik(meta: dict | None) -> str | None:
        if not meta:
            return None
        src = files_dir / meta['path']
        if not src.is_file():
            sys.exit(f'Brak pliku w paczce: {meta["path"]}')
        if src.stat().st_size > LIMIT_PLIKU:
            print(f'POMIJAM (> 20 MB): {meta["path"]}')
            return None
        dst = cel(meta['path'])
        pliki[dst] = src
        return dst

    rows: list[dict] = []
    for l in man.get('lektury', []):
        m = l['material']
        t = l.get('tresc') or {}
        files = []
        for f in l.get('pliki') or []:
            p = plik(f)
            if p:
                files.append({'path': p, 'name': f.get('zrodlo') or Path(p).name, 'size': f.get('bajty') or 0})
        rows.append({
            'slug': slugify(l['slug']), 'kind': 'lektura', 'category': m.get('category') or 'inne',
            'title': m['title'], 'author': m.get('author') or '', 'note': m.get('note') or '',
            'lead': t.get('lead') or '', 'body': {'sections': t.get('sections') or []},
            'links': only_https(l.get('linki')), 'cover_path': plik(l.get('obraz_glowny')),
            'audio_path': plik(l.get('nagranie')), 'gallery': [p for p in (plik(g) for g in l.get('galeria') or []) if p],
            'files': files, 'source_date': m.get('meeting_date') or (m.get('added_at') or '')[:10] or None,
            '_meeting_date': m.get('meeting_date'),
        })
    for z in man.get('materialy_zajec', []):
        m, f = z['material'], z['plik']
        p = plik(f)
        if not p:
            continue
        rows.append({
            'slug': slugify('zajecia-' + Path(f['path']).stem), 'kind': 'pdf', 'category': m.get('category') or 'zajecia',
            'title': m['title'], 'author': m.get('author') or '', 'note': m.get('note') or '', 'lead': '',
            'body': {}, 'links': [], 'cover_path': None, 'audio_path': None, 'gallery': [],
            'files': [{'path': p, 'name': f.get('zrodlo') or Path(p).name, 'size': f.get('bajty') or 0}],
            'source_date': m.get('meeting_date') or (m.get('added_at') or '')[:10] or None,
            '_meeting_date': m.get('meeting_date'),
        })
    # kolejność: najstarsze pierwsze (oś czasu „powrotu do przeszłości”)
    rows.sort(key=lambda r: (r['source_date'] or '', r['kind'] != 'lektura', r['slug']))
    for i, r in enumerate(rows):
        r['sort'] = i * 10

    total = sum(p.stat().st_size for p in pliki.values())
    print(f'Pozycji: {len(rows)} · plików: {len(pliki)} · {total / 1024 / 1024:.1f} MB')
    if a.na_sucho:
        for r in rows:
            print(f'  {r["source_date"]}  {r["kind"]:8}  {r["slug"]}')
        return

    pr = Projekt(a.ref, secret_key(a.ref))

    # powiązanie z zajęciami po dacie (jeśli w grupie są zajęcia z tego dnia)
    by_day = {}
    for mt in pr.meetings():
        by_day.setdefault(str(mt.get('starts_at', ''))[:10], mt['id'])
    for r in rows:
        r['meeting_id'] = by_day.get(r.pop('_meeting_date') or '')

    ok = 0
    for dst, src in pliki.items():
        mime = mimetypes.guess_type(src.name)[0] or 'application/octet-stream'
        st, res = pr.upload(dst, src.read_bytes(), mime)
        if st in (200, 201):
            ok += 1
            print(f'  wgrano {dst}')
        else:
            print(f'  BŁĄD {st} {dst}: {res}')
    st, res = pr.upsert(rows)
    print(f'Pliki: {ok}/{len(pliki)} · wiersze archive_items: HTTP {st}{"" if st in (200, 201, 204) else " " + str(res)}')
    if ok != len(pliki) or st not in (200, 201, 204):
        sys.exit(1)


if __name__ == '__main__':
    main()
