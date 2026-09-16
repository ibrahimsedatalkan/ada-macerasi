# Ada Macerası — Sunucu Yayın Rehberi

Oyun **çevrimdışı** olarak tam çalışır (GitHub Pages). Sunucu yalnızca
**iki ek özellik** için gerekir:

1. Canlı düello (arkadaşlarla uzaktan yarış)
2. Ortak sınıf listesi (cihazlar arası)

Sunucu olmadan **hiçbir özellik kaybolmaz** — oyun tam işlevsel kalır.

---

## ⚠️ ÖNCE BİLİNMESİ GEREKEN: HTTPS ZORUNLU

Oyun `https://ibrahimsedatalkan.github.io` üzerinde çalışır. Tarayıcılar
**https bir sayfadan http adrese istek atmayı engeller** (mixed content
kuralı). Yani sunucu da **https** olmalı.

Bunun için iki yol var:

| Yol | Gereken | Zorluk |
|-----|---------|--------|
| **A) Alan adı + sertifika** | Bir alan adı (ör. `oyun.siteniz.com`) | Orta |
| **B) Cloudflare Tunnel** | Ücretsiz Cloudflare hesabı (alan adı gerekmez) | Kolay ⭐ |

---

## 1. Sunucuyu kur (tek komut)

Sunucuda:

```bash
cd ~/projects/ada-macerasi
bash server/setup-server.sh
```

Bu betik:
- Node sürümünü denetler
- Sunucuyu **systemd servisi** olarak kurar (açılışta başlar, çökerse 3 sn'de döner)
- CORS'a GitHub Pages kaynağını ekler
- Sağlık ucunu sınar

Doğrulama:
```bash
curl -s http://127.0.0.1:8787/api/health
# → {"ok":true,"servis":"ada-macerasi","surum":"1.0","oda":0,...}

sudo systemctl status ada-macerasi
sudo journalctl -u ada-macerasi -f      # canlı günlük
```

---

## 2. HTTPS aç (iki seçenek)

### Seçenek B — Cloudflare Tunnel (alan adı gerekmez, ücretsiz) ⭐

```bash
# cloudflared kur
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Hızlı tünel (geçici adres verir — deneme için)
cloudflared tunnel --url http://127.0.0.1:8787
# → https://rastgele-sozcuk.trycloudflare.com  gibi bir adres verir
```

Kalıcı adres için (kendi alan adınız varsa):
```bash
cloudflared tunnel login          # tarayıcıdan Cloudflare hesabınıza giriş
cloudflared tunnel create ada
cloudflared tunnel route dns ada oyun.siteniz.com
cloudflared tunnel run ada
```

### Seçenek A — Alan adı + Let's Encrypt

```bash
# 1) Alan adını bu makinenin IP'sine yönlendir (DNS A kaydı)
# 2) Sertifika al
sudo apt install -y certbot
sudo certbot certonly --standalone -d oyun.siteniz.com

# 3) nginx ile ters proxy (örnek)
sudo tee /etc/nginx/sites-available/ada >/dev/null <<'NGINX'
server {
  listen 443 ssl http2;
  server_name oyun.siteniz.com;
  ssl_certificate     /etc/letsencrypt/live/oyun.siteniz.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/oyun.siteniz.com/privkey.pem;

  # SSE (canlı düello akışı) için tampon kapatılmalı
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;              # ← SSE için ŞART
    proxy_read_timeout 3600s;
  }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/ada /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 4) Servisi CORS'a yeni alan adını ekle
sudo systemctl edit ada-macerasi
# [Service] bölümüne:  Environment=ALLOWED_ORIGINS=https://ibrahimsedatalkan.github.io,https://oyun.siteniz.com
sudo systemctl restart ada-macerasi
```

---

## 3. Oyunda sunucuyu ayarla

Oyunda: **Veli Paneli → 🌐 Sınıf sunucusu** → adresi gir → **Kaydet ve sına**

- ✅ `Sunucu çalışıyor (ada-macerasi v1.0, 0 açık oda)` → tamam
- ⚠️ `Sunucuya ulaşılamadı` → adres veya CORS ayarını kontrol edin
- Adres **https://** ile başlamalı (oyun sizi uyarır)

---

## 4. Doğrulama

```bash
# CORS başlığı doğru mu?
curl -s -H "Origin: https://ibrahimsedatalkan.github.io" -D - -o /dev/null \
  http://127.0.0.1:8787/api/health | grep -i access-control
# → Access-Control-Allow-Origin: https://ibrahimsedatalkan.github.io

# Preflight çalışıyor mu?
curl -s -X OPTIONS -H "Origin: https://ibrahimsedatalkan.github.io" \
  -H "Access-Control-Request-Method: POST" -o /dev/null -w "%{http_code}\n" \
  http://127.0.0.1:8787/api/duel/create
# → 204

# Uçtan uca düello (iki oyuncu)
cd ~/projects/ada-macerasi && node test/server-verify.mjs
```

---

## SORUN GİDERME

| Belirti | Sebep | Çözüm |
|---------|-------|-------|
| `Sunucuya ulaşılamadı` | CORS başlığı yok | `ALLOWED_ORIGINS` içinde GitHub Pages adresi var mı? |
| Tarayıcı konsolunda **mixed content** | Oyun https, sunucu http | Sunucuya https ekleyin (adım 2) |
| Düello odası açılıyor ama hamle gelmiyor | Ters proxy SSE'yi tamponluyor | nginx'te `proxy_buffering off;` |
| 502 / bağlantı reddi | Servis çalışmıyor | `sudo systemctl status ada-macerasi` |
| Sunucu bir süre sonra ölüyor | systemd kurulmamış | `bash server/setup-server.sh` çalıştırın |

---

## GÜVENLİK NOTLARI

- Sunucu **127.0.0.1**'e bağlanır; dışarıya yalnız ters proxy/tünel açar.
  Doğrudan porta erişim gerekmez.
- CORS **beyaz liste** ile çalışır — yalnız belirttiğiniz kaynaklardan istek kabul eder.
- Sınıf PIN'leri `pbkdf2` (120.000 tur) ile hash'lenir, düz metin saklanmaz.
- Oyun verisi (`server/data/`) `.gitignore`'da — repoya girmez.
- Çocuk verisi toplanmaz: yalnız takma ad, sınıf kodu ve ilerleme puanları.
