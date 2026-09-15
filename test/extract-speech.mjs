/* Oyundaki TÜM seslendirilecek metinleri çıkar → speech-texts.json
   Tarayıcıda çalışır (modüller window kullanıyor, Node'da çalışmaz). */
import { connect } from './cdp.mjs';
import { writeFileSync } from 'node:fs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1000, 800);
await c.goto(`${B}/index.html`, 2500);

const raw = await c.evaluate(`(async () => {
  const L = await import('./js/lessons.js');
  const W = await import('./js/worlds.js');
  const Q = await import('./js/games/questions.js');
  const H = await import('./js/games/hints.js');
  const S = await import('./js/shapes.js');
  const C = await import('./js/collect.js');

  const metinler = [];   // { id, metin, kategori }
  const ekle = (id, metin, kategori) => {
    const m = String(metin || '').replace(/\\s+/g, ' ').trim();
    if (m.length > 1) metinler.push({ id, metin: m, kategori });
  };

  /* 1) DERSLER — slaytların sesli metinleri */
  ekle('ders-geo-0', L.GEO_INTRO.slides[0].ses, 'ders');
  ekle('ders-geo-1', L.GEO_INTRO.slides[1].ses, 'ders');
  ekle('ders-geo-2', L.GEO_INTRO.slides[2].ses, 'ders');
  for (const [sid, d] of Object.entries(L.SHAPE_LESSONS)) {
    d.slides.forEach((s, i) => ekle('ders-' + sid + '-' + i, s.ses || s.metin, 'ders'));
  }

  /* 2) ŞEKİL: ad + yönerge (çizim oyunu) */
  const howTo = {
    kare: 'Sağa git. Aşağı git. Sola git. Yukarı git. Başladığın yere dön.',
    dikdortgen: 'Önce uzun kenarı çiz. Sonra kısa kenarı. Karşılıklı kenarlar eşit.',
    ucgen: 'Birden ikiye git. İkiden üçe git. Üçten bire dön.',
    daire: 'Birden başla. Saat yönünde yuvarlak çiz. Köşe yapma.',
    besgen: 'Numaraları sırayla takip et. Birden beşe kadar. Sonra bire dön.',
    altigen: 'Numaraları sırayla takip et. Birden altıya kadar. Sonra bire dön.'
  };
  for (const [id, m] of Object.entries(howTo)) ekle('cizim-' + id, m, 'cizim');

  /* 3) ŞEKİL: sorular */
  const sekiller = ['kare', 'dikdortgen', 'ucgen', 'daire', 'besgen', 'altigen'];
  for (const sid of sekiller) {
    const s = S.SHAPES[sid];
    ekle('sor-kenar-' + sid, s.name + ' kaç kenarlı?', 'sekil-soru');
    ekle('sor-kose-' + sid, s.name + ' kaç köşeli?', 'sekil-soru');
    ekle('sor-ad-' + sid, 'Bu şeklin adı ne?', 'sekil-soru');
  }

  /* 4) ÇARPIM SORULARI — tablo yönergelerinden gerçek soruları üret */
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      ekle('carpim-' + a + 'x' + b, a + ' çarpı ' + b + ' kaç eder?', 'carpim');
    }
  }
  for (let t = 1; t <= 10; t++) {
    ekle('tablo-' + t, t + ' çarpı bir kaç eder? Cevap ' + t + '.', 'carpim');
  }

  /* 5) İPUCU TEKNİKLERİ — kısa konuşma metinleri */
  const teknikler = new Set();
  const dene = (q) => {
    const t = H.techniqueFor(q);
    if (t && t.countHint) teknikler.add(JSON.stringify({ ad: t.name, kisa: t.countHint }));
  };
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      dene({ kind: 'multiply', mode: 'result', a, b, answer: a * b });
    }
  }
  dene({ kind: 'multiply', mode: 'result', a: 3, b: 4, answer: 12 });
  for (let i = 0; i < 20; i++) dene({ kind: 'addsub', mode: i % 2 ? 'add' : 'sub', a: 27 + i, b: 8, answer: i % 2 ? 35 + i : 19 + i });
  for (const sid of ['kare', 'dikdortgen', 'ucgen', 'daire', 'besgen', 'altigen']) {
    dene({ kind: 'sides', shapeId: sid, answer: S.SHAPES[sid].sides, ask: 'kenar' });
  }
  let ti = 0;
  for (const t of teknikler) {
    const o = JSON.parse(t);
    ekle('ipucu-' + (ti++), o.ad + '. ' + o.kisa, 'ipucu');
  }

  /* 6) ÖVGÜ / GERİ BİLDİRİM cümleleri */
  const ovguler = [
    'Harika, çizdin!', 'Çok yakın, biraz daha devam et.', 'Şeklin üzerinden geç.',
    'Tekrar dene, noktaları takip et.', 'Doğru! Süpersin!', 'Aferin!',
    'Şimdi sıra sende! Aynı şekilde çiz.', 'Süper, beş doğru üst üste!',
    'Dersler. Bir şekil seç, önce öğren sonra çiz.', 'Sayıyı onluk ve birlik diye ayır. Sırayla hesapla.'
  ];
  ovguler.forEach((m, i) => ekle('geri-' + i, m, 'geri-bildirim'));

  /* 7) ADA girişleri ve hikayeleri */
  for (const w of W.WORLDS) {
    ekle('ada-' + w.id, w.intro, 'ada');
    for (const l of w.levels) {
      if (l.story) ekle('bolum-' + l.id, l.story, 'bolum');
    }
  }

  return JSON.stringify(metinler);
})()`);

const liste = JSON.parse(raw || '[]');
writeFileSync('speech-texts.json', JSON.stringify(liste, null, 2), 'utf-8');

const kategoriler = {};
for (const m of liste) kategoriler[m.kategori] = (kategoriler[m.kategori] || 0) + 1;
console.log('Toplam metin:', liste.length);
console.log('Kategoriler:', JSON.stringify(kategoriler, null, 2));
console.log('JS hatası:', await c.errors());
process.exit(0);
