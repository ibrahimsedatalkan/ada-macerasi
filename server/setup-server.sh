#!/usr/bin/env bash
# ============================================================
# Ada Macerası — sunucu kurulum betiği (tek komut)
#
# Kullanım (sunucuda):
#     bash server/setup-server.sh https://dunyan.example.com
#
# Ne yapar:
#   1) Node sürümünü denetler
#   2) Sunucuyu systemd servisi olarak kurar (açılışta başlar, çökerse döner)
#   3) CORS'a kendi alan adınızı ekler
#   4) Sağlık ucunu sınar
#
# ÖNEMLİ — HTTPS: Oyun GitHub Pages'te (https) çalışır. Tarayıcı, https
# sayfadan http adrese istek atmayı ENGELLER (mixed content). Bu yüzden
# sunucuya da https gerekir. Bu betik yalnız sunucuyu kurar; TLS için
# alan adınızı bu makineye yönlendirip sertifika almanız gerekir
# (aşağıdaki DEPLOY.md'ye bakın).
# ============================================================
set -euo pipefail

ALAN_ADI="${1:-}"
KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8787}"
SERVIS_ADI="ada-macerasi"
CALISAN_KULLANICI="${SUDO_USER:-$USER}"

echo "=== Ada Macerası sunucu kurulumu ==="
echo "klasör : $KOK"
echo "port   : $PORT"
echo "kullanıcı: $CALISAN_KULLANICI"
[ -n "$ALAN_ADI" ] && echo "alan adı: $ALAN_ADI" || echo "alan adı: (verilmedi — CORS yalnız GitHub Pages)"

# ---- 1) Node denetimi ----
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js bulunamadı. Kurun:  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
fi
echo "✅ Node: $(node -v)"

# ---- 2) CORS kaynakları ----
IZINLI="https://ibrahimsedatalkan.github.io"
[ -n "$ALAN_ADI" ] && IZINLI="$IZINLI,$ALAN_ADI"

# ---- 3) systemd servisi ----
SERVIS_YOLU="/etc/systemd/system/${SERVIS_ADI}.service"
echo "→ systemd servisi yazılıyor: $SERVIS_YOLU"
sudo tee "$SERVIS_YOLU" >/dev/null <<SERVIS
[Unit]
Description=Ada Macerası oyun sunucusu (düello + sınıf tablosu)
After=network.target

[Service]
Type=simple
User=${CALISAN_KULLANICI}
WorkingDirectory=${KOK}
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=${PORT}
Environment=ALLOWED_ORIGINS=${IZINLI}
ExecStart=$(command -v node) ${KOK}/server/server.mjs
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVIS

sudo systemctl daemon-reload
sudo systemctl enable --now "${SERVIS_ADI}"
sleep 2

# ---- 4) Sağlık sınaması ----
echo "→ sağlık ucu sınanıyor..."
if curl -sf --max-time 8 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
  echo "✅ Sunucu çalışıyor: http://127.0.0.1:${PORT}/api/health"
  curl -s "http://127.0.0.1:${PORT}/api/health"
  echo
else
  echo "❌ Sağlık ucu cevap vermedi. Günlük:"
  sudo journalctl -u "${SERVIS_ADI}" -n 30 --no-pager
  exit 1
fi

echo
echo "=== SIRADAKİ ADIM: HTTPS ==="
echo "Tarayıcı, https oyundan http sunucuya istek atmayı engeller."
echo "Bu yüzden sunucuya https gerekir. Seçenekler:"
echo "  A) Alan adınız varsa → bu makineye yönlendir + certbot ile sertifika"
echo "     sudo apt install -y certbot && sudo certbot certonly --standalone -d $ALAN_ADI"
echo "  B) Alan adı yoksa   → Cloudflare Tunnel (ücretsiz, alan adı gerekmez)"
echo "     cloudflared tunnel --url http://127.0.0.1:${PORT}"
echo
echo "Sonra oyunda: Veli Paneli → Sınıf sunucusu → adresi girip Kaydet'e basın."
