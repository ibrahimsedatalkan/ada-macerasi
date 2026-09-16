/* Aile ayarları testleri: zaman baskısı (kapalı/normal/sıkı) + büyük yazı */
import { connect, result } from './cdp.mjs';

const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 980);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/** Belirli bir bölümü başlat (id ile) */
async function bolumBaslat(levelId) {
  await c.goto(`${B}/index.html`, 1800);
  await c.evaluate(`(async () => {
    const W = (await import('./js/worlds.js')).WORLDS;
    for (const w of W) for (const l of w.levels) l.__unlocked = true;
    return true;
  })()`);
  // Tüm kilitleri aç
  await c.evaluate(`(async () => {
    const W = (await import('./js/worlds.js')).WORLDS;
    const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
    const p = JSON.parse(localStorage.getItem(k));
    p.results = p.results || {};
    for (const w of W) for (const l of w.levels) p.results[l.id] = p.results[l.id] || { stars: 3, best: 500, plays: 1 };
    localStorage.setItem(k, JSON.stringify(p));
  })()`);
  await c.goto(`${B}/index.html`, 1900);
  await c.evaluate(`(async () => {
    const W = (await import('./js/worlds.js')).WORLDS;
    let hedef = null, wi = 0;
    W.forEach((w, i) => { if (w.levels.some(l => l.id === '${levelId}')) { hedef = w; wi = i; } });
    document.querySelectorAll('.world-card')[wi].click();
    return true;
  })()`);
  await c.sleep(800);
  await c.evaluate(`(() => {
    const cards = [...document.querySelectorAll('.level-node')];
    const idx = ${JSON.stringify(levelId)}.split('-l')[1] - 1;
    if (cards[idx]) cards[idx].click();
    return !!cards[idx];
  })()`);
  await c.sleep(1300);
  await c.clickByText('Başla', 'button', 1500);
}

/* ---- Hazırlık: profil oluştur ---- */
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 1900);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Efe'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2B'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(300);
await c.clickByText('Maceraya başla', 'button', 1300);

/* PEDAGOJİK NOT: Varsayılan zorluk artık "kolay" ve KOLAY ZORLUKTA SÜRE
   KAPALIDIR (7 yaş için zaman kaygısını önlemek amacıyla yapılan düzeltme).
   Süre modunu anlamlı biçimde test edebilmek için zorluğu "zor"a alıyoruz —
   kolay zorlukta süre çubuğu zaten gösterilmez. */
await c.evaluate(`(() => {
  const a = JSON.parse(localStorage.getItem('ada.settings.v2') || '{}');
  a.difficulty = 'zor';
  localStorage.setItem('ada.settings.v2', JSON.stringify(a));
  return true;
})()`);
await c.goto(`${B}/index.html`, 2200);

/* ---- 1) Zaman baskısı ayarı panelde var mı? ---- */
await c.clickByText('Veli Paneli', 'button', 1200);
const panel = await c.evaluate(`(() => {
  const kutular = [...document.querySelectorAll('.advice-box')];
  const zaman = kutular.find(k => /Zaman baskısı/.test(k.textContent||''));
  const btns = zaman ? [...zaman.querySelectorAll('button')].map(b=>b.textContent.trim()) : [];
  return JSON.stringify({ var: !!zaman, butonlar: btns });
})()`);
const pn = JSON.parse(panel || '{}');
T('Veli panelinde zaman baskısı ayarı var', pn.var, (pn.butonlar || []).join(' / '));
T('Üç seçenek sunuluyor (Kapalı/Normal/Sıkı)', (pn.butonlar || []).length === 3, (pn.butonlar || []).join(' / '));

/* ---- 2) Normal modda süre çubuğu VAR (w1-l5 = Hız Turu, time:14) ---- */
await bolumBaslat('w1-l5');
await c.bekleKosul(`!!document.querySelector('.timer-bar')`, 6000);
const normalTimer = await c.evaluate(`(() => {
  const t = document.querySelector('.timer-bar');
  return JSON.stringify({ var: !!t, gorunur: t ? t.style.display !== 'none' : false });
})()`);
const nt = JSON.parse(normalTimer || '{}');
T('Normal modda hızlı bölümde süre çubuğu var', nt.var && nt.gorunur, JSON.stringify(nt));

/* ---- 3) "Kapalı" seç → süre çubuğu KAYBOLUR ---- */
await c.clickByText('Veli Paneli', 'button', 1200);

