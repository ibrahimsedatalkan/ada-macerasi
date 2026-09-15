/* ============================================================
   smoke.mjs — uçtan uca duman testi (headless Chrome + CDP)
   Çalıştırma:
     chrome --headless=new --remote-debugging-port=9222 ...
     node test/smoke.mjs [http://127.0.0.1:8123]
   Ekran görüntüleri test/shots/ altına yazılır.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { connect, result } from './cdp.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8123';
const SHOTS = path.join(import.meta.dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (result(name, ok, detail)) pass++; else fail++; };

const c = await connect();
await c.viewport(1280, 900);
await c.initErrors();
await c.goto(BASE + '/index.html', 900);
await c.evaluate('localStorage.clear()');
await c.goto(BASE + '/index.html', 1800);

check('sayfa açıldı', (await c.evaluate('document.title')).includes('Ada Macerası'));
check('giriş ekranı aktif', (await c.evaluate('document.querySelector(".screen.active").dataset.screen')) === 'login');
await c.screenshot(path.join(SHOTS, '01-login.png'));

/* ---------- Giriş ---------- */
await c.evaluate(`(() => {
  const ins = document.querySelectorAll('[data-screen="login"] input');
  ins[0].value = 'TestOyuncu'; ins[1].value = '2A';
  document.querySelectorAll('[data-screen="login"] .avatar-opt')[3].click();
})()`);
await c.clickByText('Maceraya başla');
check('harita açıldı', (await c.evaluate('document.querySelector(".screen.active").dataset.screen')) === 'map');
check('profil kaydedildi', (await c.evaluate('!!localStorage.getItem("ada.active.v2")')));
{
  const beklenen = await c.evaluate(`(async () => (await import('./js/worlds.js')).WORLDS.length)()`);
  check(`tüm adalar listelendi (${beklenen})`, (await c.evaluate('document.querySelectorAll(".world-card").length')) === beklenen);
}
check('ilk ada açık', (await c.evaluate('!document.querySelectorAll(".world-card")[0].classList.contains("locked")')));
check('ikinci ada kilitli', (await c.evaluate('document.querySelectorAll(".world-card")[1].classList.contains("locked")')));
await c.screenshot(path.join(SHOTS, '02-map.png'));

/* ---------- Çarpım bölümü (w1-l1) ---------- */
await c.clickSelector('.world-card');
check('bölüm listesi açıldı', (await c.evaluate('document.querySelectorAll(".level-node").length')) === 5);
await c.clickSelector('.level-node');
check('bölüm tanıtımı açıldı', (await c.evaluate('!!document.getElementById("dialog").querySelector(".btn.primary")')));
await c.clickByText('Başla!');
check('oyun ekranı', (await c.evaluate('document.querySelector(".screen.active").dataset.screen')) === 'game');
const q1 = await c.evaluate('document.querySelector(".question").textContent');
check('soru üretildi', /×/.test(q1 || ''), q1);
await c.screenshot(path.join(SHOTS, '03-multiply.png'));

/* Doğru cevapları vererek bölümü bitir */
let answered = 0, wrongCount = 0;
for (let i = 0; i < 12; i++) {
  const st = await c.evaluate('document.querySelector(".screen.active").dataset.screen');
  if (st !== 'game') break;
  const info = await c.evaluate(`(() => {
    const q = document.querySelector('.question')?.textContent || '';
    const btns = [...document.querySelectorAll('.answer-btn')].map(b => b.textContent.trim());
    return JSON.stringify({ q, btns });
  })()`);
  const { q, btns } = JSON.parse(info || '{}');
  if (!btns?.length) break;
  const m = q.match(/(\d+)\s*×\s*(\d+)/);
  let target = m ? String(Number(m[1]) * Number(m[2])) : btns[0];
  if (!btns.includes(target)) target = btns[0];
  await c.evaluate(`(() => { const b = [...document.querySelectorAll('.answer-btn')].find(x => x.textContent.trim() === ${JSON.stringify(target)}); if (b) b.click(); })()`);
  await c.sleep(900);
  answered++;
  void wrongCount;
}
const resScreen = await c.evaluate('document.querySelector(".screen.active").dataset.screen');
check('bölüm tamamlandı → sonuç ekranı', resScreen === 'result', `sorulan: ${answered}`);
const stars = await c.evaluate('document.querySelectorAll(".result-stars .s.on").length');
check('yıldız verildi (3)', stars === 3, 'yıldız: ' + stars);
check('ilerleme kaydedildi', (await c.evaluate('JSON.parse(localStorage.getItem("ada.p.v2.2A.testoyuncu")||"{}").results?.["w1-l1"]?.stars')) >= 1);
await c.screenshot(path.join(SHOTS, '04-result.png'));

