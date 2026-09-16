/* PEDAGOJİK DENETİM TESTLERİ
   Çocuk psikolojisi açısından riskli tasarım kararlarını koruma altına alır:
   sıralama baskısı, zaman kaygısı, ödül-only geri bildirim, sınırsız ekran. */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 1000);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2400);
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Pedagog'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2P'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(320);
await c.clickByText('Maceraya başla', 'button', 1800);

/* ---- 1) Varsayılan zorluk KOLAY (süre yok, bol can) ---- */
const varsayilan = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  const M = await import('./js/main.js');
  const W = await import('./js/worlds.js');
  const d = S.defaultSettings();
  const lvl = W.WORLDS[0].levels[0];
  const uygulanan = M.withTimeMode(lvl).cfg;
  return JSON.stringify({ zorluk: d.difficulty, can: uygulanan.lives, sure: uygulanan.time });
})()`) || '{}');
T('Varsayılan zorluk "kolay" (7 yaş için uygun)', varsayilan.zorluk === 'kolay', `zorluk=${varsayilan.zorluk}`);
T('Varsayılanda can bol (5)', varsayilan.can === 5, `can=${varsayilan.can}`);
T('Varsayılanda ZAMAN BASKISI YOK', varsayilan.sure === 0, `süre=${varsayilan.sure} sn`);

/* ---- 2) Zor seçilince zaman baskısı geliyor (isteğe bağlı) ---- */
const zor = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  const M = await import('./js/main.js');
  const W = await import('./js/worlds.js');
  const ayar = JSON.parse(localStorage.getItem('ada.settings.v2') || '{}');
  ayar.difficulty = 'zor';
  localStorage.setItem('ada.settings.v2', JSON.stringify(ayar));
  // modül içi settings'i güncellemek için sayfayı yenilemek gerekir —
  // bunun yerine ZORLUKLAR tablosunu doğrula
  return JSON.stringify({ zorCan: M.ZORLUKLAR.zor.can, zorSure: M.ZORLUKLAR.zor.sure, kolaySure: M.ZORLUKLAR.kolay.sure });
})()`) || '{}');
T('Zor seviyede can az (2) — isteyen için meydan okuma', zor.zorCan === 2, `can=${zor.zorCan}`);
T('Kolay seviyede süre kapalı, Zor\'da sıkı', zor.kolaySure === 'off' && zor.zorSure === 'tight',
  `kolay=${zor.kolaySure} zor=${zor.zorSure}`);

/* ---- 3) SINIF LİSTESİ SIRALAMA YAPMIYOR (özgüven koruması) ---- */
await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  // Farklı puanlarda 4 oyuncu ekle
  const kayit = [
    { nick: 'Zeynep', classCode: '2P', stars: 40, coins: 900, correct: 300, avatar: '🦊' },
    { nick: 'Ahmet',  classCode: '2P', stars: 5,  coins: 30,  correct: 12,  avatar: '🐻' },
    { nick: 'Berrin', classCode: '2P', stars: 22, coins: 400, correct: 120, avatar: '🐰' },
    { nick: 'Can',    classCode: '2P', stars: 1,  coins: 5,   correct: 3,   avatar: '🐼' }
  ];
  localStorage.setItem('ada.board.v2', JSON.stringify(kayit));
  return true;
})()`);
await c.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => /Sınıf/.test(x.textContent||'')); if (b) b.click(); return !!b; })()`);
await c.sleep(1200);

const sinif = JSON.parse(await c.evaluate(`(() => {
  const satirlar = [...document.querySelectorAll('table tbody tr')];
  const isimler = satirlar.map(tr => (tr.children[1]?.innerText || '').trim().split('\\n')[0]);
  return JSON.stringify({
    baslik: document.querySelector('.screen.active h1')?.innerText || '',
    isimSira: isimler,
    siralamaRozeti: document.querySelectorAll('.badge.rank-1, .badge.rank-2, .badge.rank-3').length,
    siralamaKolonu: [...document.querySelectorAll('th')].map(t => t.innerText).includes('#'),
    ozetVar: !!document.querySelector('.board-ozet'),
    altNot: (document.body.innerText.match(/Birlikte öğreniyoruz[^\\n]*/) || [''])[0]
  });
})()`) || '{}');

T('Sınıf ekranı "Sınıfımız" olarak adlandırılmış (yarışma değil)',
  /Sınıfımız/.test(sinif.baslik), `başlık="${sinif.baslik}"`);
