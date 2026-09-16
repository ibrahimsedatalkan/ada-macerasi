/* CANLI Vercel deploy'unu gerçek tarayıcıda doğrula */
import { connect, result } from './cdp.mjs';

const LIVE = process.env.LIVE_URL || 'https://ibrahimsedatalkan.github.io/ada-macerasi';
const c = await connect();
await c.viewport(1280, 980);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

console.log(`Canlı adres: ${LIVE}\n`);

await c.goto(`${LIVE}/`, 4000);

/* Sayfa gerçekten yüklendi mi? */
const baslik = await c.evaluate(`document.title`);
T('Sayfa yüklendi (başlık doğru)', /Ada Macerası/.test(baslik || ''), baslik);

/* Temiz başlangıç: önceki oturumu sil, giriş ekranı gelsin */
await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
await c.goto(`${LIVE}/`, 4000);

/* JS modül grafiği çalıştı mı? (ekran render olduysa evet) */
const ekran = await c.evaluate(`(() => {
  const aktif = document.querySelector('.screen.active');
  return JSON.stringify({
    aktif: aktif?.dataset.screen || null,
    girisVar: !!document.querySelector('input[type="text"]'),
    avatarSayisi: document.querySelectorAll('.avatar-opt').length
  });
})()`);
const e = JSON.parse(ekran || '{}');
T('Modüller yüklendi, giriş ekranı çizildi', e.girisVar && e.avatarSayisi >= 12, JSON.stringify(e));

/* Konsol hatası var mı? (modül 404'leri burada görünür) */
const hatalar = await c.errors();
T('JS hatası yok', hatalar === '[]' || !hatalar, hatalar);

/* Oyunu oyna: profil oluştur → harita */
await c.evaluate(`(() => {
  const i = [...document.querySelectorAll('input[type="text"]')];
  if (i[0]) { i[0].value = 'Canli'; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
  if (i[1]) { i[1].value = '2C'; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
  return true;
})()`);
await c.sleep(400);
await c.clickByText('Maceraya başla', 'button', 2000);

const harita = await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const C = await import('./js/collect.js');
  return JSON.stringify({
    ekran: document.querySelector('.screen.active')?.dataset.screen || null,
    ada: document.querySelectorAll('.world-card').length,
    beklenenAda: W.length,
    hazineSlot: document.querySelectorAll('.ts-slot').length,
    beklenenHazine: C.ALL_TREASURES.length,
    dukkanBtn: !!([...document.querySelectorAll('button')].find(b => /Dükkân/.test(b.textContent||''))),
    adalar: W.map(w => w.name)
  });
})()`);
const h = JSON.parse(harita || '{}');
T('Harita çizildi', h.ekran === 'map', h.ekran);
T(`Tüm adalar görünüyor (${h.beklenenAda})`, h.ada === h.beklenenAda, `${h.ada} ada: ${(h.adalar||[]).join(', ')}`);
T('Hazine sandığı tüm parçaları gösteriyor', h.hazineSlot === h.beklenenHazine, `${h.hazineSlot}/${h.beklenenHazine}`);
T('Dükkân butonu var', h.dukkanBtn === true, String(h.dukkanBtn));
T('Sayı Denizi (toplama-çıkarma) canlıda', (h.adalar || []).includes('Sayı Denizi'), (h.adalar||[]).join(', '));

/* Arka planlar yüklendi mi? (yeni w6 dahil) */
const bgler = await c.evaluate(`(async () => {
  const yukle = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth > 0); im.onerror = () => res(false); im.src = src; });
  const sonuc = {};
  for (const id of ['w1','w2','w3','w4','w5','w6','w7','hero']) sonuc[id] = await yukle('assets/bg/' + id + '.jpg');
  return JSON.stringify(sonuc);
})()`);
const bg = JSON.parse(bgler || '{}');
const bgHepsi = Object.values(bg).every(Boolean);
T('Tüm ada görselleri yüklendi (w6 + w7 dahil)', bgHepsi, JSON.stringify(bg));

/* TOPLAMA-ÇIKARMA canlıda oynanabiliyor mu? */
const addCanli = await c.evaluate(`(async () => {
  const Q = await import('./js/games/questions.js');
  const H = await import('./js/games/hints.js');
  Q.resetQuestionMemory();
  const ornekler = [];
  let hata = 0, negatif = 0;
  for (let i = 0; i < 60; i++) {
    const q = Q.makeAddQuestion({ max: 100, carry: true, mode: i % 2 ? 'add' : 'sub' });
    const beklenen = q.mode === 'add' ? q.a + q.b : q.a - q.b;
    if (q.answer !== beklenen) hata++;
    if (q.answer < 0) negatif++;
    if (ornekler.length < 3) ornekler.push(q.a + (q.mode === 'add' ? ' + ' : ' − ') + q.b + ' = ' + q.answer);
  }
  const ip = H.techniqueFor({ kind: 'addsub', mode: 'sub', a: 32, b: 7, answer: 25 });
  return JSON.stringify({ hata, negatif, ornekler, ipucu: ip?.name || '' });
})()`);
const ac = JSON.parse(addCanli || '{}');
T('Toplama/çıkarma canlıda doğru hesaplıyor', ac.hata === 0 && ac.negatif === 0,
  `60 soruda ${ac.hata} hata, ${ac.negatif} negatif — ${(ac.ornekler||[]).join(' | ')}`);
T('Çıkarma ipucu canlıda (onluk bozma)', !!ac.ipucu, ac.ipucu);

/* Oyuna gir ve soru geliyor mu? */
await c.clickByText('Çayır Adası', 'button', 1200);
await c.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Bölüm\\s+1\\b/.test(x.textContent||'')); if(b) b.click(); return !!b; })()`);
await c.sleep(1600);
await c.clickByText('Başla', 'button', 2000);

