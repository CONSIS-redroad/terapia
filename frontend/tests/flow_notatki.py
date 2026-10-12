"""Scenariusz „Moje notatki” + „Program cyklu” (12.10.2026) — tryb demo, telefon (is_mobile), jasny i ciemny.

Sprawdza:
  1. uczestnik: „Dodaj moją notatkę” → mój tytuł + notatka → Zapisz → „Zapisano” → po przeładowaniu jest (pola + „Mój tytuł:” przy temacie);
  2. napis „widzisz tylko Ty”;
  3. Program cyklu: rozwinięcie, 21 tematów, nazwa programu;
  4. admin (demo): Edytuj zajęcia → wybór tematu z programu → zapis → temat w nagłówku karty;
  5. scrollWidth == clientWidth dla 320/360/390/430 (z otwartą notatką i programem), w obu motywach;
  6. konsola / pageerror = 0; zrzuty do obejrzenia.

Użycie: python tests/flow_notatki.py --url http://127.0.0.1:8156/dist/ --out <katalog>
Kod wyjścia: 0 = OK, 1 = błędy (lista w raporcie).
"""
import argparse
import json
import os
import sys

from playwright.sync_api import sync_playwright

INIT = """
try {
  localStorage.setItem('terapia_consent_v1', JSON.stringify({ version: '2026-10-08', at: new Date().toISOString() }));
  if (!localStorage.getItem('terapia_profile_v1')) localStorage.setItem('terapia_profile_v1', JSON.stringify({ pseudonym: 'Tester' }));
  localStorage.setItem('terapia_demo_view', window.__VIEW__ || 'user');
} catch (e) {}
"""

