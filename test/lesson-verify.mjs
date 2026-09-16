/* DERS EKRANI + KİLİT AŞMA + SES testleri
   Kullanıcı şikâyeti: (1) ses hızlı/anlaşılmaz, (2) çocuk konuyu okulda
   görmediği için kilitli bölüme giremiyor, (3) ders anlatımı yok. */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 980);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2200);
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Ders'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2I'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.bekleKosul(`document.querySelector('input[type="text"]')?.value.length > 0`, 3000);
await c.sleep(200);
await c.clickByText('Maceraya başla', 'button', 400);
await c.bekleEkran('map', 9000);
await c.sleep(200);

/* ---- 1) HİÇBİR ŞEY AÇILMAMIŞKEN ders ekranı erişilebilir mi? ---- */
const baslangic = await c.evaluate(`(() => JSON.stringify({
  yildiz: document.querySelectorAll('.world-card.locked').length,
  dersBtn: !!([...document.querySelectorAll('button')].find(b => /Dersler/.test(b.textContent||'')))
}))()`);
const bl = JSON.parse(baslangic || '{}');
T('Başlangıçta adalar kilitli', (bl.yildiz || 0) >= 5, `${bl.yildiz} kilitli ada`);
T('Haritada "Dersler" butonu var', bl.dersBtn === true);

await c.clickByText('Dersler', 'button', 1400);
const dersEkrani = await c.evaluate(`(() => JSON.stringify({
  ekran: document.querySelector('.screen.active')?.dataset.screen || null,
  kart: document.querySelectorAll('.lesson-card').length,
  basliklar: [...document.querySelectorAll('.lesson-card .lc-title')].map(x => x.innerText),
  yeniEtiket: document.querySelectorAll('.lesson-card .lc-state').length
}))()`);
const de = JSON.parse(dersEkrani || '{}');
T('Ders listesi açıldı (kilit gerekmez)', de.ekran === 'lessons', de.ekran);
T('Giriş dersi + 6 şekil dersi var', de.kart === 7, `${de.kart} kart: ${(de.basliklar||[]).join(', ')}`);
T('Her derste durum etiketi var', de.yeniEtiket === 7, `${de.yeniEtiket} etiket`);

/* ---- 2) Slayt görünümü çalışıyor mu? ---- */
await c.evaluate(`(() => { const k=[...document.querySelectorAll('.lesson-card')].find(x=>/Kare/.test(x.textContent||'')); if(k) k.click(); return !!k; })()`);
await c.sleep(1200);
const slayt1 = await c.evaluate(`(() => JSON.stringify({
  ekran: document.querySelector('.screen.active')?.dataset.screen || null,
  nokta: document.querySelectorAll('.lesson-dots .dot').length,
  aktifNokta: document.querySelectorAll('.lesson-dots .dot.on').length,
  baslik: document.querySelector('.lesson-h')?.innerText || '',
  metin: document.querySelector('.lesson-p')?.innerText || '',
  sekilVar: !!document.querySelector('.lesson-shape svg'),
  sesBtn: !!([...document.querySelectorAll('button')].find(b => /Tekrar dinle/.test(b.textContent||'')))
}))()`);
const s1 = JSON.parse(slayt1 || '{}');
T('Slayt görünümü açıldı', s1.ekran === 'lesson', s1.ekran);
T('3 slayt var, ilki aktif', s1.nokta === 3 && s1.aktifNokta === 1, `${s1.nokta} nokta / ${s1.aktifNokta} aktif`);
T('Slayt başlığı ve metni görünüyor', (s1.baslik || '').length > 3 && (s1.metin || '').length > 20, `${s1.baslik} — ${(s1.metin||'').slice(0,50)}…`);
T('Şekil görseli büyük çizildi', s1.sekilVar === true);
T('"Tekrar dinle" butonu var', s1.sesBtn === true);

/* İleri git */
await c.clickByText('İleri', 'button', 900);
const slayt2 = await c.evaluate(`(() => JSON.stringify({
  baslik: document.querySelector('.lesson-h')?.innerText || '',
  aktif: [...document.querySelectorAll('.lesson-dots .dot')].findIndex(x => x.classList.contains('on'))
}))()`);
const s2 = JSON.parse(slayt2 || '{}');
T('İleri butonu slayt değiştiriyor', s2.aktif === 1, `aktif slayt: ${s2.aktif + 1} — ${s2.baslik}`);

await c.clickByText('İleri', 'button', 900);
const sonSlayt = await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Şimdi dene/.test(x.textContent||''));
  return JSON.stringify({ btnVar: !!b, metin: b?.textContent || '' });
})()`);
const ss = JSON.parse(sonSlayt || '{}');
T('Son slaytta "Şimdi dene!" butonu çıkıyor', ss.btnVar === true, ss.metin);

/* ---- 3) "Şimdi dene" KİLİDİ AŞIP alıştırmayı açıyor mu? ---- */
await c.clickByText('Şimdi dene', 'button', 2600);
const alistirma = await c.evaluate(`(() => JSON.stringify({
  ekran: document.querySelector('.screen.active')?.dataset.screen || null,
  canvas: !!document.querySelector('.draw-stage canvas'),
  howTo: (document.querySelector('.how-to')?.innerText || '').slice(0, 40)
}))()`);
const al = JSON.parse(alistirma || '{}');
T('Ders sonrası alıştırma AÇILDI (kilit aşıldı)', al.ekran === 'game' && al.canvas,
  `ekran=${al.ekran} canvas=${al.canvas}`);

/* Ders görüldü işaretlendi mi? */
const goruldu = await c.evaluate(`(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
  const p = JSON.parse(localStorage.getItem(k));
  return JSON.stringify(p.lessonsSeen || []);
})()`);
const gr = JSON.parse(goruldu || '[]');
T('Ders "görüldü" olarak kaydedildi', gr.includes('ders-kare'), gr.join(', ') || 'boş');

/* ---- 4) SERBEST MOD kilidi açıyor mu? ---- */
await c.goto(`${B}/index.html`, 2000);
const onceKilit = await c.evaluate(`document.querySelectorAll('.world-card.locked').length`);
await c.clickByText('Veli Paneli', 'button', 1400);
const smBtn = await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Serbest Mod/.test(x.textContent||''));
  if (b) b.click();
  return !!b;
})()`);
await c.sleep(600);
T('Veli panelinde Serbest Mod anahtarı var', smBtn === true);
await c.goto(`${B}/index.html`, 2000);
const sonraKilit = await c.evaluate(`document.querySelectorAll('.world-card.locked').length`);
T('Serbest Mod açılınca tüm adalar açıldı', onceKilit > 0 && sonraKilit === 0,
  `önce ${onceKilit} kilitli → sonra ${sonraKilit}`);

