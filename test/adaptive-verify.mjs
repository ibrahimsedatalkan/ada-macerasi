/* Adaptif zorluk + aralıklı tekrar testleri */
import { connect, result } from './cdp.mjs';

const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 900);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2200);

/* ---- 1) Zorluk kademesi performansa göre değişiyor ---- */
const tier = await c.evaluate(`(async () => {
  const A = await import('./js/games/adaptive.js');
  const mk = (recent) => ({ stats: { recent, byTable: {}, byShape: {} } });
  const iyi = mk([1,1,1,1,1,1,1,1]);                    // hep doğru
  const kotu = mk([0,0,0,1,0,0,1,0]);                   // çoğu yanlış
  const notr = mk([1,1,0,1,1,0,1,0]);                   // ~%63 doğru → akış bandı
  const bos  = mk([]);                                  // veri yok
  return JSON.stringify({
    iyi: A.difficultyTier(iyi), kotu: A.difficultyTier(kotu),
    notr: A.difficultyTier(notr), bos: A.difficultyTier(bos),
    maxIyi: A.adaptiveMaxB(iyi, 5, 10), maxKotu: A.adaptiveMaxB(kotu, 5, 10)
  });
})()`);
const tr = JSON.parse(tier || '{}');
T('İyi gidince zorluk artıyor', tr.iyi === 2, `tier=${tr.iyi}`);
T('Zorlanınca zorluk düşüyor', tr.kotu === 0, `tier=${tr.kotu}`);
T('Karışıkta normal kalıyor', tr.notr === 1, `tier=${tr.notr}`);
T('Veri yokken normal başlıyor', tr.bos === 1, `tier=${tr.bos}`);
T('Zorluk sayı aralığını değiştiriyor', tr.maxIyi > tr.maxKotu, `iyi=${tr.maxIyi} kötü=${tr.maxKotu}`);

/* ---- 2) Zayıf tablo daha sık seçiliyor ---- */
const weak = await c.evaluate(`(async () => {
  const A = await import('./js/games/adaptive.js');
  // 2'ler iyi, 4'ler kötü
  const p = { stats: { recent: [1,1,1,1], byTable: { '2': { c: 18, w: 2 }, '4': { c: 3, w: 15 } }, byShape: {} } };
  const sayac = {};
  for (let i = 0; i < 400; i++) {
    const t = A.pickAdaptiveTables(p, [2, 4], 1)[0];
    sayac[t] = (sayac[t] || 0) + 1;
  }
  return JSON.stringify(sayac);
})()`);
const wk = JSON.parse(weak || '{}');
T('Zayıf tablo daha sık soruluyor', (wk['4'] || 0) > (wk['2'] || 0), `4'ler: ${wk['4']}, 2'ler: ${wk['2']} (400 seçim)`);

/* ---- 3) Denenmemiş tabloya öncelik ---- */
const never = await c.evaluate(`(async () => {
  const A = await import('./js/games/adaptive.js');
  const p = { stats: { recent: [1,1,1,1], byTable: { '2': { c: 20, w: 0 } }, byShape: {} } };
  const s = {};
  for (let i = 0; i < 400; i++) { const t = A.pickAdaptiveTables(p, [2, 5], 1)[0]; s[t] = (s[t]||0)+1; }
  return JSON.stringify(s);
})()`);
const nv = JSON.parse(never || '{}');
T('Hiç denenmemiş tablo öne çıkıyor', (nv['5'] || 0) > (nv['2'] || 0), `5'ler: ${nv['5']}, 2'ler: ${nv['2']}`);

/* ---- 4) Aralıklı tekrar kuyruğu ---- */
const missed = await c.evaluate(`(async () => {
  const A = await import('./js/games/adaptive.js');
  const p = { stats: { recent: [], byTable: {}, byShape: {} }, missed: [] };
  A.initMissed(p);
  // Aynı soruyu iki kez yanlış yap → kuyruğa bir kez girmeli, sayacı artmalı
  A.pushMissed(p, { kind: 'multiply', mode: 'result', a: 3, b: 4 });
  A.pushMissed(p, { kind: 'multiply', mode: 'result', a: 3, b: 4 });
  A.pushMissed(p, { kind: 'multiply', mode: 'result', a: 2, b: 5 });
  const kuyruk = p.missed.length;
  const ilk = A.takeDueMissed(p);
  const sonra = p.missed.length;
  return JSON.stringify({ kuyruk, ilk, sonra, sayac: 0 });
})()`);
const ms = JSON.parse(missed || '{}');
T('Yanlış sorular kuyruğa giriyor (tekrarsız)', ms.kuyruk === 2, `kuyruk: ${ms.kuyruk}`);
T('Kuyruktan soru çekiliyor', ms.ilk && ms.ilk.a === 3 && ms.ilk.b === 4, JSON.stringify(ms.ilk));
T('Çekilen soru kuyruktan düşüyor', ms.sonra === 1, `kalan: ${ms.sonra}`);

/* ---- 5) Kuyruk sınırı (sonsuz büyümez) ---- */
const cap = await c.evaluate(`(async () => {
  const A = await import('./js/games/adaptive.js');
  const p = { stats: { recent: [], byTable: {}, byShape: {} }, missed: [] };
  for (let i = 1; i <= 20; i++) A.pushMissed(p, { kind: 'multiply', mode: 'result', a: i, b: 2 });
  return p.missed.length;
})()`);
T('Tekrar kuyruğu sınırlı (en fazla 6)', cap <= 6, `kuyruk: ${cap}`);

/* ---- 6) Son performans penceresi ---- */
const recent = await c.evaluate(`(async () => {
  const A = await import('./js/games/adaptive.js');
  const p = { stats: { recent: [] } };
  for (let i = 0; i < 30; i++) A.pushRecent(p, i % 2 === 0);
  return JSON.stringify({ uzunluk: p.stats.recent.length, acc: A.recentAccuracy(p) });
})()`);
const rc = JSON.parse(recent || '{}');
T('Performans penceresi 12 ile sınırlı', rc.uzunluk === 12, `pencere: ${rc.uzunluk}`);
T('Doğruluk hesabı çalışıyor', rc.acc > 0.3 && rc.acc < 0.7, `acc: ${rc.acc.toFixed(2)}`);

/* ---- 7) Oyun içinde tekrar soru işareti ---- */
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2200);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Efe'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2B'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(300);
await c.clickByText('Maceraya başla', 'button', 1400);
await c.clickByText('Çayır Adası', 'button', 900);
await c.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Bölüm\\s+1\\b/.test(x.textContent||'')); if(b) b.click(); return !!b; })()`);
await c.sleep(1500);
await c.clickByText('Başla', 'button', 1600);
const gameOk = await c.evaluate(`(() => document.querySelectorAll('.answer-btn').length)()`);
T('Adaptif entegrasyonu oyunu bozmadı (4 seçenek)', gameOk === 4, `seçenek: ${gameOk}`);

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
