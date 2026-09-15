/* ============================================================
   questions.js — soru üreteçleri (çarpım, kenar/köşe, dokun-şekil)
   multiply.js / sides.js / boss.js / duel.js bu modülü paylaşır.
   ============================================================ */

import { randInt, shuffle } from '../ui.js';
import { SHAPES, SHAPE_IDS } from '../shapes.js';

export function uniqueNumbers(list) {
  return [...new Set(list.filter((n) => Number.isFinite(n) && n >= 0).map((n) => Math.round(n)))];
}

/** Doğru cevap + yakın çeldiriciler (pedagojik: komşu çarpımlar ve ±1) */
export function numericOptions(answer, { count = 4, min = 0, max = 100, pool = [] } = {}) {
  const set = new Set([answer]);
  const candidates = shuffle([
    ...pool,
    answer + 1, answer - 1, answer + 2, answer - 2,
    answer + 10, answer - 10, answer + 2, answer - 2
  ]);
  let gi = 0;
  const guard = 400;
  while (set.size < count && gi < guard) {
    const c = candidates[gi % candidates.length] + (gi > candidates.length ? Math.floor(gi / candidates.length) : 0);
    gi++;
    if (c >= min && c <= max && c !== answer) set.add(c);
  }
  let extra = answer + 3;
  while (set.size < count) { if (extra <= max && extra >= min) set.add(extra); extra += 3; }
  return shuffle([...set]).slice(0, count);
}

/* ---------------- Çarpım ---------------- */
export function makeMultiplyQuestion({ tables = [2], mode = 'result', maxB = 5 } = {}) {
  const a = tables[Math.floor(Math.random() * tables.length)];
  const b = randInt(1, maxB);
  const product = a * b;
  const m = mode === 'mix' ? ['result', 'missing', 'reverse'][randInt(0, 2)] : mode;

  if (m === 'missing') {
    return {
      kind: 'multiply', table: a, a, b, answer: b, mode: 'missing',
      prompt: `${a} × ? = ${product}`,
      ask: `${a} çarpı kaç, ${product} eder?`,
      options: numericOptions(b, { min: 1, max: Math.max(10, maxB), count: 4, pool: [1, 2, 3, 4, 5].filter((x) => x !== b) })
    };
  }
  if (m === 'reverse') {
    return {
      kind: 'multiply', table: b, a, b, answer: a, mode: 'reverse',
      prompt: `? × ${b} = ${product}`,
      ask: `Kaç çarpı ${b}, ${product} eder?`,
      options: numericOptions(a, { min: 1, max: Math.max(10, maxB), count: 4, pool: tables.filter((x) => x !== a) })
    };
  }
  return {
    kind: 'multiply', table: a, a, b, answer: product, mode: 'result',
    prompt: `${a} × ${b} = ?`,
    ask: `${a} çarpı ${b} kaç eder?`,
    options: numericOptions(product, { min: 1, max: 100, count: 4, pool: [a * (b + 1), a * (b - 1), a + b, 2 * a].filter((x) => x > 0) })
  };
}

/* ---------------- Kenar / köşe ---------------- */
const SIDES_ASKABLE = ['kare', 'dikdortgen', 'ucgen', 'daire', 'besgen', 'altigen'];

export function makeSidesQuestion({ ask = 'mix', shapes = SIDES_ASKABLE } = {}) {
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
}

/* ---------------- Dokun: doğru şekilleri topla ---------------- */
export function makeTapQuestion({ shapes = ['kare', 'ucgen', 'daire'], count = 4, distractors = 2 } = {}) {
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
}

/** Soruyu sesli okunacak metne çevir */
export function questionSpeech(q) {
  if (!q) return '';
  if (q.kind === 'multiply') return q.ask;
  if (q.kind === 'sides') return q.ask;
  if (q.kind === 'tap') return q.ask;
  return q.prompt || '';
}

export function scoreBand(accuracy) {
  if (accuracy >= 0.95) return 3;
  if (accuracy >= 0.78) return 2;
  return 1;
}