/* Serbest mod kapalıyken tekrar kilitli mi? */
await c.clickByText('Veli Paneli', 'button', 1400);
await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Serbest Mod/.test(x.textContent||''));
  if (b) b.click();
  return !!b;
})()`);
await c.sleep(600);
await c.goto(`${B}/index.html`, 2000);
const geriKilit = await c.evaluate(`document.querySelectorAll('.world-card.locked').length`);
T('Serbest Mod kapanınca kilit geri geliyor', geriKilit > 0, `${geriKilit} kilitli ada`);

/* ---- 5) SES: yavaşladı mı + cümlelere bölünüyor mu? ---- */
const ses = await c.evaluate(`(async () => {
  const A = await import('./js/audio.js');
  const src = await (await fetch('js/audio.js')).text();
  // Varsayılan rate değerini kaynaktan doğrula
  const m = /speechRate\\s*=\\s*(0\\.\\d+)/.exec(src);
  const varsayilanRate = m ? Number(m[1]) : null;
  // Cümle bölme fonksiyonu çalışıyor mu? speak() çağrısını yakalayalım
  const soylenen = [];
  const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
  window.speechSynthesis.speak = (u) => { soylenen.push({ text: u.text, rate: u.rate }); };
  A.speak('Karenin dört kenarı vardır. Hepsi eşittir. Dört köşesi vardır.', { force: true, key: 'test-' + Date.now() });
  await new Promise(r => setTimeout(r, 120));
  window.speechSynthesis.speak = orig;
  return JSON.stringify({ varsayilanRate, parcaSayisi: soylenen.length, ornek: soylenen.map(x => x.text), rate: soylenen[0]?.rate });
})()`);
const se = JSON.parse(ses || '{}');
T('Varsayılan konuşma hızı dengeli (0.70–0.78)', (se.varsayilanRate || 1) >= 0.70 && (se.varsayilanRate || 1) <= 0.80, `rate=${se.varsayilanRate}`);
T('Uzun metin cümlelere bölünerek okunuyor', (se.parcaSayisi || 0) >= 3,
  `${se.parcaSayisi} parça: ${JSON.stringify(se.ornek)}`);
T('Konuşma hızı uygulanıyor (0.70–0.78)', (se.rate || 1) >= 0.70 && (se.rate || 1) <= 0.80, `uygulanan rate=${se.rate}`);


/* ---- 6) KONUŞMA HIZI AYARI (veli paneli) ---- */
const hiz = await c.evaluate(`(async () => {
  const A = await import('./js/audio.js');
  const onceki = A.getSpeechRate();
  A.setSpeechRate(0.9);
  const sonra = A.getSpeechRate();
  A.setSpeechRate(0.3);          // sınır testi: alt sınır 0.45
  const altSinir = A.getSpeechRate();
  A.setSpeechRate(5);            // üst sınır 1.3
  const ustSinir = A.getSpeechRate();
  A.setSpeechRate(onceki);
  return JSON.stringify({ onceki, sonra, altSinir, ustSinir, geri: A.getSpeechRate() });
})()`);
const hz = JSON.parse(hiz || '{}');
T('Hız ayarlanabiliyor', hz.sonra === 0.9, `${hz.onceki} → ${hz.sonra}`);
T('Hız alt sınırı korunuyor (0.45)', hz.altSinir === 0.45, `0.3 verildi → ${hz.altSinir}`);
T('Hız üst sınırı korunuyor (1.3)', hz.ustSinir === 1.3, `5 verildi → ${hz.ustSinir}`);

await c.goto(`${B}/index.html`, 2000);
await c.clickByText('Veli Paneli', 'button', 1400);
const hizUI = await c.evaluate(`(() => {
  const kutular = [...document.querySelectorAll('.advice-box')];
  const k = kutular.find(x => /Konuşma hızı/.test(x.textContent||''));
  if (!k) return JSON.stringify({ var: false });
  return JSON.stringify({
    var: true,
    butonlar: [...k.querySelectorAll('button')].map(b => b.textContent.trim()),
    secili: [...k.querySelectorAll('button.green')].map(b => b.textContent.trim())
  });
})()`);
const hu = JSON.parse(hizUI || '{}');
T('Veli panelinde konuşma hızı ayarı var', hu.var === true, (hu.butonlar||[]).join(' / '));
T('Hız seçenekleri sunuluyor', (hu.butonlar || []).length >= 4, (hu.butonlar||[]).join(' / '));
T('"Dene" butonu var (kulakla karşılaştırma)', (hu.butonlar||[]).some(b => /dene/i.test(b)), (hu.butonlar||[]).join(' / '));

await c.screenshot('test/shots/lesson-final.png');
console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('Ekran: test/shots/lesson-final.png');
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
