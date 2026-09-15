/* HAM KOD SIZINTISI testi
   Amaç: hiçbir ekranda HTML/SVG markup'ı KULLANICIYA METİN olarak görünmesin.
   Bu hata sınıfı daha önce yaşandı: inline onerror niteliğine gömülen SVG
   içindeki çift tırnak, niteliği erken kapatıp kodu ekrana döktü. */
import { connect, result } from './cdp.mjs';

const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 980);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/** Görünen metinde markup kalıntısı var mı? */
const SIZINTI = /(<\/?(svg|path|circle|ellipse|rect|polygon|span|img|div|g)\b|viewBox=|stroke-width=|stroke-linecap=|fill="#|&quot;|&#39;|\bd="M\d|outerHTML)/i;

async function tara(etiket) {
  const r = await c.evaluate(`(() => {
    const aktif = document.querySelector('.screen.active');
    const d = document.getElementById('dialog');
    const parcalar = [];
    if (aktif) parcalar.push(aktif.innerText || '');
    if (d && !d.hidden) parcalar.push(d.innerText || '');
    return JSON.stringify({ metin: parcalar.join('\\n'), gorunurEkran: aktif?.dataset.screen || null, diyalog: !!(d && !d.hidden) });
  })()`);
  const o = JSON.parse(r || '{}');
  const bulgu = SIZINTI.exec(o.metin || '');
  T(`${etiket} — ham kod yok`, !bulgu,
    bulgu ? `SIZINTI: "${bulgu[0]}" → …${(o.metin||'').slice(Math.max(0, bulgu.index-30), bulgu.index+70).replace(/\n/g,'⏎')}` : `${(o.metin||'').length} karakter temiz`);
  return o;
}

/* Profil kur */
await c.goto(`${B}/index.html`, 2200);
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Sizinti'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2H'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(350);

/* 1) Giriş ekranı */
await tara('Giriş ekranı');

await c.clickByText('Maceraya başla', 'button', 1600);
/* 2) Harita */
await tara('Harita');

/* 3) Her ada brifing diyaloğu (asıl hata buradaydı) */
const adaSayisi = await c.evaluate(`document.querySelectorAll('.world-card').length`);
for (let w = 0; w < adaSayisi; w++) {
  await c.evaluate(`(() => { document.querySelectorAll('.world-card')[${w}].click(); return true; })()`);
  await c.sleep(850);
  // Ada diyaloğu (bölüm listesi)
  await tara(`Ada ${w + 1} bölüm listesi`);
  // İlk bölümün brifingi
  await c.evaluate(`(() => { const n=[...document.querySelectorAll('.level-node')]; if(n[0]) n[0].click(); return n.length; })()`);
  await c.sleep(1250);
  await tara(`Ada ${w + 1} brifing`);
  await c.clickByText('Sonra', 'button', 600);
  await c.sleep(400);
}

/* 4) Dükkân */
await c.clickByText('Dükkân', 'button', 1100);
await tara('Jeton dükkânı');
await c.clickByText('Haritaya dön', 'button', 800);

/* 5) Albüm */
await c.clickByText('Albüm', 'button', 1100);
await tara('Çıkartma albümü');
await c.clickByText('Haritaya dön', 'button', 800);

/* 6) Sınıf tablosu */
await c.clickByText('Sınıf Tablosu', 'button', 1100);
await tara('Sınıf tablosu');
await c.clickByText('Haritaya dön', 'button', 800);

/* 7) Veli paneli */
await c.clickByText('Veli Paneli', 'button', 1200);
await tara('Veli paneli');
await c.clickByText('Haritaya dön', 'button', 800);

/* 8) Sonuç ekranı (mood rozeti burada) */
await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const k = Object.keys(localStorage).find(x => x.startsWith('ada.p.v2.'));
  const p = JSON.parse(localStorage.getItem(k));
  p.results = p.results || {};
  for (const w of W) for (const l of w.levels) p.results[l.id] = { stars: 3, best: 500, plays: 1 };
  localStorage.setItem(k, JSON.stringify(p));
})()`);
await c.goto(`${B}/index.html`, 2000);
await c.evaluate(`(() => { document.querySelectorAll('.world-card')[0].click(); return true; })()`);
await c.sleep(850);
await c.evaluate(`(() => { const n=[...document.querySelectorAll('.level-node')]; if(n[0]) n[0].click(); return n.length; })()`);
await c.sleep(1250);
await c.clickByText('Başla', 'button', 2000);
/* Doğru cevabı bul ve tıkla → sonuç ekranı */
const cevap = await c.evaluate(`(() => {
  const t = document.querySelector('.question')?.innerText || '';
  const m = /(\\d+)\\s*×\\s*(\\d+)/.exec(t);
  if (!m) return '0';
  return String(Number(m[1]) * Number(m[2]));
})()`);
await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('.answer-btn')].find(x => x.textContent.trim() === '${cevap}');
  if (b) b.click();
  return !!b;
})()`);
await c.sleep(1200);
/* Bölümü hızlı bitir: kalan soruları doğru cevapla */
for (let i = 0; i < 8; i++) {
  const cv = await c.evaluate(`(() => {
    const t = document.querySelector('.question')?.innerText || '';
    const m = /(\\d+)\\s*×\\s*(\\d+)/.exec(t);
    return m ? String(Number(m[1]) * Number(m[2])) : '';
  })()`);
  if (!cv) break;
  await c.evaluate(`(() => {
    const b = [...document.querySelectorAll('.answer-btn')].find(x => x.textContent.trim() === '${cv}');
    if (b) b.click();
    return !!b;
  })()`);
  await c.sleep(800);
}
await c.sleep(900);
await tara('Bölüm sonu (mood rozeti)');

await c.screenshot('test/shots/no-code-leak.png');
console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('Ekran: test/shots/no-code-leak.png');
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
