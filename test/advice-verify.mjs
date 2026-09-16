/* Veli paneli öneri motoru testleri + ekran görüntüsü */
import { connect, result } from './cdp.mjs';

const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 980);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2000);
// TEST İZOLASYONU: önceki testin bıraktığı durum sonucu etkilemesin
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);

/* ---- 1) Zayıf tablo tespiti + bölüm hedefi ---- */
const zayif = await c.evaluate(`(async () => {
  const A = await import('./js/advice.js');
  const p = { stats: {
    correct: 40, wrong: 30, correctNoHint: 5,
    byTable: { '2': { c: 20, w: 1 }, '4': { c: 3, w: 12 }, '5': { c: 8, w: 2 } },
    byShape: {}
  }, streak: { count: 0 } };
  const o = A.buildAdvice(p);
  return JSON.stringify(o);
})()`);
const oz = JSON.parse(zayif || '[]');
const acil = oz.find((x) => x.tip === 'acil');
T('Zayıf tablo tespit edildi', !!acil && /4/.test(acil.baslik), acil ? acil.baslik : 'yok');
T('Zayıf tablo için BÖLÜM hedefi verildi', !!(acil && acil.hedef && acil.hedef.levelId),
  acil?.hedef ? `${acil.hedef.worldName} → ${acil.hedef.title}` : 'hedef yok');
T('Neden açıklaması var', !!(acil && acil.neden && acil.neden.length > 15), acil?.neden || '');
T('Eylem adımı var', !!(acil && acil.eylem && acil.eylem.length > 20), acil?.eylem || '');

/* ---- 2) Denenmemiş tablolar ---- */
const yok = await c.evaluate(`(async () => {
  const A = await import('./js/advice.js');
  const p = { stats: { correct: 20, wrong: 5, correctNoHint: 18,
    byTable: { '1': { c: 10, w: 1 }, '2': { c: 10, w: 4 } }, byShape: {} }, streak: { count: 2 } };
  return JSON.stringify(A.buildAdvice(p));
})()`);
const oy = JSON.parse(yok || '[]');
const denenmemis = oy.find((x) => /denenmedi|hiç/i.test(x.baslik));
T('Denenmemiş tablolar bildiriliyor', !!denenmemis, denenmemis?.baslik || 'yok');

/* ---- 3) İpucu bağımlılığı uyarısı ---- */
const ipucu = await c.evaluate(`(async () => {
  const A = await import('./js/advice.js');
  const p = { stats: { correct: 50, wrong: 5, correctNoHint: 3,
    byTable: { '1': { c: 45, w: 3 } }, byShape: {} }, streak: { count: 1 } };
  return JSON.stringify(A.buildAdvice(p));
})()`);
const oi = JSON.parse(ipucu || '[]');
T('İpucu bağımlılığı uyarısı çalışıyor', oi.some((x) => /pucu/i.test(x.baslik)), oi.map(x=>x.baslik).join(' | '));

/* ---- 4) Yüksek doğruluk → zorluk artır önerisi ---- */
const iyi = await c.evaluate(`(async () => {
  const A = await import('./js/advice.js');
  const byTable = {}; for (let t=1;t<=5;t++) byTable[t] = { c: 12, w: 1 };
  const p = { stats: { correct: 60, wrong: 5, correctNoHint: 55, byTable, byShape: {} }, streak: { count: 4 } };
  return JSON.stringify(A.buildAdvice(p));
})()`);
const oy2 = JSON.parse(iyi || '[]');
T('İyi gidene zorluk artır öneriliyor', oy2.some((x) => x.tip === 'iyi'), oy2.map(x=>x.tip+':'+x.baslik).join(' | '));

/* ---- 5) Boş profil çökmüyor ---- */
const bos = await c.evaluate(`(async () => {
  const A = await import('./js/advice.js');
  const p = { stats: { correct: 0, wrong: 0, byTable: {}, byShape: {} }, streak: { count: 0 } };
  const o = A.buildAdvice(p);
  const t = A.adviceToText({ nick: 'Test' }, o);
  return JSON.stringify({ adet: o.length, metinVar: t.length > 30 });
})()`);
const ob = JSON.parse(bos || '{}');
T('Boş profilde de öneri üretiyor (çökmüyor)', ob.adet >= 1 && ob.metinVar, `${ob.adet} öneri`);

/* ---- 6) Her tablo için bölüm haritası var ---- */
const harita = await c.evaluate(`(async () => {
  const A = await import('./js/advice.js');
  const eksik = [];
  for (let t = 1; t <= 10; t++) if (!A.tableLevels(t).length) eksik.push(t);
  return JSON.stringify(eksik);
})()`);
const eh = JSON.parse(harita || '[]');
T('Her tablonun öğretildiği bölüm biliniyor', eh.length === 0, eh.length ? `eksik: ${eh.join(',')}` : '10/10 tablo');

/* ---- 7) Veli panelinde öneri bölümü görünüyor ---- */
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 1900);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Zeynep'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2A'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(300);
await c.clickByText('Maceraya başla', 'button', 1300);

// Gerçekçi istatistik ver (zayıf 4'ler, hiç 6-10 yok)
await c.evaluate(`(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
  const p = JSON.parse(localStorage.getItem(k));
  p.results = { 'w1-l1': { stars: 3, best: 900, plays: 2 }, 'w1-l2': { stars: 2, best: 700, plays: 3 } };
  p.stats = { plays: 5, correct: 42, wrong: 26, correctNoHint: 8, drawDone: 0, bossDone: 0,
    bestStreak: 6, byTable: { '1': { c: 14, w: 2 }, '2': { c: 18, w: 3 }, '4': { c: 4, w: 15 }, '5': { c: 6, w: 6 } },
    byShape: { 'kare': { c: 5, w: 4 } } };
  p.streak = { count: 2, best: 3, lastDay: new Date().toISOString().slice(0,10) };
  p.coins = 180;
  localStorage.setItem(k, JSON.stringify(p));
})()`);
await c.goto(`${B}/index.html`, 2100);
await c.clickByText('Veli Paneli', 'button', 1300);
const panel = await c.evaluate(`(() => JSON.stringify({
  kutu: !!document.querySelector('.advice-box'),
  kart: document.querySelectorAll('.advice-card').length,
  acil: document.querySelectorAll('.advice-card.tip-acil').length,
  basliklar: [...document.querySelectorAll('.advice-card .adv-head b')].map(x => x.innerText)
}))()`);
const pn = JSON.parse(panel || '{}');
T('Veli panelinde öneri kutusu görünüyor', pn.kutu && pn.kart >= 1, `${pn.kart} öneri`);
T('Öneri başlıkları listeleniyor', (pn.basliklar || []).length >= 1, (pn.basliklar || []).join(' | '));
T('Zayıf alan vurgulanmış (acil)', pn.acil >= 1, `acil: ${pn.acil}, toplam: ${pn.kart}`);

await c.screenshot('test/shots/parent-advice.png');
console.log('Ekran: test/shots/parent-advice.png');
console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
