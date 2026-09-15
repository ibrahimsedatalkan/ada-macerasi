import { connect } from './cdp.mjs';
const c = await connect();
await c.send('Log.enable');
await c.viewport(1280, 900);
await c.initErrors();
const errs = async (tag) => {
  const e = await c.evaluate('JSON.stringify(window.__errs||[])');
  if (e && e !== '[]') console.log(`  ⚠️ ${tag} HATA:`, e.slice(0, 400));
  const logs = c.events.filter(x => x.method === 'Log.entryAdded' && x.params.entry.level === 'error');
  if (logs.length) { console.log(`  ⚠️ ${tag} LOG:`, logs.slice(-3).map(x => x.params.entry.text + ' @' + (x.params.entry.url || '')).join(' ; ')); }
};

await c.goto('http://127.0.0.1:8123/index.html', 1600);
await c.evaluate(`(() => { const ins = document.querySelectorAll('[data-screen="login"] input'); ins[0].value='Dbg'; ins[1].value='2B'; })()`);
await c.clickByText('Maceraya başla');
await errs('login');
await c.clickSelector('.world-card');
await c.clickSelector('.level-node');
await c.clickByText('Başla!');
await c.sleep(3400);   // bölüm öncesi geri sayım (3-2-1-BAŞLA)
await errs('level-start');

for (let i = 0; i < 9; i++) {
  const info = JSON.parse(await c.evaluate(`(() => {
    const q = document.querySelector('.question')?.textContent || '';
    const btns = [...document.querySelectorAll('.answer-btn')].map(b => b.textContent.trim());
    const pill = [...document.querySelectorAll('.hint-pill')].map(e=>e.textContent).join(' | ');
    const screen = document.querySelector('.screen.active')?.dataset.screen;
    const lives = document.querySelector('.lives')?.textContent || '';
    return JSON.stringify({ q, btns, pill, screen, lives });
  })()`) || '{}');
  console.log(`tur${i}: screen=${info.screen} q="${info.q}" btn=[${info.btns}] lives="${info.lives}" pill=${(info.pill || '').slice(0, 60)}`);
  if (info.screen !== 'game') break;
  const m = (info.q || '').match(/(\d+)\s*×\s*(\d+)/);
  const target = m ? String(Number(m[1]) * Number(m[2])) : (info.btns || [])[0];
  const clicked = await c.evaluate(`(() => { const b=[...document.querySelectorAll('.answer-btn')].find(x=>x.textContent.trim()===${JSON.stringify(target)}); if(!b) return false; b.click(); return true; })()`);
  console.log('   tıklandı:', target, clicked);
  await c.sleep(900);
  await errs('cevap' + i);
}
console.log('SON EKRAN:', await c.evaluate('document.querySelector(".screen.active")?.dataset.screen'));
await c.screenshot('./test/shots/dbg-multiply.png');

/* Düello */
await c.goto('http://127.0.0.1:8123/index.html', 1500);
await c.clickByText('Düello');
await c.sleep(500);
console.log('DUEL SCREEN:', await c.evaluate('document.querySelector(".screen.active")?.dataset.screen'));
console.log('DUEL BTNS:', await c.evaluate(`[...document.querySelectorAll('[data-screen="duel"] button')].map(b=>b.textContent.trim().slice(0,20)).join(' | ')`));
await errs('duel-setup');
await c.clickByText('Başla!');
await c.sleep(3400);   // bölüm öncesi geri sayım (3-2-1-BAŞLA)
await c.sleep(600);
console.log('DUEL SONRASI:', (await c.evaluate('document.body.textContent') || '').slice(0, 300).replace(/\s+/g, ' '));
await errs('duel-start');
await c.screenshot('./test/shots/dbg-duel.png');
process.exit(0);