const oyun = await c.evaluate(`(() => JSON.stringify({
  ekran: document.querySelector('.screen.active')?.dataset.screen || null,
  soru: (document.querySelector('.question')?.innerText||'').replace(/\\s+/g,' ').trim(),
  secenek: document.querySelectorAll('.answer-btn').length,
  tekrarBtn: !!([...document.querySelectorAll('button')].find(b=>/tekrar dinle/i.test(b.textContent||''))),
  ipucuBtn: !!([...document.querySelectorAll('button')].find(b=>/düşünmeliyim/i.test(b.textContent||'')))
}))()`);
const o = JSON.parse(oyun || '{}');
T('Bölüm başladı, soru geldi', o.ekran === 'game' && o.secenek === 4, `${o.soru} (${o.secenek} seçenek)`);
T('Tekrar dinle butonu canlıda var', o.tekrarBtn === true);
T('İpucu butonu canlıda var', o.ipucuBtn === true);

/* İpucu aç → cevap sızdırmıyor mu? (canlıda da) */
await c.clickByText('Nasıl düşünmeliyim', 'button', 1000);
const ipucu = await c.evaluate(`(() => {
  const t = document.querySelector('.hint-title')?.innerText || '';
  const b = document.querySelector('.hint-body')?.innerText || '';
  const tip = document.querySelector('.hint-tip')?.innerText || '';
  return JSON.stringify({ var: (t+b+tip).length > 20, metin: (t+' | '+b).slice(0,150) });
})()`);
const ip = JSON.parse(ipucu || '{}');
T('İpucu canlıda çalışıyor (teknik anlatıyor)', ip.var, ip.metin);

/* Çeldirici kalitesi CANLIDA: küçük çarpımlarda saçma seçenek olmamalı */
const cel = await c.evaluate(`(async () => {
  const Q = await import('./js/games/questions.js');
  let kotu = 0, toplam = 0, ornek = '';
  for (let a = 1; a <= 5; a++) {
    for (let b = 1; b <= 5; b++) {
      Q.resetQuestionMemory();
      const q = Q.makeMultiplyQuestion({ tables: [a], mode: 'result', maxB: 5, maxBHard: 5 });
      toplam++;
      const c = q.a * q.b;
      const sacma = q.options.filter(x => x !== c && x % q.a !== 0 && Math.abs(x - c) > Math.max(3, q.a));
      if (sacma.length) { kotu++; if (!ornek) ornek = q.a + 'x' + q.b + '=' + c + ' → ' + q.options.join(','); }
    }
  }
  return JSON.stringify({ toplam, kotu, ornek });
})()`);
const cl = JSON.parse(cel || '{}');
T('Canlıda çeldiriciler temiz (bariz yanlış seçenek yok)', cl.kotu === 0,
  `${cl.toplam} soruda ${cl.kotu} saçma` + (cl.ornek ? ' | ' + cl.ornek : ''));

await c.screenshot('test/shots/live-vercel.png');

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('Ekran: test/shots/live-vercel.png');
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
