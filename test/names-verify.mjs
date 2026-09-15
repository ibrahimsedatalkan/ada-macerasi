/* İSİM PAKETİ testleri
   Kritik: Python (üretim) ve JS (oyun) slug fonksiyonları BİREBİR aynı
   olmalı. Farklı olursa çocuk kendi adını duymaz, sessizce tarayıcı
   sesine düşer. Bu hata bir kez yaşandı: 'İpek' Python'da 'i-pek',
   JS'te 'ipek' çıkıyordu (Türkçe büyük İ birleşik nokta bırakıyor). */
import { connect, result } from './cdp.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
await c.viewport(900, 700);
await c.initErrors();

let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

/* ---- isimler.txt oku ---- */
const adlar = readFileSync('isimler.txt', 'utf-8').split('\n').map(s => s.trim()).filter(Boolean);
T('isimler.txt okundu', adlar.length > 0, `${adlar.length} isim`);

/* ---- Python slug'ları ---- */
const pyRaw = execFileSync('python3', ['-c', `
import json, sys, pathlib
sys.path.insert(0, 'tools')
from tts import slug
adlar = [l.strip() for l in pathlib.Path('isimler.txt').read_text(encoding='utf-8').splitlines() if l.strip()]
print(json.dumps({a: slug(a) for a in adlar}, ensure_ascii=False))
`], { encoding: 'utf-8' });
const pySlug = JSON.parse(pyRaw);

/* Zor isimler (listede olmasa da) — iki dilin aynı sonucu verdiğini kanıtlar */
const zorAdlar = ['İpek','Işıl','Şükrü','Öztürk','Çağla','Kağan','Meriç','Yiğit Efe','Gülçin','Ömer'];
const pyZor = JSON.parse(execFileSync('python3', ['-c', `
import json, sys
sys.path.insert(0, 'tools')
from tts import slug
print(json.dumps({a: slug(a) for a in ${JSON.stringify(zorAdlar)}}, ensure_ascii=False))
`], { encoding: 'utf-8' }));

/* ---- JS slug'ları (tarayıcıdan) ---- */
await c.goto(`${B}/index.html`, 2500);
const jsRaw = await c.evaluate(`(async () => {
  const A = await import('./js/audio.js');
  return JSON.stringify(${JSON.stringify(adlar)}.map(a => [a, A.nameSlug(a)]));
})()`);
const jsSlug = Object.fromEntries(JSON.parse(jsRaw || '[]'));

/* ---- Karşılaştır ---- */
const farklar = adlar.filter(a => pySlug[a] !== jsSlug[a])
  .map(a => `${a}: python=${pySlug[a]} js=${jsSlug[a]}`);
T('Python ve JS slug fonksiyonları BİREBİR aynı', farklar.length === 0,
  farklar.slice(0, 4).join(' | ') || `${adlar.length} isim kontrol edildi`);

/* Türkçe karakterlerin doğru sadeleştiğini ayrıca doğrula */
const jsZorRaw = await c.evaluate(`(async () => {
  const A = await import('./js/audio.js');
  return JSON.stringify(${JSON.stringify(zorAdlar)}.map(a => [a, A.nameSlug(a)]));
})()`);
const jsZor = Object.fromEntries(JSON.parse(jsZorRaw || '[]'));
const beklenen = { 'İpek':'ipek','Işıl':'isil','Şükrü':'sukru','Öztürk':'ozturk','Çağla':'cagla',
                   'Kağan':'kagan','Meriç':'meric','Yiğit Efe':'yigit-efe','Gülçin':'gulcin','Ömer':'omer' };
const yanlis = Object.entries(beklenen).filter(([a, b]) =>
  pyZor[a] !== b || jsZor[a] !== b).map(([a, b]) => `${a}→py=${pyZor[a]}/js=${jsZor[a]} (beklenen ${b})`);
T('Türkçe karakterler doğru sadeleşiyor', yanlis.length === 0, yanlis.join(' | ') || 'İ/ı/ş/ğ/ç/ö/ü ✓ (10 zor isim)');

/* ---- Her isim için MP3 var mı? ---- */
const eksik = adlar.filter(a => {
  const y = `assets/ses/isim/${pySlug[a]}.mp3`;
  return !existsSync(y) || statSync(y).size < 500;
});
T('Listenin TAMAMI için isim sesi üretilmiş', eksik.length === 0,
  eksik.length ? `eksik: ${eksik.join(', ')}` : `${adlar.length} dosya hazır`);

/* ---- names.json tutarlı mı? ---- */
const namesJson = JSON.parse(readFileSync('assets/ses/isim/names.json', 'utf-8'));
const manEksik = adlar.filter(a => !namesJson[pySlug[a]]);
T('names.json tüm isimleri içeriyor', manEksik.length === 0,
  manEksik.length ? `eksik: ${manEksik.join(', ')}` : `${Object.keys(namesJson).length} kayıt`);

/* ---- Oyun gerçekten buluyor mu? ---- */
const bulma = await c.evaluate(`(async () => {
  const A = await import('./js/audio.js');
  const nm = await (await fetch('assets/ses/isim/names.json')).json();
  const adlar = ${JSON.stringify(adlar)};
  const bulunmayan = adlar.filter(a => {
    const s = A.nameSlug(a);
    return !nm[s] && !nm[s.replace(/-/g,'')] ;
  });
  return JSON.stringify({ toplam: adlar.length, bulunmayan });
})()`);
const bl = JSON.parse(bulma || '{}');
T('Oyun her ismi paketde bulabiliyor', (bl.bulunmayan || []).length === 0,
  (bl.bulunmayan || []).length ? `bulunamayan: ${bl.bulunmayan.join(', ')}` : `${bl.toplam} isim ✓`);

/* ---- Karşılama parçaları ---- */
const kar = await c.evaluate(`(async () => {
  const A = await import('./js/audio.js');
  const m = await A.preloadSpeech();
  return JSON.stringify({
    hos: m['Hoş geldin'] || null,
    hazir: m['Bugün geometri öğreneceğiz. Hazır mısın?'] || null
  });
})()`);
const k = JSON.parse(kar || '{}');
T('Karşılama parçaları manifestte', !!k.hos && !!k.hazir, `${k.hos} | ${k.hazir}`);

const jsHatalar = await c.errors();
const hataListesi = Array.isArray(jsHatalar) ? jsHatalar
  : JSON.parse(typeof jsHatalar === 'string' && jsHatalar.trim() ? jsHatalar : '[]');
T('JS hatası yok', hataListesi.length === 0, JSON.stringify(hataListesi));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
