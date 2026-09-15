/* Zorluk seçimi + karakter animasyonu doğrulaması */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 1000);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2200);
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Zorluk'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2A'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(300);
// İlk-oyun zorluk diyaloğunu test edeceğiz → hızlı modu KAPAT
await c.evaluate(`(() => { window.__hizliMod = false; try { sessionStorage.removeItem('ada_hizli'); } catch (e) {} return true; })()`);
await c.clickByText('Maceraya başla', 'button', 1800);
await c.sleep(3200);

/* ---- 1) İlk oyunda zorluk seçimi açılıyor mu? ---- */
const z1 = JSON.parse(await c.evaluate(`(() => JSON.stringify({
  dialog: !document.getElementById('dialog').hidden,
  kartlar: document.querySelectorAll('.zorluk-kart').length,
  adlar: [...document.querySelectorAll('.zk-ad')].map(x => x.innerText),
  secili: document.querySelector('.zorluk-kart.secili .zk-ad')?.innerText || null
}))()`) || '{}');
T('İlk oyunda zorluk seçimi açıldı', z1.dialog === true && z1.kartlar === 3,
  `${z1.kartlar} kart: ${(z1.adlar || []).join(', ')} | seçili: ${z1.secili}`);

/* ---- 2) "Kolay" seçilince can sayısı 5 oluyor mu? ---- */
await c.clickByText('Kolay', 'button', 1400);
const k = JSON.parse(await c.evaluate(`(async () => {
  const M = await import('./js/main.js');
  const W = await import('./js/worlds.js');
  const lvl = W.WORLDS[0].levels[0];
  return JSON.stringify({ can: M.withTimeMode(lvl).cfg.lives, sure: M.withTimeMode(lvl).cfg.time });
})()`) || '{}');
T('Kolay seçilince can 5 ve süre kapalı', k.can === 5 && k.sure === 0, `can=${k.can} süre=${k.sure}`);

/* ---- 3) "Zor" seçilince can 2 ---- */
const chipAcildi = await c.evaluate(`(() => {
  const b = document.querySelector('.zorluk-chip');
  if (!b) return JSON.stringify({ chip: false });
  b.click();
  return JSON.stringify({ chip: true, dialog: !document.getElementById('dialog').hidden });
})()`);
console.log('   rozet tıklaması:', chipAcildi);
await c.sleep(800);
const kartSec = await c.evaluate(`(() => {
  const kart = [...document.querySelectorAll('.zorluk-kart')]
    .find(x => /^Zor$/.test((x.querySelector('.zk-ad')?.innerText || '').trim()));
  if (!kart) return JSON.stringify({ bulundu: false, kartSayisi: document.querySelectorAll('.zorluk-kart').length });
  kart.click();
  return JSON.stringify({ bulundu: true });
})()`);
console.log('   Zor kartı:', kartSec);
await c.sleep(900);
const z = JSON.parse(await c.evaluate(`(async () => {
  const M = await import('./js/main.js');
  const W = await import('./js/worlds.js');
  const lvl = W.WORLDS[0].levels[0];
  return JSON.stringify({ can: M.withTimeMode(lvl).cfg.lives });
})()`) || '{}');
T('Zor seçilince can 2', z.can === 2, `can=${z.can}`);

/* ---- 4) Haritada zorluk rozeti var ve doğru yazıyor ---- */
await c.evaluate(`(() => { const b = document.querySelector('.zorluk-chip'); if (b) b.click(); return !!b; })()`);
await c.sleep(600);
await c.clickByText('Normal', 'button', 1400);
const rozet = await c.evaluate(`document.querySelector('.zorluk-chip')?.innerText?.replace(/\\s+/g,' ') || ''`);
T('Haritada zorluk rozeti var', /Normal/.test(rozet), rozet);

/* ---- 5) Karakter animasyonu: fonksiyonlar ve sınıf ---- */
const anim = JSON.parse(await c.evaluate(`(async () => {
  const U = await import('./js/ui.js');
  const hud = document.getElementById('hud-avatar');
  return JSON.stringify({
    canlandir: typeof U.canlandir, sevin: typeof U.avatarSevin,
    uzul: typeof U.avatarUzul, maskot: typeof U.maskotCanlandir,
    hudCanli: hud ? hud.classList.contains('canli') : false
  });
})()`) || '{}');
T('Animasyon fonksiyonları var', anim.canlandir === 'function' && anim.sevin === 'function' && anim.maskot === 'function',
  `sevin=${anim.sevin} uzul=${anim.uzul} maskot=${anim.maskot}`);
T('HUD avatarı canlı (nefes alıyor)', anim.hudCanli === true);

/* ---- 6) Doğru cevapta avatar seviniyor mu? (sınıf ekleniyor mu) ---- */
const tepki = await c.evaluate(`(async () => {
  const U = await import('./js/ui.js');
  const hud = document.getElementById('hud-avatar');
  U.avatarSevin(hud, 1);
  const anlik = hud.classList.contains('an-sevinc');
  U.avatarUzul(hud);
  const uzul = hud.classList.contains('an-uzuntu');
  return JSON.stringify({ sevinc: anlik, uzuntu: uzul });
})()`);
const tp = JSON.parse(tepki || '{}');
T('Doğru cevapta sevinç animasyonu ekleniyor', tp.sevinc === true);
T('Yanlış cevapta üzüntü animasyonu ekleniyor', tp.uzuntu === true);

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

await c.screenshot('test/shots/zorluk.png');
console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
