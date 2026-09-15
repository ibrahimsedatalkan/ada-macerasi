/* Brifing diyaloğunda ham kod/kırıntı var mı? DOM'u dök */
import { connect } from './cdp.mjs';
const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 980);
await c.goto(`${B}/index.html`, 2200);

await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Kod'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2G'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(350);
await c.clickByText('Maceraya başla', 'button', 1500);

/* Brifing diyaloğunu aç */
await c.evaluate(`(() => { document.querySelectorAll('.world-card')[0].click(); return true; })()`);
await c.sleep(900);
await c.evaluate(`(() => { const n=[...document.querySelectorAll('.level-node')]; if(n[0]) n[0].click(); return n.length; })()`);
await c.sleep(1500);

const dump = await c.evaluate(`(() => {
  const d = document.getElementById('dialog');
  if (!d || d.hidden) return JSON.stringify({ hata: 'diyalog yok' });
  const panel = d.querySelector('.panel') || d;
  // Metin düğümlerini ve innerHTML'i al
  const html = panel.innerHTML;
  // Kullanıcıya görünen metin
  const gorunen = panel.innerText;
  // Şüpheli: HTML etiketi kalıntısı görünen metinde var mı?
  const supheli = /(<|>|svg|path|span|img|class=|d=)/i.test(gorunen);
  // maskot sarmalayıcısı
  const wrap = panel.querySelector('.mascot-wrap');
  const rozet = panel.querySelector('.mascot-badge');
  return JSON.stringify({
    gorunenMetin: gorunen.slice(0, 400),
    supheli,
    wrapVar: !!wrap,
    rozetVar: !!rozet,
    rozetHTML: rozet ? rozet.innerHTML.slice(0, 200) : '(yok)',
    wrapOuterLen: wrap ? wrap.outerHTML.length : 0,
    wrapIc: wrap ? wrap.innerHTML.slice(-160) : ''
  });
})()`);
console.log(dump);

/* Ekran görüntüsü */
await c.screenshot('test/shots/brief-bug.png');
console.log('Ekran: test/shots/brief-bug.png');
console.log('JS hatası:', await c.errors());
process.exit(0);
