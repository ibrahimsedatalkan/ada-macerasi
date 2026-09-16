/* ============================================================
   advice.js — Veli paneli için EYLEM önerisi üretir

   Panel sadece veri gösteriyordu ("4'lerde %50"). Veli ne yapacağını
   bilemiyordu. Burada ham istatistik "şunu oyna" tavsiyesine dönüşür.

   Her öneri: { tip, baslik, neden, eylem, hedef }
   tip: 'acil' | 'onemli' | 'iyi' | 'bilgi'
   ============================================================ */

import { WORLDS } from './worlds.js';

/** Bir tabloyu öğreten bölümleri bul */
export function tableLevels(table) {
  const out = [];
  for (const w of WORLDS) {
    for (const l of w.levels) {
      if (l.type === 'multiply' && (l.cfg?.tables || []).includes(table)) {
        out.push({ worldId: w.id, worldName: w.name, levelId: l.id, title: l.title, tek: (l.cfg.tables || []).length === 1 });
      }
    }
  }
  return out;
}

const MIN_DENEME = 3;   // tavsiye için gereken en az soru sayısı

function accOf(c) {
  const t = (c?.c || 0) + (c?.w || 0);
  return t ? c.c / t : null;
}

/**
 * Profil istatistiklerinden eylem listesi üret.
 * @returns {Array<{tip:string, baslik:string, neden:string, eylem:string, hedef?:object, ses?:string}>}
 */
