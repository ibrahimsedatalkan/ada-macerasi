/* Koleksiyon/ödül ekonomisi testleri: dükkân, albüm, hazine, seri */
import { connect, result } from './cdp.mjs';

const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 900);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2200);

// Temiz başlangıç: localStorage'ı sil, SAYFAYI YENİLE (login gelsin), sonra profil oluştur
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2200);          // yenile → giriş ekranı
await c.evaluate(`(() => {
  const inputs = [...document.querySelectorAll('input[type="text"]')];
  if (inputs[0]) { inputs[0].value = 'Zeynep'; inputs[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (inputs[1]) { inputs[1].value = '2A'; inputs[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return inputs.length;
})()`);
await c.sleep(350);
await c.clickByText('Maceraya başla', 'button', 1400);

// Profil oluştu mu?
const profExists = await c.evaluate(`(() => Object.keys(localStorage).filter(k => k.startsWith('ada.p.v2.')).length)()`);
console.log('   Oluşan profil sayısı:', profExists);

// Jeton ver (test için)
await c.evaluate(`(() => {
  const k = Object.keys(localStorage).filter(x => x.startsWith('ada.p.v2.'))[0];
  if (!k) return null;
  const p = JSON.parse(localStorage.getItem(k));
  p.coins = 500;
  localStorage.setItem(k, JSON.stringify(p));
  const idx = JSON.parse(localStorage.getItem('ada.index.v2') || '[]');
  if (idx[0]) { idx[0].coins = 500; localStorage.setItem('ada.index.v2', JSON.stringify(idx)); }
  return k;
})()`);
await c.goto(`${B}/index.html`, 2200);

/* ---- 1) Haritada hazine şeridi ---- */
const tStrip = await c.evaluate(`(async () => {
  const C = await import('./js/collect.js');
  return JSON.stringify({
    var: !!document.querySelector('.treasure-strip'),
    slots: document.querySelectorAll('.ts-slot').length,
    beklenen: C.ALL_TREASURES.length,
    label: (document.querySelector('.ts-label')||{}).innerText || ''
  });
})()`);
const ts = JSON.parse(tStrip || '{}');
T('Haritada hazine şeridi var (tüm adalar)', ts.var && ts.slots === ts.beklenen, `${ts.slots} slot / ${ts.beklenen} ada`);

/* ---- 2) Dükkân açılıyor ---- */
await c.clickByText('Dükkân', 'button', 1100);
const shop = await c.evaluate(`(() => JSON.stringify({
  screen: document.body.dataset.view || document.body.dataset.screen,
  items: document.querySelectorAll('.shop-item').length,
  sections: [...document.querySelectorAll('.shop-sec')].map(x=>x.innerText),
  coins: (document.querySelector('.coin-live')||{}).innerText || '',
  preview: !!document.querySelector('.sp-avatar .dress-wrap')
}))()`);
const sh = JSON.parse(shop || '{}');
T('Dükkân açıldı, ürünler listelendi', sh.items >= 8, `${sh.items} ürün — ${(sh.sections||[]).join(' / ')}`);
T('Dükkân önizlemesi var', !!sh.preview, sh.coins);

/* ---- 3) Satın alma çalışıyor ---- */
const beforeCoins = await c.evaluate(`(() => {
  const k = Object.keys(localStorage).filter(x=>x.startsWith('ada.p.v2.'))[0];
  return JSON.parse(localStorage.getItem(k)).coins;
})()`);
// Ucuz bir ürün al: "● 25" yazan ilk buton
await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('.shop-item .btn')].find(x => /●\\s*\\d+/.test(x.textContent||''));
  if (b) b.click();
  return !!b;
})()`);
await c.sleep(900);
const afterBuy = await c.evaluate(`(() => {
  const k = Object.keys(localStorage).filter(x=>x.startsWith('ada.p.v2.'))[0];
  const p = JSON.parse(localStorage.getItem(k));
  return JSON.stringify({ coins: p.coins, items: p.items, equipped: p.equipped, owned: document.querySelectorAll('.shop-item.owned').length });
})()`);
const ab = JSON.parse(afterBuy || '{}');
T('Satın alma jetonu düşürüyor', ab.coins < beforeCoins, `${beforeCoins} → ${ab.coins}`);
T('Satın alınan ürün envantere girdi', (ab.items || []).length >= 1, JSON.stringify(ab.items));
T('Alınan ürün otomatik takıldı', Object.keys(ab.equipped || {}).length >= 1, JSON.stringify(ab.equipped));

/* ---- 4) Albüm açılıyor ---- */
await c.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Haritaya dön/.test(x.textContent||'')); if(b) b.click(); return !!b; })()`);
await c.sleep(800);
await c.clickByText('Albüm', 'button', 1100);
const album = await c.evaluate(`(async () => {
  const C = await import('./js/collect.js');
  return JSON.stringify({
    slots: document.querySelectorAll('.album-slot').length,
    beklenen: C.STICKERS.length,
    has: document.querySelectorAll('.album-slot.has').length,
    title: (document.querySelector('h2')||{}).innerText || ''
  });
})()`);
const al = JSON.parse(album || '{}');
T('Albüm açıldı (tüm çıkartmalar)', al.slots === al.beklenen, `${al.slots} slot / ${al.beklenen} çıkartma`);

/* ---- 5) Günlük seri ---- */
const streak = await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  const k = Object.keys(localStorage).filter(x=>x.startsWith('ada.p.v2.'))[0];
  const p = S.migrate(JSON.parse(localStorage.getItem(k)));
  const a = S.touchDailyStreak(p);
  const b = S.touchDailyStreak(p);   // aynı gün 2. çağrı artmamalı
  return JSON.stringify({ ilk: a, ikinci: b });
})()`);
const st = JSON.parse(streak || '{}');
T('Günlük seri ilk oyunda artıyor', st.ilk && st.ilk.count >= 1, JSON.stringify(st.ilk));
T('Aynı gün tekrar artmıyor', st.ikinci && st.ikinci.artti === false, JSON.stringify(st.ikinci));

/* ---- 6) Çıkartma değerlendirmesi ---- */
const stickerEval = await c.evaluate(`(async () => {
  const C = await import('./js/collect.js');
  const p = { coins: 0, items: [], equipped: {}, stickers: [], results: { 'w1-l1': { plays: 1, stars: 3 } },
    stats: { plays: 1, correct: 12, wrong: 1, byTable: { '2': { c: 9, w: 1 } }, byShape: {}, bestStreak: 6, correctNoHint: 11, drawDone: 0, bossDone: 0 },
    streak: { count: 3, best: 3 } };
  const yeni = C.evaluateStickers(p);
  return JSON.stringify({ kazanilan: yeni.map(s => s.id), toplam: p.stickers.length });
})()`);
const se = JSON.parse(stickerEval || '{}');
T('Çıkartma başarımları çalışıyor', (se.kazanilan || []).length >= 4, `kazanılan: ${(se.kazanilan||[]).join(', ')}`);

/* ---- Ekran görüntüleri ---- */
await c.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Haritaya dön/.test(x.textContent||'')); if(b) b.click(); return !!b; })()`);
await c.sleep(900);
await c.screenshot('test/shots/new-map.png');
await c.clickByText('Dükkân', 'button', 1100);
await c.screenshot('test/shots/new-shop.png');
await c.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Haritaya dön/.test(x.textContent||'')); if(b) b.click(); return !!b; })()`);
await c.sleep(700);
await c.clickByText('Albüm', 'button', 1100);
await c.screenshot('test/shots/new-album.png');

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('Ekranlar: test/shots/new-{map,shop,album}.png');
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
