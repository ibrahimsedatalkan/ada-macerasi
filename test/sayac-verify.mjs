/* DOKUNARAK SAYMA (manipulatives) testleri
   Pedagojik iddia: 7 yaş somut işlemler dönemindedir; çarpımı GRUP olarak
   görüp parmakla saymak, soyut sembolü kavramayı kolaylaştırır. Bu araç
   cevabı SÖYLEMEZ — çocuk sayarak KEŞFEDER. */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 1000);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/* ---- 1) Araç modülü doğru çalışıyor mu? ---- */
await c.goto(`${B}/index.html`, 2500);
const modul = JSON.parse(await c.evaluate(`(async () => {
  const M = await import('./js/games/manipulatives.js');
  return JSON.stringify({ ac: typeof M.sayaciAc, kapat: typeof M.sayaciKapat });
})()`) || '{}');
T('Manipulatives modülü hazır', modul.ac === 'function' && modul.kapat === 'function');

/* ---- 2) Grup yapısı DOĞRU mu? (3 × 4 → 3 grup, her grupta 4 nokta) ---- */
const yapi = JSON.parse(await c.evaluate(`(async () => {
  const M = await import('./js/games/manipulatives.js');
  const kap = document.createElement('div');
  document.body.append(kap);
  M.sayaciAc({ a: 3, b: 4 }, kap, null);
  await new Promise(r => setTimeout(r, 200));
  const out = {
    grupSayisi: kap.querySelectorAll('.sayac-grup').length,
    grupBasliklari: [...kap.querySelectorAll('.sayac-grup-no')].map(x => x.innerText),
    herGrupta: [...kap.querySelectorAll('.sayac-grup')].map(g => g.querySelectorAll('.sayac-nokta').length),
    toplamNokta: kap.querySelectorAll('.sayac-nokta').length,
    sayac: kap.querySelector('.sayac-sayi')?.innerText,
    ipucu: kap.querySelector('.sayac-ipucu')?.innerText || ''
  };
  M.sayaciKapat(); kap.remove();
  return JSON.stringify(out);
})()`) || '{}');
T('3 × 4 için 3 GRUP oluştu', yapi.grupSayisi === 3, `${yapi.grupSayisi} grup`);
T('Her grupta 4 NOKTA var (grup × üye yapısı)',
  JSON.stringify(yapi.herGrupta) === JSON.stringify([4, 4, 4]), JSON.stringify(yapi.herGrupta));
T('Toplam 12 dokunulabilir nokta', yapi.toplamNokta === 12, `${yapi.toplamNokta} nokta`);
T('Sayaç 0\'dan başlıyor', yapi.sayac === '0', `sayaç="${yapi.sayac}"`);
T('Yönerge grup yapısını anlatıyor', /3 grup.*her grupta 4/i.test(yapi.ipucu), yapi.ipucu);

/* ---- 3) Sayma davranışı: her dokunuş artırıyor mu? ---- */
const sayma = JSON.parse(await c.evaluate(`(async () => {
  const M = await import('./js/games/manipulatives.js');
  const kap = document.createElement('div');
  document.body.append(kap);
  M.sayaciAc({ a: 2, b: 3 }, kap, null);
  await new Promise(r => setTimeout(r, 200));
  const oku = () => kap.querySelector('.sayac-sayi')?.innerText;
  const noktalar = [...kap.querySelectorAll('.sayac-nokta')];
  const adimlar = [oku()];
  noktalar[0].click(); adimlar.push(oku());
  noktalar[1].click(); adimlar.push(oku());
  noktalar[0].click(); adimlar.push(oku());   // AYNI noktaya tekrar → artmamalı
  const isaretli = kap.querySelectorAll('.sayac-nokta.sayildi').length;
  M.sayaciKapat(); kap.remove();
  return JSON.stringify({ adimlar, isaretli });
})()`) || '{}');
T('Her dokunuşta sayaç artıyor', JSON.stringify(sayma.adimlar) === JSON.stringify(['0', '1', '2', '2']),
  sayma.adimlar?.join(' → '));
T('Aynı noktaya tekrar dokunmak saymıyor (çift sayma yok)', sayma.adimlar?.[3] === '2',
  `son değer=${sayma.adimlar?.[3]}`);
T('Dokunulan nokta işaretleniyor', sayma.isaretli === 2, `${sayma.isaretli} işaretli`);

