#!/usr/bin/env python3
"""Gemini TTS ile Türkçe seslendirme üret.

Kullanım:
    python3 tools/gemini_tts.py --text "Karenin dört kenarı vardır." --out out/deneme.mp3
    python3 tools/gemini_tts.py --voice Aoede --style "yavaş ve net" ...

Çıktı: MP3 (24kHz PCM -> ffmpeg ile dönüştürülür)
Anahtar: ~/.hermes/.env içindeki GEMINI_API_KEY
"""
import argparse
import base64
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

MODEL = "gemini-3.1-flash-tts-preview"
API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Çocuk oyunu için ses yönergesi — Gemini TTS doğal dille stil kabul eder
VARSAYILAN_STIL = (
    "Sıcak, sevecen ve net bir öğretmen sesiyle konuş. "
    "Yedi yaşındaki bir çocuğa anlatıyormuş gibi, acele etmeden, "
    "her cümleyi ayrı ayrı ve biraz yavaş söyle."
)


def anahtar() -> str:
    p = pathlib.Path.home() / ".hermes" / ".env"
    if p.exists():
        for satir in p.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^GEMINI_API_KEY=(.+)$", satir.strip())
            if m:
                return m.group(1).strip()
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    if k:
        return k
    sys.exit("GEMINI_API_KEY bulunamadı (~/.hermes/.env)")


def uret(metin: str, ses: str, stil: str, model: str = MODEL) -> bytes:
    """TTS çağrısı yap, ham PCM baytlarını döndür (24kHz, 16-bit, mono)."""
    govde = {
        "contents": [{"parts": [{"text": f"{stil}\n\nOku: {metin}"}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": ses}}
            },
        },
    }
    istek = urllib.request.Request(
        API.format(model=model) + "?key=" + anahtar(),
        data=json.dumps(govde).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(istek, timeout=90) as y:
        cevap = json.loads(y.read().decode("utf-8"))

    if "error" in cevap:
        raise RuntimeError(cevap["error"].get("message", "bilinmeyen API hatası"))

    try:
        parcalar = cevap["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError):
        raise RuntimeError("beklenmeyen yanıt: " + json.dumps(cevap)[:400])

    for p in parcalar:
        ic = p.get("inlineData") or p.get("inline_data")
        if ic and ic.get("data"):
            return base64.b64decode(ic["data"])
    raise RuntimeError("yanıtta ses verisi yok")


def pcm_to_mp3(pcm: bytes, cikti: pathlib.Path, hiz: float = 1.0):
    """ffmpeg ile PCM -> MP3. hiz<1 yavaşlatır, >1 hızlandırır."""
    cikti.parent.mkdir(parents=True, exist_ok=True)
    filtre = []
    if hiz != 1.0:
        # atempo 0.5-2.0 arası; tonu bozmadan hız değiştirir
        filtre = ["-filter:a", f"atempo={max(0.5, min(2.0, hiz))}"]
    komut = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "pipe:0",
        *filtre,
        "-codec:a", "libmp3lame", "-q:a", "4", str(cikti),
    ]
    r = subprocess.run(komut, input=pcm, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg hatası: " + r.stderr.decode("utf-8", "ignore")[:300])
    return cikti


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="Aoede")
    ap.add_argument("--style", default=VARSAYILAN_STIL)
    ap.add_argument("--speed", type=float, default=1.0, help="1.0 normal, 0.9 yavaş")
    ap.add_argument("--model", default=MODEL)
    a = ap.parse_args()

    pcm = uret(a.text, a.voice, a.style, a.model)
    yol = pcm_to_mp3(pcm, pathlib.Path(a.out), a.speed)
    sure = round(len(pcm) / (24000 * 2), 2)
    print(f"✅ {yol}  ({sure} sn ses, {yol.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
