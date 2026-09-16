/* CANLIDA geometrik çizim öğretimi çalışıyor mu? */
import { connect, result } from './cdp.mjs';

const LIVE = process.env.LIVE_URL || 'https://ibrahimsedatalkan.github.io/ada-macerasi';
const c = await connect();
await c.viewport(1280, 980);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

console.log(`Canlı: ${LIVE}\n`);
await c.goto(`${LIVE}/`, 4500);
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${LIVE}/`, 4200);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Canli'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2F'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(400);
await c.clickByText('Maceraya başla', 'button', 2000);

/* Tüm kilitleri aç, çizim adasına git (Gökkuşağı Zirvesi = 4. ada) */
await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
  const p = JSON.parse(localStorage.getItem(k));
  p.results = p.results || {};
  for (const w of W) for (const l of w.levels) p.results[l.id] = { stars: 3, best: 500, plays: 1 };
  localStorage.setItem(k, JSON.stringify(p));
})()`);
await c.goto(`${LIVE}/`, 3200);

const cizimBolum = await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const wi = W.findIndex(w => w.levels.some(l => l.type === 'draw'));
  document.querySelectorAll('.world-card')[wi].click();
  const idx = W[wi].levels.findIndex(l => l.type === 'draw');
  return JSON.stringify({ ada: W[wi].name, bolumIndex: idx, cizimSayisi: W[wi].levels.filter(l => l.type === 'draw').length });
})()`);
const cb = JSON.parse(cizimBolum || '{}');
T('Çizim adası canlıda', !!cb.ada, `${cb.ada} — ${cb.cizimSayisi} çizim bölümü`);
T('Çizim bölümü sayısı 9', cb.cizimSayisi === 9, `${cb.cizimSayisi} bölüm`);

await c.sleep(900);
await c.evaluate(`(() => {
  const nodes = [...document.querySelectorAll('.level-node')];
  if (nodes[0]) nodes[0].click();
  return nodes.length;
})()`);
await c.sleep(1500);
await c.clickByText('Başla', 'button', 2600);

/* Canlıda öğretim araçları */
const araclar = await c.evaluate(`(() => {
  const cv = document.querySelector('.draw-stage canvas');
  if (!cv) return JSON.stringify({ hata: 'canvas yok' });
  const ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let yesil = 0, sari = 0, mavi = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    if (d[i+3] > 10) {
      if (g > 180 && r < 140 && b < 160) yesil++;
      if (r > 220 && g > 190 && b < 120) sari++;
      if (b > 200 && r < 150 && g > 150) mavi++;
    }
  }
  const kutu = 110;
  const kd = ctx.getImageData(6, 6, kutu, kutu).data;
  let zemin = 0;
  for (let i = 3; i < kd.length; i += 4) if (kd[i] > 10) zemin++;
  return JSON.stringify({
    ekran: document.querySelector('.screen.active')?.dataset.screen || null,
    howTo: document.querySelector('.how-to')?.innerText || '',
    demoBtn: !!([...document.querySelectorAll('button')].find(b => /Nasıl çizilir/.test(b.textContent||''))),
    yesil, sari, mavi, zemin
  });
})()`);
const ar = JSON.parse(araclar || '{}');
T('Çizim ekranı canlıda açıldı', ar.ekran === 'game', ar.ekran);
T('Yönerge satırı canlıda', (ar.howTo || '').length > 15, ar.howTo);
T('Demo butonu canlıda', ar.demoBtn === true);
T('Noktalı zemin canlıda çizildi', (ar.zemin || 0) > 30, `${ar.zemin} piksel`);
T('Başlangıç noktası canlıda (yeşil)', (ar.yesil || 0) > 20, `${ar.yesil} piksel`);
T('Köşe numaraları canlıda (sarı)', (ar.sari || 0) > 50, `${ar.sari} piksel`);
T('Yön okları canlıda (mavi)', (ar.mavi || 0) > 30, `${ar.mavi} piksel`);

await c.screenshot('test/shots/live-draw.png');
console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('Ekran: test/shots/live-draw.png');
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
