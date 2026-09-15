/* SES HIZI testleri
   Yaşanan hata: iki yavaşlatma üst üste bindi → konuşma anlaşılmayacak
   kadar yavaşladı.
     1) Ses dosyası -10% hızda üretilmiş  (dosyaya GÖMÜLÜ yavaşlatma)
     2) playbackRate 0.88 uygulanmış      (oynatmada ikinci yavaşlatma)
   Sonuç: ~%21 yavaş. Kullanıcı "çok yavaş konuşuyor" dedi.

   Bu testler o hatanın geri gelmesini engeller. */
import { connect, result } from './cdp.mjs';
import { readFileSync } from 'node:fs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(900, 700);
await c.initErrors();

let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/* ---- 1) Üretim ayarları: hız dosyaya GÖMÜLMEMELİ ---- */
const pySrc = readFileSync('tools/tts.py', 'utf-8');
const hizSatiri = (pySrc.match(/^EDGE_HIZ\s*=\s*"([^"]+)"/m) || [])[1];
const hizSayi = hizSatiri ? parseInt(hizSatiri.replace('%', ''), 10) : null;
T('Dosya üretiminde yavaşlatma gömülü değil (|hız| ≤ 3%)',
  hizSayi !== null && Math.abs(hizSayi) <= 3, `EDGE_HIZ = ${hizSatiri}`);

/* ---- 2) playbackRate eşlemesi: Normal = 1.00 (doğal) ---- */
await c.goto(`${B}/index.html`, 2500);
const hizTesti = await c.evaluate(`(async () => {
  const A = await import('./js/audio.js');
  // Eşleme formülünü kaynaktan doğrula (dosya doğal hızda üretildiği için
  // Normal ayar 1.00 playbackRate vermeli)
  const src = await (await fetch('js/audio.js')).text();
  const esleme = /playbackRate\\s*=\\s*Math\\.max\\(([\\d.]+),\\s*Math\\.min\\(([\\d.]+),\\s*hiz\\s*\\/\\s*([\\d.]+)\\)\\)/.exec(src);
  const sonuc = {};
  if (esleme) {
    const alt = Number(esleme[1]), ust = Number(esleme[2]), bolen = Number(esleme[3]);
    const hesapla = (h) => Math.max(alt, Math.min(ust, h / bolen));
    sonuc.bolen = bolen;
    sonuc.normal = hesapla(0.72);
    sonuc.yavas = hesapla(0.66);
    sonuc.cokYavas = hesapla(0.58);
    sonuc.hizli = hesapla(0.82);
  } else {
    sonuc.bulunamadi = true;
  }
  sonuc.varsayilanAyar = A.getSpeechRate();
  return JSON.stringify(sonuc);
})()`);
const ht = JSON.parse(hizTesti || '{}');
T('Hız eşlemesi bulundu', !ht.bulunamadi, ht.bulunamadi ? 'formül eşleşmedi' : `bölen=${ht.bolen}`);
T('NORMAL ayar = DOĞAL hız (1.00)', Math.abs((ht.normal || 0) - 1.0) < 0.02, `Normal → ${ht.normal}`);
T('Yavaş ayar gerçekten yavaşlatıyor', ht.yavas > 0.85 && ht.yavas < 1.0, `Yavaş → ${ht.yavas}`);
T('Çok Yavaş ayar en yavaş seçenek', ht.cokYavas < ht.yavas, `Çok Yavaş → ${ht.cokYavas}`);
T('Hızlı ayar hızlandırıyor', (ht.hizli || 0) > 1.05, `Hızlı → ${ht.hizli}`);
T('Ayar artan sırada (monoton)', ht.cokYavas < ht.yavas && ht.yavas < ht.normal && ht.normal < ht.hizli,
  `${ht.cokYavas} < ${ht.yavas} < ${ht.normal} < ${ht.hizli}`);
T('Varsayılan ayar Normal (0.72)', Math.abs((ht.varsayilanAyar || 0) - 0.72) < 0.01, `${ht.varsayilanAyar}`);

/* ---- 3) Üretilen dosyalar gerçekten doğal hızda mı? ----
   Yavaş üretilmiş bir dosya aynı cümle için belirgin uzun olur.
   Karşılaştırma: cümle başına saniye oranı. */
const sure = await c.evaluate(`(async () => {
  const A = await import('./js/audio.js');
  const m = await A.preloadSpeech();
  const anahtarlar = Object.keys(m).slice(0, 6);
  const sonuclar = [];
  for (const k of anahtarlar) {
    const s = await new Promise((res) => {
      const a = new Audio(m[k]);
      a.onloadedmetadata = () => res(a.duration);
      a.onerror = () => res(null);
      setTimeout(() => res(null), 4000);
      a.load();
    });
    if (s) sonuclar.push({ kisa: k.slice(0, 28), karakter: k.length, sure: s, oran: k.length / s });
  }
  const ortalama = sonuclar.length
    ? sonuclar.reduce((t, x) => t + x.oran, 0) / sonuclar.length : null;
  return JSON.stringify({ ornek: sonuclar.slice(0, 3), ortalamaOran: ortalama });
})()`);
const sr = JSON.parse(sure || '{}');
// Türkçe konuşma ~13-19 karakter/saniye (doğal). Yavaşlatılmışsa oran düşer.
// Ölçülen doğal değer: ~8.5-9 karakter/sn (edge-tts Türkçe, rate=+0%).
// Çift yavaşlatma olsaydı ~6'nın altına düşerdi.
T('Ses dosyaları doğal hızda (≥ 7.5 karakter/sn)',
  (sr.ortalamaOran || 0) >= 7.5,
  `ortalama ${(sr.ortalamaOran || 0).toFixed(1)} karakter/sn — ${JSON.stringify((sr.ornek || [])[0] || {})}`);
T('Ses dosyaları aşırı yavaşlatılmamış (≥ 6 karakter/sn)',
  (sr.ortalamaOran || 0) >= 6,
  `çift yavaşlatma yok: ${(sr.ortalamaOran || 0).toFixed(1)} karakter/sn`);

const jsHatalar = await c.errors();
const hataListesi = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', hataListesi.length === 0, JSON.stringify(hataListesi));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
