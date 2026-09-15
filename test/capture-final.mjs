/* Haritayı tam açık halde ekran görüntüsü al (6 ada + hazine + dükkân) */
import { connect } from './cdp.mjs';
const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 980);
await c.goto(`${B}/index.html`, 2000);

await c.evaluate(`(() => {
  localStorage.clear();
  return true;
})()`);
await c.goto(`${B}/index.html`, 1800);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Zeynep'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2A'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(300);
await c.clickByText('Maceraya başla', 'button', 1300);

// Tüm bölümlere yıldız + hazine + jeton ver (tam ilerleme görünümü)
await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
  const p = JSON.parse(localStorage.getItem(k));
  p.results = {};
  for (const w of W) for (const l of w.levels) p.results[l.id] = { stars: 3, best: 900, plays: 2 };
  p.worldDoneIds = W.map(x => x.id);
  p.treasures = W.map(x => x.id);
  p.coins = 640;
  p.stickers = ['st_first','st_10c','st_streak5','st_t1','st_t2','st_t5','st_shape','st_draw','st_boss','st_50c','st_world1'];
  p.items = ['hat_party','pet_bee','frame_gold'];
  p.equipped = { head: 'hat_party', pet: 'pet_bee' };
  p.streak = { count: 4, best: 6, lastDay: new Date().toISOString().slice(0,10) };
  localStorage.setItem(k, JSON.stringify(p));
  const idx = JSON.parse(localStorage.getItem('ada.index.v2') || '[]');
  if (idx[0]) { idx[0].stars = 102; idx[0].coins = 640; localStorage.setItem('ada.index.v2', JSON.stringify(idx)); }
})()`);
await c.goto(`${B}/index.html`, 2200);
await c.screenshot('test/shots/final-map.png');

// Dükkân (aksesuar takılı halde)
await c.clickByText('Dükkân', 'button', 1200);
await c.screenshot('test/shots/final-shop.png');
await c.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Haritaya dön/.test(x.textContent||'')); if(b) b.click(); return !!b; })()`);
await c.sleep(800);

// Yıldız Adası bölüm listesi
await c.evaluate(`(() => {
  const cards = [...document.querySelectorAll('.world-card')];
  const w6 = cards.find(x => /Yıldız Adası/.test(x.textContent||''));
  if (w6) w6.click();
  return !!w6;
})()`);
await c.sleep(900);
await c.screenshot('test/shots/final-w6.png');

console.log('✅ test/shots/final-map.png, final-shop.png, final-w6.png');
console.log('JS hatası:', await c.errors());
process.exit(0);
