#!/usr/bin/env bash
# Tüm test paketini çalıştır ve özet ver.
# Kullanım:  bash test/run-all.sh
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1


# ── EŞZAMANLI ÇALIŞMA KİLİDİ ─────────────────────────────────────
# Tüm paketler AYNI tarayıcıyı paylaşır. İki paket aynı anda çalışırsa
# birbirlerinin durumunu bozar ve sonuçlar değişken olur (yaşandı:
# 5 kopya aynı anda çalışıp yanıltıcı sonuç üretti).
KILIT_DOSYA="/tmp/ada-test.lock"
if [ -e "$KILIT_DOSYA" ]; then
  eski_pid=$(cat "$KILIT_DOSYA" 2>/dev/null || echo "")
  if [ -n "$eski_pid" ] && kill -0 "$eski_pid" 2>/dev/null; then
    echo "❌ Başka bir test paketi çalışıyor (PID $eski_pid)."
    echo "   Aynı tarayıcıyı paylaştıkları için sonuçlar güvenilmez olur."
    echo "   Bitmesini bekleyin ya da: kill $eski_pid"
    exit 1
  fi
  rm -f "$KILIT_DOSYA"   # bayat kilit
fi
echo $$ > "$KILIT_DOSYA"
trap 'rm -f "$KILIT_DOSYA"' EXIT INT TERM

DOSYALAR=$(ls test/*-verify.mjs 2>/dev/null | sort)
TOPLAM_GEC=0; TOPLAM_KAL=0; PAKET=0; BASARISIZ=""

echo "════════════════════════════════════════════════"
echo "  ADA MACERASI — TAM TEST PAKETİ"
echo "════════════════════════════════════════════════"
echo

for f in $DOSYALAR; do
  ad=$(basename "$f" .mjs)
  # İZOLASYON: paketler aynı tarayıcı deposunu paylaşır. Her paketten önce
  # bilinen temiz duruma dön — yoksa sıralama sonucu değiştirir.
  node test/reset-state.mjs >/dev/null 2>&1
  cikti=$(node "$f" 2>&1)
  satir=$(echo "$cikti" | grep -oE "=== [0-9]+ geçti / [0-9]+ kaldı ===" | tail -1)
  gec=$(echo "$satir" | grep -oE "^=== [0-9]+" | grep -oE "[0-9]+")
  kal=$(echo "$satir" | grep -oE "[0-9]+ kaldı" | grep -oE "[0-9]+")
  gec=${gec:-0}; kal=${kal:-?}
  PAKET=$((PAKET+1))
  TOPLAM_GEC=$((TOPLAM_GEC+gec))
  if [ "$kal" = "0" ]; then
    printf "  ✅ %-28s %3s geçti\n" "$ad" "$gec"
  else
    printf "  ❌ %-28s %3s geçti / %s KALDI\n" "$ad" "$gec" "$kal"
    BASARISIZ="$BASARISIZ $ad"
    TOPLAM_KAL=$((TOPLAM_KAL+kal))
  fi
done

echo
echo "════════════════════════════════════════════════"
printf "  %s paket · %s test geçti · %s kaldı\n" "$PAKET" "$TOPLAM_GEC" "$TOPLAM_KAL"
echo "════════════════════════════════════════════════"
[ -n "$BASARISIZ" ] && { echo "  BAŞARISIZ:$BASARISIZ"; exit 1; }
exit 0
