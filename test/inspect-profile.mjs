/* Profil diyaloğunu canlı incele: DOM dökümü + ekran görüntüsü */
import { connect } from './cdp.mjs';

const B = 'http://127.0.0.1:8123';
const shot = (n) => `test/shots/inspect-${n}.png`;

const c = await connect();
await c.viewport(1280, 900);
await c.initErrors();
await c.goto(`${B}/index.html`, 2500);

console.log('=== SAYFA YÜKLENDİ ===');
console.log('Hatalar:', await c.errors());

// 1) Form elemanlarını döküm et
const dom = await c.evaluate(`JSON.stringify({
  inputs: [...document.querySelectorAll('input')].map(i => ({id:i.id, name:i.name, type:i.type, ph:i.placeholder, val:i.value})),
  buttons: [...document.querySelectorAll('button')].map(b => ({id:b.id, cls:b.className, txt:(b.textContent||'').trim().slice(0,40)})),
  screens: [...document.querySelectorAll('[data-screen]')].map(s => s.getAttribute('data-screen'))
})`);
console.log('DOM:', dom);

// 2) Profil oluştur
await c.evaluate(`(() => {
  const ni = document.querySelector('input#nick') || document.querySelector('input[type="text"]');
  if (ni) { ni.value = 'TestOyuncu'; ni.dispatchEvent(new Event('input', {bubbles:true})); }
  const ci = document.querySelector('input#code') || [...document.querySelectorAll('input')].find(i => i !== ni);
  if (ci) { ci.value = '2A'; ci.dispatchEvent(new Event('input', {bubbles:true})); }
  return true;
})()`);
await c.sleep(300);
await c.clickByText('Maceraya başla', 'button', 1200);
console.log('Profil oluşturuldu mu → ekran:', await c.evaluate(`document.body.dataset.screen || document.body.dataset.view || '?'`));

// 3) Profil çipine tıkla
const clicked = await c.clickSelector('#hud-profile', 700);
console.log('#hud-profile tıklama:', clicked);

// 4) Diyalog içeriğini döküm et
const dlg = await c.evaluate(`JSON.stringify({
  hidden: document.getElementById('dialog')?.hidden,
  text: (document.getElementById('dialog')?.innerText || '').slice(0, 900),
  html: (document.getElementById('dialog')?.innerHTML || '').slice(0, 1500),
  imgs: [...(document.getElementById('dialog')?.querySelectorAll('img') || [])].map(i => ({src:i.getAttribute('src'), complete:i.complete, nw:i.naturalWidth}))
})`);
console.log('=== PROFİL DİYALOĞU ===');
console.log(dlg);

await c.screenshot(shot('profile-dialog'));
console.log('Ekran görüntüsü:', shot('profile-dialog'));
console.log('Son hatalar:', await c.errors());
process.exit(0);
