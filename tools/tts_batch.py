#!/usr/bin/env python3
"""Toplu seslendirme üretimi — Gemini TTS + Aoede + neşeli ton.

Özellikler:
  - Kaldığı yerden devam eder (var olan dosyayı atlar)
  - 429 (kota) alınca bekleyip tekrar dener, gerekirse hızı düşürür
  - Her üretilen dosya için manifest günceller (metin -> dosya)
  - İlerleme kaydeder: tools/tts-progress.json
"""
import json
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gemini_tts import uret, pcm_to_mp3  # noqa: E402

KOK = pathlib.Path(__file__).resolve().parent.parent
SES_KLASOR = KOK / "assets" / "ses"
MANIFEST = KOK / "assets" / "ses" / "manifest.json"
ILERLEME = KOK / "tools" / "tts-progress.json"

SES = "Aoede"
MODEL = "gemini-2.5-flash-preview-tts"   # 3.1 kotası doldu; 2.5 çalışıyor
# Seçilen ton: neşeli oyun sunucusu (kullanıcı 2 numarayı seçti)
STIL = ("Çok neşeli ve heyecanlı konuş, bir oyun sunucusu gibi. "
        "Her cümlede sevinç duyulsun, ses tonu canlı ve yukarıda. "
        "Yedi yaşındaki bir çocuğa sesleniyorsun, sıcak ve arkadaşça ol.")


def normalize(m: str) -> str:
    return re.sub(r"\s+", " ", str(m or "")).strip()


def yukle(p: pathlib.Path, varsayilan):
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return varsayilan
    return varsayilan


def kaydet(p: pathlib.Path, veri):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(veri, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    metinler = json.loads((KOK / "speech-texts.json").read_text(encoding="utf-8"))
    SES_KLASOR.mkdir(parents=True, exist_ok=True)
    manifest = yukle(MANIFEST, {})
    ilerleme = yukle(ILERLEME, {"yapilan": [], "bekleme": 9.0})

    yapilan = set(ilerleme.get("yapilan", []))
    bekleme = float(ilerleme.get("bekleme", 12.5))

    toplam = len(metinler)
    kalan = [m for m in metinler if m["id"] not in yapilan]
    print(f"Toplam {toplam} cümle, {len(kalan)} tanesi üretilecek.", flush=True)
    print(f"Tahmini süre: {len(kalan) * bekleme / 60:.0f} dakika", flush=True)

    hata_seri = 0
    for i, kayit in enumerate(kalan, 1):
        mid = kayit["id"]
        metin = normalize(kayit["metin"])
        dosya = f"assets/ses/{mid}.mp3"
        yol = KOK / dosya

        if yol.exists() and yol.stat().st_size > 800:
            manifest[metin] = dosya
            yapilan.add(mid)
            continue

        deneme = 0
        while True:
            deneme += 1
            try:
                pcm = uret(metin, SES, STIL, model=MODEL)
                pcm_to_mp3(pcm, yol, 1.0)
                manifest[metin] = dosya
                yapilan.add(mid)
                hata_seri = 0
                ilerleme.update({"yapilan": sorted(yapilan), "bekleme": bekleme})
                kaydet(MANIFEST, manifest)
                kaydet(ILERLEME, ilerleme)
                if i % 10 == 0 or i == len(kalan):
                    print(f"[{i}/{len(kalan)}] {mid} ✓  ({len(manifest)} manifest kaydı)", flush=True)
                time.sleep(bekleme)
                break
            except Exception as e:
                msg = str(e)
                kota = "429" in msg or "quota" in msg.lower() or "Too Many" in msg
                gecici = "503" in msg or "Unavailable" in msg
                if kota and deneme <= 6:
                    # Kota: hızı düşür ve bekle
                    bekleme = min(30.0, bekleme * 1.4)
                    beklenecek = min(70, 15 * deneme)
                    print(f"[{i}/{len(kalan)}] {mid} kota → {beklenecek}sn bekleyip tekrar "
                          f"(deneme {deneme}, yeni aralık {bekleme:.1f}sn)", flush=True)
                    time.sleep(beklenecek)
                    continue
                if gecici and deneme <= 8:
                    print(f"[{i}/{len(kalan)}] {mid} servis yoğun (503) → 20sn bekleyip tekrar ({deneme})", flush=True)
                    time.sleep(20)
                    continue
                if deneme <= 3 and not kota:
                    time.sleep(6)
                    continue
                print(f"[{i}/{len(kalan)}] {mid} ATLANDI: {msg[:160]}", flush=True)
                hata_seri += 1
                if hata_seri >= 12:
                    print("Üst üste çok hata — durduruluyor.", flush=True)
                    kaydet(MANIFEST, manifest)
                    kaydet(ILERLEME, {"yapilan": sorted(yapilan), "bekleme": bekleme})
                    return 1
                break

    kaydet(MANIFEST, manifest)
    kaydet(ILERLEME, {"yapilan": sorted(yapilan), "bekleme": bekleme})
    print(f"\n✅ BİTTİ — {len(manifest)} cümle seslendirildi.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
