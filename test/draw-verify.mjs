/* Geometrik çizim oyunu testleri — öğretim araçları çalışıyor mu? */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 980);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/* Çizim bölümüne gir */
async function cizimeGir(levelId) {
  await c.goto(`${B}/index.html`, 1900);
  await c.evaluate(`(async () => {
    const W = (await import('./js/worlds.js')).WORLDS;
    const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
    const p = JSON.parse(localStorage.getItem(k));
    p.results = p.results || {};
    for (const w of W) for (const l of w.levels) p.results[l.id] = { stars: 3, best: 500, plays: 1 };
    localStorage.setItem(k, JSON.stringify(p));
  })()`);
  await c.goto(`${B}/index.html`, 1900);
  await c.evaluate(`(async () => {
    const W = (await import('./js/worlds.js')).WORLDS;
    const wi = W.findIndex(w => w.levels.some(l => l.id === '${levelId}'));
    document.querySelectorAll('.world-card')[wi].click();
    return true;
  })()`);
  await c.sleep(900);
  const li = Number(levelId.split('-l')[1]) - 1;
  await c.evaluate(`(() => {
    const n = [...document.querySelectorAll('.level-node')];
    if (n[${li}]) n[${li}].click();
    return n.length;
  })()`);
  await c.sleep(1400);
  await c.clickByText('Başla', 'button', 2200);
}

await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Cizim'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2E'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(350);
await c.clickByText('Maceraya başla', 'button', 1500);

/* ---- 1) Çizim bölümü açıldı mı? ---- */
await cizimeGir('w4-l1');
const acildi = await c.evaluate(`(() => JSON.stringify({
  ekran: document.querySelector('.screen.active')?.dataset.screen || null,
  canvas: !!document.querySelector('.draw-stage canvas'),
  howTo: document.querySelector('.how-to')?.innerText || '',
  izleBtn: !!([...document.querySelectorAll('button')].find(b => /Nasıl çizilir/.test(b.textContent||'')))
}))()`);
const a = JSON.parse(acildi || '{}');
T('Çizim bölümü açıldı', a.ekran === 'game' && a.canvas, JSON.stringify({ ekran: a.ekran, canvas: a.canvas }));
T('"Nasıl çizilir" yönerge satırı var', (a.howTo || '').length > 15, a.howTo);
T('"Nasıl çizilir?" demo butonu var', a.izleBtn === true);

/* ---- 2) Tuval gerçekten çizildi mi? (noktalı zemin + numaralar) ---- */
const pikseller = await c.evaluate(`(() => {
  const cv = document.querySelector('.draw-stage canvas');
  if (!cv) return JSON.stringify({ hata: 'canvas yok' });
  const ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let dolu = 0, yesil = 0, sari = 0, mavi = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2], al = d[i+3];
    if (al > 10) dolu++;
    if (g > 180 && r < 140 && b < 160) yesil++;          // başlangıç noktası
    if (r > 220 && g > 190 && b < 120) sari++;           // köşe numarası rozeti
    if (b > 200 && r < 150 && g > 150) mavi++;           // yön okları
  }
  const toplam = d.length / 4;
  return JSON.stringify({ doluYuzde: Math.round(dolu/toplam*100), yesil, sari, mavi });
})()`);
const px = JSON.parse(pikseller || '{}');
T('Tuval çizildi (içerik var)', (px.doluYuzde || 0) > 3, `dolu: %${px.doluYuzde}`);

/* Noktalı zemin gerçekten var mı? Köşe bölgesinde (şeklin dışında) nokta ara */
const zemin = await c.evaluate(`(() => {
  const cv = document.querySelector('.draw-stage canvas');
  const ctx = cv.getContext('2d');
  const kutu = 120;                                  // köşeden 120x120 örnekle
  const d = ctx.getImageData(6, 6, kutu, kutu).data;
  let dolu = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 10) dolu++;
  return JSON.stringify({ doluluk: Math.round(dolu / (kutu * kutu) * 100), dolu });
})()`);
const zm = JSON.parse(zemin || '{}');
T('Noktalı kâğıt zemini çizildi (köşede noktalar var)', (zm.dolu || 0) > 30,
  `köşe bölgesinde ${zm.dolu} dolu piksel (%${zm.doluluk})`);
T('Başlangıç noktası (yeşil) çizildi', (px.yesil || 0) > 20, `${px.yesil} piksel`);
T('Köşe numaraları (sarı rozet) çizildi', (px.sari || 0) > 50, `${px.sari} piksel`);
T('Yön okları (mavi) çizildi', (px.mavi || 0) > 30, `${px.mavi} piksel`);