T('SIRALAMA ROZETİ YOK (1./2./3. madalya kaldırıldı)', sinif.siralamaRozeti === 0,
  `${sinif.siralamaRozeti} sıralama rozeti bulundu`);
T('Sıralama kolonu (#) yok', sinif.siralamaKolonu === false);
T('Liste alfabetik (puana göre değil)',
  JSON.stringify(sinif.isimSira) === JSON.stringify([...sinif.isimSira].sort((a, b) => a.localeCompare(b, 'tr'))),
  `sıra: ${(sinif.isimSira || []).join(' → ')}`);
T('Toplam emek özeti var (birlikte öğrenme)', sinif.ozetVar === true);
T('Olumlu kapanış mesajı var', /Birlikte öğreniyoruz/.test(sinif.altNot), sinif.altNot?.slice(0, 60));

/* ---- 4) SONUÇ EKRANI "NE ÖĞRENDİN" GÖSTERİYOR ----
   Gerçekten bir bölüm oynayıp sonuç ekranına ulaşıyoruz. */
const baslik = await c.evaluate(`document.querySelector('.screen.active h1')?.innerText || document.querySelector('.panel h1')?.innerText || ''`);

// Haritaya dön → ilk adanın ilk bölümünü oyna
await c.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => /Haritaya dön/.test(x.textContent||'')); if (b) b.click(); return !!b; })()`);
await c.sleep(1200);
await c.evaluate(`(() => { document.querySelectorAll('.world-card')[0].click(); return true; })()`);
await c.sleep(900);
await c.evaluate(`(() => { const n = [...document.querySelectorAll('.level-node')]; if (n[0]) n[0].click(); return true; })()`);
await c.sleep(900);
await c.clickByText('Başla', 'button', 1500);

// 8 soruyu doğru cevapla
for (let i = 0; i < 12; i++) {
  const bitti = await c.evaluate(`document.querySelector('.screen.active')?.dataset.screen === 'result'`);
  if (bitti) break;
  await c.evaluate(`(() => {
    const btns = [...document.querySelectorAll('.answer-btn')].map(b => b.textContent.trim());
    const q = (document.querySelector('.q-mark, .question')?.innerText || '');
    const m = q.match(/(\\d+)\\s*[×x]\\s*(\\d+)/);
    let target = m ? String(Number(m[1]) * Number(m[2])) : btns[0];
    if (!btns.includes(target)) target = btns[0];
    const b = [...document.querySelectorAll('.answer-btn')].find(x => x.textContent.trim() === target);
    if (b) b.click();
  })()`);
  await c.sleep(850);
}

const sonucEkrani = await c.evaluate(`document.querySelector('.screen.active')?.dataset.screen`);
T('Bölüm oynanıp sonuç ekranına ulaşıldı', sonucEkrani === 'result', `ekran=${sonucEkrani}`);

const ogrenme = JSON.parse(await c.evaluate(`(() => {
  const kutu = document.querySelector('.learn-box');
  return JSON.stringify({
    var: !!kutu,
    baslik: document.querySelector('.lb-baslik')?.innerText || '',
    metin: document.querySelector('.lb-metin')?.innerText || '',
    ipucu: document.querySelector('.lb-ipucu')?.innerText || ''
  });
})()`) || '{}');
T('Sonuç ekranında "Ne öğrendin?" kutusu var', ogrenme.var === true, ogrenme.baslik);
T('Öğrenme metni somut (ne çalıştığını söylüyor)', /çalıştın|doğru bildin|soru/i.test(ogrenme.metin || ''),
  ogrenme.metin?.slice(0, 80));
T('İpucu kullanımı hakkında yapıcı geri bildirim var', /ipucu/i.test(ogrenme.ipucu || ''), ogrenme.ipucu?.slice(0, 70));
await c.screenshot('test/shots/pedagoji-sonuc.png');

/* ---- 5) EKRAN SÜRESİ AYARI VAR ---- */
const sure = JSON.parse(await c.evaluate(`(async () => {
  const S = await import('./js/state.js');
  const d = S.defaultSettings();
  return JSON.stringify({ dk: d.gunlukSure, kilit: d.gunlukSureKilit });
})()`) || '{}');
T('Günlük süre ayarı var (varsayılan 30 dk)', sure.dk === 30, `${sure.dk} dk`);
T('Sert kilit VARSAYILAN OLARAK KAPALI (nazik yaklaşım)', sure.kilit === false);

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

await c.screenshot('test/shots/pedagoji.png');
console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
