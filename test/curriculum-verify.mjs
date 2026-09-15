/* Müfredat kapsamı testleri — 2. sınıf kazanımlarının tamamı oyunda var mı?
   Bu test, eğitim içeriğinin sessizce eksilmesini engeller. */
import { connect, result } from './cdp.mjs';

const B = 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 900);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2000);

const kapsam = await c.evaluate(`(async () => {
  const W = await import('./js/worlds.js');
  const H = await import('./js/games/hints.js');
  const all = W.WORLDS.flatMap(w => w.levels.map(l => ({ w: w.id, ...l })));

  // Hangi çarpım tabloları öğretiliyor?
  const tablolar = new Set();
  for (const l of all) for (const t of (l.cfg?.tables || [])) tablolar.add(Number(t));

  // Hangi soru tipleri var?
  const tipler = new Set(all.map(l => l.type));

  // Her tablo için ipucu tekniği var mı? (6-10 dahil)
  const teknikEksik = [];
  for (let t = 1; t <= 10; t++) {
    const tek = H.techniqueFor({ kind: 'multiply', mode: 'result', a: t, b: 3, answer: t * 3 });
    if (!tek || !tek.name || !tek.teach) teknikEksik.push(t);
  }

  // Her bölümün ipucu var mı? (sides için de)
  const ipucusuzBolum = [];
  for (const l of all) {
    if (l.type === 'multiply') {
      const tek = H.techniqueFor({ kind: 'multiply', mode: l.cfg?.mode || 'result', a: 4, b: 3, answer: 12 });
      if (!tek) ipucusuzBolum.push(l.id);
    }
  }

  // Ada ve bölüm sayısı
  return JSON.stringify({
    adalar: W.WORLDS.map(w => w.id),
    bolumSayisi: all.length,
    tablolar: [...tablolar].sort((a, b) => a - b),
    tabloSayisi: tablolar.size,
    tipler: [...tipler],
    teknikEksik,
    ipucusuzBolum
  });
})()`);
const k = JSON.parse(kapsam || '{}');

T('Tüm çarpım tabloları 1-10 kapsanıyor', k.tabloSayisi === 10 && k.tablolar[0] === 1 && k.tablolar[9] === 10,
  `tablolar: ${(k.tablolar || []).join(',')}`);
T('6-10 tabloları öğretiliyor (2. sınıf 2. yarısı)',
  [6, 7, 8, 9, 10].every((t) => (k.tablolar || []).includes(t)),
  `eksik olanlar: ${[6, 7, 8, 9, 10].filter((t) => !(k.tablolar || []).includes(t)).join(',') || 'yok'}`);
T('Her tablo için düşünme tekniği var', (k.teknikEksik || []).length === 0,
  k.teknikEksik.length ? `eksik: ${k.teknikEksik.join(',')}` : '10/10 teknik hazır');
T('Tüm oyun tipleri mevcut', ['multiply', 'sides', 'draw', 'shapehunt', 'boss'].every((t) => (k.tipler || []).includes(t)),
  (k.tipler || []).join(', '));
T('Her çarpım bölümünün ipucu var', (k.ipucusuzBolum || []).length === 0,
  k.ipucusuzBolum.length ? `eksik: ${k.ipucusuzBolum.join(',')}` : 'hepsi hazır');
T('Yeterli bölüm var (30+)', k.bolumSayisi >= 30, `${k.bolumSayisi} bölüm`);

