# PATH: tools/import/html_do_lektury.py | REQ-ID: TERAPIA-IMPORT-03
"""HTML materiału „gazetowego” (strony .magazine-page, akapity, .quote-inset, .callout-box, h2.section-title) → paczka importu
archiwum (manifest.json + files/) w formacie, który wgrywa `wgraj_archiwum.py` — treść jako `section.blocks` czytnika (0.11).

TREŚĆ NIE TRAFIA DO REPO: wynik zapisuj w `prywatne/` (w .gitignore). Repo zawiera tylko ten konwerter.

Użycie:
  python tools/import/html_do_lektury.py --html "<plik.html>" --slug oblicza-przemocy --wyjscie prywatne/import-oblicza-przemocy
      [--kategoria poradnik] [--data 2026-11-07] [--okladka <obraz.jpg> --okladka-podpis "fot. … (licencja)"] [--notka "…"]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from html.parser import HTMLParser
from pathlib import Path


def norm(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


class Mag(HTMLParser):
    """Zbiera: strony (numer z nagłówka), w nich bloki w kolejności; okładkę (tytuł, autor, motto, lista)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.pages: list[dict] = []      # {page, blocks:[(kind, text)]}
        self.cover = {'title': '', 'author': '', 'epigraph': '', 'agenda': [], 'source': ''}
        self.stack: list[tuple[str, str]] = []   # (tag, klasa)
        self.buf: list[str] | None = None
        self.kind = ''
        self.endnote: list[str] = []

    def cls(self) -> str:
        return ' '.join(c for _, c in self.stack)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs); c = a.get('class', '') or ''
        if tag == 'br' and self.buf is not None:
            self.buf.append('\n'); return
        self.stack.append((tag, c))
        if 'magazine-page' in c:
            self.pages.append({'page': '', 'blocks': []})
        ctx = self.cls()
        if self.buf is None:
            k = ''
            if 'page-header-banner' in ctx and tag == 'span': k = 'head'
            elif 'cover-top-quote' in c: k = 'epigraph'
            elif tag == 'h1': k = 'title'
            elif 'author' in c.split(): k = 'author'
            elif 'cover-agenda' in ctx and tag == 'li': k = 'agenda'
            elif 'end-note' in ctx and tag == 'p': k = 'endnote'
            elif 'callout-box' in c: k = 'callout'
            elif 'quote-inset' in c: k = 'quote'
            elif tag == 'h2': k = 'h2'
            elif tag == 'p' and 'columns-3' in ctx: k = 'p'
            if k:
                self.kind, self.buf = k, []

    def handle_endtag(self, tag):
        if self.buf is not None and self.stack and self.stack[-1][0] == tag and self._closes(tag):
            text = norm(''.join(self.buf)).replace(' \n ', '\n')
            text = '\n'.join(norm(x) for x in ''.join(self.buf).split('\n') if norm(x))
            k = self.kind; self.buf = None; self.kind = ''
            if text:
                pg = self.pages[-1] if self.pages else None
                if k == 'head' and pg is not None:
                    m = re.search(r'Strona\s+(\d+)', text) or re.fullmatch(r'-\s*(\d+)\s*-', text)
                    if m and not pg['page']: pg['page'] = m.group(1)
                    if '•' in text and not self.cover['source']: self.cover['source'] = text.replace('•', '·')
                elif k in ('epigraph', 'title', 'author'):
                    self.cover[k] = self.cover[k] or text
                elif k == 'agenda': self.cover['agenda'].append(text)
                elif k == 'endnote': self.endnote.append(text)
                elif pg is not None: pg['blocks'].append((k, text))
        if self.stack:
            self.stack.pop()

    def _closes(self, tag: str) -> bool:
        return {'head': 'span', 'epigraph': 'div', 'title': 'h1', 'author': 'div', 'agenda': 'li', 'endnote': 'p',
                'callout': 'div', 'quote': 'div', 'h2': 'h2', 'p': 'p'}.get(self.kind) == tag

    def handle_data(self, data):
        if self.buf is not None:
            self.buf.append(data)


