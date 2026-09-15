# Ada Macerası — Oyun Sunucusu

Çevrimdışı oyunun üzerine hesap, ilerleme senkronu, sınıf tablosu ve
**canlı düello** ekler. **Sıfır bağımlılık** — yalnızca Node.js 18+.

## Çalıştırma

```bash
node server/server.mjs                 # http://127.0.0.1:8787
node server/server.mjs --port 9000     # farklı port
PORT=9000 HOST=0.0.0.0 node server/server.mjs   # dışarı aç (dikkat: aşağıya bak)
```

Sunucu hem **oyunu** (statik dosyalar) hem **API'yi** aynı adresten sunar:

| | |
|---|---|
| Oyun | `http://<adres>:8787/` |
| API | `http://<adres>:8787/api/...` |

## Oyuna bağlama

Oyunda tarayıcı konsolunda bir kez:

```js
localStorage.setItem('ada.api', 'http://127.0.0.1:8787');
```

`ada.api` boşsa oyun **tamamen çevrimdışı** çalışır (bugünkü hâli).
Aynı kod, iki mod.

## API uçları

| Uç | Yöntem | Açıklama |
|---|---|---|
| `/api/register` | POST | `{nick, classCode, pin(4 hane), avatar}` → `{token}` |
| `/api/login` | POST | `{nick, classCode, pin}` → `{token}` |
| `/api/progress` | POST | İlerleme yaz (yıldız/jeton **geri gitmez**, birleştirilir) |
| `/api/progress` | GET | `?nick=&classCode=` → kayıt |
| `/api/board` | GET | `?classCode=` → sınıf liderlik tablosu |
| `/api/duel/create` | POST | Oda kur → `{roomCode}` (4 haneli) |
| `/api/duel/join` | POST | `{roomCode}` → odaya katıl |
| `/api/duel/move` | POST | `{roomCode, move}` → hamle gönder |
| `/api/duel/stream` | GET (SSE) | `?roomCode=` → canlı olay akışı |

Kimlik doğrulama: `Authorization: Bearer <token>`.

## Tasarım kararları

- **E-posta / kişisel veri toplanmaz.** Takma ad + sınıf kodu + 4 haneli PIN.
  Çocuk oyunu için bilinçli olarak minimum veri.
- **PIN** PBKDF2 (120k tur) ile saklanır, düz metin tutulmaz.
- **Veri**: `server/data/db.json` (git'e girmez). Sıfır kurulum için JSON dosyası.
  Yük artarsa SQLite/Postgres'e taşınabilir — API aynı kalır.
- **Canlı düello** SSE ile: WebSocket sunucusu gerekmez, tarayıcıda `EventSource`
  yeterli, arada proxy/CDN olsa da çalışır.
- **Hız sınırı**: IP başına 240 istek/dakika. Gövde sınırı 64 KB.
- **Dizin kaçışı** koruması: statik sunum `ROOT` dışına çıkamaz.

## Yayına alırken

`127.0.0.1`'e bağlamak güvenlidir ama dışarıdan erişilemez. Dışarı açacaksan:

1. **HTTPS şart** — PIN ve token düz HTTP'de açık gider.
   Önüne bir ters proxy (Caddy/Nginx) veya Cloudflare Tunnel koy.
2. `HOST=0.0.0.0` yalnızca proxy arkasında kullan.
3. Yedekleme: `server/data/db.json` düzenli kopyalanmalı.

## Testler

```bash
node test/server-verify.mjs                  # 21 test: hesap, ilerleme, tablo, düello, güvenlik
API_BASE=http://127.0.0.1:9000 node test/server-verify.mjs
```
