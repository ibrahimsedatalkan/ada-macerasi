# 🦊 Ada Macerası — Sayılar ve Şekiller

7-8 yaş (ilkokul 2. sınıf) çocuklar için, **çarpım tablosu** ve **geometri** öğreten,
bölüm geçmeli bir **macera oyunu**. Tarayıcıda çalışır (tablet, telefon, bilgisayar),
kayıt gerektirmez ve internetsiz de oynanır.

---

## 1. Nasıl oynanır

1. **Giriş:** takma ad + sınıf kodu yaz, karakterini seç. E-posta veya kişisel bilgi istenmez.
2. **Harita:** 5 ada, her adada 5 bölüm (toplam **25 bölüm**). Bölümü bitirince sonraki açılır.
3. **Yıldız:** %95 doğruluk = ⭐⭐⭐, %78 = ⭐⭐, bitirdiysen en az ⭐. Yıldızlar ilerlemeyi açar.
4. **Düello:** aynı cihazda 2 çocuk sırayla aynı soruyu cevaplar; hızlı ve doğru olan puan alır.
5. **Sınıf Tablosu:** aynı sınıf kodunu yazan oyuncular birlikte listelenir.
6. **Veli Paneli:** hangi çarpım tablosunda / hangi şekilde ne kadar iyi olduğunu gösterir.

### Adalar ve kazanımlar

| Ada | Konu | Oyun tipi |
|---|---|---|
| 🌱 Çayır Adası | 1, 2, 3'ler ve karışık | Balon patlatma (doğru sonucu seç) |
| 🌳 Orman Adası | 4, 5'ler + şekil tanıma | Şekil avı (sürükle-bırak) |
| 💎 Kristal Mağara | Kenar / köşe sayma (kare, dikdörtgen, üçgen, daire, beşgen, altıgen) | Şekil dedektifi |
| 🌈 Gökkuşağı Zirvesi | **Geometrik çizim** (parmakla/fareyle izleme) | Sihirli kalem |
| 🐉 Ejderha Kalesi | Hepsini karışık, süreli | Bölüm sonu (ejderha canı) |

Zorluk artışı: soru sayısı ↑, seçenek sayısı ↑, süre ↓, can ↓, "3 × ? = 12" (eksik çarpan)
ve "? × 4 = 20" (ters çarpım) soruları, karışık bölümler.

### 🧭 Yolculuk şeridi (hedefe ilerleme)

Her bölümün üstünde canlı bir yol vardır: seçilen karakter yolun başında durur.

- **Her doğru cevap** karakteri bir adım ilerletir ve önündeki engel (çalı, kaya,
  kristal, kırık tahta, kapı) parçalanır.
- **Yanlış cevap** ilerlemeyi geri almaz; karakter sadece sendeler (motivasyon korunur)
  ama can azalır ve o engel yolda kalır.
- **Yolun ortasındaki BÜYÜK ENGEL** yıkılınca "Yol açıldı!" mesajı gelir — hedefe
  yaklaştığını net gösterir.
- **Bölüm sonunda** hedef açılır: hazine sandığı kapağı kalkar, kulenin kapısı açılır,
  kristal parlar, köprünün eksik tahtaları yerine oturur. Ulaşılamayan engeller kırmızı
  işaretli kalır ("Kalan engeller yolda kaldı").
- **Çizim bölümlerinde** ilerleme cevap sayısına değil, **çizimin kapsama oranına**
  bağlıdır: kalem ilerledikçe karakter de hedefe yaklaşır.

Bölüm tipine göre yolun uzunluğu: çarpım/kenar-köşe = soru sayısı, şekil avı = toplam
şekil sayısı, ejderha = soru sayısının ~1,4 katı (tek soruda birden çok doğru olabildiği için),
çizim = şekil sayısı × 3.

---

## 2. Dosya yapısı

```
ada-macerasi/
├── index.html              # tek sayfa iskeleti (sahne, HUD, ekranlar)
├── css/style.css           # görsel sistem (renk, tipografi, bileşenler)
├── js/
│   ├── main.js             # akış: giriş → harita → bölüm → oyun → sonuç
│   ├── worlds.js           # 5 ada × 5 bölüm müfredat verisi
│   ├── state.js            # profil, ilerleme, yıldız, sınıf tablosu (localStorage)
│   ├── shapes.js           # şekil sözlüğü (kenar/köşe) + SVG üretici
│   ├── ui.js               # DOM yardımcıları, konfeti, maskot (Pofi), diyalog
│   ├── audio.js            # sentezlenen ses efektleri + Türkçe sesli anlatım
│   ├── duel.js             # 2 kişilik düello (aynı cihaz)
│   ├── online.js           # sunucu adaptörü (AŞAMA 2 — şimdilik çevrimdışı)
│   └── games/
│       ├── questions.js    # soru üreteçleri (çarpım, kenar-köşe, dokun-şekil)
│       ├── multiply.js     # Balon patlatma
│       ├── shapehunt.js    # Şekil avı (sürükle-bırak + dokun-seç)
│       ├── sides.js        # Kenar/köşe sayma
│       ├── draw.js         # Geometrik çizim (kapsama oranı ile başarı)
│       └── boss.js         # Ejderha bölümü (karışık, süreli)
├── test/
│   ├── cdp.mjs             # bağımlılıksız CDP sürücüsü (headless Chrome)
│   ├── smoke.mjs           # 36 adımlı uçtan uca test
│   └── shots/              # test ekran görüntüleri
├── vercel.json             # yayın ayarları (başlıklar, temiz URL)
└── .vercelignore
```

