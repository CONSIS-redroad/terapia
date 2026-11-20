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
 10. przyciski „zajęcia dd.mm” w programie ≥ 44 px, nagłówek „(21 tematów)”;
 11. SZYFROWANIE (D042, 0.16): PIN do notatek (ustawienie / odblokowanie po przeładowaniu), w localStorage tylko „rr1:…”
     (zero jawnego tekstu), zły PIN, migracja starych JAWNYCH notatek przy ustawieniu PIN-u, zmiana PIN-u, „Zablokuj”;
 12. ODTWORZENIA ADWERSARZA 20.11 (każde z parą kontrolną; dwa „urządzenia” = dwie karty jednego kontekstu demo,
     wspólny localStorage = wspólna „baza”):
     O1 migracja z migawki NIE nadpisuje nowszej treści z drugiego urządzenia (zapis warunkowy);
     O2 po „Nie pamiętam PIN-u” na A: B nie otwiera się starym PIN-em, B z kluczem w pamięci nie zapisze (KEY_STALE,
        tekst zostaje), nieczytelna notatka ma „Usuń tę notatkę”;
     O3 po zmianie PIN-u na A: B (otwarte wcześniej) przyjmuje NOWY PIN;
     O4 „Zablokuj” w trakcie wolnego zapisu z dopiskiem — dopisek zapisany; zapis, który padł → trwały komunikat;
 13. RUNDA 2 adwersarza: R2-1 długa (20 000 zn., polskie znaki) jawna notatka szyfruje się (warunek migracji bez treści
     w URL — demo udaje limit bramki); kontrola: migracja, która pada, daje komunikat „Nie udało się zaszyfrować N notatek”;
     R2-2 po „Zablokuj” edytor znika < 1 s, „Blokuję… dokańczam zapis”; R2-3 zapis dłuższy niż czeka blokada →
     „Pokaż niezapisany tekst” z dopiskiem (kontrola: krótszy zapis — dopisek w bazie);
 14. RUNDA 3: R3-1 po blokadzie NIE da się pokazać jawnego niezapisanego tekstu bez PIN-u (brak przycisku, tekstu nie ma
     na stronie); kontrola: po odblokowaniu PIN-em przycisk wraca i tekst jest do skopiowania.

