/* Çeldirici (yanlış seçenek) kalitesi testleri
   AMAÇ: Yanlış seçenekler "bariz yanlış" olmasın, düşünmeyi gerektirsin.
   Kötü çeldirici soruyu bedava kolaylaştırır (1×4 sorusunda 14 seçeneği gibi). */
import { connect, result } from './cdp.mjs';

const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 900);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2000);

/* Tüm tablolar × 1-10 için örnek üret ve çeldiricileri denetle */
const analiz = await c.evaluate(`(async () => {
  const Q = await import('./js/games/questions.js');
  const sorunlar = { buyukSicrama: [], cevapYok: [], azSecenek: [], tekrar: [], cokBuyuk: [] };
  let toplam = 0;
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      Q.resetQuestionMemory();
      // Üreteci doğrudan besleyemeyiz; rastgele üretip a,b eşleşenleri süz
      for (let d = 0; d < 60; d++) {
        const q = Q.makeMultiplyQuestion({ tables: [a], mode: 'result', maxB: 10, maxBHard: 10 });
        if (q.a !== a || q.b !== b || q.mode !== 'result') continue;
        toplam++;
        const cevap = a * b;
        const sec = q.options;
        if (!sec.includes(cevap)) sorunlar.cevapYok.push(a + 'x' + b);
        if (new Set(sec).size !== sec.length) sorunlar.tekrar.push(a + 'x' + b);
        if (sec.length !== 4) sorunlar.azSecenek.push(a + 'x' + b + ':' + sec.length);
        // Bariz yanlış: cevap ile seçenek arası tablo adımının 3 katından fazla mı?
        const enUzak = Math.max(...sec.filter(x => x !== cevap).map(x => Math.abs(x - cevap)));
        if (enUzak > Math.max(12, a * 3)) sorunlar.buyukSicrama.push(a + 'x' + b + '=' + cevap + ' → ' + sec.join(','));
        // Saçma çeldirici: ne cevaba yakın, ne de tablonun katı olmalı.
        // (7×1=7 sorusunda 14 ve 21 MEŞRU — 7'nin katları, tabloyu sınar.
        //  Eski hata: 1×4=4 sorusunda 14 — ne yakın ne tablo katı.)
        const kat = (x) => x > 0 && x % a === 0;
        const yakin = (x) => Math.abs(x - cevap) <= Math.max(3, a);
        const sacma = sec.filter(x => x !== cevap && !kat(x) && !yakin(x));
        if (sacma.length) sorunlar.cokBuyuk.push(a + 'x' + b + '=' + cevap + ' → ' + sec.join(',') + ' [saçma: ' + sacma.join(',') + ']');
        break;
      }
    }
  }
  return JSON.stringify({ toplam, ...sorunlar });
})()`);
const a = JSON.parse(analiz || '{}');

T('Yeterli örnek üretildi', (a.toplam || 0) >= 80, `${a.toplam} soru incelendi`);
T('Her soruda doğru cevap seçeneklerde', (a.cevapYok || []).length === 0,
  (a.cevapYok || []).slice(0, 4).join(', ') || 'hepsi tam');
T('Seçenekler birbirinden farklı', (a.tekrar || []).length === 0, (a.tekrar || []).slice(0, 4).join(', ') || 'tekrar yok');
T('Her soruda 4 seçenek', (a.azSecenek || []).length === 0, (a.azSecenek || []).slice(0, 4).join(', ') || 'hepsi 4');
T('Çeldiriciler mantıklı yakınlıkta (bariz yanlış yok)', (a.buyukSicrama || []).length === 0,
  (a.buyukSicrama || []).slice(0, 3).join(' | ') || 'hepsi makul');
T('Her seçenek ya cevaba yakın ya tablonun katı (saçma çeldirici yok)', (a.cokBuyuk || []).length === 0,
  (a.cokBuyuk || []).slice(0, 3).join(' | ') || 'temiz');

/* Belirli kötü örnek: 1×4'te 14 OLMAMALI (eski hata) */
const kotu = await c.evaluate(`(async () => {
  const Q = await import('./js/games/questions.js');
  let onDort = 0, toplam = 0;
  for (let i = 0; i < 300; i++) {
    Q.resetQuestionMemory();
    const q = Q.makeMultiplyQuestion({ tables: [1,2], mode: 'result', maxB: 5, maxBHard: 5 });
    toplam++;
    if (q.answer < 12 && q.options.some(x => x > 20)) onDort++;
  }
  return JSON.stringify({ toplam, onDort });
})()`);
const k = JSON.parse(kotu || '{}');
T('Küçük çarpımlarda büyük sayı çeldiricisi yok (eski hata)', k.onDort === 0,
  `${k.toplam} soruda ${k.onDort} kötü çeldirici`);