/* ---- 3) Demo animasyonu oynuyor mu? (kareler farklı olmalı) ---- */
const demo = await c.evaluate(`(async () => {
  const cv = document.querySelector('.draw-stage canvas');
  const ctx = cv.getContext('2d');
  const imza = () => {
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 40) h = (h * 31 + d[i] + d[i+3]) >>> 0;
    return h;
  };
  const b = [...document.querySelectorAll('button')].find(x => /Nasıl çizilir/.test(x.textContent||''));
  if (!b) return JSON.stringify({ hata: 'buton yok' });
  b.click();
  const kareler = [];
  for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 330)); kareler.push(imza()); }
  const farkli = new Set(kareler).size;
  return JSON.stringify({ kareler, farkli });
})()`);
const dm = JSON.parse(demo || '{}');
T('Demo animasyonu oynuyor (kareler değişiyor)', (dm.farkli || 0) >= 3,
  `6 karede ${dm.farkli} farklı görüntü`);

/* ---- 4) Şeklin üzerinden geçince başarı ---- */
await cizimeGir('w4-l1');
const cizim = await c.evaluate(`(async () => {
  const cv = document.querySelector('.draw-stage canvas');
  const r = cv.getBoundingClientRect();
  // Hedef şekli DOM'dan değil, tuvalden öğrenemeyiz — karenin kenarını taklit et:
  // kare tuvalin ortasında; kenar uzunluğunu kapsama %100 olacak şekilde dolaş.
  const boy = Math.min(r.width, r.height) * 0.94;
  const cx = r.width / 2, cy = r.height / 2;
  const yari = boy / 2;
  const noktalar = [];
  const ekle = (x1,y1,x2,y2) => { const n = 60; for (let i=0;i<=n;i++){ const t=i/n; noktalar.push([x1+(x2-x1)*t, y1+(y2-y1)*t]); } };
  const sol = cx - yari, sag = cx + yari, ust = cy - yari, alt = cy + yari;
  ekle(sol, ust, sag, ust); ekle(sag, ust, sag, alt); ekle(sag, alt, sol, alt); ekle(sol, alt, sol, ust);

  const gonder = (tip, x, y) => cv.dispatchEvent(new PointerEvent(tip, { clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerId: 1, isPrimary: true, buttons: tip === 'pointerup' ? 0 : 1 }));
  gonder('pointerdown', noktalar[0][0], noktalar[0][1]);
  for (let i = 1; i < noktalar.length; i++) {
    gonder('pointermove', noktalar[i][0], noktalar[i][1]);
    if (i % 20 === 0) await new Promise(res => setTimeout(res, 8));
  }
  gonder('pointerup', noktalar[noktalar.length-1][0], noktalar[noktalar.length-1][1]);
  await new Promise(res => setTimeout(res, 700));
  return JSON.stringify({ kapsama: document.querySelector('.hint-pill.good, .hint-pill')?.innerText || '', ekran: document.querySelector('.screen.active')?.dataset.screen });
})()`);
const cz = JSON.parse(cizim || '{}');
const yuzde = Number((/(\d+)/.exec(cz.kapsama || '') || [])[1] || 0);
T('Şeklin üzerinden geçince kapsama yükseldi', yuzde >= 60, `kapsama: ${cz.kapsama} | ekran: ${cz.ekran}`);

await c.screenshot('test/shots/draw-teach.png');

/* ---- 5) Tüm şekiller çizilebilir mi? (6 şekil) ---- */
const sekiller = await c.evaluate(`(async () => {
  const S = await import('./js/shapes.js');
  const W = await import('./js/worlds.js');
  const cizimSekilleri = new Set();
  for (const w of W.WORLDS) for (const l of w.levels) if (l.type === 'draw') for (const s of (l.cfg?.shapes || [])) cizimSekilleri.add(s);
  const tanimli = Object.keys(S.SHAPES);
  const eksik = tanimli.filter(x => !cizimSekilleri.has(x));
  const kontur = {};
  for (const id of tanimli) {
    const o = S.shapeOutline(id, { size: 200, cx: 100, cy: 100 });
    kontur[id] = o.kind === 'circle' ? o.r > 0 : (o.pts || []).length;
  }
  return JSON.stringify({ tanimli, cizimSekilleri: [...cizimSekilleri], eksik, kontur });
})()`);
const sk = JSON.parse(sekiller || '{}');
T('Tüm şekillerin çizim bölümü var', (sk.eksik || []).length === 0, `eksik: ${(sk.eksik||[]).join(', ') || 'yok'}`);
T('Her şeklin konturu üretilebiliyor', Object.values(sk.kontur || {}).every(v => v > 0), JSON.stringify(sk.kontur));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('Ekran: test/shots/draw-teach.png');
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
