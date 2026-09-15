#!/usr/bin/env python3
"""İsim paketi üretimi — her çocuğun adı ayrı bir ses dosyası.

NEDEN: Oyun herkese açık; isimler oyun sırasında giriliyor, önceden
bilinemez. Bu yüzden cümle PARÇALARA ayrılır:

    "Hoş geldin"  +  [çocuğun adı]  +  "Bugün geometri öğreneceğiz. Hazır mısın?"

Sabit parçalar bir kez üretilir; her isim küçük bir dosya olur.
Yeni bir çocuk geldiğinde yalnızca onun adı üretilir.

Kullanım:
    python3 tools/tts_names.py Civan Ada Zeynep Efe
    python3 tools/tts_names.py --dosya sinif-listesi.txt
    python3 tools/tts_names.py --tum -- siniftaki-tum-isimler

Çıktı:
    assets/ses/isim/<slug>.mp3
    assets/ses/isim/names.json   -> { "civan": "assets/ses/isim/civan.mp3", ... }
"""
import argparse
import json
import pathlib
import re
import sys
import time
import unicodedata

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gemini_tts import uret, pcm_to_mp3  # noqa: E402

KOK = pathlib.Path(__file__).resolve().parent.parent
KLASOR = KOK / "assets" / "ses" / "isim"
MANIFEST = KLASOR / "names.json"

SES = "Aoede"
MODEL = "gemini-2.5-flash-preview-tts"
# İsim söylenirken neşeli ama NET olmalı (çocuk kendi adını duymalı)
STIL = ("Çok neşeli ve sıcak bir sesle, sanki sevgiyle sesleniyormuş gibi söyle. "
        "Yedi yaşındaki bir çocuğa hitap ediyorsun. Tek bir isim söylüyorsun, "
        "çok net ve anlaşılır olsun.")


def slug(ad: str) -> str:
    """İsmi dosya adına çevir (Türkçe karakterleri sadeleştir)."""
    s = ad.strip().lower()
    tr = str.maketrans("çğıöşüâîû", "cgiosuaiu")
    s = s.translate(tr)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "isim"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("isimler", nargs="*", help="Üretilecek isimler")
    ap.add_argument("--dosya", help="Her satırda bir isim olan dosya")
    a = ap.parse_args()

    isimler = list(a.isimler)
    if a.dosya:
        p = pathlib.Path(a.dosya)
        if p.exists():
            isimler += [l.strip() for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
        else:
            sys.exit(f"Dosya bulunamadı: {p}")

    # Tekrarları at, sırayı koru
    gorulen, temiz = set(), []
    for i in isimler:
        i = i.strip().strip(",").strip()
        if i and i.lower() not in gorulen:
            gorulen.add(i.lower())
            temiz.append(i)

    if not temiz:
        sys.exit("İsim verilmedi. Örnek: python3 tools/tts_names.py Civan Ada")

    KLASOR.mkdir(parents=True, exist_ok=True)
    manifest = {}
    if MANIFEST.exists():
        try:
            manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        except Exception:
            manifest = {}

    print(f"{len(temiz)} isim işlenecek. (Mevcut paket: {len(manifest)} isim)", flush=True)
    yeni = 0
    for i, ad in enumerate(temiz, 1):
        s = slug(ad)
        yol = KLASOR / f"{s}.mp3"
        if yol.exists() and yol.stat().st_size > 600:
            manifest[s] = f"assets/ses/isim/{s}.mp3"
            print(f"[{i}/{len(temiz)}] {ad} — zaten var", flush=True)
            continue

        deneme = 0
        while True:
            deneme += 1
            try:
                pcm = uret(ad, SES, STIL, model=MODEL)
                pcm_to_mp3(pcm, yol)
                manifest[s] = f"assets/ses/isim/{s}.mp3"
                yeni += 1
                print(f"[{i}/{len(temiz)}] {ad} ✓", flush=True)
                MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
                time.sleep(9)
                break
            except Exception as e:
                msg = str(e)
                gecici = any(k in msg for k in ("429", "503", "quota", "Unavailable", "Too Many"))
                if gecici and deneme <= 8:
                    bekle = 20 if "503" in msg else min(70, 15 * deneme)
                    print(f"[{i}/{len(temiz)}] {ad} — kota/yoğunluk, {bekle}sn bekleniyor ({deneme})", flush=True)
                    time.sleep(bekle)
                    continue
                print(f"[{i}/{len(temiz)}] {ad} ATLANDI: {msg[:120]}", flush=True)
                break

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n✅ İsim paketi: {len(manifest)} isim ({yeni} yeni üretildi)", flush=True)


if __name__ == "__main__":
    main()