export function buildAdvice(profile) {
  const out = [];
  const st = profile?.stats || {};
  const byTable = st.byTable || {};

  /* ---- 1) Zorlandığı tablolar (acil) ---- */
  const zayiflar = [];
  for (let t = 1; t <= 10; t++) {
    const c = byTable[String(t)];
    const a = accOf(c);
    const n = (c?.c || 0) + (c?.w || 0);
    if (a != null && n >= MIN_DENEME && a < 0.7) zayiflar.push({ t, a, n });
  }
  zayiflar.sort((x, y) => x.a - y.a);
  for (const z of zayiflar.slice(0, 3)) {
    const tekli = tableLevels(z.t).filter((l) => l.tek);
    const hedef = tekli[0] || tableLevels(z.t)[0];
    out.push({
      tip: 'acil',
      baslik: `${z.t}'lerde zorlanıyor`,
      neden: `Son ${z.n} soruda doğruluk %${Math.round(z.a * 100)}. Bu tabloda emin değil.`,
      eylem: hedef ? `"${hedef.worldName} → ${hedef.title}" bölümünü birlikte tekrar oynayın. Kısa tutun: 5-10 dakika.` : `Birlikte ${z.t}'leri sayın (${z.t}'er ${z.t}'er ritmik sayma).`,
      hedef,
      ses: `${z.t}'lerde biraz zorlanıyor. Kısa bir tekrar iyi gelir.`
    });
  }

  /* ---- 2) Hiç denenmemiş tablolar (önemli) ---- */
  const hicYok = [];
  for (let t = 1; t <= 10; t++) {
    const c = byTable[String(t)];
    if (!c || ((c.c || 0) + (c.w || 0)) === 0) hicYok.push(t);
  }
  if (hicYok.length) {
    const ilk = hicYok[0];
    const hedef = tableLevels(ilk)[0];
    out.push({
      tip: 'onemli',
      baslik: hicYok.length === 1 ? `${ilk}'lar henüz hiç denenmedi` : `${hicYok.length} tablo henüz hiç denenmedi`,
      neden: hicYok.length === 1
        ? `2. sınıf müfredatında ${ilk}'lar var, ama oyunda hiç sorulmamış.`
        : `Şu tablolara hiç dokunulmadı: ${hicYok.join(', ')}.`,
      eylem: hedef ? `"${hedef.worldName}" adasını açın — ${hedef.title} ile başlayın.` : 'Yıldız Adası’nı deneyin.',
      hedef,
      ses: `${hicYok.length} tablo hiç denenmemiş. Sırayla gidin.`
    });
  }

  /* ---- 3) İpucu bağımlılığı (önemli) ---- */
  const ipucsuz = st.correctNoHint || 0;
  const dogru = st.correct || 0;
  if (dogru >= 20 && ipucsuz / Math.max(1, dogru) < 0.35) {
    out.push({
      tip: 'onemli',
      baslik: 'İpucu bağımlılığı başlıyor',
      neden: `${dogru} doğru cevabın yalnızca ${ipucsuz} tanesi ipucu kullanmadan geldi.`,
      eylem: 'Çocuğa "önce kendi başına dene, olmazsa ipucu" deyin. Bölümü ipucsuz bitirirse "Kendi Başına" çıkartmasını kazanır.',
      ses: 'İpuçsuz denemesi için cesaretlendirin.'
    });
  }

  /* ---- 4) Hazır: daha zoru (iyi haber) ---- */
  const genelToplam = (st.correct || 0) + (st.wrong || 0);
  const genelAcc = genelToplam ? (st.correct || 0) / genelToplam : 0;
  if (genelToplam >= 30 && genelAcc >= 0.85) {
    const zorTablo = hicYok.length ? hicYok[0] : 9;
    out.push({
      tip: 'iyi',
      baslik: 'Hazır — zorluk artırılabilir',
      neden: `Genel doğruluk %${Math.round(genelAcc * 100)}. Kolay bölümler artık sıkıcı olabilir.`,
      eylem: `Yıldız Adası (6-10'lar) bölümlerini açabilirsiniz. Oyun zorluğu kendi de ayarlıyor: iyi gittiğinde sayılar büyür.`,
      ses: 'Maşallah, doğruluk yüksek. Zor bölümlere geçebilir.'
    });
  }

  /* ---- 5) Seri (bilgi) ---- */
  const seri = profile?.streak || {};
  if ((seri.count || 0) >= 3) {
    out.push({
      tip: 'bilgi',
      baslik: `${seri.count} gün üst üste oynuyor`,
      neden: 'Günlük kısa çalışma, uzun tek seferden çok daha etkili (aralıklı tekrar).',
      eylem: 'Günde 10-15 dakika yeterli. Seriyi bozmamak kendi başına motivasyon oluyor.',
      ses: `${seri.count} gün üst üste oynadı, harika.`
    });
  } else if (genelToplam > 0 && (seri.count || 0) === 0) {
    out.push({
      tip: 'bilgi',
      baslik: 'Günlük düzen kurulmadı',
      neden: 'Aralıklı tekrar (her gün az az) öğrenmeyi kalıcı yapar.',
      eylem: 'Her gün aynı saatte 10 dakika oynatmayı deneyin — örneğin akşam yemeğinden sonra. Günlük seri rozeti çocuğa hedef olur.',
      ses: 'Her gün kısa çalışmak en iyisi.'
    });
  }

  /* ---- 6) Geometri (varsa) ---- */
  const byShape = st.byShape || {};
  const zayifSekil = Object.entries(byShape)
    .map(([k, c]) => ({ k, a: accOf(c), n: (c.c || 0) + (c.w || 0) }))
    .filter((x) => x.a != null && x.n >= MIN_DENEME && x.a < 0.7)
    .sort((x, y) => x.a - y.a)[0];
  if (zayifSekil) {
    out.push({
      tip: 'onemli',
      baslik: `${zayifSekil.k} şeklinde zorlanıyor`,
      neden: `Doğruluk %${Math.round(zayifSekil.a * 100)} (${zayifSekil.n} soru).`,
      eylem: 'Kristal Mağara adasındaki kenar/köşe bölümlerini tekrar oynayın. Evde de o şeklin nesnelerini sayabilirsiniz (tabak, kitap, pencere).',
      ses: `${zayifSekil.k} şeklinde biraz zorlanıyor.`
    });
  }

  // Hiç veri yoksa
  if (!out.length && genelToplam === 0) {
    out.push({
      tip: 'bilgi',
      baslik: 'Henüz veri yok',
      neden: 'Çocuk oynamaya başlayınca burada kişiye özel öneriler görünecek.',
      eylem: 'İlk bölümü birlikte oynayın. Oyun sesli anlatıyor, okuma bilmese de oynayabilir.',
      ses: 'Henüz veri yok. Çocuk oynamaya başlasın.'
    });
  }

  // Sıralama: acil → önemli → iyi → bilgi
  const sira = { acil: 0, onemli: 1, iyi: 2, bilgi: 3 };
  return out.sort((a, b) => sira[a.tip] - sira[b.tip]).slice(0, 5);
}

/** Önerileri kısa, paylaşılabilir metne çevir (WhatsApp/e-posta için) */
export function adviceToText(profile, advice) {
  const satir = [`${profile?.nick || 'Oyuncu'} — çalışma önerileri`, ''];
  for (const a of advice) {
    satir.push(`• ${a.baslik}`);
    satir.push(`  Neden: ${a.neden}`);
    satir.push(`  Yapılacak: ${a.eylem}`);
    satir.push('');
  }
  return satir.join('\n');
}

/* ============================================================
   HATA ÖRÜNTÜSÜ ANALİZİ
   ------------------------------------------------------------
   PEDAGOJİK GEREKÇE: "7'lerde zayıf" demek veliye yol göstermez.
   Öğrenme araştırmasında etkili müdahale SORU DÜZEYİNDE olur: çocuk
   7×8'de takılıyorsa YALNIZ o soruyu çalışmak gerekir — 7'lerin
   tamamını baştan çalıştırmak zaman kaybı ve sıkıcıdır.

   Analiz üç şey bulur:
     1) TAKILMA NOKTASI — belirli bir soruda ısrarlı hata (7×8)
     2) KARIŞTIRMA      — komşu iki sonucu karıştırma (7×8 ↔ 7×9)
     3) ÇÖZÜLEN         — eskiden zayıf olup artık doğru yapılan
   ============================================================ */

