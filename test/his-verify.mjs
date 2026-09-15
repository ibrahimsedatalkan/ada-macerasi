/* Duyusal katman testleri: haptik (titreşim), ortam sesleri, müzik kısma */
import { connect, result } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(1280, 1000);
await c.initErrors();
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

await c.goto(`${B}/index.html`, 2600);

/* ---- 1) his.js yükleniyor ve API tam ---- */
const api = JSON.parse(await c.evaluate(`(async () => {
  const H = await import('./js/his.js');
  return JSON.stringify({
    titre: typeof H.titre, dogru: typeof H.titretDogru, yanlis: typeof H.titretYanlis,
    kombo: typeof H.titretKombo, trofe: typeof H.titretTrofe, dokun: typeof H.titretDokun,
    ortam: typeof H.ortamBaslat, ortamDur: typeof H.ortamDurdur, ortamVar: typeof H.ortamCaliyor,
    seviye: typeof H.muzikSeviye, konusma: typeof H.konusmaDurumu,
    destek: H.titresimAcik()
  });
})()`) || '{}');
T('his.js tüm haptik API sunuyor',
  api.dogru === 'function' && api.yanlis === 'function' && api.kombo === 'function' && api.trofe === 'function',
  `dogru=${api.dogru} kombo=${api.kombo} trofe=${api.trofe}`);
T('his.js ortam sesi API sunuyor',
  api.ortam === 'function' && api.ortamDur === 'function' && api.ortamVar === 'function');
T('Müzik kısma API sunuluyor', api.seviye === 'function' && api.konusma === 'function');

/* ---- 2) Titreşim çağrıları hata fırlatmıyor ---- */
const titresim = JSON.parse(await c.evaluate(`(async () => {
  const H = await import('./js/his.js');
  const sonuc = {};
  try { sonuc.dogru = H.titretDogru() !== undefined || true; } catch (e) { sonuc.dogru = false; }
  try { H.titretYanlis(); H.titretKombo(7); H.titretTrofe(); H.titretDokun(); sonuc.hepsi = true; } catch (e) { sonuc.hepsi = false; }
  return JSON.stringify(sonuc);
})()`) || '{}');
T('Titreşim çağrıları güvenli (hata yok)', titresim.hepsi === true);

/* ---- 3) Titreşim çağrısı gerçekten yapılıyor mu? (navigator.vibrate izleme) ---- */
const izleme = JSON.parse(await c.evaluate(`(async () => {
  const H = await import('./js/his.js');
  const kayit = [];
  const eski = navigator.vibrate;
  navigator.vibrate = (d) => { kayit.push(d); return true; };
  H.titretDogru(); H.titretYanlis(); H.titretTrofe();
  navigator.vibrate = eski;
  return JSON.stringify({ cagriSayisi: kayit.length, desenler: kayit.map(x => JSON.stringify(x)) });
})()`) || '{}');
T('Doğru/yanlış/trofe titreşim çağrısı yapıyor', izleme.cagriSayisi === 3,
  `${izleme.cagriSayisi} çağrı: ${(izleme.desenler || []).join(' , ')}`);

/* ---- 4) Ortam sesi başlat/durdur ---- */
const ortam = JSON.parse(await c.evaluate(`(async () => {
  const H = await import('./js/his.js');
  const once = H.ortamCaliyor();
  H.ortamBaslat('w2', 1);
  const sonra = H.ortamCaliyor();
  H.ortamDurdur();
  const durdu = H.ortamCaliyor();
  H.ortamBaslat('olmayan-ada', 1);   // bilinmeyen ada: hata vermemeli
  const bilinmeyen = H.ortamCaliyor();
  H.ortamDurdur();
  return JSON.stringify({ once, sonra, durdu, bilinmeyen });
})()`) || '{}');
T('Ortam sesi başlıyor', ortam.sonra === true, `önce=${ortam.once} sonra=${ortam.sonra}`);
T('Ortam sesi duruyor', ortam.durdu === false);
T('Bilinmeyen ada hata vermiyor', ortam.bilinmeyen === false);

/* ---- 5) Müzik kısma (ducking) ----
   NOT: Headless testte AudioContext `suspended` kalır (kullanıcı etkileşimi
   yok) → ses saati ilerlemez ve gain.value DEĞİŞMEZ. Bu yüzden değeri
   okumak yerine setTargetAtTime ÇAĞRISINI izliyoruz: doğru hedefe,
   doğru zamanda çağrılıyor mu? (Gerçek cihazda dokunma sesi açar.) */
const duck = JSON.parse(await c.evaluate(`(async () => {
  const H = await import('./js/his.js');
  const M = await import('./js/music.js');
  M.muzikBaslat('menu');
  const dugum = window.__adaMuzikKazanc;
  if (!dugum) return JSON.stringify({ hata: 'müzik düğümü yok' });

  const cagrilar = [];
  const gercek = dugum.gain.setTargetAtTime.bind(dugum.gain);
  dugum.gain.setTargetAtTime = (deger) => { cagrilar.push(+deger.toFixed(3)); return gercek(deger, 0, 0.08); };

  H.konusmaDurumu(true);                 // konuşma başladı → kıs
  const kisikCagri = cagrilar[cagrilar.length - 1];
  H.konusmaDurumu(false);                // konuşma bitti → geri aç
  const geriCagri = cagrilar[cagrilar.length - 1];

  // Ses bağlamı durumu (teşhis bilgisi)
  const durum = dugum.context.state;
  dugum.gain.setTargetAtTime = gercek;
  M.muzikDurdur();
  return JSON.stringify({ cagriSayisi: cagrilar.length, kisikCagri, geriCagri, durum });
})()`) || '{}');
T('Konuşma başlayınca müzik kısma çağrısı yapılıyor', (duck.kisikCagri || 99) < 0.5,
  `kısık hedefi=${duck.kisikCagri} (ses bağlamı: ${duck.durum})`);
T('Konuşma bitince müzik geri açma çağrısı yapılıyor', (duck.geriCagri || 0) > (duck.kisikCagri || 1),
  `kısık=${duck.kisikCagri} → geri=${duck.geriCagri}`);
T('Kısma hedefi konuşmayı duyurur (müziğin ~%32\'si)', (duck.kisikCagri || 0) > 0.05 && (duck.kisikCagri || 0) < 0.3,
  `hedef=${duck.kisikCagri}`);

/* ---- 6) Oyun müziği modları ---- */
const muzik = JSON.parse(await c.evaluate(`(async () => {
  const M = await import('./js/music.js');
  M.muzikBaslat('play');
  const a = M.muzikMod();
  M.muzikModu('victory'); const b = M.muzikMod();
  M.muzikYogunluk(3); M.muzikYogunluk(-5);
  M.muzikDurdur();
  return JSON.stringify({ play: a, victory: b, durdu: M.muzikCaliyor() });
})()`) || '{}');
T('Müzik modları değişiyor', muzik.play === 'play' && muzik.victory === 'victory');
T('Müzik durdurulabiliyor', muzik.durdu === false);

const jsHatalar = await c.errors();
const liste = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', liste.length === 0, JSON.stringify(liste));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
console.log(`Titreşim desteği (bu tarayıcıda): ${api.destek ? 'VAR' : 'yok (mobilde çalışır)'}`);
process.exit(fail ? 1 : 0);
