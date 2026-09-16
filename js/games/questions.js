/* ============================================================
   questions.js — soru üreteçleri (çarpım, kenar/köşe, dokun-şekil)
   multiply.js / sides.js / boss.js / duel.js bu modülü paylaşır.
   ============================================================ */

import { randInt, shuffle } from '../ui.js';
import { SHAPES, SHAPE_IDS } from '../shapes.js';

export function uniqueNumbers(list) {
  return [...new Set(list.filter((n) => Number.isFinite(n) && n >= 0).map((n) => Math.round(n)))];
}

/**
 * Doğru cevap + PEDAGOJİK çeldiriciler.
 *
 * İyi çeldirici "bariz yanlış" değil, "düşünmeyi gerektiren" olandır:
 *   1) Tablo komşusu (a×(b±1))  → tabloyu gerçekten biliyor mu?
 *   2) Toplama hatası (a+b)     → × ile + karıştırıyor mu?
 *   3) ±1 / ±2                  → dikkat hatası
 *   4) Onluk kayma (±10)        → SADECE cevap ≥20 ise (küçük sayıda anlamsız:
 *                                 4 yerine 14 seçeneği soruyu bedava kolaylaştırır)
 *
 * @param {number} answer
 * @param {{count?:number,min?:number,max?:number,pool?:number[],step?:number,factors?:number[]}} o
 *   step    → tablo adımı (çarpanda a). Tablo komşusu çeldirici üretir.
 *   factors → [a, b] toplama hatası çeldiricisi için.
 */
export function numericOptions(answer, { count = 4, min = 0, max = 100, pool = [], step = 0, factors = null } = {}) {
  const set = new Set([answer]);
  const ekle = (v) => {
    if (set.size >= count) return;
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= min && n <= max && n !== answer) set.add(n);
  };

  /* 1) Tablo komşuları — en öğretici çeldirici */
  if (step > 0) { ekle(answer - step); ekle(answer + step); ekle(answer + 2 * step); }

  /* 2) Çarpma yerine toplama yapan çocuk */
  if (factors && factors.length === 2) ekle(Number(factors[0]) + Number(factors[1]));

  /* 3) Çağıranın önerdiği adaylar */
  for (const p of pool) ekle(p);

  /* 4) Dikkat hataları */
  for (const d of [-1, 1, -2, 2, 3, -3]) ekle(answer + d);

  /* 5) Onluk kayma — yalnızca cevap büyükken anlamlı */
  if (answer >= 20) { ekle(answer + 10); ekle(answer - 10); }

  /* 6) Hâlâ eksikse tablo adımıyla uzaklaş */
  const adim = Math.max(1, step || 1);
  let k = 3;
  while (set.size < count && k <= 12) { ekle(answer + k * adim); ekle(answer - k * adim); k++; }

  /* 7) Son çare: küçük artışlarla doldur */
  let e = 1;
  while (set.size < count && e <= 40) { ekle(answer + e); ekle(answer - e); e++; }

  return shuffle([...set]).slice(0, count);
}

/* ---------------- Sayı sözcükleri ----------------
   Toplama/çıkarma sorularında sayılar RASTGELE üretilir (1-100 arası
   binlerce kombinasyon) — hepsini önceden kaydetmek imkânsız.
   Çözüm: sayıları PARÇA parça kaydedip cümleyi birleştirmek.
   0-100 arası sayı sözcükleri + operatörler önceden üretildi. */
const BIRLER = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const ONLAR = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

/** Türkçe sayı sözcüğü (0-100) — Python üreticisiyle AYNI algoritma */
export function sayiMetni(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'sıfır';
  if (n === 100) return 'yüz';
  if (n < 10) return BIRLER[n];
  if (n < 100) {
    const o = Math.floor(n / 10), b = n % 10;
    return (ONLAR[o] + (b ? ' ' + BIRLER[b] : '')).trim();
  }
  return String(n);
}

/**
 * Sorunun SES PARÇALARI — ses dosyası olan kısa parçalara böler.
 * addsub: ["yirmi üç", "artı", "sekiz", "kaç eder?"]
 * Bu sayede rastgele üretilen her toplama sorusu doğal sesle okunur.
 */
export function questionSpeechParts(q) {
  if (!q) return null;
  if (q.kind === 'addsub') {
    return [sayiMetni(q.a), q.mode === 'add' ? 'artı' : 'eksi', sayiMetni(q.b), 'kaç eder?'];
  }
  if (q.kind === 'multiply' && q.mode !== 'result' && q.a != null && q.b != null) {
    // Eksik/ters modda da parçalara bölebiliriz
    if (q.mode === 'missing') return ['bir', 'çarpı', 'kaç', 'eder'];
    if (q.mode === 'reverse') return ['kaç', 'çarpı', 'bir', 'eder'];
  }
  return null;
}
/* ---------------- Tekrar önleyici ----------------
   Aynı sorunun arka arkaya gelmesini engeller. Son 4 soru hatırlanır. */