/** Belirli bir çarpım sorusunda ısrarlı hata var mı? */
export function takilmaNoktalari(profile, { enAzYanlis = 2, enAzDeneme = 3 } = {}) {
  const bf = profile?.stats?.byFact || {};
  const liste = [];
  for (const [k, v] of Object.entries(bf)) {
    const toplam = (v.c || 0) + (v.w || 0);
    if (toplam < enAzDeneme || (v.w || 0) < enAzYanlis) continue;
    const dogruluk = (v.c || 0) / toplam;
    if (dogruluk > 0.5) continue;                      // yarıdan fazla doğruysa takılma sayılmaz
    const [a, b] = k.split('x').map(Number);
    if (!(a >= 1 && a <= 10 && b >= 1 && b <= 10)) continue;   // yalnız çarpım tablosu
    liste.push({ fakt: k, a, b, c: v.c || 0, w: v.w || 0, toplam, dogruluk, son: v.son || 0 });
  }
  // En çok yanlış + en taze olan öne
  return liste.sort((x, y) => (y.w - x.w) || (y.son - x.son)).slice(0, 5);
}

/** Komşu sonuçları karıştırma: 7×8 ile 7×9 gibi ardışık iki soruda hata */
export function karistirmaNoktalari(profile) {
  const bf = profile?.stats?.byFact || {};
  const bulgular = [];
  for (const [k, v] of Object.entries(bf)) {
    const [a, b] = k.split('x').map(Number);
    if (!(a >= 1 && a <= 10 && b >= 1 && b <= 10)) continue;
    const toplam = (v.c || 0) + (v.w || 0);
    if (toplam < 4 || (v.w || 0) < 2) continue;
    const komsular = [];
    if (b > 1) komsular.push(a + 'x' + (b - 1));
    if (b < 10) komsular.push(a + 'x' + (b + 1));
    const komsuHatali = komsular.filter((kk) => {
      const kv = bf[kk];
      if (!kv) return false;
      const kt = (kv.c || 0) + (kv.w || 0);
      return kt >= 3 && (kv.w || 0) >= 2;
    });
    if (komsuHatali.length) bulgular.push({ fakt: k, komsu: komsuHatali[0], a, b });
  }
  return bulgular.slice(0, 3);
}

/** Sonunda öğrenilmiş eski zayıf sorular — motivasyon için önemli */
export function cozulenler(profile) {
  const bf = profile?.stats?.byFact || {};
  const liste = [];
  for (const [k, v] of Object.entries(bf)) {
    const [a, b] = k.split('x').map(Number);
    if (!(a >= 1 && a <= 10 && b >= 1 && b <= 10)) continue;
    const toplam = (v.c || 0) + (v.w || 0);
    if (toplam < 4) continue;
    if ((v.w || 0) >= 2 && v.c >= 3 && (v.c / toplam) >= 0.75) liste.push({ fakt: k, a, b });
  }
  return liste.slice(0, 4);
}

/** Analiz sonucunu tek, UYGULANABİLİR öneriye çevir */
export function hataOnerisi(profile) {
  const takil = takilmaNoktalari(profile);
  const karis = karistirmaNoktalari(profile);
  const cozul = cozulenler(profile);

  if (takil.length) {
    const t = takil[0];
    const k = karis.find((x) => x.fakt === t.fakt);
    if (k) {
      const [ka, kb] = k.komsu.split('x');
      return `⚠️ ${t.a}×${t.b} ile ${ka}×${kb} sonuçlarını karıştırıyor (${t.w} kez kaçırdı). `
        + `Bu İKİ soruyu yan yana çalıştırın: "${t.a} kere ${t.b}" ve "${ka} kere ${kb}". Farkı görmek karıştırmayı çözer.`;
    }
    const yardim = t.a >= 6 ? `5 kere ${t.b} artı ${t.a - 5} kere ${t.b}` : `${t.a}'yi parçalara ayırıp topla`;
    return `⚠️ ${t.a}×${t.b} sorusunda takılıyor (${t.w} kez kaçırdı, ${t.c} doğru). `
      + `Yalnız bu soruyu çalıştırın. İpucu: "${yardim}".`;
  }
  if (cozul.length) {
    return `✅ Güzel haber: ${cozul[0].fakt.replace('x', '×')} sorusunu artık doğru yapıyor! `
      + `Eskiden zorlanıyordu — bu ilerlemeyi çocuğunuza söyleyin, çok motive eder.`;
  }
  return null;
}
