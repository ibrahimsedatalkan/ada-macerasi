/* ŞIK KONUMU ve İLERLEME testleri
   ------------------------------------------------------------
   KULLANICI BİLDİRDİ:
     1) "Tüm doğru cevaplar 2. şık olarak verdi"
     2) "Bölüm bittiğinde ilerlemiyor. Diğer bölüme geçmiyor."

   HATA 1 KÖK NEDENİ: together.js'te şıklar `.sort((a,b)=>a-b)` ile
   KÜÇÜKTEN BÜYÜĞE sıralanıyordu (ör. 12,15,18,21). Çarpım cevabı genelde
   ortadaki değer olduğu için DOĞRU CEVAP HEP 2. ŞIKTA kalıyordu →
   çocuk matematik yapmadan hep ikinciye basıp %100 alabiliyordu.
   Bu, ölçme-değerlendirmeyi tamamen geçersiz kılan bir hataydı.

   HATA 2: Bağımsız modlarda (Birlikte Oyna) "sonraki bölüm" kavramı yok;
   sonuç ekranında ileri gitme yolu bulunmuyordu.

   Bu test her iki hatayı da kalıcı olarak engeller.
   ------------------------------------------------------------ */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

async function giris(ad, kod) {
  await c.goto(`${B}/index.html`, 2400);
  await c.evaluate(`(() => { localStorage.clear(); return true; })()`);
  await c.goto(`${B}/index.html`, 2000);
  await c.evaluate(`(() => {
    const i = [...document.querySelectorAll('input[type="text"]')];
    if (i[0]) { i[0].value = ${JSON.stringify(ad)}; i[0].dispatchEvent(new Event('input',{bubbles:true})); }
    if (i[1]) { i[1].value = ${JSON.stringify(kod)}; i[1].dispatchEvent(new Event('input',{bubbles:true})); }
    return true;
  })()`);
  await c.sleep(300);
  await c.clickByText('Maceraya başla', 'button', 500);
  await c.bekleEkran('map', 9000);
  await c.sleep(700);
  await c.evaluate(`(() => { const d=document.getElementById('dialog'); if(d && !d.hidden){const b=[...d.querySelectorAll('button')].find(x=>/Kolay/i.test(x.textContent||'')); if(b) b.click();} return true; })()`);
  await c.sleep(800);
}

/* ══════════════════════════════════════════════════════════════
   1) ŞIK KONUMU DAĞILIMI — en kritik test
   Doğru cevabın şıklardaki konumu RASTGELE olmalı. Hep aynı yerde
   olursa çocuk matematik yapmadan doğru cevabı bulur.

   NOT: Bu ölçüm MODÜL düzeyinde yapılır (400 soru üretip konum sayılır).
   DOM'dan okumayı denedim; oyun "Atla"/otomatik geçiş sırasında soru ile
   şıklar farklı anlara denk geldiği için güvenilmez sonuç veriyordu
   (yanlışlıkla %83 sapma ölçtü). Modül ölçümü kesin ve hızlı.
   ══════════════════════════════════════════════════════════════ */
await c.viewport(390, 844);
await c.goto(`${B}/index.html`, 2400);

const dagilim = JSON.parse(await c.evaluate(`(async () => {
  const Q = await import('./js/games/questions.js');
  const sayim = [0, 0, 0, 0];
  let sirali = 0, ornek = 0, bulunamadi = 0;
  for (let i = 0; i < 400; i++) {
    const q = Q.makeMultiplyQuestion({ tables: [1,2,3,4,5], mode: 'result', maxB: 5 });
    const opts = q.options || [];
    const idx = opts.findIndex((v) => Number(v) === Number(q.answer));
    if (idx < 0) { bulunamadi++; continue; }
    sayim[idx]++; ornek++;
    if (opts.length > 1 && opts.every((v, j, a) => j === 0 || v >= a[j-1])) sirali++;
  }
  return JSON.stringify({ ornek, bulunamadi, sayim, sirali });
})()`) || '{}');

T('Doğru cevap her zaman şıkların İÇİNDE (400 örnek)',
  dagilim.bulunamadi === 0 && dagilim.ornek === 400,
  `örnek=${dagilim.ornek} bulunamadı=${dagilim.bulunamadi}`);
// NOT: Rastgele 4 şıkkın kendiliğinden küçükten büyüğe sıralı çıkma olasılığı
// 1/4! = %4,2'dir (≈17/400). Yani "sıfır sıralı" beklemek YANLIŞ olurdu.
// Gerçek hata kalıbı: neredeyse HEPSİ sıralı (eski kodda %100 idi).
T('★ Şıklar küçükten büyüğe SIRALI DEĞİL (eski hata: %100 sıralıydı)',
  dagilim.sirali < 400 * 0.15, `sıralı çıkan: ${dagilim.sirali}/400 (rastgele beklenen ≈17, eski hata: 400)`);

const s = dagilim.sayim || [0, 0, 0, 0];
const toplam = s.reduce((a, b) => a + b, 0) || 1;
const enYogun = Math.max(...s) / toplam;
const enSeyrek = Math.min(...s) / toplam;
T('★ Doğru cevap 4 konumun HEPSİNDE çıkıyor',
  s.every((v) => v > 0), `dağılım: ${JSON.stringify(s)}`);
