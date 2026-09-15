/* Yolculuk şeridi testi: doğru cevap → ilerleme, engel kırılması,
   büyük engel (yolun ortası), hedefe varış, yanlışta sendeleme,
   ve çizim bölümünde ilerlemenin kapsama oranına bağlanması. */
import fs from 'node:fs';
import path from 'node:path';
import { connect, result } from './cdp.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8123';
const SHOTS = path.join(import.meta.dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const check = (n, ok, d) => { if (result(n, ok, d)) pass++; else fail++; };

const c = await connect();
await c.viewport(1280, 900);
await c.initErrors();
await c.goto(BASE + '/index.html', 900);
await c.evaluate('localStorage.clear()');
await c.goto(BASE + '/index.html', 1600);

const readJourney = async () => JSON.parse(await c.evaluate(`JSON.stringify((() => {
  const j = document.querySelector('.journey');
  if (!j) return { yok: true };
  const walker = j.querySelector('.j-walker');
  return {
    var: true,
    adim: j.querySelectorAll('.j-mark').length,
    gecilen: j.querySelectorAll('.j-mark.done').length,
    kacirilan: j.querySelectorAll('.j-mark.missed').length,
    buyukKirildi: !!j.querySelector('.j-big.done'),
    hedefAcik: !!j.querySelector('.j-goal.open'),
    hedefKapali: !!j.querySelector('.j-goal.closed'),
    hedefTip: j.querySelector('.j-goal')?.dataset.goal,
    etiket: j.querySelector('.j-label')?.textContent,
    sayac: j.querySelector('.j-count')?.textContent,
    yuruyenLeft: walker ? Math.round(parseFloat(walker.style.left)) : null
  };
})())`) || '{}');

const screen = () => c.evaluate('document.querySelector(".screen.active").dataset.screen');

async function questionInfo() {
  return JSON.parse(await c.evaluate(`(() => {
    const q = document.querySelector('.question')?.textContent || '';
    const btns = [...document.querySelectorAll('.answer-btn')].map(b => b.textContent.trim());
    const lives = (document.querySelector('.lives')?.textContent || '').trim();
    return JSON.stringify({ q, btns, lives });
  })()`) || '{}');
}

/** Doğru veya yanlış cevap verir. Yanlışta sendeleme anında yakalanır. */
async function answer(correct) {
  const info = await questionInfo();
  const m = (info.q || '').match(/(\d+)\s*×\s*(\d+)/);
  const right = m ? String(Number(m[1]) * Number(m[2])) : (info.btns || [])[0];
  const target = correct ? right : (info.btns || []).find((b) => b !== right) || right;
  await c.evaluate(`(() => { const b = [...document.querySelectorAll('.answer-btn')].find(x => x.textContent.trim() === ${JSON.stringify(target)}); if (b) b.click(); })()`);
  await c.sleep(180);
  const after = JSON.parse(await c.evaluate(`JSON.stringify({
    stumble: !!document.querySelector('.j-walker.stumble') || !!document.querySelector('.j-bubble.show'),
    lives: (document.querySelector('.lives')?.textContent || '').trim()
  })`) || '{}');
  await c.sleep(correct ? 750 : 1900);   // yanlıştan sonra doğru cevap 1,5 sn gösterilir → uzun bekle
  return { q: info.q, target, right, stumble: after.stumble, lives: after.lives, livesBefore: info.lives };
}

/* --- giriş + ilk bölüm (w1-l1: 6 soru, 3 can, 1'ler) --- */
await c.evaluate(`(() => { const ins = document.querySelectorAll('[data-screen="login"] input'); ins[0].value = 'Yolcu'; ins[1].value = '2D'; })()`);
await c.clickByText('Maceraya başla');
await c.clickSelector('.world-card');
await c.clickSelector('.level-node');
await c.clickByText('Başla!');
await c.sleep(500);

let s = await readJourney();
check('yolculuk şeridi göründü', s.var === true);
check('hedef etiketi: Hazine Sandığı', /Hazine Sandığı/.test(s.etiket || ''), s.etiket);
check('hedef tipi sandık', s.hedefTip === 'sandik');
check('6 adımlık yol çizildi', s.adim === 6, 'adım: ' + s.adim);
check('başlangıçta ilerleme yok, karakter yolda başta', s.gecilen === 0 && s.yuruyenLeft === 8, `geçilen=${s.gecilen} left=${s.yuruyenLeft}`);
await c.screenshot(path.join(SHOTS, 'k-1-journey-basi.png'));

await answer(true);
s = await readJourney();
check('1 doğru → 1 engel kırıldı', s.gecilen === 1, 'geçilen: ' + s.gecilen);
check('karakter ilerledi (yolda yürüdü)', s.yuruyenLeft > 12, 'left: ' + s.yuruyenLeft);
check('sayaç güncellendi', /1 \/ 6/.test(s.sayac || ''), s.sayac);

const wrong = await answer(false);
s = await readJourney();
check('yanlış cevap ilerlemeyi geri almıyor', s.gecilen === 1, `geçilen: ${s.gecilen} (${wrong.q})`);
check('yanlış cevapta karakter sendeledi', wrong.stumble === true);
check('yanlış cevap canı azalttı', /♡/.test(wrong.lives || ''), wrong.lives);

await answer(true);
s = await readJourney();
check('2. doğru → 2. engel kırıldı', s.gecilen === 2, 'geçilen: ' + s.gecilen);
check('büyük engel henüz ayakta', s.buyukKirildi === false);

await answer(true);
s = await readJourney();
check('3. doğru (yolun ortası) → BÜYÜK ENGEL yıkıldı', s.buyukKirildi === true, 'geçilen: ' + s.gecilen);
check('etiket büyük engel mesajını gösterdi', /Büyük engel yıkıldı/.test(s.etiket || ''), s.etiket);
await c.screenshot(path.join(SHOTS, 'k-2-buyuk-engel.png'));

/* kalan soruları doğru cevaplayıp bölümü bitir */
for (let i = 0; i < 4; i++) {
  if ((await screen()) !== 'game') break;
  await answer(true);
}
await c.sleep(1000);
s = await readJourney();
check('bölüm bitti → sonuç ekranı', (await screen()) === 'result');
check('sonuç ekranında yol görünüyor', s.var === true);
check('hedefe varıldı, hedef açıldı', s.hedefAcik === true, `hedefAcik=${s.hedefAcik} geçilen=${s.gecilen}/${s.adim}`);
check('1 yanlış → yolda 1 engel kaldı (kırmızı işaretli)', s.kacirilan === 1, 'kacirilan: ' + s.kacirilan);
check('1 yanlış → 2 yıldız', (await c.evaluate('document.querySelectorAll(".result-stars .s.on").length')) === 2);
await c.screenshot(path.join(SHOTS, 'k-3-hedef-acildi.png'));

/* --- çizim bölümü: ilerleme kapsama oranına bağlı --- */
await c.evaluate(`(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
  const p = JSON.parse(localStorage.getItem(k));
  ['w1-l1','w1-l2','w1-l3','w1-l4','w1-l5','w2-l1','w2-l2','w2-l3','w2-l4','w2-l5','w3-l1','w3-l2','w3-l3','w3-l4','w3-l5','w4-l1','w4-l2','w4-l3','w4-l4','w4-l5'].forEach(id => p.results[id] = { stars: 3, best: 1, plays: 1 });
  localStorage.setItem(k, JSON.stringify(p));
})()`);
await c.goto(BASE + '/index.html', 1500);
await c.evaluate('document.querySelectorAll(".world-card")[3].click()');
await c.sleep(350);
await c.evaluate('document.querySelectorAll(".level-node")[0].click()');
await c.clickByText('Başla!');
await c.sleep(700);
s = await readJourney();
check('çizim bölümünün hedefi köprü', s.hedefTip === 'kopru', s.hedefTip);
check('çizimde de şerit var', s.var === true && s.adim >= 4, 'adım: ' + s.adim);
const beforeDraw = s.gecilen;

const geom = JSON.parse(await c.evaluate(`(() => {
  const cv = document.querySelector('.draw-stage canvas');
  const r = cv.getBoundingClientRect();
  const size = Math.min(r.width, r.height) * 0.94, rr = size * 0.4, w = rr * 1.7, h = rr * 1.7;
  return JSON.stringify({ x: r.x, y: r.y, cx: r.width/2, cy: r.height/2, w, h });
})()`) || '{}');
const corners = [
  [geom.cx - geom.w / 2, geom.cy - geom.h / 2], [geom.cx + geom.w / 2, geom.cy - geom.h / 2],
  [geom.cx + geom.w / 2, geom.cy + geom.h / 2], [geom.cx - geom.w / 2, geom.cy + geom.h / 2]
];
async function drawEdge(i) {
  const a = corners[i], b = corners[(i + 1) % 4];
  await c.mouse('mousePressed', geom.x + a[0], geom.y + a[1]);
  for (let n = 1; n <= 22; n++) {
    const t = n / 22;
    await c.mouse('mouseMoved', geom.x + a[0] + (b[0] - a[0]) * t, geom.y + a[1] + (b[1] - a[1]) * t);
  }
  await c.mouse('mouseReleased', geom.x + b[0], geom.y + b[1]);
  await c.sleep(300);
}

await drawEdge(0);   // tek kenar → kısmi ilerleme
s = await readJourney();
check('kısmi çizimde karakter hedefe yaklaştı', s.gecilen > beforeDraw, `${beforeDraw} → ${s.gecilen}`);
check('kısmi çizimde hedef henüz açılmadı', s.hedefAcik === false);
await c.screenshot(path.join(SHOTS, 'k-4-cizim-ilerleme.png'));

for (let e = 1; e < 4; e++) await drawEdge(e);
await c.sleep(1700);
s = await readJourney();
check('çizim tamamlanınca köprü açıldı', s.hedefAcik === true, `geçilen=${s.gecilen}/${s.adim}`);
check('çizim bölümü sonuç ekranıyla bitti', (await screen()) === 'result');
await c.screenshot(path.join(SHOTS, 'k-5-kopru-acildi.png'));

const errs = JSON.parse((await c.errors()) || '[]');
check('çalışma hatası yok', errs.length === 0, errs.join(' ;; ').slice(0, 240));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
