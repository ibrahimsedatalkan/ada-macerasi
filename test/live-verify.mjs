/* CANLI Vercel deploy'unu gerçek tarayıcıda doğrula */
import { connect, result } from './cdp.mjs';

const LIVE = process.env.LIVE_URL || 'https://temporary-flying-reef-9ra71vr.vercel.app';
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

const harita = await c.evaluate(`(() => JSON.stringify({
  ekran: document.querySelector('.screen.active')?.dataset.screen || null,
  ada: document.querySelectorAll('.world-card').length,
  hazineSlot: document.querySelectorAll('.ts-slot').length,
  dukkanBtn: !!([...document.querySelectorAll('button')].find(b => /Dükkân/.test(b.textContent||'')))
}))()`);
const h = JSON.parse(harita || '{}');
T('Harita çizildi', h.ekran === 'map', h.ekran);
T('6 ada görünüyor', h.ada === 6, `${h.ada} ada`);
T('Hazine sandığı görünüyor', h.hazineSlot === 6, `${h.hazineSlot} slot`);
T('Dükkân butonu var', h.dukkanBtn === true, String(h.dukkanBtn));

/* Arka planlar yüklendi mi? (yeni w6 dahil) */
const bgler = await c.evaluate(`(async () => {
  const yukle = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth > 0); im.onerror = () => res(false); im.src = src; });
  const sonuc = {};
  for (const id of ['w1','w2','w3','w4','w5','w6','hero']) sonuc[id] = await yukle('assets/bg/' + id + '.jpg');
  return JSON.stringify(sonuc);
})()`);
const bg = JSON.parse(bgler || '{}');
const bgHepsi = Object.values(bg).every(Boolean);
T('Tüm ada görselleri yüklendi (w6 dahil)', bgHepsi, JSON.stringify(bg));

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

await c.screenshot('test/shots/live-vercel.png');

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('Ekran: test/shots/live-vercel.png');
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
