/* ÇARPIM TABLOSU KAPSAMI testi — her bölüm ×10'a kadar soruyor mu?
   ------------------------------------------------------------
   KULLANICI İSTEĞİ: "Oyunda çarpım tablosunu 10'lara kadar yapar mısın?"

   BULUNAN EKSİK: Tablolar 1-10 tanımlıydı ama w1-w5 bölümlerinde maxB
   ayarlanmamıştı → varsayılan 5'e düşüyordu. Yani "2'ler" bölümünde çocuk
   yalnız 2×1..2×5 görüyordu; 2×7, 4×9, 5×10 hiç sorulmuyordu.
   (Üst sınır 10 yalnızca Yıldız Adası'na konmuştu.)

   Bu test her çarpım/patron bölümünün GERÇEKTEN ×10'a kadar soru
   ürettiğini doğrular.                                                   */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(390, 844);
await c.initErrors();
await c.goto(`${B}/index.html`, 2600);

let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/* Her bölüm için 120 soru üret, görülen en büyük çarpanı ve kapsamı ölç */
const rapor = JSON.parse(await c.evaluate(`(async () => {
  const W = (await import('./js/worlds.js')).WORLDS;
  const Q = await import('./js/games/questions.js');
  const A = await import('./js/games/adaptive.js');
  const cikti = [];

  for (const w of W) {
    for (const l of (w.levels || [])) {
      if (l.type !== 'multiply' && l.type !== 'boss') continue;
      const c = l.cfg || {};
      if (!c.tables || !c.tables.length) continue;

      // Oyunun kullandığı AYNI hesap (profil boş → kademe 1 = normal)
      const temelMax = c.mode === 'result' ? (c.maxB ?? 10) : Math.min(10, c.maxBHard ?? 10);
      const maxB = A.adaptiveMaxB(null, temelMax, c.maxBHard ?? 10);

      const gorulen = new Set();
      const tablolar = new Set();
      for (let i = 0; i < 120; i++) {
        const q = Q.makeMultiplyQuestion({ tables: c.tables, mode: c.mode || 'result', maxB });
        gorulen.add(Number(q.b));
        tablolar.add(Number(q.a));
      }
      cikti.push({
        id: l.id,
        tablolar: [...tablolar].sort((x, y) => x - y),
        maxB,
        enBuyukCarpan: Math.max(...gorulen),
        carpanlar: [...gorulen].sort((x, y) => x - y)
      });
    }
  }
  return JSON.stringify(cikti);
})()`) || '[]');

console.log('BÖLÜM'.padEnd(9) + 'TABLOLAR'.padEnd(22) + 'ÜST SINIR'.padEnd(10) + 'GÖRÜLEN ÇARPANLAR');
console.log('─'.repeat(76));
for (const r of rapor) {
  console.log(
    String(r.id).padEnd(9) +
    String(r.tablolar.join(',')).padEnd(22) +
    String(r.maxB).padEnd(10) +
    '1..' + r.enBuyukCarpan + (r.enBuyukCarpan >= 10 ? ' ✅' : ' ❌')
  );
}

console.log('');
T('Çarpım/patron bölümü bulundu', rapor.length > 0, `${rapor.length} bölüm`);

const eksikler = rapor.filter((r) => r.enBuyukCarpan < 10);
T('★ TÜM çarpım/patron bölümleri ×10\'a kadar soruyor',
  eksikler.length === 0,
  eksikler.length ? 'eksik: ' + eksikler.map((r) => `${r.id} (max ×${r.enBuyukCarpan})`).join(', ')
                  : `${rapor.length}/${rapor.length} bölüm ×10 ✅`);

// Tablo kapsamı: 1-10 hepsi bir yerde var mı?
const tumTablolar = new Set();
rapor.forEach((r) => r.tablolar.forEach((t) => tumTablolar.add(t)));
const eksikTablo = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((t) => !tumTablolar.has(t));
T('★ 1-10 arası TÜM tablolar müfredatta var',
  eksikTablo.length === 0, eksikTablo.length ? 'eksik tablo: ' + eksikTablo.join(', ') : '10/10 tablo ✅');

// Her bölüm KENDİ tablosunu soruyor mu? (yanlış tablo sızmasın)
const karisik = rapor.filter((r) => r.tablolar.some((t) => !r.tablolar.includes(t)));
T('Bölümler kendi tablo kümesinden soruyor', karisik.length === 0);

// Kritik örnek: 2'ler bölümü 2×10 üretebiliyor mu?
const ikiler = rapor.find((r) => r.id === 'w1-l2');
T('★ "2\'ler" bölümü 2×10 üretebiliyor (önce ×5\'te kesiliyordu)',
  ikiler && ikiler.enBuyukCarpan >= 10, ikiler ? `görülen: 1..${ikiler.enBuyukCarpan}` : 'bölüm yok');

const besler = rapor.find((r) => r.id === 'w2-l2');
T('★ "5\'ler" bölümü 5×10 üretebiliyor (önce ×5\'te kesiliyordu)',
  besler && besler.enBuyukCarpan >= 10, besler ? `görülen: 1..${besler.enBuyukCarpan}` : 'bölüm yok');

const JS = await c.errors();
const liste = Array.isArray(JS) ? JS : JSON.parse(typeof JS === 'string' && JS.trim() ? JS : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
