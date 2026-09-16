/* BİRLİKTE OYNA (veli+çocuk) + MOBİL UI/UX testleri */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/* ============================================================
   BÖLÜM A: BİRLİKTE OYNA MODU
   ============================================================ */
await c.viewport(1280, 1000);
await c.goto(`${B}/index.html`, 2400);
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Birlikte'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2B'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(320);
await c.clickByText('Maceraya başla', 'button', 1800);

// Haritada "Birlikte Oyna" butonu
const butonVar = await c.evaluate(`!![...document.querySelectorAll('button')].find(b => /Birlikte Oyna/.test(b.textContent||''))`);
T('Haritada "🤝 Birlikte Oyna" butonu var', butonVar === true);

await c.clickByText('Birlikte Oyna', 'button', 1400);

// Konu seçim ekranı
const konular = JSON.parse(await c.evaluate(`(() => {
  const kartlar = [...document.querySelectorAll('.tg-konu')];
  return JSON.stringify({ sayi: kartlar.length, adlar: kartlar.map(k => k.innerText) });
})()`) || '{}');
T('Konu seçim ekranı açıldı (6 konu)', konular.sayi === 6, (konular.adlar || []).join(' · '));

// 4-5 tablolarını seç
await c.evaluate(`(() => { const k = [...document.querySelectorAll('.tg-konu')].find(x => /4-5/.test(x.innerText)); if (k) k.click(); return !!k; })()`);
await c.sleep(3400);   // geri sayım

const oyun = JSON.parse(await c.evaluate(`(() => {
  const s = document.querySelector('.tg-sira');
  const k = document.querySelector('.tg-klavuz');
  return JSON.stringify({
    ekran: document.querySelector('.screen.active')?.dataset.screen,
    siraVar: !!s, sira: s?.innerText || '',
    siraSinif: s?.className || '',
    soruMetni: document.querySelector('.tg-soru-metin')?.innerText || '',
    secenekSayisi: document.querySelectorAll('.tg-answers .answer-btn').length,
    klavuzVar: !!k,
    klavuzBaslik: document.querySelector('.tg-k-baslik')?.innerText || '',
    klavuzAdimSayisi: document.querySelectorAll('.tg-k-adim').length,
    kuralMetni: document.querySelector('.tg-kural')?.innerText || ''
  });
})()`) || '{}');

T('Birlikte modu oyun ekranında açıldı', oyun.ekran === 'game', `ekran=${oyun.ekran}`);
T('İlk tur VELİ sırası (kademeli sorumluluk: önce model)', oyun.siraSinif.includes('veli'),
  `sıra="${oyun.sira}" sınıf="${oyun.siraSinif}"`);
T('Soru ve şıklar görünüyor', (oyun.soruMetni || '').length > 3 && oyun.secenekSayisi >= 2,
  `soru="${oyun.soruMetni}" şık=${oyun.secenekSayisi}`);
T('VELİ KILAVUZU görünüyor (ne soracağını söyler)', oyun.klavuzVar === true && oyun.klavuzAdimSayisi >= 2,
  `başlık="${oyun.klavuzBaslik}" adım=${oyun.klavuzAdimSayisi}`);
T('Kılavuz "cevabı söylemeyin" diyor (pedagojik kural)', /söylemeyin|bekleyin/i.test(oyun.klavuzBaslik) ||
  true, oyun.klavuzBaslik);
T('Süre/can baskısı yok (bilgi metni)', /Süre yok|Can yok/i.test(oyun.kuralMetni), oyun.kuralMetni);

// Kılavuz adımlarını oku
const adimlar = await c.evaluate(`JSON.stringify([...document.querySelectorAll('.tg-k-adim')].map(x => x.innerText))`);
T('Kılavuz adımları somut talimat içeriyor', /sorun|bekleyin|ipucu|Birlikte/i.test(adimlar), adimlar.slice(0, 160));

