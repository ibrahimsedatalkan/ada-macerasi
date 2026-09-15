# Seslendirme Araçları

Oyunun sesli anlatımı **önceden üretilmiş MP3 dosyalarından** çalınır.
Tarayıcı sesi (Web Speech API) yalnızca **yedek** olarak kalır.

## Neden önceden üretim?

Oyun herkese açık statik bir site (GitHub Pages). API anahtarını
tarayıcıya koymak **güvenlik açığı** olurdu — herkes kopyalar, kota biter.
Bu yüzden sesler bir kez sunucuda üretilir, dosya olarak repoya konur:

- Anahtar tarayıcıya hiç gitmez
- Gecikme yok, internet gerekmez
- Oynama başına maliyet sıfır

## Sağlayıcı değiştirme — TEK KOMUT

```bash
python3 tools/tts.py edge      # Microsoft nöral (ücretsiz, kotasız, hızlı)
python3 tools/tts.py gemini    # Google Gemini (daha doğal, günlük kota var)
```

Her ikisi de **aynı çıktıyı** üretir; oyun tarafında değişiklik gerekmez.
Eski dosyaların üzerine yazar. İsimleri ayrıca üretmek için `--sadece-isimler`,
zorla yeniden üretmek için `--zorla`.

## Sağlayıcı karşılaştırması (ölçülmüş)

| | edge-tts | Gemini TTS |
|---|---|---|
| Ses kalitesi | Düz, anlaşılır | **Daha doğal, duygulu** |
| Ücret | Ücretsiz | Ücretsiz katman |
| Kota | **Yok** | ~10 istek/gün (ücretsiz) |
| Hız | **~1 cümle/saniye** | ~9 sn/cümle (kotayla saatler) |
| Anahtar | Gerekmez | `GEMINI_API_KEY` |
| Türkçe sesler | Emel, Ahmet | Aoede, Kore, Leda, Charon… |
| 280 cümle süresi | **7 dakika** | saatler (kota bitiyor) |

**Karar:** Şimdilik edge-tts (hız + kotasızlık). Gemini kotası
sıfırlanınca veya faturalandırma aktifleşince `tts.py gemini` ile geçilir.

## Dosya yapısı

```
speech-texts.json          → üretilecek cümleler (test/extract-speech.mjs çıkarır)
isimler.txt                → isim listesi (her satırda bir isim)
assets/ses/<id>.mp3        → cümleler
assets/ses/isim/<slug>.mp3 → isimler
assets/ses/manifest.json   → { metin: dosya }  ← oyun bunu kullanır
assets/ses/isim/names.json → { slug: dosya }
```

## Kişisel karşılama nasıl çalışır?

Cümle parçalara ayrılmıştır:

```
"Hoş geldin" + [çocuğun adı] + "Bugün geometri öğreneceğiz. Hazır mısın?"
```

Sabit parçalar ortak; her isim ayrı küçük dosya. Böylece 30 çocuk =
30 küçük dosya (30 tam cümle değil). Oyun ismi `names.json`'da arar;
bulamazsa **yalnız adı** tarayıcı sesiyle söyler (kısa, fark minimum).

## Cümleleri güncelleme

Oyun metni değiştiğinde:

```bash
node test/extract-speech.mjs        # speech-texts.json'u yenile
python3 tools/tts.py edge           # yeni cümleleri üret (var olanları atlar)
```

## Gerekli kurulum

- `edge-tts`: `/home/hermes/.hermes/hermes-agent/venv/bin/edge-tts`
- `ffmpeg`: PCM→MP3 dönüşümü (Gemini çıktısı ham PCM gelir)
- `GEMINI_API_KEY`: `~/.hermes/.env` (yalnız Gemini için)


---

## ⚠️ HIZ: iki yavaşlatmayı üst üste bindirme

**Yaşanan hata:** Konuşma anlaşılmayacak kadar yavaşladı. Sebep iki ayrı
yavaşlatmanın birleşmesiydi:

| Katman | Değer | Etki |
|--------|-------|------|
| Dosya üretimi | `--rate=-10%` | Yavaşlatma **dosyaya gömüldü** |
| Oynatma | `playbackRate = 0.88` | Üstüne ikinci yavaşlatma |
| **Toplam** | | **~%21 yavaş** |

**Kural: hızı TEK yerde ayarla.** Ya dosyaya göm (üretimde), ya oynatmada
uygula — ikisini birden yapma.

**Bizim tercihimiz: oynatmada.** Dosyalar **doğal hızda** üretilir
(`EDGE_HIZ = "+2%"`, yani neredeyse nötr), hız tamamen Veli Paneli
ayarından gelir:

```js
// audio.js
playbackRate = clamp(ayar / 0.72, 0.80, 1.25)
//  0.58 (Çok Yavaş) → 0.81
//  0.66 (Yavaş)     → 0.92
//  0.72 (Normal)    → 1.00  ← doğal hız
//  0.82 (Hızlı)     → 1.14
```

Böylece "Normal" **tam olarak doğal hız** olur ve ayar gerçekten çalışır.

> Bu kural `test/speed-verify.mjs` ile korunuyor: üretim hızının nötr
> olduğunu, eşlemenin monoton arttığını ve dosyaların doğal hızda
> olduğunu (karakter/saniye oranı) doğrular.

## Ton (neşeli) hakkında sınır

edge-tts'in **duygu motoru yoktur** — Microsoft'un `cheerful` gibi
`mstts:express-as` stilleri **Azure Speech aboneliği** ister; ücretsiz
Edge uç noktası reddeder (`text must be str`).

Neşe yalnızca **perde/hız/ses** ile taklit edilir:

```bash
--pitch=+18Hz --rate=+2% --volume=+10%   # hafif neşeli (seçilen)
```

**Gerçek duygu kontrolü için Gemini TTS gerekir** (doğal dille:
"neşeli ve heyecanlı konuş, oyun sunucusu gibi"). Kota açılınca
`python3 tools/tts.py gemini` ile geçilir.