/* ---------- İkinci bölüm açıldı mı + kenar/köşe oyunu ---------- */
await c.clickByText('Harita');
await c.clickSelector('.world-card');
const levelLocks = await c.evaluate('[...document.querySelectorAll(".level-node")].map(n=>n.classList.contains("locked")).join(",")');
check('ilk bölüm geçildi → 2. bölüm açıldı', levelLocks === 'false,false,true,true,true', levelLocks);
await c.clickByText('Vazgeç', 'button', 200).catch(() => {});
await c.evaluate('document.getElementById("dialog").hidden = true');

/* w3'ü açmak için profili hazırla: tüm önceki bölümlere yıldız ver (dinamik liste) */
await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const k = 'ada.p.v2.2A.testoyuncu';
  const p = JSON.parse(localStorage.getItem(k));
  p.results = p.results || {};
  for (const w of W) for (const l of w.levels) p.results[l.id] = { stars: 3, best: 500, plays: 1 };
  p.worldDoneIds = W.map(x => x.id);
  p.treasures = W.map(x => x.id);
  localStorage.setItem(k, JSON.stringify(p));
})()`);
await c.goto(BASE + '/index.html', 1600);
check('otomatik giriş', (await c.evaluate('document.querySelector(".screen.active").dataset.screen')) === 'map');
check('tüm adalar açık', (await c.evaluate('document.querySelectorAll(".world-card.locked").length')) === 0);

/* ---------- Kenar/köşe oyunu (w3-l1) ---------- */
await c.evaluate('document.querySelectorAll(".world-card")[2].click()');
await c.sleep(400);
await c.clickSelector('.level-node');
await c.clickByText('Başla!');
const q3 = await c.evaluate('document.querySelector(".question").textContent');
check('kenar sorusu geldi', /kenar|köşe/.test(q3 || ''), q3);
check('şekil SVG çizildi', (await c.evaluate('!!document.querySelector(".bubble svg")')));
check('seçenekler var', (await c.evaluate('document.querySelectorAll(".answer-btn").length')) >= 3);
await c.screenshot(path.join(SHOTS, '05-sides.png'));
await c.clickByText('Çık');
await c.clickByText('Evet, çık');

/* ---------- Çizim oyunu (w4-l1) ---------- */
await c.evaluate('document.querySelectorAll(".world-card")[3].click()');
await c.sleep(400);
await c.clickSelector('.level-node');
await c.clickByText('Başla!');
await c.sleep(500);
check('çizim tuvali var', (await c.evaluate('!!document.querySelector(".draw-stage canvas")')));
await c.screenshot(path.join(SHOTS, '06-draw-before.png'));

const geom = JSON.parse(await c.evaluate(`(() => {
  const cv = document.querySelector('.draw-stage canvas');
  const r = cv.getBoundingClientRect();
  const size = Math.min(r.width, r.height) * 0.94;
  const rr = size * 0.4;
  const w = rr * 1.7, h = rr * 1.7;
  const cx = r.width/2, cy = r.height/2;
  return JSON.stringify({ x: r.x, y: r.y, cx, cy, w, h });
})()`));

// Karenin dört kenarını fare ile çiz
const corners = [
  [geom.cx - geom.w / 2, geom.cy - geom.h / 2],
  [geom.cx + geom.w / 2, geom.cy - geom.h / 2],
  [geom.cx + geom.w / 2, geom.cy + geom.h / 2],
  [geom.cx - geom.w / 2, geom.cy + geom.h / 2]
];
for (let e = 0; e < 4; e++) {
  const a = corners[e], b = corners[(e + 1) % 4];
  const steps = 22;
  await c.mouse('mousePressed', geom.x + a[0], geom.y + a[1]);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    await c.mouse('mouseMoved', geom.x + a[0] + (b[0] - a[0]) * t, geom.y + a[1] + (b[1] - a[1]) * t);
  }
  await c.mouse('mouseReleased', geom.x + b[0], geom.y + b[1]);
}
await c.sleep(600);
const cov = await c.evaluate(`[...document.querySelectorAll('.hint-pill')].map(e=>e.textContent).join(' | ')`);
check('çizim kapsaması ölçüldü', /%[1-9]/.test(cov || ''), cov);
await c.screenshot(path.join(SHOTS, '07-draw-after.png'));
await c.sleep(1400);
const after = await c.evaluate('document.querySelector(".screen.active").dataset.screen + ":" + ([...document.querySelectorAll(".hint-pill")].map(e=>e.textContent).join(" | "))');
check('çizim sonrası ilerledi', !/Kapsama: %0/.test(after) || after.startsWith('result'), after.slice(0, 90));

/* ---------- Düello ---------- */
await c.goto(BASE + '/index.html', 1500);
await c.clickByText('Düello');
await c.sleep(600);
check('düello mod seçimi açıldı', (await c.evaluate('document.querySelector(".screen.active").dataset.screen')) === 'duel');
await c.clickByText('Aynı cihazda 2 kişi', 'button', 800);
check('düello kurulum ekranı', (await c.evaluate('document.querySelector(".screen.active").dataset.screen')) === 'duel');
await c.evaluate(`document.querySelectorAll('[data-screen="duel"] input')[1].value = 'Arkadas'`);
await c.clickByText('Başla!');
check('düello 1. oyuncuya geçti', (await c.evaluate('document.body.textContent')).includes('Sıra: TestOyuncu'));
await c.screenshot(path.join(SHOTS, '08-duel.png'));
await c.clickByText('Hazırım!');
const dq = await c.evaluate('document.querySelector(".question")?.textContent');
check('düello sorusu geldi', !!dq, dq);
const db = await c.evaluate(`[...document.querySelectorAll('[data-screen="duel"] .answer-btn, [data-screen="duel"] .answers button')].length`);
check('düello cevap alanı hazır', (db || 0) >= 3, 'buton: ' + db);

/* ---------- Şekil avı (sürükle-bırak) ---------- */
await c.goto(BASE + '/index.html', 1500);
await c.evaluate('document.querySelectorAll(".world-card")[1].click()');
await c.sleep(350);
await c.evaluate('document.querySelectorAll(".level-node")[2].click()');
await c.clickByText('Başla!');
await c.sleep(600);
const tokCount0 = await c.evaluate('document.querySelectorAll(".shape-tok").length');
check('şekil avı tokenları geldi', tokCount0 === 4, 'token: ' + tokCount0);
const drag = JSON.parse(await c.evaluate(`(() => {
  const tok = document.querySelector('.shape-tok');
  const shape = tok.dataset.shape;
  const basket = document.querySelector('.basket[data-shape="' + shape + '"]');
  const t = tok.getBoundingClientRect(), b = basket.getBoundingClientRect();
  return JSON.stringify({ shape, from: [t.x + t.width/2, t.y + t.height/2], to: [b.x + b.width/2, b.y + b.height/2] });
})()`) || '{}');
await c.mouse('mousePressed', drag.from[0], drag.from[1]);
for (let s = 1; s <= 12; s++) {
  const t = s / 12;
  await c.mouse('mouseMoved', drag.from[0] + (drag.to[0] - drag.from[0]) * t, drag.from[1] + (drag.to[1] - drag.from[1]) * t);
}
await c.mouse('mouseReleased', drag.to[0], drag.to[1]);
await c.sleep(500);
const tokCount1 = await c.evaluate('document.querySelectorAll(".shape-tok").length');
check('sürükle-bırak çalıştı (token sepete girdi)', tokCount1 === tokCount0 - 1, `${tokCount0} → ${tokCount1} (${drag.shape})`);
await c.screenshot(path.join(SHOTS, '10-shapehunt.png'));

/* ---------- Boss bölümü (ejderha) ---------- */
await c.goto(BASE + '/index.html', 1500);
await c.evaluate('document.querySelectorAll(".world-card")[4].click()');
await c.sleep(350);
await c.evaluate('document.querySelectorAll(".level-node")[0].click()');
await c.clickByText('Başla!');
await c.sleep(500);
check('boss ekranı: ejderha ve can çubuğu', (await c.evaluate('!!document.querySelector("svg") && document.body.textContent.includes("Ejderha canı")')));
check('boss: süre çubuğu', (await c.evaluate('!!document.querySelector(".timer-bar i")')));
const bossQ = await c.evaluate('document.querySelector(".question")?.textContent');
check('boss sorusu geldi', !!bossQ, bossQ);
await c.screenshot(path.join(SHOTS, '11-boss.png'));

/* ---------- Veli paneli ---------- */
await c.goto(BASE + '/index.html', 1400);
await c.clickByText('Veli Paneli');
check('veli paneli açıldı', (await c.evaluate('document.querySelector(".screen.active").dataset.screen')) === 'parent');
check('ustalık çubukları var', (await c.evaluate('document.querySelectorAll(".mastery-row").length')) >= 5);
await c.screenshot(path.join(SHOTS, '09-parent.png'));

/* ---------- Hatalar ---------- */
const errs = JSON.parse((await c.errors()) || '[]');
check('çalışma hatası yok', errs.length === 0, errs.join(' ;; ').slice(0, 300));
const consoleErrs = c.consoleMsgs.filter((m) => m.startsWith('error'));
check('konsol hatası yok', consoleErrs.length === 0, consoleErrs.join(' ;; ').slice(0, 300));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('ekran görüntüleri: ' + SHOTS);
process.exit(fail ? 1 : 0);
