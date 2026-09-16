/* KAYIT SINIRI testleri — prism-scan bulgularının regresyon koruması
   ------------------------------------------------------------
   BULUNAN SORUNLAR (prism-scan + davranışsal doğrulama):
     1. recordAnswer  belleği değiştiriyor, KAYDETMİYORDU → bölüm
        ortasında kapanmada byFact/recent/missed uçuyordu (adaptif
        zorluk çocuğun zayıf yerini "unutuyordu")
     2. gorevIlerlet  günlük görev ödülünü + jetonu KAYDETMİYORDU
     3. gunlukGorev   gün sıfırlamasını KAYDETMİYORDU → kademeli hedef
        büyümesi (10→12→15→18→20) temelsiz hesaplanıyordu
     4. write() hatası SESSİZDİ → kota dolduğunda/gizli modda çocuk
        saatlerce oynayıp her şeyi kaybedebiliyordu, kimse fark etmiyordu

   Bu testler düzeltmenin KALICI olduğunu doğrular.                          */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(390, 844);
await c.initErrors();
await c.goto(`${B}/index.html`, 2600);

let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/* ══════════ 1) recordAnswer ARTIK KAYDEDİYOR ══════════ */
const r1 = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  localStorage.clear();
  const p = S.newProfile('KayitTest', '2K', '🦊');
  S.saveProfile(p);
  for (let i = 0; i < 5; i++) S.recordAnswer(p, { correct: true, table: 3, b: 4 });
  const disk = JSON.parse(localStorage.getItem('ada.p.v2.2K.kayittest'));
  return JSON.stringify({
    bellekte: p.stats.correct,
    diskte: disk.stats.correct,
    byFactDiskte: JSON.stringify(disk.stats.byFact)
  });
})()`) || '{}');

T('★ recordAnswer artık DİSKE kaydediyor (bölüm ortası koruması)',
  r1.bellekte === 5 && r1.diskte === 5,
  `bellekte=${r1.bellekte} diskte=${r1.diskte} (önce diskte 0 kalıyordu)`);
T('★ byFact (hangi soruda takıldığı) da kaydediliyor',
  (r1.byFactDiskte || '').includes('3x4'),
  `diskte byFact: ${r1.byFactDiskte}`);

/* ══════════ 2) gorevIlerlet ÖDÜLÜ KAYDEDİYOR ══════════ */
const r2 = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  localStorage.clear();
  const p = S.newProfile('GorevTest', '2K', '🐼');
  S.saveProfile(p);
  let odul = null;
  for (let i = 0; i < 30 && !odul; i++) odul = S.gorevIlerlet(p, 1);
  const disk = JSON.parse(localStorage.getItem('ada.p.v2.2K.gorevtest'));
  return JSON.stringify({
    odulAlindi: !!odul,
    jetonBellekte: p.coins,
    jetonDiskte: disk.coins,
    odulAlindiDiskte: disk.gunluk ? disk.gunluk.odulAlindi : null,
    yapilanDiskte: disk.gunluk ? disk.gunluk.yapilan : null
  });
})()`) || '{}');

T('Günlük görev ödülü alındı', r2.odulAlindi === true, `jeton: ${r2.jetonBellekte}`);
T('★ Ödül jetonları DİSKE kaydedildi',
  r2.jetonDiskte > 0 && r2.jetonDiskte === r2.jetonBellekte,
  `bellekte=${r2.jetonBellekte} diskte=${r2.jetonDiskte} (önce diskte 0 idi)`);
T('★ ödülAlindi bayrağı DİSKE kaydedildi',
  r2.odulAlindiDiskte === true,
  `diskte: ${r2.odulAlindiDiskte} (önce null idi)`);

/* ══════════ 3) gunlukGorev GÜN SIFIRLAMASI KAYDEDİYOR ══════════ */
const r3 = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  localStorage.clear();
  const p = S.newProfile('GunTest', '2K', '🐯');
  p.gunluk = { tarih: '2020-01-01', hedef: 10, yapilan: 10, odulAlindi: true };
  S.saveProfile(p);
  const yeni = S.gunlukGorev(p);
  const disk = JSON.parse(localStorage.getItem('ada.p.v2.2K.guntest'));
  return JSON.stringify({
    yeniTarih: yeni.tarih,
    yeniHedef: yeni.hedef,
    diskteTarih: disk.gunluk ? disk.gunluk.tarih : null,
    diskteHedef: disk.gunluk ? disk.gunluk.hedef : null
  });
})()`) || '{}');

T('★ Gün sıfırlaması DİSKE kaydedildi',
  r3.diskteTarih !== '2020-01-01',
  `diskte: ${r3.diskteTarih} (önce 2020-01-01 kalıyordu)`);
T('★ Kademeli hedef büyümesi çalışıyor (10 → 12)',
  r3.yeniHedef === 12 && r3.diskteHedef === 12,
  `bellekte=${r3.yeniHedef} diskte=${r3.diskteHedef}`);

/* ══════════ 4) KAYIT HATASI ARTIK SESSİZ DEĞİL ══════════ */
const r4 = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  localStorage.clear();
  S.kayitHatasiniTemizle();
  const onceSaglik = S.kayitSagligi();

  const p = S.newProfile('HataTest', '2K', '🐸');
  const gercekSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  S.saveProfile(p);
  localStorage.setItem = gercekSet;

  const sonraSaglik = S.kayitSagligi();

  // kayıt testi (tekrar denenebilir mi?)
  const testSonuc = S.kayitTesti();
  const temizSonra = S.kayitSagligi();

  return JSON.stringify({
    onceSaglikli: onceSaglik.saglikli,
    sonraSaglikli: sonraSaglik.saglikli,
    hataMesaji: sonraSaglik.sonHata ? sonraSaglik.sonHata.mesaj : null,
    hataAnahtari: sonraSaglik.sonHata ? sonraSaglik.sonHata.anahtar : null,
    testGecti: testSonuc,
    temizSonraSaglikli: temizSonra.saglikli
  });
})()`) || '{}');