T('★ Dağılım DENGELİ (hiçbir konum %45\'ten fazla baskın değil)',
  enYogun < 0.45, `en yoğun: %${(enYogun * 100).toFixed(0)} · en seyrek: %${(enSeyrek * 100).toFixed(0)} · ${JSON.stringify(s)}`);

/* ══════════════════════════════════════════════════════════════
   2) BİRLİKTE OYNA SONUÇ: ileri gitme yolu var mı?
   ══════════════════════════════════════════════════════════════ */
await giris('Konum', '2K');
await c.evaluate(`(() => { const b=[...document.querySelectorAll('.map-head .btn')].find(x=>/Birlikte/i.test(x.textContent||'')); if(b) b.click(); return true; })()`);
await c.sleep(1300);
await c.evaluate(`(() => { const k=document.querySelector('.tg-konu'); if(k) k.click(); return true; })()`);
await c.sleep(3400);
T('Birlikte Oyna oyunu başladı', (await c.evaluate(`document.querySelector('.screen.active')?.dataset.screen`)) === 'game');

await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('.tg-alt button')].find(x => /Bitir/i.test(x.textContent||''));
  if (b) b.click();
  return !!b;
})()`);
await c.sleep(2400);
const sonuc = JSON.parse(await c.evaluate(`(() => {
  const ekran = document.querySelector('.screen.active');
  const butonlar = [...(ekran?.querySelectorAll('button') || [])].map(b => b.innerText.trim());
  return JSON.stringify({ ekran: ekran?.dataset.screen, butonlar });
})()`) || '{}');
T('Birlikte Oyna sonuç ekranı açıldı', sonuc.ekran === 'result', `ekran=${sonuc.ekran}`);
T('★ Birlikte Oyna sonucunda HARİTA butonu var (ileri gitme yolu)',
  (sonuc.butonlar || []).some((t) => /Harita/i.test(t)), (sonuc.butonlar || []).join(' | '));
T('★ Birlikte Oyna sonucunda BAŞKA KONU / YENİ TUR butonu var',
  (sonuc.butonlar || []).some((t) => /Başka konu|Yeni tur/i.test(t)), (sonuc.butonlar || []).join(' | '));

/* ══════════════════════════════════════════════════════════════
   3) NORMAL BÖLÜM: "Sonraki bölüm" butonu ve kilidi açıyor mu?
   ══════════════════════════════════════════════════════════════ */
await giris('Ilerleme', '2I');
await c.evaluate(`(() => { document.querySelectorAll('.world-card')[0].click(); return true; })()`);
await c.sleep(900);
await c.evaluate(`(() => { const n=[...document.querySelectorAll('.level-node')]; if(n[0]) n[0].click(); return true; })()`);
await c.sleep(1200);
await c.clickByText('Başla', 'button', 3600);

for (let i = 0; i < 20; i++) {
  const d = JSON.parse(await c.evaluate(`(() => {
    if (document.querySelector('.screen.active')?.dataset.screen !== 'game') return JSON.stringify({ bitti: true });
    const q = document.querySelector('.question')?.innerText || '';
    const btns = [...document.querySelectorAll('.answer-btn')];
    if (!btns.length) return JSON.stringify({ bitti: false });
    const m = q.match(/(\\d+)\\s*[x×*]\\s*(\\d+)/);
    if (!m) return JSON.stringify({ bitti: false });
    const dogru = String(Number(m[1]) * Number(m[2]));
    const hedef = btns.find(b => (b.textContent || '').trim() === dogru);
    if (hedef) hedef.click();
    return JSON.stringify({ bitti: false });
  })()`));
  if (d.bitti) break;
  await c.sleep(950);
}
await c.sleep(3000);

const r3 = JSON.parse(await c.evaluate(`(() => {
  const ekran = document.querySelector('.screen.active');
  const butonlar = [...(ekran?.querySelectorAll('button') || [])].map(b => b.innerText.trim());
  return JSON.stringify({ ekran: ekran?.dataset.screen, butonlar });
})()`) || '{}');
T('Normal bölüm sonuç ekranı açıldı', r3.ekran === 'result', `ekran=${r3.ekran}`);
T('★ Normal bölümde "Sonraki bölüm" butonu VAR',
  (r3.butonlar || []).some((t) => /Sonraki bölüm/i.test(t)), (r3.butonlar || []).join(' | '));

if ((r3.butonlar || []).some((t) => /Sonraki bölüm/i.test(t))) {
  await c.clickByText('Sonraki bölüm', 'button', 2200);
  const ileri = JSON.parse(await c.evaluate(`(() => {
    const d = document.getElementById('dialog');
    return JSON.stringify({
      diyalogAcik: !!(d && !d.hidden),
      metin: (d?.innerText || '').slice(0, 60)
    });
  })()`) || '{}');
  T('★ "Sonraki bölüm" GERÇEKTEN ilerletiyor (yeni bölüm brifingi açılıyor)',
    ileri.diyalogAcik === true, JSON.stringify(ileri));
}

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
