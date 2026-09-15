/* Mobil/tablet düzen testi: yatay taşma, kesilme ve dokunma hedefi boyutları */
import fs from 'node:fs';
import path from 'node:path';
import { connect } from './cdp.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8123';
const SHOTS = path.join(import.meta.dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const sizes = [
  { name: 'telefon', w: 390, h: 844, dpr: 3, mobile: true },
  { name: 'tablet', w: 820, h: 1180, dpr: 2, mobile: true }
];

const c = await connect();
let problems = [];

async function overflowReport(tag) {
  const data = JSON.parse(await c.evaluate(`(() => {
    const de = document.documentElement;
    const horizontal = de.scrollWidth - de.clientWidth;
    const wide = [...document.querySelectorAll('.screen.active *')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.right > de.clientWidth + 1 || r.left < -1);
    }).slice(0, 6).map(e => (e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().right));
    const small = [...document.querySelectorAll('.screen.active button')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height < 40;
    }).slice(0, 4).map(e => (e.textContent || e.className).trim().slice(0, 18) + ':' + Math.round(e.getBoundingClientRect().height));
    return JSON.stringify({ horizontal, wide, small });
  })()`) || '{}');
  if (data.horizontal > 2) problems.push(`${tag}: yatay taşma ${data.horizontal}px`);
  if ((data.wide || []).length) problems.push(`${tag}: taşan öğe ${data.wide.join(', ')}`);
  if ((data.small || []).length) problems.push(`${tag}: küçük dokunma hedefi ${data.small.join(', ')}`);
  console.log(`  ${tag}: taşma=${data.horizontal}px taşan=${(data.wide || []).length} küçükButon=${(data.small || []).length}`);
}

for (const s of sizes) {
  console.log(`\n### ${s.name} (${s.w}×${s.h})`);
  await c.send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: s.dpr, mobile: s.mobile });
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  await c.goto(BASE + '/index.html', 900);
  await c.evaluate('localStorage.clear()');
  await c.goto(BASE + '/index.html', 1600);

  await overflowReport('giriş');
  await c.screenshot(path.join(SHOTS, `m-${s.name}-1-login.png`));

  await c.evaluate(`(() => { const ins = document.querySelectorAll('[data-screen="login"] input'); ins[0].value='Mobil'; ins[1].value='2C'; })()`);
  await c.clickByText('Maceraya başla');
  await overflowReport('harita');
  await c.screenshot(path.join(SHOTS, `m-${s.name}-2-map.png`));

  await c.clickSelector('.world-card');
  await c.sleep(300);
  await c.screenshot(path.join(SHOTS, `m-${s.name}-3-levels.png`));
  await c.clickSelector('.level-node');
  await c.clickByText('Başla!');
await c.sleep(3400);   // bölüm öncesi geri sayım (3-2-1-BAŞLA)
  await c.sleep(500);
  await overflowReport('çarpım');
  const gridCols = await c.evaluate(`getComputedStyle(document.querySelector('.answers')).gridTemplateColumns`);
  console.log('  cevap ızgarası:', gridCols);
  await c.screenshot(path.join(SHOTS, `m-${s.name}-4-multiply.png`));
  await c.clickByText('Çık');
  await c.clickByText('Evet, çık');

  /* çizim oyunu için tüm adaları aç */
  await c.evaluate(`(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
    const p = JSON.parse(localStorage.getItem(k));
    ['w1-l1','w1-l2','w1-l3','w1-l4','w1-l5','w2-l1','w2-l2','w2-l3','w2-l4','w2-l5','w3-l1','w3-l2','w3-l3','w3-l4','w3-l5','w4-l1','w4-l2','w4-l3','w4-l4','w4-l5'].forEach(id => p.results[id] = { stars:3, best:1, plays:1 });
    localStorage.setItem(k, JSON.stringify(p));
  })()`);
  await c.goto(BASE + '/index.html', 1400);
  await c.evaluate('document.querySelectorAll(".world-card")[3].click()');
  await c.sleep(300);
  await c.evaluate('document.querySelectorAll(".level-node")[0].click()');
  await c.clickByText('Başla!');
await c.sleep(3400);   // bölüm öncesi geri sayım (3-2-1-BAŞLA)
  await c.sleep(700);
  await overflowReport('çizim');
  const canvasBox = await c.evaluate(`JSON.stringify((() => { const r = document.querySelector('.draw-stage').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })())`);
  console.log('  çizim alanı:', canvasBox);
  await c.screenshot(path.join(SHOTS, `m-${s.name}-5-draw.png`));

  /* kenar/köşe */
  await c.goto(BASE + '/index.html', 1300);
  await c.evaluate('document.querySelectorAll(".world-card")[2].click()');
  await c.sleep(300);
  await c.evaluate('document.querySelectorAll(".level-node")[0].click()');
  await c.clickByText('Başla!');
await c.sleep(3400);   // bölüm öncesi geri sayım (3-2-1-BAŞLA)
  await c.sleep(500);
  await overflowReport('kenar-köşe');
  await c.screenshot(path.join(SHOTS, `m-${s.name}-6-sides.png`));

  /* şekil avı */
  await c.goto(BASE + '/index.html', 1300);
  await c.evaluate('document.querySelectorAll(".world-card")[1].click()');
  await c.sleep(300);
  await c.evaluate('document.querySelectorAll(".level-node")[2].click()');
  await c.clickByText('Başla!');
await c.sleep(3400);   // bölüm öncesi geri sayım (3-2-1-BAŞLA)
  await c.sleep(700);
  await overflowReport('şekil-avı');
  await c.screenshot(path.join(SHOTS, `m-${s.name}-7-shapehunt.png`));

  /* düello */
  await c.goto(BASE + '/index.html', 1300);
  await c.clickByText('Düello');
  await c.sleep(400);
  await overflowReport('düello kurulum');
  await c.screenshot(path.join(SHOTS, `m-${s.name}-8-duel.png`));

  /* veli paneli */
  await c.goto(BASE + '/index.html', 1300);
  await c.clickByText('Veli Paneli');
  await overflowReport('veli paneli');
  await c.screenshot(path.join(SHOTS, `m-${s.name}-9-parent.png`));
}

console.log('\n=== SORUNLAR ===');
console.log(problems.length ? problems.map((p) => '⚠️ ' + p).join('\n') : 'sorun bulunamadı ✔');
const errs = JSON.parse((await c.errors()) || '[]');
console.log('çalışma hataları:', errs.length ? errs.join(' ;; ') : 'yok');
process.exit(0);
