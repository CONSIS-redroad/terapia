"""Scenariusz „Moje notatki” + „Program cyklu” (12.10.2026) — tryb demo, telefon (is_mobile), jasny i ciemny.

Sprawdza:
  1. uczestnik: „Dodaj moją notatkę” → mój tytuł + notatka → Zapisz → „Zapisano” → po przeładowaniu jest (pola + „Mój tytuł:” przy temacie);
  2. napis „widzisz tylko Ty”;
  3. Program cyklu: rozwinięcie, 21 tematów, nazwa programu;
  4. admin (demo): Edytuj zajęcia → wybór tematu z programu → zapis → temat w nagłówku karty;
  5. scrollWidth == clientWidth dla 320/360/390/430 (z otwartą notatką i programem), w obu motywach;
  6. konsola / pageerror = 0; zrzuty do obejrzenia;
  7. WYŚCIG AUTOZAPISU (poprawka po adwersarzu 12.10): demo z opóźnieniem zapisu (localStorage
     'terapia_test_save_delay'), pisz → w trakcie zapisu dopisz → po powrocie zapisu 1 przełącz na inne zajęcia →
     po przeładowaniu ma być PEŁNY tekst (stary kod gubił końcówkę);
  8. puste pola NIE kasują (po przeładowaniu notatka jest), „Usuń moją notatkę” → „Tak, usuń” kasuje;
  9. błąd odczytu notatek ('terapia_test_notes_fail') → komunikat, edycja zablokowana;
 10. przyciski „zajęcia dd.mm” w programie ≥ 44 px, nagłówek „(21 tematów)”.

Użycie: python tests/flow_notatki.py --url http://127.0.0.1:8156/dist/ --out <katalog> [--only-race]
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


def _ctx(br, extra_js: str = ''):
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, color_scheme='light')
    ctx.add_init_script("window.__VIEW__ = 'user';" + INIT + extra_js)
    pg = ctx.new_page()
    errs: list[str] = []
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errs.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    return ctx, pg, errs


def _open(pg):
    pg.wait_for_timeout(1500)
    pg.evaluate("document.getElementById('tresc')?.scrollIntoView()")
    pg.wait_for_timeout(400)
    return pg.locator('section[aria-label="Moje notatki"]').first


def _tap(loc):
    """Klik zdarzeniem DOM (element.click()): przy brzegu ekranu przyklejony nagłówek / dolna nawigacja przechwytują
    dotyk, a przewijanie toru karuzeli robi element „niestabilnym” — test sprawdza logikę zapisu, nie cel dotyku
    (cele dotyku mierzy osobno mobile_check.py i pomiar przycisków programu)."""
    loc.wait_for(state='attached', timeout=5000)
    loc.evaluate("e => e.click()")


def _vals(sec):
    t = sec.locator('input').first.input_value() if sec.locator('input').count() else None
    n = sec.locator('textarea').first.input_value() if sec.locator('textarea').count() else None
    return t, n


DELAY_MS = 2500
RACE_T = 'Wyścig'
RACE_1 = 'Część pierwsza.'
RACE_2 = RACE_1 + ' KOŃCÓWKA dopisana w trakcie zapisu.'


def race(br, a, fails):
    """Pisz → zapis 1 w locie (2,5 s) → dopisz → zapis 1 wraca → przełącz zajęcia → przeładuj → ma być PEŁNY tekst."""
    r: dict = {'opoznienie_ms': DELAY_MS}
    ctx, pg, errs = _ctx(br, f"try {{ localStorage.setItem('terapia_test_save_delay', '{DELAY_MS}'); }} catch (e) {{}}")
    pg.goto(a.url, wait_until='load')
    sec = _open(pg)
    r['zajecia_start'] = pg.locator('h4').first.inner_text()
    add = sec.get_by_role('button', name='Dodaj moją notatkę', exact=True)
    if add.count():
        _tap(add)
    sec.locator('input').first.fill(RACE_T)
    sec.locator('textarea').first.fill(RACE_1)
    status = sec.get_by_role('status')
    status.filter(has_text='Zapisuję').wait_for(timeout=4000)       # zapis 1 wystartował (po ~1,2 s)
    pg.wait_for_timeout(2000)                                        # zapis 1 w locie
    sec.locator('textarea').first.fill(RACE_2)                        # dopisz w trakcie zapisu
    pg.wait_for_timeout(DELAY_MS - 2000 + 300)                       # zapis 1 wrócił; timer dopisku (1,2 s) jeszcze nie
    r['status_przed_przelaczeniem'] = status.inner_text()
    _tap(pg.get_by_role('button', name='Następne zajęcia', exact=True).first)
    pg.wait_for_timeout(300)
    r['zajecia_po_przelaczeniu'] = pg.locator('h4').first.inner_text()
    pg.wait_for_timeout(DELAY_MS + 1500)                             # ewentualny zapis 2 kończy się w tle
    pg.reload(wait_until='load')
    sec = _open(pg)
    r['zajecia_po_przeladowaniu'] = pg.locator('h4').first.inner_text()
    t, n = _vals(sec)
    r['po_przeladowaniu'] = {'tytul': t, 'notatka': n}
    r['localStorage'] = pg.evaluate("JSON.parse(localStorage.getItem('terapia_demo_local_v1')||'{}').myNotes || null")
    if r['zajecia_po_przeladowaniu'] != r['zajecia_start']:
        fails.append(f"wyścig: po przeładowaniu inne zajęcia ({r['zajecia_po_przeladowaniu']!r})")
    if n != RACE_2:
        fails.append(f'wyścig: UTRATA KOŃCÓWKI — po przeładowaniu {n!r}, oczekiwano {RACE_2!r}')
    r['bledy_konsoli'] = errs[:]
    fails += [f'wyścig: {e}' for e in errs]
    ctx.close()
    return r


def empty_and_delete(br, a, fails):
    """Puste pola nie kasują; „Usuń moją notatkę” + „Tak, usuń” kasuje."""
    r: dict = {}
    ctx, pg, errs = _ctx(br)
    pg.goto(a.url, wait_until='load')
    sec = _open(pg)
    _tap(sec.get_by_role('button', name='Dodaj moją notatkę', exact=True))
    sec.locator('input').first.fill('Do skasowania')
    sec.locator('textarea').first.fill('treść')
    _tap(sec.get_by_role('button', name='Zapisz', exact=True))
    sec.get_by_role('status').filter(has_text='Zapisano').wait_for(timeout=4000)
    # wyczyść oba pola → autozapis NIE kasuje
    sec.locator('input').first.fill('')
    sec.locator('textarea').first.fill('')
    sec.locator('textarea').first.blur()
    pg.wait_for_timeout(2000)
    r['status_puste'] = sec.get_by_role('status').inner_text()
    if 'puste' not in r['status_puste'].lower():
        fails.append(f"puste: status {r['status_puste']!r} (oczekiwano komunikatu o pustych polach)")
    pg.reload(wait_until='load')
    sec = _open(pg)
    # Pola czyszczone po kolei: stan pośredni (pusty tytuł, jest treść) zapisuje się normalnie przy wyjściu z pola —
    # liczy się, że PUSTEGO stanu autozapis nie wysłał i notatka NIE zniknęła z bazy.
    r['po_przeladowaniu_puste'] = _vals(sec)
    r['localStorage_po_wyczyszczeniu'] = pg.evaluate("JSON.parse(localStorage.getItem('terapia_demo_local_v1')||'{}').myNotes || null")
    kept = list((r['localStorage_po_wyczyszczeniu'] or {}).values())
    if len(kept) != 1 or not (kept[0]['title'].strip() or kept[0]['note'].strip()):
        fails.append(f"puste: autozapis skasował notatkę: {r['localStorage_po_wyczyszczeniu']!r}")
    # świadome usunięcie z potwierdzeniem w UI
    _tap(sec.get_by_role('button', name='Usuń moją notatkę', exact=True))
    r['potwierdzenie_widoczne'] = sec.get_by_text('Usunąć tę notatkę na stałe?').is_visible()
    sec.scroll_into_view_if_needed()
    pg.screenshot(path=os.path.join(a.out, 'light_6_usun_potwierdzenie.png'))
    _tap(sec.get_by_role('button', name='Tak, usuń', exact=True))
    sec.get_by_role('status').filter(has_text='Notatka usunięta').wait_for(timeout=4000)
    pg.reload(wait_until='load')
    sec = _open(pg)
    r['po_usunieciu_dodaj_widoczne'] = sec.get_by_role('button', name='Dodaj moją notatkę', exact=True).count() == 1
    r['localStorage_po_usunieciu'] = pg.evaluate("JSON.parse(localStorage.getItem('terapia_demo_local_v1')||'{}').myNotes || null")
    if not r['po_usunieciu_dodaj_widoczne'] or r['localStorage_po_usunieciu']:
        fails.append(f"usuń: notatka dalej jest ({r['localStorage_po_usunieciu']!r})")
    r['bledy_konsoli'] = errs[:]
    fails += [f'puste/usuń: {e}' for e in errs]
    ctx.close()
    return r


def load_error(br, a, fails):
    """Błąd odczytu notatek ≠ „brak notatek”: komunikat i brak pól edycji."""
    r: dict = {}
    ctx, pg, errs = _ctx(br, "try { localStorage.setItem('terapia_test_notes_fail', 'permission denied for table meeting_notes'); } catch (e) {}")
    pg.goto(a.url, wait_until='load')
    sec = _open(pg)
    r['komunikat'] = sec.get_by_role('alert').inner_text() if sec.get_by_role('alert').count() else ''
    r['pola_edycji'] = sec.locator('input, textarea').count()
    r['przycisk_dodaj'] = sec.get_by_role('button', name='Dodaj moją notatkę', exact=True).count()
    if 'Nie udało się wczytać notatek' not in r['komunikat']:
        fails.append(f"błąd odczytu: brak komunikatu ({r['komunikat']!r})")
    if r['pola_edycji'] or r['przycisk_dodaj']:
        fails.append('błąd odczytu: edycja NIE jest zablokowana')
    sec.scroll_into_view_if_needed()
    pg.screenshot(path=os.path.join(a.out, 'light_7_blad_odczytu.png'))
    r['bledy_konsoli'] = errs[:]
    fails += [f'błąd odczytu: {e}' for e in errs]
    ctx.close()
    return r


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--only-race', action='store_true', help='tylko scenariusz wyścigu (para przed/po na starym kodzie)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    fails: list[str] = []
    rep: dict = {'schemes': {}}

    with sync_playwright() as p:
        br = p.chromium.launch()
        rep['wyscig'] = race(br, a, fails)
        if a.only_race:
            br.close()
            rep['fails'] = fails
            print(json.dumps(rep, ensure_ascii=False, indent=2))
            return 1 if fails else 0
        rep['puste_i_usun'] = empty_and_delete(br, a, fails)
        rep['blad_odczytu'] = load_error(br, a, fails)
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
            r['program_naglowek'] = prog.locator('button[aria-expanded]').first.inner_text()
            if '(21 tematów)' not in r['program_naglowek']:
                fails.append(f"{scheme}: nagłówek programu {r['program_naglowek']!r} bez „(21 tematów)”")
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
                # przyciski „zajęcia dd.mm” przy temacie programu — cel dotyku ≥ 44 px
                progs = pg.locator('section[aria-label="Program cyklu"]').first
                progs.locator('button[aria-expanded]').first.click()
                pg.wait_for_timeout(300)
                chips = progs.locator('button', has_text='zajęcia ')
                hs = [round(chips.nth(i).bounding_box()['height'], 1) for i in range(chips.count())]
                r['program_przyciski_zajec_wys'] = hs
                if not hs:
                    fails.append('admin: brak przycisku „zajęcia dd.mm” przy temacie programu')
                elif min(hs) < 44:
                    fails.append(f'admin: przycisk „zajęcia dd.mm” {min(hs)} px < 44')
                fs = chips.first.evaluate('e => parseFloat(getComputedStyle(e).fontSize)') if hs else 0
                r['program_przyciski_zajec_font'] = fs
                progs.locator('button[aria-expanded]').first.click()  # zwiń — dalej test otwiera go sam
                pg.wait_for_timeout(200)
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
