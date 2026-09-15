/* Bug düzeltmelerini doğrulayan testler:
   1) Aynı soru arka arkaya gelmiyor
   2) İpucu cevabı vermiyor
   3) Profilde ham emoji (kod) yerine görsel var
   4) TTS yavaş konuşuyor                                        */
import { connect, result } from './cdp.mjs';

const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 900);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2000);

/* ---- 1) Soru tekrarı ---- */
const dupCheck = await c.evaluate(`(async () => {
  const m = await import('./js/games/questions.js');
  m.resetQuestionMemory();
  const keys = [];
  for (let i = 0; i < 80; i++) {
    const q = m.makeMultiplyQuestion({ tables: [1,2,3,4,5], mode: 'result', maxB: 5 });
    keys.push(q.mode + ':' + q.a + 'x' + q.b);
  }
  let cons = 0;
  for (let i = 1; i < keys.length; i++) if (keys[i] === keys[i-1]) cons++;
  return JSON.stringify({ total: keys.length, consecutiveDup: cons, sample: keys.slice(0,6) });
})()`);
const dup = JSON.parse(dupCheck || '{}');
T('Aynı soru arka arkaya gelmiyor', dup.consecutiveDup === 0, `80 soruda ardışık tekrar: ${dup.consecutiveDup}`);

/* kenar/köşe de */
const dupSides = await c.evaluate(`(async () => {
  const m = await import('./js/games/questions.js');
  m.resetQuestionMemory();
  const k = [];
  for (let i = 0; i < 60; i++) { const q = m.makeSidesQuestion({ ask: 'mix' }); k.push(q.shapeId + ':' + q.ask); }
  let c2 = 0; for (let i = 1; i < k.length; i++) if (k[i] === k[i-1]) c2++;
  return c2;
})()`);
T('Kenar/köşe sorusu tekrar etmiyor', dupSides === 0, `ardışık tekrar: ${dupSides}`);

/* ---- 2) İpucu cevabı vermiyor ---- */
const hintCheck = await c.evaluate(`(async () => {
  const h = await import('./js/games/hints.js');
  const q = await import('./js/games/questions.js');
  let leaks = 0; const bad = [];
  for (const [a,b] of [[2,3],[4,5],[3,3],[5,2],[4,4],[2,5],[5,5],[3,4]]) {
    const question = { kind:'multiply', mode:'result', a, b, answer: a*b };
    const t = h.techniqueFor(question);
    const text = [t.name, t.teach, t.countHint, t.strategy].join(' ');
    const nums = (text.match(/\\\\d+/g) || []).map(Number);
    if (nums.includes(a*b)) { leaks++; bad.push(a+'x'+b+'→'+a*b); }
  }
  return JSON.stringify({ leaks, bad });
})()`);
const hc = JSON.parse(hintCheck || '{}');
T('İpucu cevabı sızdırmıyor', hc.leaks === 0, `sızıntı: ${hc.leaks} ${JSON.stringify(hc.bad || [])}`);

/* ---- 3) Profilde ham emoji yerine görsel ---- */
const emojiCheck = await c.evaluate(`(async () => {
  const u = await import('./js/ui.js');
  const html = u.avatarInline('🐸', 22);
  return JSON.stringify({ hasImg: html.includes('<img'), hasClass: html.includes('ava-inline'), hasEmoji: /\\p{Extended_Pictographic}/u.test(html) });
})()`);
const ec = JSON.parse(emojiCheck || '{}');
T('avatarInline görsel üretiyor (emoji değil)', ec.hasImg && ec.hasClass && !ec.hasEmoji, JSON.stringify(ec));

/* Profil oluştur → harita başlığındaki alt satırı kontrol et */
await c.evaluate(`(() => {
  const ni = document.querySelector('input[type="text"]');
  if (ni) { ni.value = 'Zeynep'; ni.dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(250);
await c.clickByText('Maceraya başla', 'button', 1100);
const mapSub = await c.evaluate(`(() => {
  const p = document.querySelector('.map-head p');
  if (!p) return JSON.stringify({found:false});
  const html = p.innerHTML;
  return JSON.stringify({
    found: true,
    hasInlineImg: html.includes('ava-inline'),
    rawEmojiInText: /\\p{Extended_Pictographic}/u.test(p.textContent || ''),
    text: (p.textContent||'').trim()
  });
})()`);
const ms = JSON.parse(mapSub || '{}');
T('Harita başlığı: emoji yerine görsel', ms.found && ms.hasInlineImg && !ms.rawEmojiInText, ms.text || '');

/* ---- 4) TTS yavaş + ipucu paneli ---- */
const ttsCheck = await c.evaluate(`(async () => {
  const a = await import('./js/audio.js');
  return typeof a.speak === 'function';
})()`);
T('speak() mevcut', ttsCheck === true);

// Oyun ekranına gir: ada kartı → ilk bölüm kartı
await c.clickByText('Çayır Adası', 'button', 900);
const entered = await c.evaluate(`(() => {
  // Bölüm kartları: "Bölüm N · ..." içeren butonlar
  const btns = [...document.querySelectorAll('button')];
  const lvl = btns.find(b => /Bölüm\\s+1\\b/.test(b.textContent || ''));
  if (lvl) { lvl.click(); return true; }
  return false;
})()`);
await c.sleep(1600);
console.log('   Bölüme girildi mi:', entered);
// Brifing ekranı → Başla!
await c.clickByText('Başla', 'button', 1600);

await c.sleep(600);
const onGame = await c.evaluate(`(() => JSON.stringify({ q: (document.querySelector('.question')||{}).innerText || '', btns: document.querySelectorAll('.answer-btn').length }))()`);
console.log('   Oyun ekranı:', onGame);

// İpucu butonuna bas → panel metnini al
await c.clickByText('Nasıl düşünmeliyim', 'button', 800);
const hintPanel = await c.evaluate(`(() => {
  const t = document.querySelector('.hint-title');
  const body = document.querySelector('.hint-body');
  const tip = document.querySelector('.hint-tip');
  const q = document.querySelector('.question')?.innerText || '';
  return JSON.stringify({
    hintText: [t?.innerText, body?.innerText, tip?.innerText].filter(Boolean).join(' ').replace(/\\s+/g,' ').trim().slice(0,400),
    question: q.replace(/\\s+/g,' ').trim(),
    options: [...document.querySelectorAll('.answer-btn')].map(b => b.textContent.trim())
  });
})()`);
const hp = JSON.parse(hintPanel || '{}');
console.log('   Soru:', hp.question);
console.log('   Seçenekler:', (hp.options || []).join(', '));
console.log('   İpucu:', hp.hintText);
T('İpucu paneli açıldı ve metin içeriyor', (hp.hintText || '').length > 20, `uzunluk: ${(hp.hintText||'').length}`);

await c.screenshot('test/shots/verify-hint.png');
console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('Ekran:', 'test/shots/verify-hint.png');
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