const RECENT_MAX = 4;
let recentKeys = [];

export function resetQuestionMemory() { recentKeys = []; }

function remember(key) {
  recentKeys.push(key);
  if (recentKeys.length > RECENT_MAX) recentKeys.shift();
}

/** Üreteci, yeni bir soru çıkana kadar dener (sonsuz döngüye girmez). */
function novel(tag, keyOf, make, tries = 30) {
  let q = make();
  for (let i = 0; i < tries; i++) {
    const k = tag + ':' + keyOf(q);
    if (!recentKeys.includes(k)) { remember(k); return q; }
    q = make();
  }
  remember(tag + ':' + keyOf(q));
  return q;
}

/* ---------------- Çarpım ----------------
   facts: HEDEFLİ ÇALIŞMA için — kesin sorular [{a,b}, ...] verilirse
   yalnız onlar sorulur. Veli panelindeki "takıldığı sorular" modu bunu
   kullanır; öğrenme araştırmasında en etkili müdahale tüm tabloyu değil
   TAKILDIĞI SORUYU çalışmaktır. */
function buildMultiply({ tables = [2], mode = 'result', maxB = 5, facts = null } = {}) {
  let a, b;
  if (facts && facts.length) {
    const f = facts[Math.floor(Math.random() * facts.length)];
    a = Number(f.a);
    b = Number(f.b);
  } else {
    a = tables[Math.floor(Math.random() * tables.length)];
    b = randInt(1, maxB);
  }
  const product = a * b;
  const m = mode === 'mix' ? ['result', 'missing', 'reverse'][randInt(0, 2)] : mode;

  if (m === 'missing') {
    return {
      kind: 'multiply', table: a, a, b, answer: b, mode: 'missing',
      prompt: `${a} × ? = ${product}`,
      ask: `${a} çarpı kaç, ${product} eder?`,
      options: numericOptions(b, {
        min: 1, max: Math.max(10, maxB), count: 4,
        step: 1, factors: [a, b],
        pool: [b + 1, b - 1, b + 2, Math.max(1, b - 2), a]
      })
    };
  }
  if (m === 'reverse') {
    return {
      kind: 'multiply', table: b, a, b, answer: a, mode: 'reverse',
      prompt: `? × ${b} = ${product}`,
      ask: `Kaç çarpı ${b}, ${product} eder?`,
      options: numericOptions(a, {
        min: 1, max: Math.max(10, maxB), count: 4,
        step: 1, factors: [a, b],
        pool: [a + 1, a - 1, a + 2, Math.max(1, a - 2), b]
      })
    };
  }
  return {
    kind: 'multiply', table: a, a, b, answer: product, mode: 'result',
    prompt: `${a} × ${b} = ?`,
    ask: `${a} çarpı ${b} kaç eder?`,
    // step = a → "bir üst/alt tablo" çeldiricisi (tabloyu gerçekten biliyor mu?)
    options: numericOptions(product, {
      min: 1, max: 200, count: 4,
      step: a, factors: [a, b],
      pool: [a * (b + 1), a * (b - 1)]
    })
  };
}

/** Çarpım sorusu — aynı soru arka arkaya gelmez. */
export function makeMultiplyQuestion(cfg = {}) {
  return novel('mul', (q) => `${q.mode}:${q.a}x${q.b}`, () => buildMultiply(cfg));
}

/* ---------------- Toplama / Çıkarma (2. sınıf çekirdek kazanımı) ----------------
   Müfredat: 100'e kadar eldeli/eldeisiz toplama, onluk bozarak/bozmadan çıkarma.
   Zorluk kademeli: önce eldesiz, sonra eldeli; önce 1 basamak, sonra 2 basamak. */

