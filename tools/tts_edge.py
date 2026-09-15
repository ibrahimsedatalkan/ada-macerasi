#!/usr/bin/env python3
"""Toplu seslendirme — edge-tts (Microsoft nöral Türkçe sesler).

NEDEN edge-tts: Gemini TTS'in ücretsiz kotası çok sıkı (≈10 istek) ve
üretim saatler sürüyordu. edge-tts:
  - Ücretsiz, API anahtarı YOK
  - Kota YOK
  - Çok hızlı (~1 cümle/saniye)
  - Türkçe nöral sesler: tr-TR-EmelNeural, tr-TR-AhmetNeural

Üretilen dosyalar Gemini ile AYNI formatta (MP3) ve aynı manifest
yapısında — oyun tarafında değişiklik gerekmez.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

KOK = pathlib.Path(__file__).resolve().parent.parent
EDGE = "/home/hermes/.hermes/hermes-agent/venv/bin/edge-tts"

SES = "tr-TR-EmelNeural"
HIZ = "-10%"          # 7 yaş için biraz yavaş
TON = "+4Hz"          # biraz daha canlı/neşeli


def uret(metin: str, cikti: pathlib.Path, ses=SES, hiz=HIZ, ton=TON) -> bool:
    cikti.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        [EDGE, "--voice", ses, f"--rate={hiz}", f"--pitch={ton}",
         "--text", metin, "--write-media", str(cikti)],
        capture_output=True, timeout=120,
    )
    return r.returncode == 0 and cikti.exists() and cikti.stat().st_size > 500


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ses", default=SES)
    ap.add_argument("--hiz", default=HIZ)
    ap.add_argument("--ton", default=TON)
    ap.add_argument("--sadece-isimler", action="store_true")
    a = ap.parse_args()

    manifest_yolu = KOK / "assets" / "ses" / "manifest.json"
    manifest = {}
    if manifest_yolu.exists():
        try:
            manifest = json.loads(manifest_yolu.read_text(encoding="utf-8"))
        except Exception:
            manifest = {}

    toplam_yeni = 0

    if not a.sadece_isimler:
        metinler = json.loads((KOK / "speech-texts.json").read_text(encoding="utf-8"))
        print(f"{len(metinler)} cümle işlenecek…", flush=True)
        for i, kayit in enumerate(metinler, 1):
            metin = re.sub(r"\s+", " ", kayit["metin"]).strip()
            dosya = f"assets/ses/{kayit['id']}.mp3"
            yol = KOK / dosya
            if yol.exists() and yol.stat().st_size > 500:
                manifest[metin] = dosya
                continue
            if uret(metin, yol, a.ses, a.hiz, a.ton):
                manifest[metin] = dosya
                toplam_yeni += 1
                if i % 25 == 0:
                    print(f"  [{i}/{len(metinler)}] üretildi…", flush=True)
            else:
                print(f"  ✗ {kayit['id']}", flush=True)
        print(f"Cümleler bitti — {toplam_yeni} yeni", flush=True)

    # İsim paketi
    isimler = []
    isim_liste = KOK / "isimler.txt"
    if isim_liste.exists():
        isimler = [l.strip() for l in isim_liste.read_text(encoding="utf-8").splitlines() if l.strip()]
    if isimler:
        def slug(ad):
            s = ad.strip().lower()
            s = s.replace("ç", "c").replace("ğ", "g").replace("ı", "i").replace("ö", "o")
            s = s.replace("ş", "s").replace("ü", "u").replace("â", "a").replace("î", "i").replace("û", "u")
            import unicodedata
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
            return s or "isim"

        isim_man = {}
        im_yolu = KOK / "assets" / "ses" / "isim" / "names.json"
        if im_yolu.exists():
            try:
                isim_man = json.loads(im_yolu.read_text(encoding="utf-8"))
            except Exception:
                isim_man = {}

        print(f"{len(isimler)} isim işlenecek…", flush=True)
        for ad in isimler:
            s = slug(ad)
            yol = KOK / "assets" / "ses" / "isim" / f"{s}.mp3"
            if yol.exists() and yol.stat().st_size > 500:
                isim_man[s] = f"assets/ses/isim/{s}.mp3"
                continue
            # İsim tek başına söylenirken biraz daha yavaş ve net
            if uret(ad, yol, a.ses, "-18%", "+5Hz"):
                isim_man[s] = f"assets/ses/isim/{s}.mp3"
                toplam_yeni += 1
        im_yolu.parent.mkdir(parents=True, exist_ok=True)
        im_yolu.write_text(json.dumps(isim_man, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"İsim paketi: {len(isim_man)} isim", flush=True)

    manifest_yolu.parent.mkdir(parents=True, exist_ok=True)
    manifest_yolu.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n✅ BİTTİ — manifest: {len(manifest)} cümle, {toplam_yeni} yeni dosya", flush=True)


if __name__ == "__main__":
    sys.exit(main())
