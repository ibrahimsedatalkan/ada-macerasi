/* SES KAPSAM DENETİMİ
   Oyunun ÇALIŞMA ANINDA okuduğu tüm metinleri toplar ve her biri için
   önceden üretilmiş MP3 var mı diye bakar. Ses dosyası olmayan metin
   tarayıcı sesine düşer (farklı ses tonu) — bu bir "boşluk"tur. */
import { connect } from './cdp.mjs';
import { readFileSync } from 'fs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1000, 800);
await c.initErrors();
await c.goto(`${B}/index.html`, 2600);

const r = await c.evaluate(`(async () => {
  const W = await import('./js/worlds.js');
  const Q = await import('./js/games/questions.js');
  const H = await import('./js/games/hints.js');
  const L = await import('./js/lessons.js');
  const C = await import('./js/collect.js');

  const metinler = new Map();      // metin -> kaynak
  const parcali = {};              // metin -> parça listesi (parçalı okuma)
  const ekle = (t, kaynak) => {
    const s = String(t || '').trim();
    if (s && s.length > 1) metinler.set(s, kaynak);
  };
  const ekleParcali = (q, kaynak) => {
    const tam = String(Q.questionSpeech(q) || '').trim();
    if (!tam) return;
    metinler.set(tam, kaynak);
    const p = Q.questionSpeechParts ? Q.questionSpeechParts(q) : null;
    if (p && p.length) parcali[tam] = p;
  };

  // 1) Adalar: tanıtım + bölüm hikâyeleri
  W.WORLDS.forEach(w => {
    ekle(w.intro, 'world.intro ' + w.id);
    w.levels.forEach(l => ekle(l.story, 'level.story ' + l.id));
  });

  // 2) Sorular: tüm üretilen soru tipleri (tam tarama)
  const sorulariTopla = () => {
    // Çarpım: 1-10 x 1-10 ve eksik/ters modları
    for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) {
      ekle(Q.questionSpeech(Q.makeMultiplyQuestion({ tables: [a], b, mode: 'result' })), 'multiply');
      ekleParcali(Q.makeMultiplyQuestion({ tables: [a], b, mode: 'missing' }), 'multiply-missing');
      ekleParcali(Q.makeMultiplyQuestion({ tables: [a], b, mode: 'reverse' }), 'multiply-reverse');
    }
    // Toplama/çıkarma: seviyelerin kullandığı aralıklar
    [[20, false, 'add'], [20, false, 'sub'], [100, true, 'add'], [100, true, 'sub']].forEach(([max, carry, mode]) => {
      for (let i = 0; i < 30; i++) {
        ekleParcali(Q.makeAddQuestion({ max, carry, mode }), 'addsub-' + mode + '-' + max);
      }
    });
    // Kenar/köşe
    const sekiller = ['kare','dikdortgen','ucgen','daire','besgen','altigen'];
    ['sides','corners'].forEach(tip => {
      sekiller.forEach(s => {
        ekle(Q.questionSpeech(Q.makeSidesQuestion({ ask: tip, shapes: [s] })), 'sides-' + tip);
      });
    });
    // Şekil avı
    ekle(Q.questionSpeech(Q.makeTapQuestion({ shapes: sekiller, count: 3, distractors: 3 })), 'tap');
  };
  sorulariTopla();

  // 2b) Ödül/övgü cümleleri (oyun motorlarında geçenler)
  const ovgu = ['Harika!','Süpersin!','Aferin!','Bravo!','Mükemmel!','Çok iyi!','Doğru!','Tam isabet!'];
  ovgu.forEach(t => ekle(t, 'ovgu'));

  // 3) İpuçları: teknik adı + sayma ipucu (KONUŞULAN kısım)
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) {
    const q = Q.makeMultiplyQuestion({ tables: [a], b, mode: 'result' });
    ekle(H.techniqueSpeech(q), 'hint-multiply');
  }
  [[20,false,'add'],[20,false,'sub'],[100,true,'add'],[100,true,'sub']].forEach(([max,carry,mode]) => {
    for (let i = 0; i < 12; i++) {
      const q = Q.makeAddQuestion({ max, carry, mode });
      ekle(H.techniqueSpeech(q), 'hint-addsub');
    }
  });

  // 4) Ders anlatımı (konuşulan ses metni)
  ekle(L.GEO_INTRO?.ses, 'geo-intro');
  Object.values(L.SHAPE_LESSONS || {}).forEach(d => (d.slides || []).forEach((s, i) => ekle(s.ses, 'ders-' + (d.id||'?') + '-' + i)));

  return JSON.stringify({ metinler: [...metinler.entries()], parcali });
})()`);

