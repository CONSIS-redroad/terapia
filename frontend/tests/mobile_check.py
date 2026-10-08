"""Kontrola aplikacji na telefonie (PWA) — uniwersalna, dla każdej strony/aplikacji RedRoad.

Mierzy (nie zgaduje) na szerokościach telefonu, w motywie jasnym i ciemnym:
  1. szerokość strony == szerokość ekranu (brak przesuwania w bok) + lista elementów wystających,
  2. najmniejszą czcionkę widocznego tekstu (próg: 13 px),
  3. cele dotyku: przyciski/linki/pola niższe niż 40 px (próg z klasy .tap = 44 px; 40 = margines),
  4. błędy konsoli i błędy strony,
  5. robi zrzuty ekranu do obejrzenia OCZAMI (pomiar nie zastępuje patrzenia).

Użycie:
  python tests/mobile_check.py --url http://127.0.0.1:8156/dist/ --out wyniki/
  python tests/mobile_check.py --url https://consis-redroad.github.io/terapia/ --widths 360 390
  (opcjonalnie --init "<JS>" — skrypt uruchamiany przed stroną, np. ustawienie localStorage, żeby ominąć ekran powitalny)

Kod wyjścia: 0 = wszystko w normie, 1 = są przekroczenia (lista w raporcie), 2 = błąd uruchomienia.
Wymaga: pip install playwright && python -m playwright install chromium

Pułapki (zmierzone przy TERAPII 08.10.2026): wait_until='load' (PWA nie milknie — 'networkidle' wisi);
bez device_scale_factor=2 na obciążonym komputerze (Target crashed); serwer lokalny uruchamiaj w katalogu
NADRZĘDNYM do dist/ (build kasuje dist/ — serwer w dist widzi pustkę).
"""
import argparse
import json
import os
import sys

MEASURE = r"""() => {
  const W = document.documentElement.clientWidth;
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight * 3; };
  const label = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' "' + (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 40) + '"');
  const overflow = [];
  document.querySelectorAll('body *').forEach(e => {
    if (e.closest('svg, canvas, [aria-hidden="true"], .snap-x')) return;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed') overflow.push(label(e) + ` L=${Math.round(r.left)} R=${Math.round(r.right)}`);
  });
  let minFont = 99, minFontEl = '';
  document.querySelectorAll('body *').forEach(e => {
    if (!vis(e)) return;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) return;
    const f = parseFloat(getComputedStyle(e).fontSize);
    if (f < minFont) { minFont = f; minFontEl = label(e); }
  });
  const small = [];
  document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]').forEach(e => {
    if (!vis(e)) return;
    const r = e.getBoundingClientRect();
    if (r.height < 40 && r.width < 40) small.push(label(e) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
  });
  return { W, scrollW: document.documentElement.scrollWidth, overflow: overflow.slice(0, 10), minFont, minFontEl, smallTargets: small.slice(0, 15), smallCount: small.length };
}"""


def main() -> int:
    ap = argparse.ArgumentParser(description="Kontrola aplikacji na telefonie (PWA)")
    ap.add_argument("--url", required=True)
    ap.add_argument("--widths", nargs="+", type=int, default=[320, 360, 390, 430])
    ap.add_argument("--out", default="mobile_check_out")
    ap.add_argument("--init", default="", help="JS uruchamiany przed załadowaniem strony")
    ap.add_argument("--min-font", type=float, default=13.0)
    a = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Brak Playwright: pip install playwright && python -m playwright install chromium")
        return 2
    os.makedirs(a.out, exist_ok=True)
    report, fails = [], 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for scheme in ("light", "dark"):
            for w in a.widths:
                ctx = b.new_context(viewport={"width": w, "height": 844}, is_mobile=True, has_touch=True, color_scheme=scheme)
                if a.init:
                    ctx.add_init_script(a.init)
                pg = ctx.new_page()
                errs: list[str] = []
                pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
                pg.on("console", lambda m: errs.append(f"console: {m.text}") if m.type == "error" else None)
                pg.goto(a.url, wait_until="load", timeout=60000)
                pg.wait_for_timeout(1500)
                m = pg.evaluate(MEASURE)
                shot = os.path.join(a.out, f"{scheme}_{w}.png")
                pg.screenshot(path=shot)
                bad = []
                if m["scrollW"] > m["W"]:
                    bad.append(f"strona szersza niż ekran: {m['scrollW']} > {m['W']}")
                if m["minFont"] < a.min_font:
                    bad.append(f"za mała czcionka {m['minFont']} px: {m['minFontEl']}")
                if m["smallCount"]:
                    bad.append(f"{m['smallCount']} cel(e) dotyku < 40 px")
                if errs:
                    bad.append(f"{len(errs)} błąd(y) konsoli/strony")
                fails += bool(bad)
                report.append({"schemat": scheme, "szerokosc": w, "ok": not bad, "problemy": bad, "pomiar": m, "bledy": errs[:5], "zrzut": shot})
                print(f"[{'OK ' if not bad else 'ŹLE'}] {scheme:5} {w}px  scrollW={m['scrollW']}  minFont={m['minFont']}px  małe cele={m['smallCount']}  błędy={len(errs)}")
                for x in bad:
                    print("        -", x)
                ctx.close()
        b.close()
    with open(os.path.join(a.out, "raport.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nRaport: {os.path.join(a.out, 'raport.json')} · zrzuty w {a.out}/ — OBEJRZYJ je, pomiar nie zastępuje oka.")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
