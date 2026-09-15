/* ============================================================
   adaptive.js — Adaptif zorluk + aralıklı tekrar (spaced repetition)

   AMAÇ: Çocuk zorlandığı yeri daha sık görsün, iyi yaptığı yeri
   daha az görsün; zorluk çocuğa göre ayarlansın. Böylece hem
   sıkılmasın hem ezilmesin.
   ============================================================ */

const RECENT_MAX = 12;   // son kaç cevap hatırlanır

/** Son cevapları profilde tut (0 = yanlış, 1 = doğru) */
export function pushRecent(profile, correct) {
  if (!profile?.stats) return;
  const r = profile.stats.recent || (profile.stats.recent = []);
  r.push(correct ? 1 : 0);
  while (r.length > RECENT_MAX) r.shift();
}

/** Son performans: 0..1 arası doğruluk (veri yoksa 0.5 = nötr) */
export function recentAccuracy(profile) {
  const r = profile?.stats?.recent || [];
  if (r.length < 3) return 0.5;
  return r.reduce((a, b) => a + b, 0) / r.length;
}

/**
 * Zorluk kademesi:
 *   0 = kolay (çocuk zorlanıyor)  → sayı aralığını dar tut
 *   1 = normal
 *   2 = zorlu (çocuk iyi gidiyor) → sayı aralığını genişlet
 */
export function difficultyTier(profile) {
  const acc = recentAccuracy(profile);
  const n = (profile?.stats?.recent || []).length;
  if (n < 4) return 1;                    // yeterli veri yok → normal
  if (acc >= 0.85) return 2;
  if (acc <= 0.55) return 0;
  return 1;
}

/** Zorluk kademesine göre çarpan üst sınırı */
export function adaptiveMaxB(profile, baseMaxB, hardMaxB = 10) {
  const t = difficultyTier(profile);
  if (t === 0) return Math.max(3, Math.min(baseMaxB, 4));
  if (t === 2) return Math.min(hardMaxB, baseMaxB + 3);
  return baseMaxB;
}

/** Çocuğun zorlandığı (zayıf) tabloları bul */
export function tableAccuracy(profile, table) {
  const st = profile?.stats?.byTable?.[String(table)];
  if (!st || (st.c + st.w) < 2) return null;
  return st.c / (st.c + st.w);
}

/**
 * Ağırlıklı tablo seçimi: zayıf tablolar daha sık çıkar.
 * @param {object} profile
 * @param {number[]} candidates bölümün izin verdiği tablolar
 * @param {number} count kaç tablo seçilecek
 */
export function pickAdaptiveTables(profile, candidates, count = 1) {
  const pool = candidates && candidates.length ? candidates : [2];
  // Her tabloya ağırlık: düşük doğruluk → yüksek ağırlık
  const weights = pool.map((t) => {
    const acc = tableAccuracy(profile, t);
    if (acc == null) return 1.15;         // hiç denenmemiş → hafif öncelik
    return Math.max(0.35, 1.6 - acc);     // %100 doğru → 0.6, %50 → 1.1
  });

  const secilen = [];
  const havuz = pool.slice();
  const w = weights.slice();
  for (let k = 0; k < Math.min(count, pool.length); k++) {
    const toplam = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * toplam;
    let idx = 0;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { idx = i; break; } }
    secilen.push(havuz[idx]);
    havuz.splice(idx, 1);
    w.splice(idx, 1);
  }
  // Seçilen yoksa rastgele doldur
  while (secilen.length < count) secilen.push(pool[secilen.length % pool.length]);
  return secilen;
}

/* ---------------- Aralıklı tekrar kuyruğu ----------------
   Yanlış yapılan soru, birkaç soru sonra tekrar sorulur.
   Böylece "yanlış yaptım, öğrenmeden geçtim" olmaz.          */

export function initMissed(profile) {
  if (!profile) return;
  profile.missed = profile.missed || [];       // [{ a, b, mode, n }]
}

/** Yanlış yapılan çarpımı kuyruğa ekle */
export function pushMissed(profile, q) {
  if (!profile || !q || q.kind !== 'multiply') return;
  initMissed(profile);
  const key = `${q.mode}:${q.a}x${q.b}`;
  const mevcut = profile.missed.find((m) => m.key === key);
  if (mevcut) { mevcut.n = (mevcut.n || 1) + 1; return; }
  profile.missed.push({ key, a: q.a, b: q.b, mode: q.mode, n: 1 });
  if (profile.missed.length > 6) profile.missed.shift();   // kuyruk sınırlı
}

/** Kuyruktan tekrar sorulacak soru (varsa) — kaç soru sonra hatırlatılır */
export function takeDueMissed(profile) {
  const m = profile?.missed || [];
  if (!m.length) return null;
  const secim = m[0];
  profile.missed = m.slice(1);
  return secim;
}

export function clearMissed(profile) {
  if (profile) profile.missed = [];
}

/**
 * Bölüm için soru planı üret.
 * Her 3. soruda (varsa) daha önce yanlış yapılan soru tekrar sorulur.
 */
export function shouldReask(index) {
  return index > 0 && index % 3 === 0;
}