await c.evaluate(`(() => {
  const kutular = [...document.querySelectorAll('.advice-box')];
  const zaman = kutular.find(k => /Zaman baskısı/.test(k.textContent||''));
  const b = [...zaman.querySelectorAll('button')].find(x => x.textContent.trim() === 'Kapalı');
  if (b) b.click();
  return !!b;
})()`);
await c.bekleKosul(`JSON.parse(localStorage.getItem('ada.settings.v2')||'{}').timeMode === 'off'`, 5000);
const kayitli = await c.evaluate(`(() => JSON.parse(localStorage.getItem('ada.settings.v2')||'{}').timeMode)()`);
T('Ayar kaydedildi (timeMode=off)', kayitli === 'off', String(kayitli));

await bolumBaslat('w1-l5');
const kapaliTimer = await c.evaluate(`(() => {
  const t = document.querySelector('.timer-bar');
  return JSON.stringify({ var: !!t, gorunur: t ? t.style.display !== 'none' : false, display: t?.style.display });
})()`);
const kt = JSON.parse(kapaliTimer || '{}');
T('Kapalı modda süre çubuğu gizli', !kt.gorunur, JSON.stringify(kt));

/* ---- 4) "Sıkı" seç → süre kısalır ---- */
await c.clickByText('Veli Paneli', 'button', 1200);
await c.evaluate(`(() => {
  const kutular = [...document.querySelectorAll('.advice-box')];
  const zaman = kutular.find(k => /Zaman baskısı/.test(k.textContent||''));
  const b = [...zaman.querySelectorAll('button')].find(x => x.textContent.trim() === 'Sıkı');
  if (b) b.click();
  return !!b;
})()`);
await c.bekleKosul(`JSON.parse(localStorage.getItem('ada.settings.v2')||'{}').timeMode === 'tight'`, 5000);
const sikıKayit = await c.evaluate(`(() => JSON.parse(localStorage.getItem('ada.settings.v2')||'{}').timeMode)()`);
T('Sıkı mod kaydedildi', sikıKayit === 'tight', String(sikıKayit));

await bolumBaslat('w1-l5');
const sikiTimer = await c.evaluate(`(() => {
  const t = document.querySelector('.timer-bar');
  const i = t?.firstChild;
  return JSON.stringify({ var: !!t, gorunur: t ? t.style.display !== 'none' : false, ilkGenislik: i?.style.width || '' });
})()`);
const st = JSON.parse(sikiTimer || '{}');
T('Sıkı modda süre çubuğu geri geliyor', st.var && st.gorunur, JSON.stringify(st));

/* ---- 5) Büyük yazı butonu çalışıyor ---- */
await c.goto(`${B}/index.html`, 1800);
const oncekiSinif = await c.evaluate(`(() => document.body.classList.contains('big-text'))()`);
await c.evaluate(`(() => { document.getElementById('btn-bigtext').click(); return true; })()`);
await c.sleep(400);
const sonrakiSinif = await c.evaluate(`(() => document.body.classList.contains('big-text'))()`);
T('A+ butonu büyük yazıyı açıyor', !oncekiSinif && sonrakiSinif, `${oncekiSinif} → ${sonrakiSinif}`);

const buyukKayit = await c.evaluate(`(() => JSON.parse(localStorage.getItem('ada.settings.v2')||'{}').bigText)()`);
T('Büyük yazı ayarı kaydedildi', buyukKayit === true, String(buyukKayit));

// Sayfa yenilenince ayar hatırlanıyor mu?
// (Açılış ekranı tıklamayla çözülüyor → boot biraz daha uzun sürüyor)
await c.goto(`${B}/index.html`, 2600);
await c.sleep(700);
const kalici = await c.evaluate(`(() => document.body.classList.contains('big-text'))()`);
T('Büyük yazı yenilemede hatırlanıyor', kalici === true, String(kalici));

// Kapat
await c.evaluate(`(() => { document.getElementById('btn-bigtext').click(); return true; })()`);
await c.sleep(300);
const kapandi = await c.evaluate(`(() => document.body.classList.contains('big-text'))()`);
T('A+ ile geri kapatılıyor', kapandi === false, String(kapandi));

/* ---- 6) Soruyu tekrar dinle butonu oyunda var ---- */
await bolumBaslat('w1-l2');
const replay = await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /tekrar dinle/i.test(x.textContent||''));
  const q = document.querySelector('.question');
  return JSON.stringify({ buton: !!b, soruTiklanabilir: q ? getComputedStyle(q).cursor === 'pointer' : false });
})()`);
const rp = JSON.parse(replay || '{}');
T('"Soruyu tekrar dinle" butonu oyunda var', rp.buton, JSON.stringify(rp));
T('Soru kartına dokunmak da tekrar okur', rp.soruTiklanabilir, JSON.stringify(rp));

await c.screenshot('test/shots/settings-final.png');

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
