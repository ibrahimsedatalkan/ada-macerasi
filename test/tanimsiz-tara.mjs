/* İMPORT EDİLMEMİŞ EXPORT TARAYICISI
   ------------------------------------------------------------
   NEDEN: Bu turda AYNI SINIF 2 hata çıktı ve ikisi de kullanıcıya
   ulaştı:
     • close()    → ui.js export ediyor, main.js import ETMEMİŞ
                    → window.close()'a gitti, diyalog kapanmadı
     • speakSeq() → audio.js export ediyor, main.js import ETMEMİŞ
                    → ReferenceError, Sonsuz Macera çöktü

   İKİSİ DE aynı desen: bir modülün export ettiği isim, başka bir modülde
   KULLANILIYOR ama import listesinde YOK.

   Bu tarayıcı SADECE o deseni arar → yanlış pozitif neredeyse yok.
   (Genel "tanımsız isim" araması denendi; metin içindeki Türkçe
   kelimeler yüzünden yüzlerce yanlış pozitif verdi.)
   ------------------------------------------------------------ */
import fs from 'node:fs';
import path from 'node:path';

const KOK = path.join(import.meta.dirname, '..');
const JS = path.join(KOK, 'js');

function dosyalar(dir, liste = []) {
  for (const g of fs.readdirSync(dir, { withFileTypes: true })) {
    const tam = path.join(dir, g.name);
    if (g.isDirectory()) dosyalar(tam, liste);
    else if (g.name.endsWith('.js')) liste.push(tam);
  }
  return liste;
}

/** Yorum ve dizeleri temizle (dize içindeki kelimeler çağrı sanılmasın) */
function temizle(t) {
  let s = t.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  s = s.replace(/`(?:\\.|[^`\\])*`/g, '``');
  s = s.replace(/'(?:\\.|[^'\\\n])*'/g, "''");
  s = s.replace(/"(?:\\.|[^"\\\n])*"/g, '""');
  return s;
}

/* ---- 1) Tüm modüllerin EXPORT ettiği isimleri topla ---- */
const exportlar = new Map();   // isim -> [modül...]
for (const d of dosyalar(JS)) {
  const kod = temizle(fs.readFileSync(d, 'utf8'));
  const kisa = path.relative(KOK, d);
  for (const m of kod.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    if (!exportlar.has(m[1])) exportlar.set(m[1], []);
    exportlar.get(m[1]).push(kisa);
  }
  for (const m of kod.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) {
    if (!exportlar.has(m[1])) exportlar.set(m[1], []);
    exportlar.get(m[1]).push(kisa);
  }
  for (const m of kod.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const parca of m[1].split(',')) {
      const ad = parca.trim().split(/\s+as\s+/).pop().trim();
      if (!ad) continue;
      if (!exportlar.has(ad)) exportlar.set(ad, []);
      exportlar.get(ad).push(kisa);
    }
  }
}

/* ---- 2) Her modülde: import edilenler + yerel tanımlar ---- */
const bulgular = [];
for (const d of dosyalar(JS)) {
  const kod = temizle(fs.readFileSync(d, 'utf8'));
  const kisa = path.relative(KOK, d);

  const importEdilen = new Set();
  for (const m of kod.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
    for (const parca of m[1].split(',')) {
      const ad = parca.trim().split(/\s+as\s+/).pop().trim();
      if (ad) importEdilen.add(ad);
    }
  }
  for (const m of kod.matchAll(/import\s+(\w+)\s+from/g)) importEdilen.add(m[1]);

  const yerel = new Set();
  for (const m of kod.matchAll(/(?:^|\s)(?:async\s+)?function\s+(\w+)/g)) yerel.add(m[1]);
  for (const m of kod.matchAll(/(?:^|\s)(?:const|let|var)\s+(\w+)/g)) yerel.add(m[1]);
  for (const m of kod.matchAll(/(?:^|\s)class\s+(\w+)/g)) yerel.add(m[1]);
  for (const m of kod.matchAll(/for\s*\(\s*(?:const|let|var)?\s*(\w+)\s+of\s/g)) yerel.add(m[1]);
  for (const m of kod.matchAll(/catch\s*\(\s*(\w+)/g)) yerel.add(m[1]);
  for (const m of kod.matchAll(/function\s*\w*\s*\(([^)]*)\)/g)) {
    for (const p of m[1].split(',')) {
      const ad = p.trim().split('=')[0].trim();
      if (/^\w+$/.test(ad)) yerel.add(ad);
    }
  }
  for (const m of kod.matchAll(/\(([^)]*)\)\s*=>/g)) {
    for (const p of m[1].split(',')) {
      const ad = p.trim().split('=')[0].trim();
      if (/^\w+$/.test(ad)) yerel.add(ad);
    }
  }

  // Bu dosyada KULLANILAN ve BAŞKA modülde export edilen isimleri bul
  for (const isim of exportlar.keys()) {
    if (importEdilen.has(isim) || yerel.has(isim)) continue;
    // Bu dosyanın kendi exportu mu?
    if ((exportlar.get(isim) || []).includes(kisa)) continue;
    // Kullanılıyor mu?  isim(  veya  isim.  veya  isim,
    const kullanim = new RegExp('(^|[^.\\w$])' + isim + '\\s*[({.,]', 'm');
    if (!kullanim.test(kod)) continue;
    // Nesne anahtarı / metot adı olabilir:  isim:  veya  isim(
    const anahtar = new RegExp('(^|[^\\w$])' + isim + '\\s*:', 'm');
    const sadeceAnahtar = anahtar.test(kod) &&
      !new RegExp('(^|[^.\\w$])' + isim + '\\s*\\(', 'm').test(kod);
    if (sadeceAnahtar) continue;

    bulgular.push({ dosya: kisa, isim, kaynak: (exportlar.get(isim) || []).join(', ') });
  }
}

const benzersiz = new Map();
for (const b of bulgular) benzersiz.set(b.dosya + '|' + b.isim, b);
const liste = [...benzersiz.values()].sort((a, b) => a.dosya.localeCompare(b.dosya));

console.log('══════ İMPORT EDİLMEMİŞ EXPORT TARAMASI ══════');
console.log(`Taranan modül: ${dosyalar(JS).length} · toplam export: ${exportlar.size}`);
console.log('');
if (!liste.length) {
  console.log('✅ Hiçbir modülde "export edilmiş ama import edilmemiş" isim yok.');
} else {
  console.log(`⚠️  ${liste.length} şüpheli kullanım:\n`);
  for (const b of liste) {
    console.log(`  ${b.dosya}  →  ${b.isim}()`);
    console.log(`     export eden: ${b.kaynak}`);
  }
}
process.exit(liste.length ? 1 : 0);