/* Tablo komşusu çeldirici üretiliyor mu? (öğretici olan) */
const komsu = await c.evaluate(`(async () => {
  const Q = await import('./js/games/questions.js');
  let komsuVar = 0, toplam = 0;
  for (let a = 2; a <= 9; a++) {
    for (let i = 0; i < 25; i++) {
      Q.resetQuestionMemory();
      const q = Q.makeMultiplyQuestion({ tables: [a], mode: 'result', maxB: 10, maxBHard: 10 });
      toplam++;
      const c = q.a * q.b;
      // a×(b±1) komşusu var mı?
      if (q.options.includes(c - q.a) || q.options.includes(c + q.a)) komsuVar++;
    }
  }
  return JSON.stringify({ toplam, komsuVar });
})()`);
const km = JSON.parse(komsu || '{}');
T('Tablo komşusu çeldirici üretiliyor (öğretici)', km.komsuVar / Math.max(1, km.toplam) > 0.3,
  `${km.komsuVar}/${km.toplam} soruda tablo komşusu var`);

/* Kenar/köşe seçenekleri makul mü? (0-8 arası) */
const sekil = await c.evaluate(`(async () => {
  const Q = await import('./js/games/questions.js');
  let kotu = 0, toplam = 0;
  for (let i = 0; i < 200; i++) {
    Q.resetQuestionMemory();
    const q = Q.makeSidesQuestion({ ask: 'mix' });
    toplam++;
    if (q.options.some(x => x < 0 || x > 8)) kotu++;
  }
  return JSON.stringify({ toplam, kotu });
})()`);
const sk = JSON.parse(sekil || '{}');
T('Kenar/köşe seçenekleri 0-8 aralığında', sk.kotu === 0, `${sk.toplam} soruda ${sk.kotu} aralık dışı`);

/* Oyun içinde de doğrulandı mı? (settings-verify'daki çalışan akış) */
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2100);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Dila'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2D'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(400);
await c.clickByText('Maceraya başla', 'button', 1600);
console.log('   harita:', await c.evaluate(`document.querySelector('.screen.active')?.dataset.screen`));

// Tüm kilitleri aç (yıldız ver) ve yenile
await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
  const p = JSON.parse(localStorage.getItem(k));
  p.results = p.results || {};
  for (const w of W) for (const l of w.levels) p.results[l.id] = { stars: 3, best: 500, plays: 1 };
  localStorage.setItem(k, JSON.stringify(p));
})()`);
await c.goto(`${B}/index.html`, 2100);

const adimlar = await c.evaluate(`(async () => {
  const kartlar = [...document.querySelectorAll('.world-card')];
  kartlar[0].click();
  return kartlar.length;
})()`);
await c.sleep(1200);
const lvlClick = await c.evaluate(`(() => {
  const nodes = [...document.querySelectorAll('.level-node')];
  if (nodes[0]) nodes[0].click();
  return nodes.length;
})()`);
console.log('   ada:', adimlar, '| bölüm düğmesi:', lvlClick);
await c.sleep(1700);
const baslaClick = await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Başla/.test(x.textContent||''));
  if (b) b.click();
  return !!b;
})()`);
console.log('   başla:', baslaClick);
await c.sleep(1900);

const oyun = await c.evaluate(`(() => {
  const q = document.querySelector('.question')?.innerText.replace(/\\s+/g,' ').trim() || '';
  const sec = [...document.querySelectorAll('.answer-btn')].map(b => Number(b.textContent));
  return JSON.stringify({ ekran: document.querySelector('.screen.active')?.dataset.screen || null, q, sec });
})()`);
const oy = JSON.parse(oyun || '{}');
const m = /(\d+)\s*[×x]\s*(\d+)/.exec(oy.q || '');
const dogru = m ? Number(m[1]) * Number(m[2]) : null;
T('Oyunda seçenekler doğru cevabı içeriyor', dogru != null && (oy.sec || []).includes(dogru),
  `ekran=${oy.ekran} ${oy.q} → ${(oy.sec || []).join(', ')} (cevap ${dogru})`);

await c.screenshot('test/shots/distractor-check.png');
console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