TITLE = 'Granice po mojemu'
NOTE = 'Moja notatka testowa: zapamiętać przykład z pracy.'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    fails: list[str] = []
    rep: dict = {'schemes': {}}

    with sync_playwright() as p:
        br = p.chromium.launch()
        for scheme in ('light', 'dark'):
            r: dict = {}
            rep['schemes'][scheme] = r
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, color_scheme=scheme)
            ctx.add_init_script("window.__VIEW__ = 'user';" + INIT)
            pg = ctx.new_page()
            errs: list[str] = []
            pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
            pg.on('console', lambda m: errs.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
            pg.goto(a.url, wait_until='load')
            pg.wait_for_timeout(1500)
            pg.evaluate("document.getElementById('tresc')?.scrollIntoView()")
            pg.wait_for_timeout(600)

            # 1. notatka
            add = pg.get_by_role('button', name='Dodaj moją notatkę', exact=True).first
            if add.count() and add.is_visible():
                add.click()
            r['widzisz_tylko_ty'] = pg.get_by_text('widzisz tylko Ty', exact=True).first.is_visible()
            if not r['widzisz_tylko_ty']:
                fails.append(f'{scheme}: brak napisu „widzisz tylko Ty”')
            pg.get_by_label('Mój tytuł', exact=True).first.fill(TITLE)
            pg.get_by_label('Notatka', exact=True).first.fill(NOTE)
            pg.get_by_role('button', name='Zapisz', exact=True).first.click()
            try:
                pg.get_by_role('status').filter(has_text='Zapisano').first.wait_for(timeout=4000)
                r['zapisano'] = True
            except Exception:
                r['zapisano'] = False
                fails.append(f'{scheme}: brak stanu „Zapisano”')
            r['localStorage'] = pg.evaluate("JSON.parse(localStorage.getItem('terapia_demo_local_v1')||'{}').myNotes || null")
            card = pg.locator('section[aria-label="Moje notatki"]').first
            card.scroll_into_view_if_needed()
            pg.screenshot(path=os.path.join(a.out, f'{scheme}_1_notatka_zapis.png'))

            # po przeładowaniu
            pg.reload(wait_until='load')
            pg.wait_for_timeout(1500)
            pg.evaluate("document.getElementById('tresc')?.scrollIntoView()")
            pg.wait_for_timeout(500)
            # pola po selektorze w sekcji (nazwa dostępna pola z treścią zawiera jego wartość — get_by_label(exact) by nie trafił)
            sec = pg.locator('section[aria-label="Moje notatki"]').first
            t_val = sec.locator('input').first.input_value() if sec.locator('input').count() else ''
            n_val = sec.locator('textarea').first.input_value() if sec.locator('textarea').count() else ''
            r['po_przeladowaniu'] = {'tytul': t_val, 'notatka': n_val}
            if t_val != TITLE or n_val != NOTE:
                fails.append(f'{scheme}: po przeładowaniu brak notatki ({t_val!r}, {n_val!r})')
            r['moj_tytul_przy_temacie'] = pg.get_by_text(TITLE, exact=True).first.is_visible()
            if not r['moj_tytul_przy_temacie']:
                fails.append(f'{scheme}: brak „Mój tytuł:” przy temacie')
            pg.locator('h4').first.scroll_into_view_if_needed()
            pg.screenshot(path=os.path.join(a.out, f'{scheme}_2_po_przeladowaniu.png'))

            # 3. program cyklu
            prog = pg.locator('section[aria-label="Program cyklu"]').first
            prog.locator('button[aria-expanded]').first.click()
            pg.wait_for_timeout(300)
            r['program_tematy'] = prog.locator('ol > li').count()
            r['program_nazwa'] = 'ROZWÓJ OSOBISTY' in prog.inner_text()
            if r['program_tematy'] != 21:
                fails.append(f"{scheme}: program ma {r['program_tematy']} tematów, oczekiwano 21")
            if not r['program_nazwa']:
                fails.append(f'{scheme}: brak nazwy programu')
            prog.scroll_into_view_if_needed()
            pg.screenshot(path=os.path.join(a.out, f'{scheme}_3_program.png'))

            # 5. szerokości (notatka + program otwarte)
            r['szerokosc'] = {}
            for w in (320, 360, 390, 430):
                pg.set_viewport_size({'width': w, 'height': 844})
                pg.wait_for_timeout(400)
                sw, cw = pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
                r['szerokosc'][w] = [sw, cw]
                if sw != cw:
                    fails.append(f'{scheme}: {w}px scrollWidth {sw} != clientWidth {cw}')
            pg.set_viewport_size({'width': 390, 'height': 844})
            r['bledy_konsoli'] = errs[:]
            fails += [f'{scheme}: {e}' for e in errs]
            ctx.close()

            # 4. admin: temat z programu (tylko raz — jasny)
            if scheme == 'light':
                ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, color_scheme=scheme)
                ctx.add_init_script("window.__VIEW__ = 'admin';" + INIT)
                pg = ctx.new_page()
                aerr: list[str] = []
                pg.on('pageerror', lambda e: aerr.append(f'pageerror: {e}'))
                pg.on('console', lambda m: aerr.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
                pg.goto(a.url, wait_until='load')
                pg.wait_for_timeout(1500)
                pg.evaluate("document.getElementById('tresc')?.scrollIntoView()")
                pg.wait_for_timeout(500)
                r['admin_przyciski_edytuj'] = pg.get_by_role('button', name='Edytuj', exact=True).count()
                pg.locator('h4').first.locator('xpath=..').get_by_role('button', name='Edytuj', exact=True).first.click()
                sel = pg.locator('label:has-text("Wybierz z programu cyklu") select').first
                r['admin_select'] = sel.count() > 0
                topic = 'Asertywność'
                sel.select_option(topic)
                r['admin_pole_tematu'] = pg.locator('label:has-text("Temat zajęć") input').first.input_value()
                sel.scroll_into_view_if_needed()
                pg.screenshot(path=os.path.join(a.out, f'{scheme}_4_admin_temat.png'))
                pg.get_by_role('button', name='Zapisz', exact=True).first.click()
                pg.wait_for_timeout(800)
                h4 = pg.locator('h4').first.inner_text()
                r['admin_temat_po_zapisie'] = h4
                if h4.strip() != topic:
                    fails.append(f'admin: temat po zapisie {h4!r} != {topic!r}')
                sw, cw = pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
                r['admin_szerokosc_390'] = [sw, cw]
                if sw != cw:
                    fails.append(f'admin 390: {sw} != {cw}')
                # edytor programu na 320
                prog = pg.locator('section[aria-label="Program cyklu"]').first
                prog.locator('button[aria-expanded]').first.click()
                prog.get_by_role('button', name='Edytuj program', exact=True).click()
                pg.set_viewport_size({'width': 320, 'height': 800})
                pg.wait_for_timeout(400)
                sw, cw = pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
                r['admin_edytor_programu_320'] = [sw, cw]
                if sw != cw:
                    fails.append(f'admin edytor programu 320: {sw} != {cw}')
                prog.scroll_into_view_if_needed()
                pg.screenshot(path=os.path.join(a.out, f'{scheme}_5_admin_edytor_programu_320.png'))
                r['admin_bledy_konsoli'] = aerr
                fails += [f'admin: {e}' for e in aerr]
                ctx.close()
        br.close()

    rep['fails'] = fails
    with open(os.path.join(a.out, 'raport_notatki.json'), 'w', encoding='utf-8') as f:
        json.dump(rep, f, ensure_ascii=False, indent=2)
    print(json.dumps(rep, ensure_ascii=False, indent=2))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