---

## 3. Yerelde çalıştırma

```bash
cd ~/projects/ada-macerasi
python3 -m http.server 8123
# tarayıcıda: http://127.0.0.1:8123
```

> Not: ES modülleri kullanıldığı için `file://` ile açmak yerine küçük bir HTTP sunucusu gerekir.

### Testleri çalıştırma (gerçek tarayıcı, headless)

```bash
# 1) Headless Chrome'u 9222 portunda başlat (bu sunucuda kütüphaneler ~/.local/chromelibs altında)
export LD_LIBRARY_PATH=$HOME/.local/chromelibs/usr/lib/x86_64-linux-gnu
$HOME/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome --headless=new --no-sandbox \
  --remote-debugging-port=9222 --user-data-dir=/tmp/ada-chrome about:blank &

# 2) Testi koş
node test/smoke.mjs http://127.0.0.1:8123
```

Test; giriş → harita → çarpım bölümü → sonuç/yıldız → kilit açma → kenar-köşe → çizim
→ düello → şekil avı sürükleme → ejderha bölümü → veli paneli akışlarını ve konsol
hatası olmadığını doğrular. Ekran görüntüleri `test/shots/` altında oluşur.

---

## 4. Vercel'e yayınlama

Proje statiktir; derleme adımı yoktur.

```bash
cd ~/projects/ada-macerasi
vercel login                 # bir kez
vercel --prod                # yayına al
# veya: vercel link && vercel --prod
```

- Yayın adresi: `https://<proje-adı>.vercel.app`
- Sınıf arkadaşları bu adresi açıp **aynı sınıf kodunu** yazarak birlikte oynar.
- Güncelleme: dosyayı değiştir → `vercel --prod` (yaklaşık 20 saniye).

---

## 5. AŞAMA 2 — ortak sınıf tablosu + canlı düello (sunucu)

Şu anda her cihaz kendi ilerlemesini saklar; sınıf tablosu **o cihazdaki** oyuncuları gösterir.
Gerçek ortak tablo ve canlı düello için küçük bir sunucu yeterli. `js/online.js` içindeki
uçlar hazır; sunucu ayakta olduğunda tarayıcı konsolunda bir kez şunu çalıştırmak yeterli:

```js
localStorage.setItem('ada.api', 'https://api.sizin-alan-adiniz.com');
```

Beklenen API sözleşmesi:

| Uç | Metot | Gövde / Sorgu | Yanıt |
|---|---|---|---|
| `/api/register` | POST | `{nick, classCode, pin, avatar}` | `{token, profile}` |
| `/api/login` | POST | `{nick, classCode, pin}` | `{token, profile}` |
| `/api/progress` | POST | `{nick, classCode, results, stats, coins}` | `{ok:true}` |
| `/api/progress` | GET | `?nick=&classCode=` | `{results, stats, coins}` |
| `/api/board` | GET | `?classCode=` | `{rows:[{nick, avatar, stars, coins, correct}]}` |
| `/api/duel/create` | POST | `{nick, classCode, avatar}` | `{roomCode}` |
| `/api/duel/join` | POST | `{roomCode, nick, avatar}` | `{ok:true}` |
| `/api/duel/move` | POST | `{roomCode, move}` | `{ok:true}` |
| `/api/duel/stream` | GET (SSE) | `?roomCode=` | olay akışı |

Sunucu yoksa oyun sorunsuz çevrimdışı çalışır (`online.safe()` hataları yutar).

---

## 6. Veri ve güvenlik (KVKK / çocuk verisi)

- **E-posta, telefon, gerçek ad istenmez.** Sadece takma ad + sınıf kodu + karakter.
- Veriler tarayıcının `localStorage`'ında kalır; sunucuya gitmez.
- Aşama 2'de sunucu eklendiğinde: 4 haneli PIN ile sınırlı hesap, veri minimizasyonu,
  veli onayı akışı eklenmesi önerilir. Reklam, izleme (analytics) ve üçüncü taraf
  betik **yoktur**.

---

## 7. Yeni bölüm / soru ekleme

`js/worlds.js` içindeki `WORLDS` dizisine yeni dünya veya bölüm ekle:

```js
{ id: 'w6-l1', title: "6'lar", type: 'multiply', story: 'Altışar altışar!',
  cfg: { tables: [6], mode: 'result', rounds: 8, options: 4, lives: 3, time: 15 } }
```

`type` seçenekleri: `multiply`, `shapehunt`, `sides`, `draw`, `boss`.
`cfg` alanları: `tables, mode (result|missing|reverse|mix), rounds, options, lives, time,
maxB, shapes, ask (kenar|kose|mix), tol, pass, include`.

Oyun motoru sözleşmesi (yeni oyun tipi yazmak için):

```js
export function createGame({ root, level, api }) {
  return { start() {}, destroy() {} };
}
// api: { speak, sfx, confetti, toast, recordAnswer, finish, profile }
```

---

## 8. Bilinen sınırlar

- Sesli anlatım tarayıcının Türkçe sesine bağlıdır; bazı cihazlarda robotik olabilir.
- Sınıf tablosu ve ilerleme cihaz bazlıdır (Aşama 2'ye kadar).
- Çizim oyunu kapsama oranı ile değerlendirir; çok titrek çizimlerde "Sil" ile tekrar denenir.