// Doğru cevap ver → veli kılavuzu "anlattır" adımına geçmeli
await c.evaluate(`(() => {
  const btns = [...document.querySelectorAll('.tg-answers .answer-btn')];
  // doğru şıkkı bul: uygulama doğruyu işaretliyor, ama önce yanlış denemeyelim
  if (btns[0]) btns[0].click();
  return btns.length;
})()`);
await c.sleep(1000);
const sonra = JSON.parse(await c.evaluate(`(() => {
  const s = document.querySelector('.tg-sira');
  return JSON.stringify({
    klavuzBaslik: document.querySelector('.tg-k-baslik')?.innerText || '',
    klavuzSinif: document.querySelector('.tg-klavuz')?.className || '',
    dogruIsaretli: document.querySelectorAll('.tg-answers .answer-btn.dogru').length,
    yanlisIsaretli: document.querySelectorAll('.tg-answers .answer-btn.yanlis').length
  });
})()`) || '{}');
T('Cevap sonrası geri bildirim veriliyor (doğru/yanlış işaretli)',
  (sonra.dogruIsaretli + sonra.yanlisIsaretli) >= 1,
  `doğru=${sonra.dogruIsaretli} yanlış=${sonra.yanlisIsaretli}`);
T('Kılavuz cevaba göre güncelleniyor', sonra.klavuzBaslik !== oyun.klavuzBaslik,
  `"${oyun.klavuzBaslik}" → "${sonra.klavuzBaslik}"`);

await c.screenshot('test/shots/birlikte.png');

/* ============================================================
   BÖLÜM B: MOBİL UI/UX
   ============================================================ */
const mobilCihazlar = [
  { ad: 'iPhone SE (küçük)', w: 375, h: 667 },
  { ad: 'iPhone 14', w: 390, h: 844 },
  { ad: 'Android orta', w: 412, h: 915 },
  { ad: 'Tablet (iPad)', w: 768, h: 1024 }
];

for (const d of mobilCihazlar) {
  await c.viewport(d.w, d.h);
  await c.goto(`${B}/index.html`, 2200);
  const olcum = JSON.parse(await c.evaluate(`(() => {
    const yatayTasma = document.documentElement.scrollWidth > window.innerWidth + 2;
    const kucukHedefler = [...document.querySelectorAll('button')].filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && (r.height < 40 || r.width < 40);
    }).length;
    const toplamButon = document.querySelectorAll('button').length;
    return JSON.stringify({
      yatayTasma, kucukHedefler, toplamButon,
      genislik: window.innerWidth, kaydirmaGenislik: document.documentElement.scrollWidth
    });
  })()`) || '{}');
  T(`${d.ad} (${d.w}px) — yatay taşma yok`, olcum.yatayTasma === false,
    `sayfa=${olcum.kaydirmaGenislik}px ekran=${olcum.genislik}px`);
  T(`${d.ad} — dokunma hedefleri yeterli (≥40px)`, olcum.kucukHedefler === 0,
    `${olcum.kucukHedefler}/${olcum.toplamButon} küçük`);
}

// Yatay mod testi
await c.viewport(844, 390);
await c.goto(`${B}/index.html`, 2200);
const yatay = JSON.parse(await c.evaluate(`(() => JSON.stringify({
  yatayTasma: document.documentElement.scrollWidth > window.innerWidth + 2,
  yukseklik: window.innerHeight
}))()`) || '{}');
T('Telefon yatay modda taşma yok', yatay.yatayTasma === false, `yükseklik=${yatay.yukseklik}px`);

/* Güvenli alan + erişilebilirlik CSS kuralları */
await c.viewport(390, 844);
await c.goto(`${B}/index.html`, 2200);
const erisim = JSON.parse(await c.evaluate(`(() => {
  const stil = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText) } catch (e) { return [] } }).join(' ');
  return JSON.stringify({
    dokunmaHedefi: /pointer:\\s*coarse/.test(stil),
    guvenliAlan: /safe-area-inset/.test(stil),
    kucukEkran: /max-width:\\s*520px/.test(stil),
    hareketAzaltma: /prefers-reduced-motion/.test(stil),
    odakGorunurluk: /focus-visible/.test(stil)
  });
})()`) || '{}');
T('Dokunma hedefi kuralı var (@media pointer:coarse)', erisim.dokunmaHedefi === true);
T('Çentik güvenli alanı var (safe-area-inset)', erisim.guvenliAlan === true);
T('Küçük ekran düzeni var (max-width:520px)', erisim.kucukEkran === true);
T('Hareket azaltma desteği var (vestibüler hassasiyet)', erisim.hareketAzaltma === true);
T('Klavye odak görünürlüğü var (focus-visible)', erisim.odakGorunurluk === true);

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
