/* Debug: bölüme giriş akışını izle */
import { connect } from './cdp.mjs';
const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 900);
await c.goto(`${B}/index.html`, 2200);

const dump = async (label) => {
  const s = await c.evaluate(`(() => JSON.stringify({
    view: document.body.dataset.screen || document.body.dataset.view || '?',
    dialogHidden: document.getElementById('dialog')?.hidden,
    dialogText: (document.getElementById('dialog')?.innerText || '').replace(/\\s+/g,' ').slice(0,120),
    questions: document.querySelectorAll('.question').length,
    answers: document.querySelectorAll('.answer-btn').length,
    hintBtns: [...document.querySelectorAll('button')].filter(b=>/düşünmeliyim/i.test(b.textContent||'')).length,
    visibleBtns: [...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null).map(b=>(b.textContent||'').trim().slice(0,28)).slice(0,14)
  }))()`);
  console.log(`\n--- ${label} ---`);
  console.log(s);
};

await dump('başlangıç');
await c.clickByText('Çayır Adası', 'button', 900);
await dump('ada açıldı');
await c.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Bölüm\\s+1\\b/.test(x.textContent||'')); if(b) b.click(); return !!b; })()`);
await c.sleep(1800);
await dump('bölüm tıklandı');
process.exit(0);
