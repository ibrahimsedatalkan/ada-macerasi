/* HATA ÖRÜNTÜSÜ ANALİZİ + HEDEFLİ ÇALIŞMA testleri
   Pedagojik iddia: "7'lerde zayıf" demek yetmez; SORU DÜZEYİNDE tespit
   gerekir. Bu test o iddiayı ve hedefli çalışma akışını doğrular. */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 1000);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2500);

/* ---- 1) Analiz motoru: takılma noktası buluyor mu? ---- */
const analiz = JSON.parse(await c.evaluate(`(async () => {
  const A = await import('./js/advice.js');
  const p = { stats: { byFact: {
    '7x8': { c: 1, w: 5, son: Date.now() },
    '7x9': { c: 1, w: 3, son: Date.now() - 5000 },
    '6x4': { c: 0, w: 3, son: Date.now() - 90000 },
    '3x3': { c: 8, w: 0 },
    '4x3': { c: 6, w: 2 }
  } } };
  return JSON.stringify({
    takilma: A.takilmaNoktalari(p).map(x => x.fakt),
    karistirma: A.karistirmaNoktalari(p).map(x => x.fakt + '~' + x.komsu),
    cozulen: A.cozulenler(p).map(x => x.fakt),
    oneri: A.hataOnerisi(p)
  });
})()`) || '{}');

T('Takılma noktası bulundu (7x8)', analiz.takilma?.includes('7x8'), (analiz.takilma || []).join(', '));
T('Kolay sorular takılma sayılmadı (3x3 hariç)',
  !analiz.takilma?.includes('3x3'), (analiz.takilma || []).join(', '));
T('KARIŞTIRMA tespit edildi (7x8 ↔ 7x9)',
  (analiz.karistirma || []).some(x => x.includes('7x8~7x9')),
  (analiz.karistirma || []).join(' , '));
T('Çözülen soru tespit edildi (4x3)', analiz.cozulen?.includes('4x3'), (analiz.cozulen || []).join(', '));
T('Öneri KARIŞTIRMAYA özel ve uygulanabilir',
  /karıştırıyor/i.test(analiz.oneri || '') && /yan yana/i.test(analiz.oneri || ''),
  analiz.oneri);
T('Öneri cevabı söylemiyor, YÖNTEM söylüyor',
  !/cevap 56|56'dır/i.test(analiz.oneri || ''), 'cevap sızdırmıyor');

/* ---- 2) Analiz: karıştırma yoksa yalnız takılma önerisi ---- */
const tek = JSON.parse(await c.evaluate(`(async () => {
  const A = await import('./js/advice.js');
  const p = { stats: { byFact: { '8x7': { c: 0, w: 4, son: Date.now() } } } };
  return JSON.stringify({ oneri: A.hataOnerisi(p), karis: A.karistirmaNoktalari(p).length });
})()`) || '{}');
T('Tek takılma: yöntem önerisi veriliyor (5 katı + N)', /5 kere|parçalara/i.test(tek.oneri || ''),
  tek.oneri?.slice(0, 90));
T('Komşu hatası yoksa karıştırma uydurmuyor', tek.karis === 0);

/* ---- 3) Analiz: veri yoksa çöküyor mu? ---- */
const bos = JSON.parse(await c.evaluate(`(async () => {
  const A = await import('./js/advice.js');
  const t = A.takilmaNoktalari({ stats: {} });
  const o = A.hataOnerisi({ stats: {} });
  const o2 = A.hataOnerisi(null);
  return JSON.stringify({ takilma: t.length, oneri: o, nullOneri: o2 });
})()`) || '{}');
T('Boş veride çökmüyor', bos.takilma === 0 && bos.oneri === null, `takılma=${bos.takilma}`);
T('profile null iken de çökmüyor', bos.nullOneri === null);

/* ---- 4) Gerçek oyunda fact takibi çalışıyor mu? ---- */
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Hata'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2H'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(320);
await c.clickByText('Maceraya başla', 'button', 1800);

const kayit = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
  const p = JSON.parse(localStorage.getItem(k));
  // Doğrudan recordAnswer ile fact yaz
  S.recordAnswer(p, { correct: false, table: 7, b: 8, kind: 'multiply' });
  S.recordAnswer(p, { correct: false, table: 7, b: 8, kind: 'multiply' });
  S.recordAnswer(p, { correct: true, table: 7, b: 8, kind: 'multiply' });
  localStorage.setItem(k, JSON.stringify(p));
  return JSON.stringify({ fakt: p.stats.byFact, var: !!p.stats.byFact });
})()`) || '{}');
T('recordAnswer fact düzeyinde kaydediyor', kayit.var === true && !!kayit.fakt?.['7x8'],
  JSON.stringify(kayit.fakt || {}));
T('Fact kaydı doğru sayıyor (2 yanlış / 1 doğru)',
  kayit.fakt?.['7x8']?.w === 2 && kayit.fakt?.['7x8']?.c === 1,
  JSON.stringify(kayit.fakt?.['7x8'] || {}));

/* ---- 5) Veli panelinde hata örüntüsü bölümü + hedefli çalışma butonu ---- */
await c.goto(`${B}/index.html`, 2400);
await c.clickByText('Veli Paneli', 'button', 1600);
const panel = JSON.parse(await c.evaluate(`(() => {
  const blok = document.querySelector('.hata-block');
  return JSON.stringify({
    var: !!blok,
    baslik: blok?.querySelector('.advice-h')?.innerText || '',
    oneriVar: !!document.querySelector('.hata-oneri'),
    hedefBtn: !![...document.querySelectorAll('button')].find(b => /takıldığı|Hedefli/i.test(b.textContent||''))
  });
})()`) || '{}');
T('Veli panelinde "Hata örüntüsü" bölümü var', panel.var === true, panel.baslik);

/* ---- 6) Hedefli çalışma: yalnız seçilen soruları soruyor mu? ---- */
const hedef = JSON.parse(await c.evaluate(`(async () => {
  const Q = await import('./js/games/questions.js');
  // facts ile üretilen sorular yalnız o fact'lerden mi?
  const facts = [{ a: 7, b: 8 }, { a: 6, b: 4 }];
  const uretilen = [];
  for (let i = 0; i < 40; i++) {
    const f = facts[Math.floor(Math.random() * facts.length)];
    const q = Q.makeMultiplyQuestion({ tables: [f.a], facts: [f], mode: 'result' });
    uretilen.push(q.table + 'x' + q.b);
  }
  const benzersiz = [...new Set(uretilen)];
  return JSON.stringify({ benzersiz, hepsiHedefte: benzersiz.every(x => ['7x8','6x4'].includes(x)) });
})()`) || '{}');
T('Hedefli çalışma yalnız seçilen soruları üretiyor', hedef.hepsiHedefte === true,
  `üretilenler: ${(hedef.benzersiz || []).join(', ')}`);

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
