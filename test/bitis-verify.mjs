/* BİTİŞ AKIŞI testleri — her mod sonuç ekranına ULAŞIYOR mu?
   ------------------------------------------------------------
   KULLANICI BİLDİRDİ: "Bitir butonuna bastığımızda ilerlemiyor. Oyun kilitleniyor."

   KÖK NEDEN: finishLevel içinde `world.levels.indexOf(level)` vardı.
   Bağımsız modlar (Birlikte Oyna, Sonsuz Macera, Hedefli Çalışma) gerçek
   bir ada bölümü DEĞİL — dünyalarında `levels` dizisi yoktu.
   → TypeError: Cannot read properties of undefined (reading 'indexOf')
   Hata renderResult'tan ÖNCE fırladığı için sonuç ekranı hiç çizilmiyordu
   → oyun kilitlenmiş gibi görünüyordu.

   Bu test HER modun bitiş akışını gerçekten çalıştırıp sonuç ekranına
   ulaştığını VE JS hatası oluşmadığını doğrular.
   ------------------------------------------------------------ */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

async function giris(ad, kod) {
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
  await c.evaluate(`(() => { const d=document.getElementById('dialog'); if(d && !d.hidden){const b=[...d.querySelectorAll('button')].find(x=>/Kolay/i.test(x.textContent||'')); if(b) b.click();} return true; })()`);
  await c.sleep(800);
}

/** Sonuç ekranına ulaşıldı mı + hata var mı? */
async function sonucDurumu() {
  return JSON.parse(await c.evaluate(`(() => JSON.stringify({
    ekran: document.querySelector('.screen.active')?.dataset.screen,
    sonuc: !!document.querySelector('.rank-box, .result-stars, .star-row'),
    yildizVar: !!document.querySelector('.rank-box'),
    butonVar: [...document.querySelectorAll('button')].some(b => /Harita|Devam|Tekrar|Yeniden/i.test(b.textContent || ''))
  }))()`) || '{}');
}

/* ═══════ 1) BİRLİKTE OYNA → Bitir (KULLANICININ BİLDİRDİĞİ) ═══════ */
await giris('Bitir1', '2B');
await c.evaluate(`(() => { const b=[...document.querySelectorAll('.map-head .btn')].find(x=>/Birlikte/i.test(x.textContent||'')); if(b) b.click(); return true; })()`);
await c.sleep(1300);
await c.evaluate(`(() => { const k=document.querySelector('.tg-konu'); if(k) k.click(); return true; })()`);
await c.sleep(3200);
T('Birlikte Oyna başladı', (await c.evaluate(`document.querySelector('.screen.active')?.dataset.screen`)) === 'game');