def to_sections(pages: list[dict]) -> list[dict]:
    """Bloki → sekcje: nowy rozdział na h2, nowa sekcja (bez tytułu) na początku każdej strony; urwane „…” sklejone."""
    secs: list[dict] = []
    for pg in pages:
        if not pg['blocks']:
            continue
        cur = {'page': pg['page'], 'blocks': []}; secs.append(cur)
        for k, text in pg['blocks']:
            if k == 'h2':
                if cur['blocks'] or cur.get('title'):
                    cur = {'page': pg['page'], 'blocks': []}; secs.append(cur)
                cur['title'] = text.capitalize() if text.isupper() else text
                continue
            t = 'p' if k == 'p' else k
            if t == 'p' and text.startswith('...'):
                prev = next((b for s in reversed(secs) for b in reversed(s['blocks']) if b['t'] == 'p'), None)
                if prev and prev['text'].endswith('...'):
                    prev['text'] = prev['text'][:-3].rstrip() + ' ' + text[3:].lstrip()
                    continue
            if t == 'p' and '\n' in text and all(x.startswith(('–', '-')) for x in text.split('\n')):
                cur['blocks'].append({'t': 'ul', 'items': [x.lstrip('–- ').strip() for x in text.split('\n')]}); continue
            cur['blocks'].append({'t': t, 'text': text.replace('\n', ' ')})
    # sekcja bez tytułu na nowej stronie, która kontynuuje rozdział — dziedziczy go w spisie przez kolejność (bez tytułu)
    return [s for s in secs if s['blocks'] or s.get('title')]


def file_meta(path: Path, rel: str) -> dict:
    data = path.read_bytes()
    return {'path': rel, 'zrodlo': path.name, 'bajty': len(data), 'sha256': hashlib.sha256(data).hexdigest()[:16], 'za_duzy': len(data) > 20 * 1024 * 1024}


def main() -> None:
    try: sys.stdout.reconfigure(encoding='utf-8')  # type: ignore[attr-defined]
    except Exception: pass
    ap = argparse.ArgumentParser(description='HTML materiału → paczka importu archiwum (czytnik)')
    ap.add_argument('--html', required=True); ap.add_argument('--slug', required=True); ap.add_argument('--wyjscie', required=True)
    ap.add_argument('--kategoria', default='poradnik', choices=['zajecia', 'ksiazka', 'poradnik', 'podcast', 'film', 'inne'])
    ap.add_argument('--data', default=None, help='RRRR-MM-DD (data w archiwum)'); ap.add_argument('--notka', default='')
    ap.add_argument('--okladka', default=None); ap.add_argument('--okladka-podpis', default='')
    a = ap.parse_args()
    if 'prywatne' not in Path(a.wyjscie).resolve().parts:
        sys.exit('Wyjście musi leżeć w folderze prywatne/ (treść nie może trafić do repo).')
    p = Mag(); p.feed(Path(a.html).read_text(encoding='utf-8'))
    secs = to_sections(p.pages)
    out = Path(a.wyjscie); files = out / 'files'
    base = f'admin/lektury/{a.slug}'
    cover = None
    if a.okladka:
        src = Path(a.okladka); rel = f'{base}/okladka{src.suffix.lower()}'
        (files / rel).parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(src, files / rel)
        cover = file_meta(files / rel, rel)
        # okładka także jako obraz w tekście (z podpisem autora/licencji) — na początku pierwszej sekcji
        if secs: secs[0]['blocks'].insert(0, {'t': 'img', 'plik': cover, 'caption': a.okladka_podpis or None})
    c = p.cover
    lekt = {
        'slug': a.slug,
        'material': {'title': (c['title'].capitalize() if c['title'].isupper() else c['title']) or a.slug, 'kind': 'lektura', 'category': a.kategoria,
                     'author': c['author'].title() if c['author'].isupper() else c['author'], 'note': a.notka,
                     'added_at': f'{a.data}T12:00:00+01:00' if a.data else None, 'meeting_date': None},
        'tresc': {'source': c['source'] or None, 'epigraph': c['epigraph'].strip('„”"') and c['epigraph'] or None, 'agenda': c['agenda'],
                  'endnote': p.endnote, 'lead': '', 'sections': secs},
        'linki': [], 'obraz_glowny': None, 'galeria': [], 'nagranie': None, 'pliki': [],
    }
    if a.data: lekt['material']['meeting_date'] = None
    man = {'wersja': 2, 'zrodlo': Path(a.html).name, 'bucket': 'group-files', 'lektury': [lekt], 'materialy_zajec': [],
           'suma_bajtow': cover['bajty'] if cover else 0, 'plikow': 1 if cover else 0, 'za_duze': []}
    out.mkdir(parents=True, exist_ok=True)
    (out / 'manifest.json').write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding='utf-8')
    n = sum(len(s['blocks']) for s in secs)
    print(f'{lekt["material"]["title"]} · {lekt["material"]["author"]} · stron: {len([x for x in p.pages if x["blocks"]])} · sekcji: {len(secs)} '
          f'· rozdziałów: {len([s for s in secs if s.get("title")])} · bloków: {n} · {out / "manifest.json"}')


if __name__ == '__main__':
    main()
