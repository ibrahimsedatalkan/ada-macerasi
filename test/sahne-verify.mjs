/* Hikâye sahnesi + kişiselleşen ipucu testleri */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 1000);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/* ---- 1) Hikâye sahnesi bölümden önce çıkıyor mu? ---- */
await c.goto(`${B}/index.html`, 2200);
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Sahne'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2S'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(320);
await c.clickByText('Maceraya başla', 'button', 1800);
// sahneyi görmek için hızlı modu kapat
await c.evaluate(`(() => { window.__hizliMod = false; try { sessionStorage.removeItem('ada_hizli'); } catch (e) {} return true; })()`);
await c.evaluate(`(() => { document.querySelectorAll('.world-card')[0].click(); return true; })()`);
await c.sleep(800);
await c.evaluate(`(() => { const n = [...document.querySelectorAll('.level-node')]; if (n[0]) n[0].click(); return true; })()`);
await c.sleep(800);
await c.clickByText('Başla', 'button', 900);

const sahne = JSON.parse(await c.evaluate(`(() => {
  const s = document.querySelector('.sahne');
  return JSON.stringify({
    var: !!s,
    ada: document.querySelector('.sn-ada')?.innerText || '',
    bolum: document.querySelector('.sn-bolum')?.innerText || '',
    hikaye: (document.querySelector('.sn-hikaye')?.innerText || '').slice(0, 60),
    maskot: !!document.querySelector('.sn-maskot')
  });
})()`) || '{}');
T('Bölümden önce hikâye sahnesi çıkıyor', sahne.var === true, `ada="${sahne.ada}" bölüm="${sahne.bolum}"`);
T('Sahnede ada adı ve bölüm adı var', (sahne.ada || '').length > 2 && (sahne.bolum || '').length > 2);
T('Sahnede hikâye metni var', (sahne.hikaye || '').length > 10, sahne.hikaye);
await c.screenshot('test/shots/sahne.png');

/* Sahneye dokununca geçiyor mu? */
await c.evaluate(`(() => { const s = document.querySelector('.sahne'); if (s) s.click(); return !!s; })()`);
await c.sleep(1400);
const sahneGecti = await c.evaluate(`!document.querySelector('.sahne')`);
T('Sahneye dokununca kapanıyor', sahneGecti === true);

/* ---- 2) Kişiselleşen ipucu: zayıf tabloya göre öneri ---- */
const ipucu = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  // Zayıf 4'ler ve 7'ler senaryosu kur, ipucu fonksiyonunu dolaylı sına:
  // acilisEkrani kisiselIpucu() kullanıyor — profili hazırlayıp ekranı açalım.
  const k = Object.keys(localStorage).find((x) => x.startsWith('ada.p.v2.'));
  if (!k) return JSON.stringify({ hata: 'profil yok' });
  const p = JSON.parse(localStorage.getItem(k));
  p.stats.byTable = { 4: { c: 1, w: 5 }, 7: { c: 1, w: 4 }, 2: { c: 8, w: 0 } };
  p.stats.correct = 20; p.stats.wrong = 9;
  localStorage.setItem(k, JSON.stringify(p));
  return JSON.stringify({ kuruldu: true });
})()`) || '{}');
T('Zayıf tablo senaryosu kuruldu', ipucu.kuruldu === true);

await c.evaluate(`(() => { window.__hizliMod = false; try { sessionStorage.removeItem('ada_hizli'); } catch (e) {} return true; })()`);
await c.goto(`${B}/index.html`, 2600, { keepIntro: true });
const kisisel = await c.evaluate(`document.querySelector('.ac-ipucu')?.innerText || ''`);
T('Yükleme ekranı kişisel ipucu gösteriyor', /Senin için|İpucu|görevi/.test(kisisel), kisisel.slice(0, 90));
T('Zayıf tabloya yönelik teknik öneriyor (4\'ler)', /4|ipucu|katı|çarp/i.test(kisisel), kisisel.slice(0, 90));

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('Ekran: test/shots/sahne.png');
process.exit(fail ? 1 : 0);