await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('.tg-alt button')].find(x => /Bitir/i.test(x.textContent||''));
  if (b) b.click();
  return !!b;
})()`);
await c.sleep(2200);
const r1 = await sonucDurumu();
T('★ Birlikte Oyna: Bitir → SONUÇ EKRANI açılıyor (bildirilen kilitlenme)',
  r1.ekran === 'result' && r1.sonuc, JSON.stringify(r1));
const h1 = await c.errors();
T('★ Birlikte Oyna: Bitir sonrası JS HATASI yok',
  String(h1).replace(/\s/g, '') === '[]', String(h1).slice(0, 120));

/* ═══════ 2) SONSUZ MACERA → Bitir ═══════ */
await giris('Bitir2', '2B');
await c.evaluate(`(() => { const b=[...document.querySelectorAll('.map-head .btn')].find(x=>/Sonsuz/i.test(x.textContent||'')); if(b) b.click(); return true; })()`);
await c.sleep(1300);
await c.clickByText('Başla', 'button', 1400);
await c.sleep(3600);
T('Sonsuz Macera başladı', (await c.evaluate(`document.querySelector('.screen.active')?.dataset.screen`)) === 'game');

const bitirVar = await c.evaluate(`(() => {
  // Yalnız OYUN EKRANI içindeki Bitir butonu — test profil adı da 'Bitir2'
  // olduğu için genel arama yanlış butona tıklıyordu (öğrenildi).
  const ekran = document.querySelector('.screen.active[data-screen="game"]');
  if (!ekran) return false;
  const b = [...ekran.querySelectorAll('button')]
    .find(x => /Bitir/i.test(x.textContent || ''));
  if (b) { b.click(); return b.textContent.trim(); }
  return false;
})()`);
T('Sonsuz Macera: Bitir butonu bulundu ve tıklandı', bitirVar !== false, String(bitirVar));
await c.sleep(2500);
const r2 = await sonucDurumu();
T('★ Sonsuz Macera: Bitir → SONUÇ EKRANI açılıyor',
  r2.ekran === 'result' && r2.sonuc, JSON.stringify(r2));
const h2 = await c.errors();
T('★ Sonsuz Macera: JS hatası yok', String(h2).replace(/\s/g, '') === '[]', String(h2).slice(0, 120));

/* ═══════ 3) NORMAL BÖLÜM (ada) — regresyon yok ═══════ */
await giris('Bitir3', '2B');
await c.evaluate(`(() => { document.querySelectorAll('.world-card')[0].click(); return true; })()`);
await c.sleep(900);
await c.evaluate(`(() => { const n=[...document.querySelectorAll('.level-node')]; if(n[0]) n[0].click(); return true; })()`);
await c.sleep(1200);
await c.clickByText('Başla', 'button', 3600);
T('Normal bölüm başladı', (await c.evaluate(`document.querySelector('.screen.active')?.dataset.screen`)) === 'game');
// Bölümü bitir: soruyu OKU, doğru cevabı HESAPLA, doğru şıkkı tıkla.
// (Cevap DOM'da işaretli değil — oyun için doğru davranış; test kendi hesaplar.)
for (let i = 0; i < 20; i++) {
  const durum = JSON.parse(await c.evaluate(`(() => {
    if (document.querySelector('.screen.active')?.dataset.screen !== 'game') {
      return JSON.stringify({ bitti: true });
    }
    const q = document.querySelector('.question')?.innerText || '';
    const btns = [...document.querySelectorAll('.answers .answer-btn, .answer-btn')];
    if (!btns.length) return JSON.stringify({ bitti: false, sebep: 'şıklar yok' });
    // "3 × 5 = ?" veya "3 x 5" biçimini çöz
    const m = q.match(/(\\d+)\\s*[x×*]\\s*(\\d+)/);
    if (!m) return JSON.stringify({ bitti: false, sebep: 'soru okunamadı: ' + q.slice(0, 30), q });
    const dogru = String(Number(m[1]) * Number(m[2]));
    const hedef = btns.find(b => (b.textContent || '').trim() === dogru);
    if (!hedef) return JSON.stringify({ bitti: false, sebep: 'doğru şık bulunamadı', dogru });
    hedef.click();
    return JSON.stringify({ bitti: false, cevaplandi: dogru });
  })()`));
  if (durum.bitti) break;
  await c.sleep(900);
}
await c.sleep(2600);
const r3 = await sonucDurumu();
T('★ Normal bölüm: bitince SONUÇ EKRANI açılıyor (ada akışı bozulmadı)',
  r3.ekran === 'result' && r3.sonuc, JSON.stringify(r3));
const h3 = await c.errors();
T('★ Normal bölüm: JS hatası yok', String(h3).replace(/\s/g, '') === '[]', String(h3).slice(0, 120));

/* ═══════ 4) STATİK: bağımsız modların dünyalarında levels var mı? ═══════ */
const statik = JSON.parse(await c.evaluate(`(async () => {
  const r = await fetch('./js/main.js', { cache: 'no-store' });
  let t = await r.text();
  t = t.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/(^|[^:])\\/\\/[^\\n]*/g, '$1');
  // currentLevel = { world: { id: 'xxx' ... } } içinde levels yok mu?
  const eksik = [];
  const re = /currentLevel\\s*=\\s*\\{[\\s\\S]{0,200}?world:\\s*\\{([^}]*)\\}/g;
  let m;
  while ((m = re.exec(t))) {
    if (!/levels\\s*:/.test(m[1])) eksik.push(m[1].replace(/\\s+/g, ' ').trim().slice(0, 50));
  }
  return JSON.stringify(eksik);
})()`));
T('★ Statik: her bağımsız modun dünyasında levels: [] var',
  statik.length === 0, `eksik: ${JSON.stringify(statik)}`);

/* ═══════ 5) Statik: finishLevel savunmacı mı? ═══════ */
const savunma = await c.evaluate(`(async () => {
  const r = await fetch('./js/main.js', { cache: 'no-store' });
  const t = await r.text();
  return Array.isArray(t.match(/const levels = Array\\.isArray\\(world\\?\\.levels\\)/)) ;
})()`);
T('★ Statik: finishLevel world.levels için savunmacı kontrol içeriyor', savunma === true);

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
