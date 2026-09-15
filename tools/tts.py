#!/usr/bin/env python3
"""Seslendirme üretimi — TEK KOMUT, iki sağlayıcı.

    python3 tools/tts.py edge      # Microsoft nöral (ücretsiz, kotasız, hızlı)
    python3 tools/tts.py gemini    # Google Gemini (daha doğal, günlük kota var)

NEDEN İKİ SAĞLAYICI:
  Gemini TTS ses kalitesi daha iyi ama ücretsiz kotası çok sıkı
  (~10 istek/gün) ve 280 cümle saatler sürüyor. edge-tts kotasız ve
  ~1 cümle/saniye, ama ses kalitesi daha düz.

Her ikisi de AYNI çıktıyı üretir:
    assets/ses/<id>.mp3          →  cümleler
    assets/ses/isim/<slug>.mp3   →  isimler
    assets/ses/manifest.json     →  { metin: dosya }
    assets/ses/isim/names.json   →  { slug: dosya }

Oyun tarafında HİÇBİR değişiklik gerekmez — sağlayıcı değiştirmek
için tek komut yeter. Eski dosyalar üzerine yazılır.

İsim listesi: isimler.txt (her satırda bir isim)
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
import time

KOK = pathlib.Path(__file__).resolve().parent.parent
SES_KLASOR = KOK / "assets" / "ses"
EDGE_BIN = "/home/hermes/.hermes/hermes-agent/venv/bin/edge-tts"

# --- Sağlayıcı ayarları ---
EDGE_SES = "tr-TR-EmelNeural"
EDGE_HIZ = "-10%"
EDGE_TON = "+4Hz"

GEMINI_MODEL = "gemini-2.5-flash-preview-tts"   # 3.1 kotası daha çabuk doluyor
GEMINI_SES = "Aoede"
GEMINI_STIL = ("Çok neşeli ve heyecanlı konuş, bir oyun sunucusu gibi. Her cümlede "
               "sevinç duyulsun, ses tonu canlı ve yukarıda. Yedi yaşındaki bir "
               "çocuğa sesleniyorsun, sıcak ve arkadaşça ol.")
GEMINI_BEKLEME = 9.0    # saniye — ücretsiz kota için


def slug(ad: str) -> str:
    """DİKKAT: audio.js içindeki nameSlug() ile BİREBİR aynı olmalı.
    Türkçe büyük İ (U+0130) lower() sonrası birleşik nokta (U+0307) bırakır;
    NFKD + birleşik işaret temizliği yapılmazsa 'İpek' -> 'i-pek' olur ve
    JS'in ürettiği 'ipek' ile EŞLEŞMEZ."""
    s = ad.strip().lower()
    for a, b in [("ç", "c"), ("ğ", "g"), ("ı", "i"), ("ö", "o"), ("ş", "s"),
                 ("ü", "u"), ("â", "a"), ("î", "i"), ("û", "u")]:
        s = s.replace(a, b)
    import unicodedata
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "isim"


def uret_edge(metin: str, cikti: pathlib.Path, hiz=EDGE_HIZ, ton=EDGE_TON) -> bool:
    cikti.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        [EDGE_BIN, "--voice", EDGE_SES, f"--rate={hiz}", f"--pitch={ton}",
         "--text", metin, "--write-media", str(cikti)],
        capture_output=True, timeout=120,
    )
    return r.returncode == 0 and cikti.exists() and cikti.stat().st_size > 500


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("saglayici", choices=["edge", "gemini"])
    ap.add_argument("--sadece-isimler", action="store_true", help="Yalnız isim paketini üret")
    ap.add_argument("--zorla", action="store_true", help="Var olan dosyaların üzerine yaz")
    a = ap.parse_args()

    if a.saglayici == "gemini":
        sys.path.insert(0, str(KOK / "tools"))
        from gemini_tts import uret, pcm_to_mp3  # noqa

        def uret_gemini(metin, yol):
            pcm = uret(metin, GEMINI_SES, GEMINI_STIL, model=GEMINI_MODEL)
            pcm_to_mp3(pcm, yol)
            return True
        uret_fn = uret_gemini
        bekleme = GEMINI_BEKLEME
    else:
        uret_fn = uret_edge
        bekleme = 0.05

    SES_KLASOR.mkdir(parents=True, exist_ok=True)
    manifest_yolu = SES_KLASOR / "manifest.json"
    manifest = {}
    if manifest_yolu.exists():
        try:
            manifest = json.loads(manifest_yolu.read_text(encoding="utf-8"))
        except Exception:
            manifest = {}

    yeni = 0
    hata = 0

    if not a.sadece_isimler:
        metinler = json.loads((KOK / "speech-texts.json").read_text(encoding="utf-8"))
        print(f"[{a.saglayici}] {len(metinler)} cümle…", flush=True)
        for i, kayit in enumerate(metinler, 1):
            metin = re.sub(r"\s+", " ", kayit["metin"]).strip()
            dosya = f"assets/ses/{kayit['id']}.mp3"
            yol = KOK / dosya
            if not a.zorla and yol.exists() and yol.stat().st_size > 500:
                manifest[metin] = dosya
                continue
            try:
                if uret_fn(metin, yol):
                    manifest[metin] = dosya
                    yeni += 1
                else:
                    hata += 1
            except Exception as e:
                hata += 1
                msg = str(e)
                if any(k in msg for k in ("429", "503", "quota", "Unavailable")):
                    print(f"  ⛔ kota/yoğunluk — {msg[:80]}", flush=True)
                    print("     (Gemini kotası doldu. Yarın ya da faturalandırma "
                          "aktifleşince tekrar deneyin.)", flush=True)
                    break
                print(f"  ✗ {kayit['id']}: {msg[:80]}", flush=True)
            if bekleme:
                time.sleep(bekleme)
            if i % 25 == 0:
                print(f"  [{i}/{len(metinler)}]  yeni {yeni}  hata {hata}", flush=True)
            manifest_yolu.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")

    # İsim paketi
    isim_liste = KOK / "isimler.txt"
    if isim_liste.exists():
        adlar = [l.strip() for l in isim_liste.read_text(encoding="utf-8").splitlines() if l.strip()]
        im_yolu = SES_KLASOR / "isim" / "names.json"
        isim_man = {}
        if im_yolu.exists():
            try:
                isim_man = json.loads(im_yolu.read_text(encoding="utf-8"))
            except Exception:
                isim_man = {}
        print(f"[{a.saglayici}] {len(adlar)} isim…", flush=True)
        for ad in adlar:
            s = slug(ad)
            yol = SES_KLASOR / "isim" / f"{s}.mp3"
            if not a.zorla and yol.exists() and yol.stat().st_size > 500:
                isim_man[s] = f"assets/ses/isim/{s}.mp3"
                continue
            try:
                ok = (uret_edge(ad, yol, "-18%", "+5Hz") if a.saglayici == "edge"
                      else uret_fn(ad, yol))
                if ok:
                    isim_man[s] = f"assets/ses/isim/{s}.mp3"
                    yeni += 1
            except Exception as e:
                print(f"  ✗ {ad}: {str(e)[:70]}", flush=True)
            if bekleme:
                time.sleep(bekleme)
        im_yolu.parent.mkdir(parents=True, exist_ok=True)
        im_yolu.write_text(json.dumps(isim_man, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  isim paketi: {len(isim_man)}", flush=True)

    manifest_yolu.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n✅ [{a.saglayici}] bitti — manifest {len(manifest)} cümle, {yeni} yeni, {hata} hata", flush=True)


if __name__ == "__main__":
    sys.exit(main())