/* ---- 4) Hepsi sayılınca SOYUT cümle çıkıyor mu? (asıl pedagojik an) ---- */
const kesif = JSON.parse(await c.evaluate(`(async () => {
  const M = await import('./js/games/manipulatives.js');
  const kap = document.createElement('div');
  document.body.append(kap);
  let bittiCagrildi = null;
  M.sayaciAc({ a: 2, b: 3 }, kap, (toplam) => { bittiCagrildi = toplam; });
  await new Promise(r => setTimeout(r, 200));
  [...kap.querySelectorAll('.sayac-nokta')].forEach(n => n.click());
  await new Promise(r => setTimeout(r, 2600));   // bitti geri çağrısı 2.2 sn sonra
  const out = {
    sayac: kap.querySelector('.sayac-sayi')?.innerText,
    kesifVar: !!kap.querySelector('.sayac-kesif'),
    satir: kap.querySelector('.sk-satir')?.innerText || '',
    soyut: kap.querySelector('.sk-soyut')?.innerText || '',
    aciklama: kap.querySelector('.sk-aciklama')?.innerText || '',
    bittiCagrildi
  };
  M.sayaciKapat(); kap.remove();
  return JSON.stringify(out);
})()`) || '{}');
T('Tüm noktalar sayılınca sayaç toplamı gösteriyor', kesif.sayac === '6', `sayaç=${kesif.sayac}`);
T('KEŞİF kutusu açıldı (somut→soyut köprüsü)', kesif.kesifVar === true);
T('SOYUT çarpım cümlesi gösteriliyor (2 × 3 = 6)', /2\s*×\s*3\s*=\s*6/.test(kesif.soyut), kesif.soyut);
T('SOMUT açıklama eşlik ediyor (grup × üye = toplam)',
  /2 grup.*her grupta 3.*toplamda 6/i.test(kesif.aciklama), kesif.aciklama);
T('Tamamlanınca geri çağrı tetikleniyor', kesif.bittiCagrildi === 6, `dönen=${kesif.bittiCagrildi}`);

/* ---- 5) Cevabı ŞİKLARDA göstermiyor mu? (keşfetmeli, kopyalamamalı) ---- */
T('Keşif kutusu cevabı yalnız sayma SONRASI gösteriyor',
  kesif.kesifVar === true, 'kutu ancak toplam sayılınca açılıyor');

/* ---- 6) Oyun içinde buton var ve çalışıyor mu? ---- */
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Sayac'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2S'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(320);
await c.clickByText('Maceraya başla', 'button', 1800);
await c.evaluate(`(() => { document.querySelectorAll('.world-card')[0].click(); return true; })()`);
await c.sleep(800);
await c.evaluate(`(() => { const n = [...document.querySelectorAll('.level-node')]; if (n[0]) n[0].click(); return true; })()`);
await c.sleep(800);
await c.clickByText('Başla', 'button', 1500);
await c.sleep(3200);

const oyunda = JSON.parse(await c.evaluate(`(() => JSON.stringify({
  butonVar: !!document.querySelector('.tap-sayac'),
  butonMetin: document.querySelector('.tap-sayac')?.innerText || '',
  panelKapali: !document.querySelector('.sayac-panel')
}))()`) || '{}');
T('Çarpım oyununda "Dokunarak say" butonu var', oyunda.butonVar === true, oyunda.butonMetin);
T('Sayaç paneli başlangıçta KAPALI (ekranı kaplamasın)', oyunda.panelKapali === true);

// Butona bas → panel açılmalı
await c.evaluate(`(() => { const b = document.querySelector('.tap-sayac'); if (b) b.click(); return !!b; })()`);
await c.sleep(600);
const acik = JSON.parse(await c.evaluate(`(() => {
  const p = document.querySelector('.sayac-panel');
  const nokta = p?.querySelectorAll('.sayac-nokta').length || 0;
  const hedef = p?.querySelector('.sayac-nokta')?.getBoundingClientRect();
  return JSON.stringify({
    panelVar: !!p, noktaSayisi: nokta,
    noktaBoyut: hedef ? Math.round(hedef.width) : 0,
    butonMetin: document.querySelector('.tap-sayac')?.innerText || ''
  });
})()`) || '{}');
T('Butona basınca sayaç paneli açılıyor', acik.panelVar === true, `${acik.noktaSayisi} nokta`);
T('Noktalar çocuk parmağı için yeterli büyüklükte (≥40px)', acik.noktaBoyut >= 40,
  `${acik.noktaBoyut}px`);
T('Buton metni "kapat"a dönüyor', /kapat/i.test(acik.butonMetin || ''), acik.butonMetin);
await c.screenshot('test/shots/sayac.png');

/* Kapatma */
await c.evaluate(`(() => { const b = document.querySelector('.tap-sayac'); if (b) b.click(); return !!b; })()`);
await c.sleep(400);
const kapandi = await c.evaluate(`!document.querySelector('.sayac-panel')`);
T('Tekrar basınca sayaç kapanıyor', kapandi === true);

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