function buildAdd({ max = 20, carry = false, mode = 'add' } = {}) {
  if (mode === 'sub') {
    // Çıkarma: sonuç negatif olmasın
    let a, b;
    if (carry) {
      // Onluk bozma gerektiren: birler basamağı yetmez
      do {
        a = randInt(11, Math.max(21, max));
        const aBir = a % 10;
        b = randInt(aBir + 1, Math.min(9, a - 1) >= aBir + 1 ? Math.min(9, a - 1) : 9);
      } while (b >= a || a % 10 >= b % 10 || b === 0);
    } else {
      // Onluk bozma GEREKMESİN: birler basamağı yetsin
      do {
        a = randInt(11, Math.max(21, max));
        const aBir = a % 10;
        b = randInt(1, Math.max(1, aBir));
      } while (b >= a);
    }
    const answer = a - b;
    return {
      kind: 'addsub', mode: 'sub', a, b, answer,
      prompt: `${a} − ${b} = ?`,
      ask: `${a} eksi ${b} kaç eder?`,
      options: numericOptions(answer, {
        min: 0, max: 120, count: 4,
        step: 10, factors: null,
        pool: [answer + 1, answer - 1, answer + 10, answer - 10, a + b]
      })
    };
  }
  // Toplama
  let a, b;
  if (carry) {
    do {
      a = randInt(5, Math.max(10, max - 5));
      b = randInt(5, Math.max(10, max - a));
    } while (a % 10 + b % 10 < 10 || a + b > max);   // elde oluşsun
  } else {
    do {
      a = randInt(1, Math.max(5, max - 5));
      b = randInt(1, Math.max(5, max - a));
    } while (a % 10 + b % 10 >= 10);                 // elde olmasın
  }
  const answer = a + b;
  return {
    kind: 'addsub', mode: 'add', a, b, answer,
    prompt: `${a} + ${b} = ?`,
    ask: `${a} artı ${b} kaç eder?`,
    options: numericOptions(answer, {
      min: 0, max: 130, count: 4,
      step: 10, factors: null,
      pool: [answer + 1, answer - 1, answer + 10, answer - 10, Math.abs(a - b)]
    })
  };
}

/** Toplama/çıkarma sorusu — aynı soru arka arkaya gelmez. */
export function makeAddQuestion(cfg = {}) {
  return novel('add', (q) => `${q.mode}:${q.a}${q.mode === 'add' ? '+' : '-'}${q.b}`, () => buildAdd(cfg));
}

/** Kenar / köşe */
const SIDES_ASKABLE = ['kare', 'dikdortgen', 'ucgen', 'daire', 'besgen', 'altigen'];

export function makeSidesQuestion({ ask = 'mix', shapes = SIDES_ASKABLE } = {}) {
  const build = () => {
    const usable = shapes.filter((s) => SHAPES[s]);
    const shapeId = usable[randInt(0, usable.length - 1)];
    const s = SHAPES[shapeId];
    const kind = ask === 'mix' ? (Math.random() < 0.5 ? 'kenar' : 'kose') : ask;
    const answer = kind === 'kenar' ? s.sides : s.corners;
    const isCircle = shapeId === 'daire';
    const pool = uniqueNumbers([0, 3, 4, 5, 6, s.sides + 1, s.sides - 1, s.corners + 1]);
    return {
      kind: 'sides', shapeId, ask: kind, answer,
      prompt: `${s.name} — kaç ${kind === 'kenar' ? 'kenar' : 'köşe'}?`,
      ask: isCircle
        ? `Dairenin kaç ${kind === 'kenar' ? 'kenarı' : 'köşesi'} var?`
        : `${s.name}nin kaç ${kind === 'kenar' ? 'kenarı' : 'köşesi'} var?`,
      hint: isCircle ? 'Dairenin kenarı ve köşesi yoktur.' : `Kenarları say: ${s.prompt}.`,
      options: numericOptions(answer, { min: 0, max: 8, count: 4, pool })
    };
  };
  return novel('side', (q) => `${q.shapeId}:${q.ask}`, build);
}

/* ---------------- Dokun: doğru şekilleri topla ---------------- */
export function makeTapQuestion({ shapes = ['kare', 'ucgen', 'daire'], count = 4, distractors = 2 } = {}) {
  const build = () => {
    const usable = shapes.filter((s) => SHAPES[s]);
    const target = usable[randInt(0, usable.length - 1)];
    const others = SHAPE_IDS.filter((s) => s !== target && usable.includes(s));
    const otherPool = others.length ? others : SHAPE_IDS.filter((s) => s !== target);
    const tokens = [];
    for (let i = 0; i < count; i++) tokens.push({ id: 't' + i + '-' + Math.random().toString(36).slice(2, 6), shape: target, mine: true });
    for (let i = 0; i < distractors; i++) tokens.push({ id: 'd' + i + '-' + Math.random().toString(36).slice(2, 6), shape: otherPool[randInt(0, otherPool.length - 1)], mine: false });
    return {
      kind: 'tap', target, answer: count,
      prompt: `Tüm ${SHAPES[target].name.toLowerCase()}leri topla!`,
      ask: `Ekrandaki tüm ${SHAPES[target].name.toLowerCase()}leri topla.`,
      tokens: shuffle(tokens)
    };
  };
  return novel('tap', (q) => q.target, build);
}

/** Soruyu sesli okunacak metne çevir */
export function questionSpeech(q) {
  if (!q) return '';
  if (q.kind === 'multiply') return q.ask;
  if (q.kind === 'addsub') return q.ask;      // "23 artı 8 kaç eder?"
  if (q.kind === 'sides') return q.ask;
  if (q.kind === 'tap') return q.ask;
  return q.prompt || '';
}

export function scoreBand(accuracy) {
  if (accuracy >= 0.95) return 3;
  if (accuracy >= 0.78) return 2;
  return 1;
}