/* Zorluk sıralaması: tablolar kolaydan zora mı? */
const zorluk = await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const tumMultiply = W.flatMap(w => w.levels.filter(l => l.type === 'multiply').map(l => l.cfg?.tables || []));
  const ilk = tumMultiply[0] || [];
  const son = tumMultiply[tumMultiply.length - 1] || [];
  return JSON.stringify({ ilk, son, adet: tumMultiply.length });
})()`);
const z = JSON.parse(zorluk || '{}');
T('Zorluk sıralı (küçük tablodan büyüğe)', Math.max(...(z.ilk || [0])) < Math.max(...(z.son || [0])),
  `ilk: ${(z.ilk || []).join(',')} → son: ${(z.son || []).join(',')}`);

/* ---- Toplama/Çıkarma kapsamı (2. sınıf çekirdek kazanımı) ---- */
const addsub = await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const Q = await import('./js/games/questions.js');
  const H = await import('./js/games/hints.js');
  const all = W.flatMap(w => w.levels).filter(l => l.type === 'addsub');

  const modlar = new Set(all.map(l => l.cfg?.mode));
  const eldeli = all.filter(l => l.cfg?.carry).length;
  const enBuyuk = Math.max(...all.map(l => l.cfg?.max || 0));

  // İpucu var mı? (toplama ve çıkarma için ayrı ayrı)
  const ipTopla = H.techniqueFor({ kind: 'addsub', mode: 'add', a: 27, b: 8, answer: 35 });
  const ipCikar = H.techniqueFor({ kind: 'addsub', mode: 'sub', a: 32, b: 7, answer: 25 });

  // Üreteç doğru sonuç veriyor mu + negatif sonuç yok mu?
  Q.resetQuestionMemory();
  let hata = 0, negatif = 0, ornekler = [];
  for (let i = 0; i < 120; i++) {
    const q = Q.makeAddQuestion({ max: 100, carry: true, mode: i % 2 ? 'add' : 'sub' });
    const beklenen = q.mode === 'add' ? q.a + q.b : q.a - q.b;
    if (q.answer !== beklenen) hata++;
    if (q.answer < 0) negatif++;
    if (ornekler.length < 4) ornekler.push((q.mode === 'add' ? q.a + '+' + q.b : q.a + '-' + q.b) + '=' + q.answer);
  }

  // Elde/onluk bozma gerçekten oluşuyor mu?
  Q.resetQuestionMemory();
  let eldeVar = 0, bozVar = 0;
  for (let i = 0; i < 80; i++) {
    const qa = Q.makeAddQuestion({ max: 100, carry: true, mode: 'add' });
    if ((qa.a % 10) + (qa.b % 10) >= 10) eldeVar++;
    const qs = Q.makeAddQuestion({ max: 100, carry: true, mode: 'sub' });
    if ((qs.a % 10) < (qs.b % 10)) bozVar++;
  }

  return JSON.stringify({
    bolum: all.length, modlar: [...modlar], eldeli, enBuyuk,
    ipTopla: !!ipTopla, ipCikar: !!ipCikar,
    ipToplaAd: ipTopla?.name || '', ipCikarAd: ipCikar?.name || '',
    hata, negatif, ornekler, eldeVar, bozVar
  });
})()`);
const as = JSON.parse(addsub || '{}');
T('Toplama ve çıkarma bölümleri var', (as.bolum || 0) >= 4 && (as.modlar || []).includes('add') && (as.modlar || []).includes('sub'),
  `${as.bolum} bölüm — modlar: ${(as.modlar || []).join(', ')}`);
T('Eldeli toplama / onluk bozma bölümleri var', (as.eldeli || 0) >= 3, `${as.eldeli} bölüm eldeli/bozmalı`);
T('100’e kadar sayılarla çalışıyor', as.enBuyuk >= 100, `en büyük: ${as.enBuyuk}`);
T('Toplama ve çıkarma için ayrı düşünme tekniği var', as.ipTopla && as.ipCikar,
  `toplama: "${as.ipToplaAd}" | çıkarma: "${as.ipCikarAd}"`);
T('Üreteç doğru sonuç veriyor', (as.hata || 0) === 0, `120 soruda ${as.hata} hata — ${(as.ornekler || []).join(' ')}`);
T('Çıkarmada negatif sonuç yok', (as.negatif || 0) === 0, `${as.negatif} negatif`);
T('Elde/onluk bozma gerçekten oluşuyor', (as.eldeVar || 0) > 30 && (as.bozVar || 0) > 30,
  `80 denemede elde: ${as.eldeVar}, bozma: ${as.bozVar}`);

/* Toplama/çıkarma da canlı oynanabiliyor mu? */
const oyna = await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const w7 = W.find(w => w.id === 'w7');
  if (!w7) return JSON.stringify({ hata: 'w7 yok' });
  return JSON.stringify({ ad: w7.name, bolum: w7.levels.length, ilkTip: w7.levels[0].type });
})()`);
const oy = JSON.parse(oyna || '{}');
T('Sayı Denizi adası tanımlı', oy.ad === 'Sayı Denizi' && oy.ilkTip === 'addsub', `${oy.ad} — ${oy.bolum} bölüm`);

/* 6-10 bölümünü gerçekten oynanabiliyor mu? */
const oynanir = await c.evaluate(`(async () => {
  const W = await import('./js/worlds.js');
  const Q = await import('./js/games/questions.js');
  const w6 = W.WORLDS.find(w => w.id === 'w6');
  if (!w6) return JSON.stringify({ hata: 'w6 yok' });
  const l = w6.levels[0];
  Q.resetQuestionMemory();
  const ornekler = [];
  for (let i = 0; i < 6; i++) {
    const q = Q.makeMultiplyQuestion({ tables: l.cfg.tables, mode: l.cfg.mode, maxB: l.cfg.maxB });
    ornekler.push({ a: q.a, b: q.b, answer: q.answer, dogru: q.a * q.b === q.answer, secenek: q.options.length });
  }
  return JSON.stringify({ tablo: l.cfg.tables[0], ornekler });
})()`);
const o = JSON.parse(oynanir || '{}');
const hepsiDogru = (o.ornekler || []).every((x) => x.dogru && x.secenek === 4);
const hepsiAyniTablo = (o.ornekler || []).every((x) => x.a === (o.tablo || 6));
T('6-10 bölümü oynanabilir ve cevaplar doğru', hepsiDogru && hepsiAyniTablo,
  `${o.tablo}'lar: ` + (o.ornekler || []).map((x) => `${x.a}×${x.b}=${x.answer}`).join(' ') + ` (seçenek: ${(o.ornekler||[])[0]?.secenek})`);

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log('JS hatası:', await c.errors());
process.exit(fail ? 1 : 0);