const { metinler, parcali } = JSON.parse(r || '{"metinler":[],"parcali":{}}');
console.log(`Oyunun okuduğu benzersiz metin: ${metinler.length}`);

// Manifest'i oku
const man = JSON.parse(readFileSync('assets/ses/manifest.json', 'utf8'));
console.log(`Manifest kaydı: ${Object.keys(man).length}`);

const norm = (t) => String(t || '').trim().replace(/\s+/g, ' ');
const varOlan = new Set(Object.keys(man).map(norm));

const eksikler = [];
const kaynakSayaci = {};
const parcaliKapsanan = [];
for (const [metin, kaynak] of metinler) {
  if (varOlan.has(norm(metin))) continue;
  // PARÇALI OKUMA: toplama/çıkarma soruları parçalardan birleştirilir
  const parcaliMi = /^addsub|^multiply-(missing|reverse)/.test(kaynak);
  if (parcaliMi && parcali[metin]) {
    const eksikParca = parcali[metin].filter((x) => !varOlan.has(norm(x)));
    if (!eksikParca.length) { parcaliKapsanan.push({ metin, kaynak, parcalar: parcali[metin] }); continue; }
  }
  eksikler.push({ metin: norm(metin), kaynak });
  const k = kaynak.split(' ')[0];
  kaynakSayaci[k] = (kaynakSayaci[k] || 0) + 1;
}

console.log(`\n=== SES KAPSAMI ===`);
console.log(`  Tam cümle kaydı olan   : ${metinler.length - eksikler.length - parcaliKapsanan.length}`);
console.log(`  Parçalardan okunan     : ${parcaliKapsanan.length}  (toplama/çıkarma — sayılar rastgele)`);
console.log(`  SES DOSYASI OLMAYAN    : ${eksikler.length}`);
if (parcaliKapsanan.length) {
  const ornek = parcaliKapsanan[0];
  console.log(`  örnek parçalı: "${ornek.metin}" → [${ornek.parcalar.join(' | ')}]`);
}
if (eksikler.length) {
  console.log('Kaynak bazında:');
  Object.entries(kaynakSayaci).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nÖrnekler (ilk 10):`);
  eksikler.slice(0, 10).forEach(e => console.log(`  [${e.kaynak}] "${e.metin.slice(0, 70)}"`));
  // Üretim için dosyaya yaz
  const { writeFileSync } = await import('fs');
  writeFileSync('speech-eksik.json', JSON.stringify(eksikler.map(e => ({ text: e.metin, kaynak: e.kaynak })), null, 1), 'utf8');
  console.log(`\n📝 speech-eksik.json yazıldı (${eksikler.length} metin) — üretim için hazır`);
} else {
  console.log('✅ Tüm metinlerin ses dosyası VAR');
}

// Kullanılmayan dosyalar (fazlalık)
const kullanilan = new Set(metinler.map(([m]) => norm(m)));
const ortak = readFileSync('speech-texts.json', 'utf8');
const idler = new Set(JSON.parse(ortak).map(x => x.text ? norm(x.text) : ''));
const fazla = [...varOlan].filter(t => !kullanilan.has(t) && !idler.has(t));
console.log(`\nManifest'te olup bu taramada kullanılmayan: ${fazla.length} (kaynak metin dosyasından gelenler normal)`);

console.log('\nJS hatası:', await c.errors());
process.exit(0);
