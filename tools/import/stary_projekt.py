"""Paczka importu do Supabase ze starego projektu TERAPIA (PHP, wersja 1.1.5).

Czyta stary folder (data/*.json + media/<rozdzial>/ + opcjonalnie folder z materiałami zajęć)
i składa w `prywatne/supabase-import/` (folder WYKLUCZONY z gita) gotową paczkę:

  prywatne/supabase-import/
    manifest.json                  wiersze do tabeli `materials` + treść lektur + mapa plików
    files/admin/lektury/<slug>/…   pliki do bucketu `group-files` (klucz = ścieżka od files/)
    files/admin/zajecia/<data>/…   materiały zajęć (PDF)

Obrazy główne PNG są zmniejszane do JPG (max 1600 px), reszta kopiowana bez zmian.
Treści są CUDZE (prawa autorskie) — NIGDY do publicznego repo; tylko do prywatnego Storage grupy.

Użycie:
  python tools/import/stary_projekt.py --zrodlo "I:/Mój dysk/Terapia" [--zajecia "domowa luty=2026-02-17"]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WYJSCIE = REPO / "prywatne" / "supabase-import"
LIMIT_PLIKU = 20 * 1024 * 1024  # = file_size_limit bucketu group-files

KATEGORIE = {  # rozdział starego projektu → kategoria materials.category
    "chapter1": "ksiazka",
    "chapter2": "poradnik",
    "chapter3": "inne",
    "chapter4": "poradnik",
}
OBRAZY = {".jpg", ".jpeg", ".png", ".webp"}
RODZAJ = {".pdf": "pdf", ".mp3": "audio", ".m4a": "audio", ".wav": "audio",
          ".epub": "pdf", ".docx": "pdf", ".doc": "pdf"}  # epub/docx: brak osobnego rodzaju w schemacie — patrz README


def slug(tekst: str) -> str:
    t = unicodedata.normalize("NFKD", tekst.replace("ł", "l").replace("Ł", "L"))
    t = t.encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60] or "plik"


def nazwa_pliku(p: Path) -> str:
    return f"{slug(p.stem)}{p.suffix.lower()}"


def kopiuj(src: Path, cel: Path) -> dict:
    cel.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix.lower() == ".png" and src.stat().st_size > 1024 * 1024:
        try:
            from PIL import Image
            cel = cel.with_suffix(".jpg")
            with Image.open(src) as im:
                im = im.convert("RGB")
                im.thumbnail((1600, 1600))
                im.save(cel, "JPEG", quality=85, optimize=True)
        except ImportError:
            shutil.copy2(src, cel)
    else:
        shutil.copy2(src, cel)
    rozmiar = cel.stat().st_size
    return {
        "path": cel.relative_to(WYJSCIE / "files").as_posix(),
        "zrodlo": src.name,
        "bajty": rozmiar,
        "sha256": hashlib.sha256(cel.read_bytes()).hexdigest()[:16],
        "za_duzy": rozmiar > LIMIT_PLIKU,
    }


def lektury(zrodlo: Path) -> list[dict]:
    spis = json.loads((zrodlo / "data" / "chapters.json").read_text(encoding="utf-8"))["chapters"]
    wynik = []
    for meta in sorted(spis, key=lambda c: c.get("date", "")):
        cid = meta["id"]
        tresc = json.loads((zrodlo / "data" / f"{cid}.json").read_text(encoding="utf-8"))
        s = slug(meta["title"])
        katalog = zrodlo / "media" / cid
        pliki, obraz_glowny, galeria, nagranie = [], None, [], None
        for f in sorted(katalog.iterdir()) if katalog.is_dir() else []:
            if f.name.startswith(".") or not f.is_file():
                continue
            info = kopiuj(f, WYJSCIE / "files" / "admin" / "lektury" / s / nazwa_pliku(f))
            ext = f.suffix.lower()
            if f.stem.lower() == "main" and ext in OBRAZY:
                obraz_glowny = info
            elif ext in OBRAZY:
                galeria.append(info)
            elif ext in (".mp3", ".m4a", ".wav") and nagranie is None:
                nagranie = info
            else:
                info["rodzaj"] = RODZAJ.get(ext, "pdf")
                pliki.append(info)
        wynik.append({
            "slug": s,
            "stary_id": cid,
            "material": {  # kolumny public.materials
                "title": meta["title"],
                "kind": "lektura",  # NOWY rodzaj — wymaga migracji (README § Zmiany schematu)
                "category": KATEGORIE.get(cid, "inne"),
                "author": tresc.get("author", ""),
                "note": meta.get("subtitle", ""),
                "added_at": f"{meta['date']}T18:00:00+02:00" if meta.get("date") else None,
                "meeting_date": meta.get("date"),  # do dopasowania meeting_id po imporcie zajęć
            },
            "tresc": {k: tresc.get(k) for k in ("lead", "sections") if tresc.get(k)},
            "linki": tresc.get("links", []),
            "obraz_glowny": obraz_glowny,
            "galeria": galeria,
            "nagranie": nagranie,
            "pliki": pliki,
        })
    return wynik


def materialy_zajec(zrodlo: Path, wpisy: list[str], juz: set[str]) -> list[dict]:
    wynik = []
    for wpis in wpisy:
        folder, _, data = wpis.partition("=")
        katalog = zrodlo / folder
        for f in sorted(katalog.iterdir()):
            if not f.is_file() or f.suffix.lower() != ".pdf":
                continue
            if f.name in juz:  # ten sam plik jest już przy lekturze
                continue
            info = kopiuj(f, WYJSCIE / "files" / "admin" / "zajecia" / data / nazwa_pliku(f))
            tytul = re.sub(r"^\d+\s*", "", f.stem).replace("_", " ").strip()
            wynik.append({
                "material": {"title": tytul[:1].upper() + tytul[1:], "kind": "pdf", "category": "zajecia",
                             "author": "", "note": f"Materiał z zajęć ({folder})",
                             "added_at": f"{data}T18:00:00+02:00", "meeting_date": data},
                "plik": info,
            })
    return wynik


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--zrodlo", required=True, type=Path, help="folder starego projektu")
    ap.add_argument("--zajecia", action="append", default=[], help='"folder=RRRR-MM-DD" (PDF-y zajęć)')
    a = ap.parse_args()
    if WYJSCIE.exists():
        shutil.rmtree(WYJSCIE / "files", ignore_errors=True)
    WYJSCIE.mkdir(parents=True, exist_ok=True)

    lek = lektury(a.zrodlo)
    juz = {p["zrodlo"] for l in lek for p in l["pliki"]}
    zaj = materialy_zajec(a.zrodlo, a.zajecia, juz)
    wszystkie = [x for l in lek for x in [l["obraz_glowny"], l["nagranie"], *l["galeria"], *l["pliki"]] if x] \
        + [z["plik"] for z in zaj]
    manifest = {
        "wersja": 1,
        "zrodlo": "stary projekt TERAPIA (PHP 1.1.5)",
        "bucket": "group-files",
        "lektury": lek,
        "materialy_zajec": zaj,
        "suma_bajtow": sum(p["bajty"] for p in wszystkie),
        "plikow": len(wszystkie),
        "za_duze": [p["path"] for p in wszystkie if p["za_duzy"]],
    }
    (WYJSCIE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"lektur: {len(lek)} | materiałów zajęć: {len(zaj)} | plików: {manifest['plikow']} | "
          f"{manifest['suma_bajtow'] / 1024 / 1024:.1f} MB | za duże: {len(manifest['za_duze'])}")
    print(f"-> {WYJSCIE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
