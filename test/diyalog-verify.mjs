/* DİYALOG KAPANMA testleri
   ------------------------------------------------------------
   BULUNAN GERÇEK HATA (kullanıcı bildirdi):
     "Birlikte oyna menüsü çalışmıyor"

   Sebep: bazı butonlar çıplak `close()` çağırıyordu. `close` ui.js'ten
   import EDİLMEMİŞTİ, bu yüzden çağrı tarayıcının yerleşik
   `window.close()` fonksiyonuna gidiyordu. O da sekmeyi kapatmaya çalışır
   (tarayıcı engeller) ve DİYALOĞU KAPATMAZ.
   Sonuç: oyun arkada başlıyor, diyalog üstünü kapatıyor → "çalışmıyor".

   NEDEN MEVCUT TESTLER YAKALAMADI: oyun durumunu (ekran, soru, şık)
   kontrol ediyorlardı ama DİYALOĞUN KAPANDIĞINI kontrol etmiyorlardı.

   Bu test o boşluğu kapatır: her diyalog akışında, eylem sonrası
   diyaloğun GERÇEKTEN kapandığını doğrular.
   ------------------------------------------------------------ */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/** Diyalog açık mı? */
const diyalogAcik = () => c.evaluate(`(() => {
  const d = document.getElementById('dialog');
  if (!d) return false;
  return !d.hidden && (d.innerText || '').trim().length > 0;
})()`);

/** Haritaya git (temiz profil) */
async function haritayaGit(ad = 'Diyalog', kod = '2D') {
  await c.goto(`${B}/index.html`, 2400);
  await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
  await c.goto(`${B}/index.html`, 2000);
  await c.evaluate(`(() => {
    const i = [...document.querySelectorAll('input[type="text"]')];
    if (i[0]) { i[0].value = ${JSON.stringify(ad)}; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
    if (i[1]) { i[1].value = ${JSON.stringify(kod)}; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
    return true;
  })()`);
  await c.sleep(300);
  await c.clickByText('Maceraya başla', 'button', 500);
  await c.bekleEkran('map', 9000);
  await c.sleep(700);
  // İlk-kurulum zorluk diyaloğunu kapat (test hızlı modunda açılmaz ama garanti)
  const zAcik = await diyalogAcik();
  if (zAcik) {
    await c.evaluate(`(() => { const d=document.getElementById('dialog'); const b=[...d.querySelectorAll('button')].find(x=>/Kolay/i.test(x.textContent||'')); if(b) b.click(); return true; })()`);
    await c.sleep(700);
  }
}

const kartTikla = (metin) => c.evaluate(`(() => {
  const b = [...document.querySelectorAll('.map-head .btn')].find(x => ${JSON.stringify(metin)}.length
    ? new RegExp(${JSON.stringify(metin)}).test(x.textContent || '') : false);
  if (b) b.click();
  return !!b;
})()`);

/* ═══════════ 1) BİRLİKTE OYNA — KULLANICININ BİLDİRDİĞİ AKIŞ ═══════════ */
await haritayaGit();
await kartTikla('Birlikte');
await c.sleep(1300);
T('Birlikte Oyna: diyalog açıldı', await diyalogAcik() === true);

const konuSayisi = await c.evaluate(`document.querySelectorAll('.tg-konu').length`);
T('Birlikte Oyna: konu kartları listelendi', konuSayisi === 6, `${konuSayisi} kart`);

// Konu seç
await c.evaluate(`(() => { const k = document.querySelector('.tg-konu'); if (k) k.click(); return true; })()`);
await c.sleep(1400);
T('★ Birlikte Oyna: konu seçince DİYALOG KAPANIYOR (bildirilen hata)',
  await diyalogAcik() === false, `diyalog açık=${await diyalogAcik()}`);
const ekran1 = await c.evaluate(`document.querySelector('.screen.active')?.dataset.screen`);
T('Birlikte Oyna: oyun ekranı açıldı', ekran1 === 'game', `ekran=${ekran1}`);

await c.sleep(2200);
const oyun1 = JSON.parse(await c.evaluate(`(() => JSON.stringify({
  sira: !!document.querySelector('.tg-sira'),
  soru: !!document.querySelector('.tg-soru-metin'),
  cevap: document.querySelectorAll('.tg-answers .answer-btn').length,
  klavuz: !!document.querySelector('.tg-klavuz')
}))()`) || '{}');
T('Birlikte Oyna: oyun GERÇEKTEN başladı (soru + şıklar + veli kılavuzu)',
  oyun1.sira && oyun1.soru && oyun1.cevap >= 2 && oyun1.klavuz,
  JSON.stringify(oyun1));

