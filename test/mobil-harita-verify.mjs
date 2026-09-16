/* MOBİL HARİTA ERİŞİLEBİLİRLİK testleri
   KULLANICI BİLDİRDİ: telefonda adalar ekranın en altında kalıyor ve
   seçilemiyordu. Kök neden ÜÇ katmanlıydı:
     1) .world-card içeriği 166px iken 90px'e kırpılıyordu (sabit height)
     2) .map-grid KENDİ İÇİNDE kaydırıyordu (iç içe kaydırma)
     3) .screen bu yüzden kaydıramıyordu → 7 adanın 6'sı erişilemezdi
   Bu test o hatanın geri gelmesini engeller. */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/** Belirtilen ölçüde haritayı aç ve ölçümleri döndür */
async function haritaOlc(g, y) {
  await c.viewport(g, y);
  await c.goto(`${B}/index.html`, 2400);
  await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
  await c.goto(`${B}/index.html`, 2000);
  await c.evaluate(`(() => {
    const i = [...document.querySelectorAll('input[type="text"]')];
    if (i[0]) { i[0].value = 'Harita'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
    if (i[1]) { i[1].value = '2H'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
    return true;
  })()`);
  await c.sleep(300);
  await c.clickByText('Maceraya başla', 'button', 500);
  await c.bekleEkran('map', 9000);
  await c.sleep(700);
  await c.evaluate(`(() => { const d=document.getElementById('dialog'); if(d && !d.hidden){const b=[...d.querySelectorAll('button')].find(x=>/Kolay/i.test(x.textContent||'')); if(b) b.click();} return true; })()`);
  await c.sleep(900);

  return JSON.parse(await c.evaluate(`(() => {
    const ekran = document.querySelector('.screen.active');
    const kartlar = [...document.querySelectorAll('.world-card')];
    const grid = document.querySelector('.map-grid');
    const bs = [...document.querySelectorAll('.map-head .btn')];
    const satirlar = {};
    bs.forEach((b) => { const t = Math.round(b.getBoundingClientRect().top); satirlar[t] = (satirlar[t] || 0) + 1; });
    const kirpilan = kartlar.filter((k) => k.scrollHeight > k.clientHeight + 4).length;
    const ilk = kartlar[0]?.getBoundingClientRect();
    const son = kartlar[kartlar.length - 1]?.getBoundingClientRect();
    return JSON.stringify({
      pencere: window.innerHeight,
      ekranScrollH: ekran?.scrollHeight,
      ekranClientH: ekran?.clientHeight,
      ekranKaydirilabilir: (ekran?.scrollHeight || 0) > (ekran?.clientHeight || 0) + 4,
      icKaydirmaVar: grid ? (grid.scrollHeight > grid.clientHeight + 4) : false,
      kartSayisi: kartlar.length,
      kirpilanKart: kirpilan,
      ilkAdaUst: ilk ? Math.round(ilk.top) : null,
      kaydirmadanGorunen: kartlar.filter((k) => { const r = k.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; }).length,
      butonSatirlari: Object.values(satirlar),
      sonAdaVar: !!son
    });
  })()`) || '{}');
}

/* ============ A) TELEFON (390×844) ============ */
const tel = await haritaOlc(390, 844);
T('Telefon: ada listesi kaydırılabilir (ekran scrollHeight > clientHeight)',
  tel.ekranKaydirilabilir === true, `${tel.ekranScrollH} / ${tel.ekranClientH}`);
T('Telefon: grid İÇİNDE kaydırma yok (iç içe kaydırma kaldırıldı)',
  tel.icKaydirmaVar === false, `iç kaydırma=${tel.icKaydirmaVar}`);
T('Telefon: ada kartları kırpılmıyor (içerik tam görünür)',
  tel.kirpilanKart === 0, `${tel.kirpilanKart}/${tel.kartSayisi} kırpılmış`);
T('Telefon: 7 ada var', tel.kartSayisi === 7, `${tel.kartSayisi} ada`);
T('Telefon: butonlar 3 sütunlu ızgara (3 satır)',
  JSON.stringify(tel.butonSatirlari) === JSON.stringify([3, 3, 3]),
  JSON.stringify(tel.butonSatirlari));
T('Telefon: en az 1 ada KAYDIRMADAN görünüyor (asıl şikâyet)',
  tel.kaydirmadanGorunen >= 1, `${tel.kaydirmadanGorunen} ada görünür`);
T('Telefon: ilk ada ekranın üst yarısında başlıyor',
  (tel.ilkAdaUst ?? 9999) < 520, `ilk ada y=${tel.ilkAdaUst}px`);
await c.screenshot('test/shots/mobil-harita-test.png');

/* ============ B) SON ADA GERÇEKTEN ERİŞİLEBİLİR Mİ? ============ */
const erisim = JSON.parse(await c.evaluate(`(() => {
  const ekran = document.querySelector('.screen.active');
  ekran.scrollTop = 999999;
  const kartlar = [...document.querySelectorAll('.world-card')];
  const son = kartlar[kartlar.length - 1];
  const r = son.getBoundingClientRect();
  const merkez = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return JSON.stringify({
    kaydirmaMiktari: Math.round(ekran.scrollTop),
    sonAdaGorunur: r.top < window.innerHeight && r.bottom > 0,
    sonAdaTiklanabilir: !!(merkez && (merkez.closest('.world-card') || merkez.classList?.contains('world-card'))),
    engelleyen: merkez ? (merkez.tagName + '.' + (merkez.className || '').split(' ')[0]) : null
  });
})()`) || '{}');
T('Son adaya kaydırılabiliyor', erisim.kaydirmaMiktari > 100, `${erisim.kaydirmaMiktari}px kaydı`);
T('Son ada görünür hâle geliyor', erisim.sonAdaGorunur === true);
T('Son ada GERÇEKTEN tıklanabilir (üstünde engel yok)',
  erisim.sonAdaTiklanabilir === true, `engelleyen=${erisim.engelleyen || 'yok'}`);

/* ============ C) KÜÇÜK TELEFON (360×640) ============ */
const kucuk = await haritaOlc(360, 640);
T('Küçük telefon: kaydırılabilir', kucuk.ekranKaydirilabilir === true);
T('Küçük telefon: kart kırpılmıyor', kucuk.kirpilanKart === 0, `${kucuk.kirpilanKart} kırpılmış`);
T('Küçük telefon: ada görünüyor', kucuk.kaydirmadanGorunen >= 1, `${kucuk.kaydirmadanGorunen} ada`);

/* ============ D) TABLET (768×1024) — düzen bozulmamış ============ */
const tablet = await haritaOlc(768, 1024);
T('Tablet: kaydırılabilir', tablet.ekranKaydirilabilir === true);
T('Tablet: kart kırpılmıyor', tablet.kirpilanKart === 0);
T('Tablet: adalar görünüyor', tablet.kaydirmadanGorunen >= 2, `${tablet.kaydirmadanGorunen} ada`);

/* ============ E) MASAÜSTÜ (1280×900) — regresyon yok ============ */
const masa = await haritaOlc(1280, 900);
T('Masaüstü: 7 ada var', masa.kartSayisi === 7, `${masa.kartSayisi} ada`);
T('Masaüstü: kart kırpılmıyor', masa.kirpilanKart === 0);
T('Masaüstü: adalar görünüyor (en az 2)', masa.kaydirmadanGorunen >= 2, `${masa.kaydirmadanGorunen} ada`);

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