Użycie: python tests/flow_notatki.py --url http://127.0.0.1:8156/dist/ --out <katalog> [--only-race]
Kod wyjścia: 0 = OK, 1 = błędy (lista w raporcie).
"""
import argparse
import json
import time
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


PIN = 'zielony kubek'
NOTES_READY = """() => { const s = document.querySelector('section[aria-label="Moje notatki"]');
    return !!s && !s.querySelector('input[name^="note-pin"]') && !/Odszyfrowuję|Sprawdzam/.test(s.textContent); }"""


def _unlock(pg, pin: str = PIN):
    """D042: ustaw PIN (pierwszy raz) albo odblokuj notatki; nic nie rób, gdy edytor już jest / odczyt padł."""
    sec = pg.locator('section[aria-label="Moje notatki"]').first
    pg.wait_for_function("""() => !/Sprawdzam/.test(document.querySelector('section[aria-label="Moje notatki"]')?.textContent || '')""", timeout=10000)
    setup = sec.get_by_role('button', name='Ustaw PIN i zaszyfruj notatki', exact=True)
    unlock = sec.get_by_role('button', name='Odblokuj notatki', exact=True)
    if setup.count():
        sec.locator('input[name="note-pin-new"]').fill(pin)
        sec.locator('input[name="note-pin-new2"]').fill(pin)
        sec.locator('input[type="checkbox"]').first.check()
        _tap(setup)
    elif unlock.count():
        sec.locator('input[name="note-pin"]').fill(pin)
        _tap(unlock)
    else:
        return sec
    pg.wait_for_function(NOTES_READY, timeout=15000)
    return sec


def _open(pg):
    pg.wait_for_timeout(1500)
    pg.evaluate("document.getElementById('tresc')?.scrollIntoView()")
    pg.wait_for_timeout(400)
    _unlock(pg)
    return pg.locator('section[aria-label="Moje notatki"]').first


def _local(pg):
    return pg.evaluate("localStorage.getItem('terapia_demo_local_v1') || ''")


def _goto_notes(pg):
    pg.wait_for_timeout(1500)
    pg.evaluate("document.getElementById('tresc')?.scrollIntoView()")
    pg.wait_for_timeout(400)
    return pg.locator('section[aria-label="Moje notatki"]').first


def crypto_flow(br, a, fails):
    """D042: migracja starych jawnych notatek, brak jawnego tekstu w pamięci, zły PIN, zmiana PIN-u, blokada."""
    r: dict = {}
    old_t, old_n = 'Stary tytuł jawny', 'Stara notatka sprzed szyfrowania — ma przetrwać.'
    ctx, pg, errs = _ctx(br)
    pg.goto(a.url, wait_until='load')
    pg.wait_for_timeout(1000)
    # stara wersja (0.15) zostawiła JAWNE notatki (do każdych zajęć demo, żeby karta na pewno jakąś pokazała)
    pg.evaluate("""([t, n]) => { const s = JSON.parse(localStorage.getItem('terapia_demo_local_v1') || '{"extraMessages":[],"memberStatus":{}}');
        s.myNotes = {}; for (let i = 1; i <= 30; i++) { const id = 'sp-' + i; s.myNotes[id] = { meetingId: id, title: t, note: n, updatedAt: new Date().toISOString() }; }
        delete s.noteKey; localStorage.setItem('terapia_demo_local_v1', JSON.stringify(s)); }""", [old_t, old_n])
    pg.reload(wait_until='load')
    sec = _goto_notes(pg)
    pg.wait_for_function("""() => !/Sprawdzam/.test(document.querySelector('section[aria-label="Moje notatki"]')?.textContent || '')""", timeout=10000)
    r['przed_pinem_formularz'] = sec.get_by_role('button', name='Ustaw PIN i zaszyfruj notatki', exact=True).count() == 1
    if not r['przed_pinem_formularz']:
        fails.append('szyfrowanie: brak formularza „Ustaw PIN”')
    # krótki PIN odrzucony
    sec.locator('input[name="note-pin-new"]').fill('12345')
    sec.locator('input[name="note-pin-new2"]').fill('12345')
    sec.locator('input[type="checkbox"]').first.check()
    _tap(sec.get_by_role('button', name='Ustaw PIN i zaszyfruj notatki', exact=True))
    pg.wait_for_timeout(500)
    r['krotki_pin_komunikat'] = sec.get_by_role('alert').inner_text() if sec.get_by_role('alert').count() else ''
    if 'co najmniej 6' not in r['krotki_pin_komunikat']:
        fails.append(f"szyfrowanie: krótki PIN bez komunikatu ({r['krotki_pin_komunikat']!r})")
    sec.scroll_into_view_if_needed()
    pg.screenshot(path=os.path.join(a.out, 'light_8_ustaw_pin.png'))
    _unlock(pg)
    t, n = _vals(sec)
    r['po_migracji_w_edytorze'] = {'tytul': t, 'notatka': n}
    if (t, n) != (old_t, old_n):
        fails.append(f'szyfrowanie: migracja zgubiła treść ({t!r}, {n!r})')
    pg.wait_for_timeout(500)
    raw = _local(pg)
    r['localStorage_bez_jawnego'] = old_n not in raw and old_t not in raw
    r['localStorage_rr1_liczba'] = raw.count('rr1:')
    if not r['localStorage_bez_jawnego'] or r['localStorage_rr1_liczba'] < 2:
        fails.append(f"szyfrowanie: w localStorage dalej jawna treść albo brak szyfrogramu (rr1: x{r['localStorage_rr1_liczba']})")
    r['napis_zaszyfrowane'] = 'zaszyfrowane' in sec.inner_text()
    sec.scroll_into_view_if_needed()
    pg.screenshot(path=os.path.join(a.out, 'light_9_odblokowane.png'))
    # przeładowanie → zablokowane; zły PIN; dobry PIN
    pg.reload(wait_until='load')
    sec = _goto_notes(pg)
    pg.wait_for_function("""() => !/Sprawdzam/.test(document.querySelector('section[aria-label="Moje notatki"]')?.textContent || '')""", timeout=10000)
    r['po_przeladowaniu_zablokowane'] = sec.get_by_role('button', name='Odblokuj notatki', exact=True).count() == 1 and old_n not in sec.inner_text()
    if not r['po_przeladowaniu_zablokowane']:
        fails.append('szyfrowanie: po przeładowaniu notatki nie są zablokowane')
    sec.locator('input[name="note-pin"]').fill('zly pin 000')
    _tap(sec.get_by_role('button', name='Odblokuj notatki', exact=True))
    sec.get_by_role('alert').filter(has_text='Zły PIN').wait_for(timeout=8000)
    r['zly_pin_odrzucony'] = True
    sec.scroll_into_view_if_needed()
    pg.screenshot(path=os.path.join(a.out, 'light_10_zly_pin.png'))
    _unlock(pg)
    r['po_odblokowaniu'] = _vals(sec)
    # zmiana PIN-u
    _tap(sec.get_by_role('button', name='Zmień PIN', exact=True))
    sec.locator('input[name="note-pin-old"]').fill(PIN)
    sec.locator('form input[name="note-pin-new"]').fill('nowy pin 456')
    sec.locator('form input[name="note-pin-new2"]').fill('nowy pin 456')
    _tap(sec.locator('form').get_by_role('button', name='Zmień PIN', exact=True))
    sec.get_by_role('status').filter(has_text='PIN zmieniony').wait_for(timeout=8000)
    _tap(sec.get_by_role('button', name='Zablokuj notatki', exact=True))
    pg.wait_for_timeout(300)
    r['zablokuj_dziala'] = sec.get_by_role('button', name='Odblokuj notatki', exact=True).count() == 1
    if not r['zablokuj_dziala']:
        fails.append('szyfrowanie: „Zablokuj notatki” nie zablokował')
    sec.locator('input[name="note-pin"]').fill(PIN)
    _tap(sec.get_by_role('button', name='Odblokuj notatki', exact=True))
    sec.get_by_role('alert').filter(has_text='Zły PIN').wait_for(timeout=8000)
    r['stary_pin_odrzucony'] = True
    sec.locator('input[name="note-pin"]').fill('nowy pin 456')
    _tap(sec.get_by_role('button', name='Odblokuj notatki', exact=True))
    pg.wait_for_function(NOTES_READY, timeout=15000)
    r['nowym_pinem'] = list(_vals(sec))
    if tuple(r['nowym_pinem']) != (old_t, old_n):
        fails.append(f"szyfrowanie: po zmianie PIN-u inna treść ({r['nowym_pinem']!r})")
    sw, cw = pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    r['szerokosc_390'] = [sw, cw]
    if sw != cw:
        fails.append(f'szyfrowanie 390: {sw} != {cw}')
    r['bledy_konsoli'] = errs[:]
    fails += [f'szyfrowanie: {e}' for e in errs]
    ctx.close()
    return r


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


WAIT_GONE = """() => !/Sprawdzam/.test(document.querySelector('section[aria-label="Moje notatki"]')?.textContent || '')"""
RESET_JS = """() => { const s = JSON.parse(localStorage.getItem('terapia_demo_local_v1') || '{"extraMessages":[],"memberStatus":{}}');
    delete s.noteKey; s.myNotes = {}; localStorage.setItem('terapia_demo_local_v1', JSON.stringify(s));
    localStorage.removeItem('terapia_test_save_delay'); localStorage.removeItem('terapia_test_save_fail'); }"""


def _page(ctx, url):
    """Nowa karta = drugie „urządzenie” (wspólny localStorage demo)."""
    pg = ctx.new_page()
    pg.goto(url, wait_until='load')
    sec = _goto_notes(pg)
    pg.wait_for_function(WAIT_GONE, timeout=10000)
    return pg, sec


def _try_unlock(pg, sec, pin):
    """'OTWARTE' albo 'ALERT: <komunikat>'."""
    sec.locator('input[name="note-pin"]').fill(pin)
    _tap(sec.get_by_role('button', name='Odblokuj notatki', exact=True))
    try:
        pg.wait_for_function(NOTES_READY, timeout=8000)
        return 'OTWARTE'
    except Exception:
        al = sec.get_by_role('alert')
        return 'ALERT: ' + (al.last.inner_text() if al.count() else '?')


def _setup_pin(pg, sec, pin):
    sec.locator('input[name="note-pin-new"]').fill(pin)
    sec.locator('input[name="note-pin-new2"]').fill(pin)
    sec.locator('input[type="checkbox"]').first.check()
    _tap(sec.get_by_role('button', name='Ustaw PIN i zaszyfruj notatki', exact=True))


def _write(pg, sec, title, note):
    if sec.get_by_role('button', name='Dodaj moją notatkę', exact=True).count():
        _tap(sec.get_by_role('button', name='Dodaj moją notatkę', exact=True))
    sec.locator('input').first.fill(title)
    sec.locator('textarea').first.fill(note)
    _tap(sec.get_by_role('button', name='Zapisz', exact=True))


def _forget_all(pg, sec, new_pin):
    _tap(sec.get_by_role('button', name='Zablokuj notatki', exact=True))
    sec.get_by_role('button', name='Nie pamiętam PIN-u', exact=True).wait_for(timeout=8000)
    _tap(sec.get_by_role('button', name='Nie pamiętam PIN-u', exact=True))
    sec.get_by_role('group', name='Nie pamiętam PIN-u').locator('input[type="checkbox"]').check()
    _tap(sec.get_by_role('button', name='Usuń notatki i ustaw nowy PIN', exact=True))
    sec.locator('input[name="note-pin-new"]').wait_for(timeout=8000)
    _setup_pin(pg, sec, new_pin)
    pg.wait_for_function(NOTES_READY, timeout=15000)


def o1_migracja_wyscig(br, a, fails, delay=2000, shown='sp-7'):
    """O1: B ustawia PIN i migruje; A (otwarte wcześniej, wolne łącze) migruje z WŁASNEJ migawki; B w międzyczasie zmienia
    notatkę, którą A zmigruje jako ostatnią. Ma zostać treść B. Kontrola: pozostałe notatki zmigrowane (0 jawnych w bazie)."""
    r: dict = {}
    pin = 'wspolny pin 1'
    ctx, pgA, errs = _ctx(br)
    pgA.goto(a.url, wait_until='load'); pgA.wait_for_timeout(800)
    pgA.evaluate("""([shown, d]) => { const s = JSON.parse(localStorage.getItem('terapia_demo_local_v1') || '{"extraMessages":[],"memberStatus":{}}');
        delete s.noteKey; s.myNotes = {};
        for (const i of [1,2,3,4,5,6,8,9,10]) { const id = 'sp-' + i; if (id !== shown) s.myNotes[id] = { meetingId: id, title: 'stary ' + id, note: 'STARA treść ' + id, updatedAt: new Date().toISOString() }; }
        s.myNotes[shown] = { meetingId: shown, title: 'stary ' + shown, note: 'STARA treść ' + shown, updatedAt: new Date().toISOString() };
        localStorage.setItem('terapia_demo_local_v1', JSON.stringify(s)); localStorage.setItem('terapia_test_save_delay', String(d)); }""", [shown, delay])
    pgA.reload(wait_until='load')
    secA = _goto_notes(pgA); pgA.wait_for_function(WAIT_GONE, timeout=10000)
    pgB, secB = _page(ctx, a.url)
    _setup_pin(pgB, secB, pin)                                   # B: PIN + migracja
    pgB.wait_for_timeout(3000)
    _setup_pin(pgA, secA, pin)                                   # A (nieświeże nokey) → KEY_EXISTS → odblokuj → migracja z migawki
    secA.locator('input[name="note-pin"]').wait_for(timeout=10000)
    sec_a_alert = secA.get_by_role('alert')
    r['A_komunikat'] = sec_a_alert.first.inner_text() if sec_a_alert.count() else ''
    secA.locator('input[name="note-pin"]').fill(pin)
    _tap(secA.get_by_role('button', name='Odblokuj notatki', exact=True))
    pgB.wait_for_function(NOTES_READY, timeout=120000)
    r['B_przed_edycja'] = list(_vals(secB))
    if r['B_przed_edycja'] != [f'stary {shown}', f'STARA treść {shown}']:
        fails.append(f"O1: karta pokazuje inne zajęcia niż {shown} ({r['B_przed_edycja']!r}) — scenariusz nie trafia w wyścig")
    secB.locator('textarea').first.fill('NOWA treść wpisana na B po migracji')
    _tap(secB.get_by_role('button', name='Zapisz', exact=True))
    secB.get_by_role('status').filter(has_text='Zapisano').wait_for(timeout=60000)
    pgA.wait_for_function(NOTES_READY, timeout=120000)          # A skończyło migrację
    pgB.wait_for_timeout(delay + 1000)
    pgA.evaluate("localStorage.removeItem('terapia_test_save_delay')")
    pgC, secC = _page(ctx, a.url)
    r['C_odblokowanie'] = _try_unlock(pgC, secC, pin)
    r['C_swieza_karta_widzi'] = list(_vals(secC))
    if r['C_swieza_karta_widzi'] != [f'stary {shown}', 'NOWA treść wpisana na B po migracji']:
        fails.append(f"O1: migracja z migawki nadpisała nowszą treść: {r['C_swieza_karta_widzi']!r}")
    raw = _local(pgC)
    r['kontrola_jawnych_w_bazie'] = raw.count('STARA treść')
    r['kontrola_rr1'] = raw.count('rr1:')
    if r['kontrola_jawnych_w_bazie'] or r['kontrola_rr1'] < 20:
        fails.append(f"O1 kontrola: migracja niepełna (jawnych {r['kontrola_jawnych_w_bazie']}, rr1 {r['kontrola_rr1']})")
    r['bledy_konsoli'] = errs[:]
    fails += [f'O1: {e}' for e in errs]
    ctx.close()
    return r


def o23_dwa_urzadzenia(br, a, fails):
    """O3: zmiana PIN-u na A → B (otwarte wcześniej) przyjmuje NOWY PIN (kontrola: świeża karta odrzuca stary).
    O2: „Nie pamiętam PIN-u” na A → B nie otwiera się starym PIN-em (kontrola: nowym tak); B z kluczem w pamięci po
    kolejnym resecie nie zapisze (KEY_STALE, tekst zostaje; kontrola: w bazie nie ma tekstu B); nieczytelna notatka →
    „Usuń tę notatkę” (kontrola: po usunięciu edytor wraca)."""
    r: dict = {}
    P1, P2, P3, P4 = 'pierwszy pin 1', 'drugi pin 22', 'trzeci pin 333', 'czwarty pin 4444'
    ctx, pgA, errs = _ctx(br)
    pgA.goto(a.url, wait_until='load'); pgA.wait_for_timeout(800)
    pgA.evaluate(RESET_JS)
    pgA.reload(wait_until='load')
    secA = _goto_notes(pgA); pgA.wait_for_function(WAIT_GONE, timeout=10000)
    _setup_pin(pgA, secA, P1); pgA.wait_for_function(NOTES_READY, timeout=15000)
    _write(pgA, secA, 'Notatka A', 'Treść A ważna')
    secA.get_by_role('status').filter(has_text='Zapisano').wait_for(timeout=8000)
    pgB, secB = _page(ctx, a.url)                                # B: zablokowane, rekord klucza (P1) w pamięci
    # O3
    _tap(secA.get_by_role('button', name='Zmień PIN', exact=True))
    secA.locator('input[name="note-pin-old"]').fill(P1)
    secA.locator('form input[name="note-pin-new"]').fill(P2); secA.locator('form input[name="note-pin-new2"]').fill(P2)
    _tap(secA.locator('form').get_by_role('button', name='Zmień PIN', exact=True))
    secA.get_by_role('status').filter(has_text='PIN zmieniony').wait_for(timeout=8000)
    pgC, secC = _page(ctx, a.url)
    r['O3_kontrola_swieza_karta_stary_P1'] = _try_unlock(pgC, secC, P1)
    pgC.close()
    r['O3_B_nowy_P2'] = _try_unlock(pgB, secB, P2)
    if r['O3_B_nowy_P2'] != 'OTWARTE':
        fails.append(f"O3: B nie przyjmuje nowego PIN-u ({r['O3_B_nowy_P2']})")
    if 'Zły PIN' not in r['O3_kontrola_swieza_karta_stary_P1']:
        fails.append(f"O3 kontrola: stary PIN otwiera ({r['O3_kontrola_swieza_karta_stary_P1']})")
    r['O3_B_widzi'] = list(_vals(secB))
    # O2: B zablokowane (rekord P2 w pamięci), A: „Nie pamiętam PIN-u” → P3, nowa notatka
    _tap(secB.get_by_role('button', name='Zablokuj notatki', exact=True)); pgB.wait_for_timeout(500)
    _forget_all(pgA, secA, P3)
    _write(pgA, secA, 'Po resecie A', 'Nowa treść A')
    secA.get_by_role('status').filter(has_text='Zapisano').wait_for(timeout=8000)
    r['O2_B_stary_P2_po_resecie'] = _try_unlock(pgB, secB, P2)
    if r['O2_B_stary_P2_po_resecie'] == 'OTWARTE':
        fails.append('O2: B otworzyło się starym PIN-em po „Nie pamiętam PIN-u” na A')
    r['O2_kontrola_B_nowy_P3'] = _try_unlock(pgB, secB, P3)
    r['O2_kontrola_B_widzi'] = list(_vals(secB))
    if r['O2_kontrola_B_nowy_P3'] != 'OTWARTE' or r['O2_kontrola_B_widzi'] != ['Po resecie A', 'Nowa treść A']:
        fails.append(f"O2 kontrola: B z nowym PIN-em ({r['O2_kontrola_B_nowy_P3']}, {r['O2_kontrola_B_widzi']!r})")
    # O2-bis: B ODBLOKOWANE (klucz P3 w pamięci), A drugi raz „Nie pamiętam PIN-u” → P4; B zapisuje starym kluczem
    _forget_all(pgA, secA, P4)
    secB.locator('textarea').first.fill('Tekst B po cudzym resecie')
    _tap(secB.get_by_role('button', name='Zapisz', exact=True))
    st = secB.get_by_role('status').filter(has_text='Nie zapisano')
    try:
        st.first.wait_for(timeout=8000)
        r['O2bis_B_status'] = st.first.inner_text()
    except Exception:
        r['O2bis_B_status'] = secB.get_by_role('status').first.inner_text() if secB.get_by_role('status').count() else '?'
    r['O2bis_B_tekst_zostal'] = secB.locator('textarea').first.input_value() == 'Tekst B po cudzym resecie' if secB.locator('textarea').count() else False
    r['O2bis_kontrola_brak_tekstu_B_w_bazie'] = 'Tekst B po cudzym resecie' not in _local(pgB)
    if 'innym urządzeniu' not in r['O2bis_B_status'] or not r['O2bis_B_tekst_zostal']:
        fails.append(f"O2bis: zapis starym kluczem nie odrzucony czytelnie ({r['O2bis_B_status']!r}, tekst został: {r['O2bis_B_tekst_zostal']})")
    pgD, secD = _page(ctx, a.url)
    r['O2bis_kontrola_D_P4'] = _try_unlock(pgD, secD, P4)
    r['O2bis_kontrola_D_nieczytelne'] = 'nie da się odszyfrować' in secD.inner_text()
    if r['O2bis_kontrola_D_P4'] != 'OTWARTE' or r['O2bis_kontrola_D_nieczytelne']:
        fails.append(f"O2bis kontrola: aktualne urządzenie ({r['O2bis_kontrola_D_P4']}, nieczytelne: {r['O2bis_kontrola_D_nieczytelne']})")
    # O2: nieczytelna notatka (szyfrogram poprawnego formatu, ale nie tym kluczem) → „Usuń tę notatkę”
    pgD.evaluate("""() => { const s = JSON.parse(localStorage.getItem('terapia_demo_local_v1'));
        s.myNotes = {}; for (let i = 1; i <= 30; i++) { const id = 'sp-' + i; s.myNotes[id] = { meetingId: id, title: 'rr1:' + 'A'.repeat(44), note: '', updatedAt: new Date().toISOString() }; }
        localStorage.setItem('terapia_demo_local_v1', JSON.stringify(s)); }""")
    pgD.reload(wait_until='load')
    secD = _goto_notes(pgD); pgD.wait_for_function(WAIT_GONE, timeout=10000)
    _try_unlock(pgD, secD, P4)
    r['O2_nieczytelna_przycisk_usun'] = secD.get_by_role('button', name='Usuń tę notatkę', exact=True).count()
    if r['O2_nieczytelna_przycisk_usun'] != 1:
        fails.append('O2: nieczytelna notatka bez przycisku „Usuń tę notatkę”')
    else:
        secD.scroll_into_view_if_needed()
        pgD.screenshot(path=os.path.join(a.out, 'light_11_nieczytelna_usun.png'))
        _tap(secD.get_by_role('button', name='Usuń tę notatkę', exact=True))
        _tap(secD.get_by_role('button', name='Tak, usuń', exact=True))
        pgD.wait_for_timeout(800)
        r['O2_kontrola_po_usunieciu_edytor'] = secD.locator('textarea, button:has-text("Dodaj moją notatkę")').count() > 0 and 'nie da się odszyfrować' not in secD.inner_text()
        if not r['O2_kontrola_po_usunieciu_edytor']:
            fails.append('O2 kontrola: po usunięciu nieczytelnej notatki edytor nie wrócił')
    r['bledy_konsoli'] = errs[:]
    fails += [f'O2/O3: {e}' for e in errs]
    ctx.close()
    return r


def o4_blokada_w_locie(br, a, fails, delay=4000):
    """O4: „Zablokuj” w trakcie wolnego zapisu, w międzyczasie dopisek → po odblokowaniu PEŁNY tekst.
    Kontrola: zapis pada (terapia_test_save_fail) + „Zablokuj” → trwały komunikat „NIE została zapisana”."""
    r: dict = {}
    pin = 'blokada pin 1'
    ctx, pg, errs = _ctx(br)
    pg.goto(a.url, wait_until='load'); pg.wait_for_timeout(800)
    pg.evaluate(RESET_JS)
    pg.reload(wait_until='load')
    sec = _goto_notes(pg); pg.wait_for_function(WAIT_GONE, timeout=10000)
    _setup_pin(pg, sec, pin); pg.wait_for_function(NOTES_READY, timeout=15000)
    pg.evaluate(f"localStorage.setItem('terapia_test_save_delay', '{delay}')")
    if sec.get_by_role('button', name='Dodaj moją notatkę', exact=True).count():
        _tap(sec.get_by_role('button', name='Dodaj moją notatkę', exact=True))
    sec.locator('input').first.fill('Tytuł')
    sec.locator('textarea').first.fill('Część 1.')
    sec.get_by_text('Zapisuję').first.wait_for(timeout=6000)
    sec.locator('textarea').first.fill('Część 1. DOPISEK w trakcie zapisu.')
    t0 = time.time()
    _tap(sec.get_by_role('button', name='Zablokuj notatki', exact=True))
    sec.locator('textarea').first.wait_for(state='detached', timeout=1000)   # R2-2: edytor znika od razu
    r['R2_2_edytor_znika_s'] = round(time.time() - t0, 2)
    r['R2_2_status_blokuje'] = sec.get_by_role('status').filter(has_text='Blokuję… dokańczam zapis').count() == 1
    if r['R2_2_edytor_znika_s'] >= 1 or not r['R2_2_status_blokuje']:
        fails.append(f"R2-2: edytor po „Zablokuj” {r['R2_2_edytor_znika_s']} s, status „Blokuję…”: {r['R2_2_status_blokuje']}")
    sec.scroll_into_view_if_needed()
    pg.screenshot(path=os.path.join(a.out, 'light_13_blokuje_dokanczam.png'))
    sec.get_by_text('Blokuję… dokańczam zapis').wait_for(state='detached', timeout=delay * 4 + 5000)
    pg.evaluate("localStorage.removeItem('terapia_test_save_delay')")
    r['O4_odblokowanie'] = _try_unlock(pg, sec, pin)
    r['O4_po_odblokowaniu'] = list(_vals(sec))
    if r['O4_po_odblokowaniu'] != ['Tytuł', 'Część 1. DOPISEK w trakcie zapisu.']:
        fails.append(f"O4: dopisek zgubiony przy blokadzie ({r['O4_po_odblokowaniu']!r})")
    # kontrola: zapis pada → komunikat trwały (nie w edytorze, który znika)
    pg.evaluate("localStorage.setItem('terapia_test_save_fail', 'brak sieci (test)')")
    sec.locator('textarea').first.fill('Zmiana, której nie da się zapisać')
    _tap(sec.get_by_role('button', name='Zablokuj notatki', exact=True))
    sec.locator('input[name="note-pin"]').wait_for(timeout=15000)
    notice = pg.get_by_role('alert').filter(has_text='NIE została zapisana')
    r['O4_kontrola_komunikat'] = notice.first.inner_text() if notice.count() else ''
    if 'NIE została zapisana' not in r['O4_kontrola_komunikat']:
        fails.append(f"O4 kontrola: nieudany zapis przy blokadzie bez trwałego komunikatu ({r['O4_kontrola_komunikat']!r})")
    r['R3_1_zablokowane'] = _locked_hides_unsaved(pg, 'Zmiana, której nie da się zapisać', fails, 'O4')
    pg.screenshot(path=os.path.join(a.out, 'light_15_niezapisany_zablokowane.png'))
    sec.get_by_text('Blokuję… dokańczam zapis').wait_for(state='detached', timeout=15000)
    pg.evaluate("localStorage.removeItem('terapia_test_save_fail')")
    r['R3_1_kontrola_odblokowanie'] = _try_unlock(pg, sec, pin)
    r['R2_3_tekst_w_komunikacie'] = _unsaved_text(pg)
    if 'Zmiana, której nie da się zapisać' not in r['R2_3_tekst_w_komunikacie']:
        fails.append(f"R2-3/R3-1 kontrola: po odblokowaniu niezapisanego tekstu nie da się odzyskać ({r['R2_3_tekst_w_komunikacie']!r})")
    pg.screenshot(path=os.path.join(a.out, 'light_12_komunikat_niezapisane.png'))
    pg.evaluate("localStorage.removeItem('terapia_test_save_fail')")
    r['bledy_konsoli'] = errs[:]
    fails += [f'O4: {e}' for e in errs]
    ctx.close()
    return r


def _locked_hides_unsaved(pg, secret, fails, label):
    """R3-1: notatki zablokowane → komunikat bez przycisku i bez jawnego tekstu na stronie."""
    btn = pg.get_by_role('button', name='Pokaż niezapisany tekst', exact=True).count()
    on_page = secret in pg.evaluate("document.body.innerText") or pg.evaluate(
        "(t) => [...document.querySelectorAll('textarea,input')].some(e => e.value.includes(t))", secret)
    info = pg.get_by_text('odblokuj notatki PIN-em, żeby go zobaczyć').count()
    ok = btn == 0 and not on_page and info >= 1
    if not ok:
        fails.append(f'R3-1 {label}: po blokadzie jawny niezapisany tekst dostępny bez PIN-u (przycisk {btn}, na stronie {on_page}, info {info})')
    return {'przycisk': btn, 'tekst_na_stronie': on_page, 'informacja': info}


def _unsaved_text(pg):
    """„Pokaż niezapisany tekst” w trwałym komunikacie → treść pola (albo '')."""
    btn = pg.get_by_role('button', name='Pokaż niezapisany tekst', exact=True)
    if not btn.count():
        return ''
    _tap(btn)
    box = pg.get_by_label('Niezapisany tekst notatki')
    return box.first.input_value() if box.count() else ''


def r2_3_zapis_dluzszy_niz_blokada(br, a, fails, delay=6000, drain_ms=1500):
    """R2-3: zapis trwa dłużej, niż blokada czeka → dopisek do skopiowania z komunikatu (tylko pamięć karty).
    Kontrola: tekst nie trafił do localStorage jako jawny (pamięć karty, nie storage)."""
    r: dict = {}
    pin = 'dlugi zapis 1'
    ctx, pg, errs = _ctx(br)
    pg.goto(a.url, wait_until='load'); pg.wait_for_timeout(800)
    pg.evaluate(RESET_JS)
    pg.reload(wait_until='load')
    sec = _goto_notes(pg); pg.wait_for_function(WAIT_GONE, timeout=10000)
    _setup_pin(pg, sec, pin); pg.wait_for_function(NOTES_READY, timeout=15000)
    pg.evaluate(f"localStorage.setItem('terapia_test_save_delay', '{delay}'); localStorage.setItem('terapia_test_drain_ms', '{drain_ms}')")
    if sec.get_by_role('button', name='Dodaj moją notatkę', exact=True).count():
        _tap(sec.get_by_role('button', name='Dodaj moją notatkę', exact=True))
    sec.locator('input').first.fill('Długi')
    sec.locator('textarea').first.fill('Część A.')
    sec.get_by_text('Zapisuję').first.wait_for(timeout=delay + 4000)
    sec.locator('textarea').first.fill('Część A. DOPISEK przy wolnym łączu.')
    _tap(sec.get_by_role('button', name='Zablokuj notatki', exact=True))
    notice = pg.get_by_role('alert').filter(has_text='NIE została zapisana')
    notice.first.wait_for(timeout=drain_ms + 5000)
    r['komunikat'] = notice.first.inner_text()
    r['R3_1_zablokowane'] = _locked_hides_unsaved(pg, 'DOPISEK przy wolnym łączu', fails, 'R2-3')
    pg.wait_for_timeout(delay + 1000)                      # rozpoczęty zapis wraca, dopisku nie ma czym zaszyfrować
    pg.evaluate("localStorage.removeItem('terapia_test_save_delay')")
    r['R3_1_kontrola_odblokowanie'] = _try_unlock(pg, sec, pin)
    r['tekst'] = _unsaved_text(pg)
    if 'DOPISEK przy wolnym łączu' not in r['tekst']:
        fails.append(f"R2-3: zapis > czasu blokady — dopisek nie do odzyskania ({r['tekst']!r})")
    pg.screenshot(path=os.path.join(a.out, 'light_14_niezapisany_tekst.png'))
    r['kontrola_brak_jawnego_w_storage'] = 'DOPISEK przy wolnym łączu' not in _local(pg)
    if not r['kontrola_brak_jawnego_w_storage']:
        fails.append('R2-3 kontrola: niezapisany tekst trafił jawnie do localStorage')
    pg.evaluate("localStorage.removeItem('terapia_test_drain_ms')")
    r['bledy_konsoli'] = errs[:]
    fails += [f'R2-3: {e}' for e in errs]
    ctx.close()
    return r


def r2_1_dluga_notatka(br, a, fails):
    """R2-1: jawne notatki po 20 000 znaków z polskimi literami szyfrują się (warunek migracji bez treści w URL).
    Kontrola: migracja, która pada (terapia_test_save_fail), daje komunikat „Nie udało się zaszyfrować N notatek”, a po
    naprawie (kolejne odblokowanie) notatki się szyfrują."""
    r: dict = {}
    pin = 'dluga notatka 1'
    longtxt = ('Zażółć gęślą jaźń — ćwiczenie z asertywności. ' * 500)[:20000]
    ctx, pg, errs = _ctx(br)
    pg.goto(a.url, wait_until='load'); pg.wait_for_timeout(800)
    pg.evaluate(RESET_JS)
    pg.evaluate("""(t) => { const s = JSON.parse(localStorage.getItem('terapia_demo_local_v1'));
        s.myNotes = {}; for (let i = 1; i <= 12; i++) { const id = 'sp-' + i; s.myNotes[id] = { meetingId: id, title: 'Długa ' + id, note: t, updatedAt: new Date(Date.now() - i * 1000).toISOString() }; }
        localStorage.setItem('terapia_demo_local_v1', JSON.stringify(s)); localStorage.setItem('terapia_test_save_fail', 'brak sieci (test)'); }""", longtxt)
    pg.reload(wait_until='load')
    sec = _goto_notes(pg); pg.wait_for_function(WAIT_GONE, timeout=10000)
    _setup_pin(pg, sec, pin); pg.wait_for_function(NOTES_READY, timeout=30000)
    notice = pg.get_by_role('alert').filter(has_text='Nie udało się zaszyfrować')
    try:
        notice.first.wait_for(timeout=8000)
        r['kontrola_komunikat_bledu'] = notice.first.inner_text()
    except Exception:
        r['kontrola_komunikat_bledu'] = ''
    if '12 notatek' not in r['kontrola_komunikat_bledu']:
        fails.append(f"R2-1 kontrola: nieudana migracja po cichu ({r['kontrola_komunikat_bledu']!r})")
    _tap(pg.get_by_role('button', name='Zamknij komunikat', exact=True))
    pg.evaluate("localStorage.removeItem('terapia_test_save_fail')")
    _tap(sec.get_by_role('button', name='Zablokuj notatki', exact=True))
    sec.get_by_text('Blokuję… dokańczam zapis').wait_for(state='detached', timeout=10000)
    r['odblokowanie'] = _try_unlock(pg, sec, pin)
    pg.wait_for_timeout(1000)
    t, n = _vals(sec)
    r['edytor'] = {'tytul': t, 'dlugosc': len(n or ''), 'zgodna': n == longtxt}
    raw = _local(pg)
    r['jawnych_w_storage'] = raw.count('Zażółć')
    r['rr1'] = raw.count('rr1:')
    r['komunikat_po_naprawie'] = pg.get_by_role('alert').filter(has_text='Nie udało się zaszyfrować').count()
    if not r['edytor']['zgodna'] or r['jawnych_w_storage'] or r['rr1'] < 24 or r['komunikat_po_naprawie']:
        fails.append(f"R2-1: długie notatki nie zaszyfrowane ({r['edytor']}, jawnych {r['jawnych_w_storage']}, rr1 {r['rr1']})")
    r['bledy_konsoli'] = errs[:]
    fails += [f'R2-1: {e}' for e in errs]
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
        rep['szyfrowanie'] = crypto_flow(br, a, fails)
        rep['O1_migracja_wyscig'] = o1_migracja_wyscig(br, a, fails)
        rep['O2_O3_dwa_urzadzenia'] = o23_dwa_urzadzenia(br, a, fails)
        rep['O4_blokada_w_locie'] = o4_blokada_w_locie(br, a, fails)
        rep['R2_1_dluga_notatka'] = r2_1_dluga_notatka(br, a, fails)
        rep['R2_3_zapis_dluzszy_niz_blokada'] = r2_3_zapis_dluzszy_niz_blokada(br, a, fails)
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
            _unlock(pg)

            # 1. notatka
            add = pg.get_by_role('button', name='Dodaj moją notatkę', exact=True).first
            if add.count() and add.is_visible():
                add.click()
            r['widzisz_tylko_ty'] = pg.get_by_text('widzisz tylko Ty').first.is_visible()
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
            _unlock(pg)
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
                try:  # scenariusz admina (wybór tematu) nieaktualny od 0.14.x — pada też na main 0.15.0; nie zasłania reszty
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
                except Exception as e:
                    fails.append(f'admin (wada scenariusza, także na main 0.15.0): {str(e).splitlines()[0]}')
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