/* ═══════════ 2) SONSUZ MACERA ═══════════ */
await haritayaGit('Diyalog2', '2D');
await kartTikla('Sonsuz');
await c.sleep(1300);
T('Sonsuz Macera: diyalog açıldı', await diyalogAcik() === true);
await c.clickByText('Başla', 'button', 1400);
T('★ Sonsuz Macera: Başla deyince DİYALOG KAPANIYOR',
  await diyalogAcik() === false, `diyalog açık=${await diyalogAcik()}`);
await c.sleep(3000);
const ekran2 = await c.evaluate(`document.querySelector('.screen.active')?.dataset.screen`);
T('Sonsuz Macera: oyun ekranı açıldı', ekran2 === 'game', `ekran=${ekran2}`);

/* ═══════════ 3) ZORLUK SEÇİMİ (rozetten) ═══════════ */
await haritayaGit('Diyalog3', '2D');
await c.evaluate(`(() => { const b = document.querySelector('.zorluk-chip'); if (b) b.click(); return !!b; })()`);
await c.sleep(1000);
T('Zorluk: diyalog açıldı', await diyalogAcik() === true);
await c.evaluate(`(() => {
  const kartlar = [...document.querySelectorAll('.zorluk-kart')];
  const z = kartlar.find(k => /Zor/.test(k.textContent || ''));
  if (z) z.click();
  return !!z;
})()`);
await c.sleep(1000);
T('★ Zorluk: seçim yapınca DİYALOG KAPANIYOR',
  await diyalogAcik() === false, `diyalog açık=${await diyalogAcik()}`);

/* ═══════════ 4) HEDEFLİ ÇALIŞMA (veli panelinden) ═══════════ */
await haritayaGit('Diyalog4', '2D');
// Takılma verisi oluştur
await c.evaluate(`(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
  const p = JSON.parse(localStorage.getItem(k));
  p.stats = p.stats || {};
  p.stats.byFact = { '7x8': { c: 0, w: 4, son: Date.now() } };
  localStorage.setItem(k, JSON.stringify(p));
  return true;
})()`);
await c.goto(`${B}/index.html`, 2400);
await c.clickByText('Veli Paneli', 'button', 1400);
const hedefBtnVar = await c.evaluate(`!![...document.querySelectorAll('button')].find(b => /takıldığı/i.test(b.textContent||''))`);
T('Hedefli çalışma butonu veli panelinde var', hedefBtnVar === true);
if (hedefBtnVar) {
  await c.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/takıldığı/i.test(x.textContent||'')); if(b) b.click(); return true; })()`);
  await c.sleep(1200);
  T('Hedefli çalışma: bilgi diyaloğu açıldı', await diyalogAcik() === true);
  await c.clickByText('Başla', 'button', 1400);
  T('★ Hedefli çalışma: Başla deyince DİYALOG KAPANIYOR',
    await diyalogAcik() === false, `diyalog açık=${await diyalogAcik()}`);
}

/* ═══════════ 5) BÖLÜM BRİFİNGİ ═══════════ */
await haritayaGit('Diyalog5', '2D');
await c.evaluate(`(() => { document.querySelectorAll('.world-card')[0].click(); return true; })()`);
await c.sleep(900);
await c.evaluate(`(() => { const n = [...document.querySelectorAll('.level-node')]; if (n[0]) n[0].click(); return true; })()`);
await c.sleep(1100);
T('Bölüm brifingi: diyalog açıldı', await diyalogAcik() === true);
await c.clickByText('Başla', 'button', 1200);
T('★ Bölüm brifingi: Başla deyince DİYALOG KAPANIYOR',
  await diyalogAcik() === false, `diyalog açık=${await diyalogAcik()}`);

/* ═══════════ 6) window.close ÇAĞRISI KALMADI MI? (statik kontrol) ═══════════
   NOT: Yorum satırları temizlenir — aksi hâlde açıklama metnindeki
   "window.close()" ifadesi yanlış eşleşme üretir (yaşandı). */
const kod = await c.evaluate(`(async () => {
  const r = await fetch('./js/main.js', { cache: 'no-store' });
  let t = await r.text();
  // Yorumları TEMİZLE (satır + blok) — yalnız gerçek kod taransın
  t = t.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/(^|[^:])\\/\\/[^\\n]*/g, '$1');
  const fonksiyonlar = t.split(/\\n(?=(?:export )?function )/);
  const bozuk = [];
  for (const blok of fonksiyonlar) {
    const ad = (blok.match(/^(?:export )?function (\\w+)/) || [])[1];
    if (!ad) continue;
    if (/\\bclose\\(\\)/.test(blok) && !/const close = dialog/.test(blok)) bozuk.push(ad);
  }
  return JSON.stringify(bozuk);
})()`);
T('★ Cıplak close() kalan fonksiyon YOK (window.close hatası tekrarlamaz)',
  JSON.parse(kod || '[]').length === 0, `şüpheli: ${kod}`);

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