T('Başlangıçta kayıt sağlıklı', r4.onceSaglikli === true);
T('★ Yazma hatası artık ALGILANIYOR (sessiz değil)',
  r4.sonraSaglikli === false, `sağlıklı=${r4.sonraSaglikli} (önce her zaman true idi)`);
T('★ Hata mesajı ve anahtarı kaydedildi',
  !!r4.hataMesaji && !!r4.hataAnahtari,
  `mesaj=${r4.hataMesaji} anahtar=${r4.hataAnahtari}`);
T('★ kayitTesti() sorunu tespit edip düzelince sağlık geri geliyor',
  r4.testGecti === true && r4.temizSonraSaglikli === true,
  `test=${r4.testGecti} sonraSağlıklı=${r4.temizSonraSaglikli}`);

/* ══════════ 5) VELİ PANELİNDE UYARI GÖRÜNÜYOR ══════════
   NOT: Burada localStorage TEMİZLENMEZ — temizlenirse giriş ekranına
   düşülür ve "Veli Paneli" butonu bulunmaz (ilk denemede böyle oldu).
   Bunun yerine mevcut profille haritaya gidip paneli açıyoruz. */
/* ÖNCEKİ BÖLÜMLER localStorage'ı temizledi → giriş ekranındayız.
   Profil oluşturup haritaya çıkmamız gerek, yoksa "Veli Paneli" olmaz. */
await c.goto(`${B}/index.html`, 2600);
const giris = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  S.kayitHatasiniTemizle();
  const i = document.querySelectorAll('.screen.active input');
  if (i[0]) i[0].value = 'PanelKullanici';
  if (i[1]) i[1].value = '2K';
  const b = [...document.querySelectorAll('button')].find(x => /Maceraya başla/i.test(x.textContent||''));
  if (b) b.click();
  return JSON.stringify({ girdi: !!b, inputSayisi: i.length });
})()`) || '{}');
await c.sleep(1600);
const harita = JSON.parse(await c.evaluate(`(() => JSON.stringify({
  ekran: document.querySelector('.screen.active')?.dataset.screen
}))()`) || '{}');
T('Profil oluşturuldu, haritadayız', harita.ekran === 'map',
  `ekran=${harita.ekran} (giriş: ${giris.girdi} · input: ${giris.inputSayisi})`);

const r5 = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  return JSON.stringify({ saglikli: S.kayitSagligi().saglikli });
})()`) || '{}');
T('Test öncesi kayıt sağlıklı', r5.saglikli === true);

// Panel aç, uyarı OLMAMALI
await c.clickByText('Veli Paneli', 'button', 1000);
const uyariNormal = JSON.parse(await c.evaluate(`(() => JSON.stringify({
  ekran: document.querySelector('.screen.active')?.dataset.screen,
  uyariVar: !!document.querySelector('.kayit-uyari')
}))()`) || '{}');
T('Kayıt sağlıklıyken veli panelinde uyarı YOK',
  uyariNormal.ekran === 'parent' && uyariNormal.uyariVar === false,
  `ekran=${uyariNormal.ekran} uyarı=${uyariNormal.uyariVar}`);

// Kayıt hatası ÜRET (setItem'ı boz)
const r6 = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  const gercekSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  const p = S.newProfile('HataPanel', '2K', '🐧');
  S.saveProfile(p);
  localStorage.setItem = gercekSet;
  return JSON.stringify({ saglikli: S.kayitSagligi().saglikli,
                          hataVar: !!S.kayitSagligi().sonHata });
})()`) || '{}');
T('Kayıt hatası üretildi ve algılandı', r6.saglikli === false && r6.hataVar === true);

// Paneli YENİDEN aç → uyarı GÖRÜNMELİ
await c.evaluate(`(() => { const b=[...document.querySelectorAll('.btn.ghost')].find(x=>/Harita/i.test(x.textContent||'')); if(b) b.click(); return true; })()`);
await c.sleep(900);
await c.clickByText('Veli Paneli', 'button', 1000);
const uyariHatali = JSON.parse(await c.evaluate(`(() => {
  const k = document.querySelector('.kayit-uyari');
  return JSON.stringify({
    ekran: document.querySelector('.screen.active')?.dataset.screen,
    uyariVar: !!k,
    metin: k ? k.innerText.replace(/\s+/g,' ').slice(0, 120) : null
  });
})()`) || '{}');
T('★ Kayıt başarısızken veli paneli UYARI GÖSTERİYOR',
  uyariHatali.uyariVar === true,
  uyariHatali.metin || `uyarı yok (ekran=${uyariHatali.ekran})`);
T('★ Uyarı sebebi ve çözümü açıklıyor (gizli mod / depolama)',
  /gizli|depolama|kaydedilmiyor|kayıt/i.test(uyariHatali.metin || ''),
  (uyariHatali.metin || '').slice(0, 70));

const JS = await c.errors();
const liste = Array.isArray(JS) ? JS : JSON.parse(typeof JS === 'string' && JS.trim() ? JS : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
