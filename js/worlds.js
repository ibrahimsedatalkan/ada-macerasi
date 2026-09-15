/* ============================================================
   worlds.js — macera haritası ve bölüm tanımları
   2. sınıf kazanımları: 1-5 çarpım tablosu, kare/dikdörtgen/
   üçgen/daire (+beşgen/altıgen), kenar-köşe, geometrik çizim.
   Zorluk sırayla artar: süre, seçenek sayısı, hayat sayısı,
   eksik çarpan soruları, karışık bölümler.
   ============================================================ */

export const WORLDS = [
  {
    id: 'w1',
    name: 'Çayır Adası',
    emoji: '🌱',
    mood: 'happy',
    intro: 'Pofi çayırda hazine sandığını arıyor. Çarpımları bilirsen yol açılır!',
    levels: [
      { id: 'w1-l1', title: "1'ler", type: 'multiply', story: 'Bir kere bir, hep bir!',
        cfg: { tables: [1], mode: 'result', rounds: 6, options: 3, lives: 3 } },
      { id: 'w1-l2', title: "2'ler", type: 'multiply', story: 'İkişer ikişer sayalım.',
        cfg: { tables: [2], mode: 'result', rounds: 7, options: 3, lives: 3 } },
      { id: 'w1-l3', title: "3'ler", type: 'multiply', story: 'Üçer üçer zıplayalım.',
        cfg: { tables: [3], mode: 'result', rounds: 7, options: 3, lives: 3 } },
      { id: 'w1-l4', title: 'Karışık 1-2', type: 'multiply', story: 'İki tablo karıştı, dikkat!',
        cfg: { tables: [1, 2], mode: 'result', rounds: 8, options: 4, lives: 3 } },
      { id: 'w1-l5', title: 'Hız Turu', type: 'multiply', story: 'Süre başlıyor, hızlı ol!',
        cfg: { tables: [1, 2, 3], mode: 'result', rounds: 8, options: 4, lives: 3, time: 14 } }
    ]
  },
  {
    id: 'w2',
    name: 'Orman Adası',
    emoji: '🌳',
    mood: 'think',
    intro: 'Ormanın şekilleri karıştı! 4 ve 5 çarpımlarıyla onları yerlerine koy.',
    levels: [
      { id: 'w2-l1', title: "4'ler", type: 'multiply', story: "Dört ayaklı dostlar 4'er sayıyor.",
        cfg: { tables: [4], mode: 'result', rounds: 7, options: 3, lives: 3 } },
      { id: 'w2-l2', title: "5'ler", type: 'multiply', story: 'Beşer beşer yukarı!',
        cfg: { tables: [5], mode: 'result', rounds: 7, options: 3, lives: 3 } },
      { id: 'w2-l3', title: 'Kare ve Üçgen Avı', type: 'shapehunt', story: 'Şekilleri doğru sepete sürükle.',
        cfg: { shapes: ['kare', 'ucgen'], rounds: 4, tokensPerRound: 4, lives: 3 } },
      { id: 'w2-l4', title: 'Tüm Şekiller', type: 'shapehunt', story: 'Kare, dikdörtgen, üçgen, daire!',
        cfg: { shapes: ['kare', 'dikdortgen', 'ucgen', 'daire'], rounds: 5, tokensPerRound: 4, lives: 3 } },
      { id: 'w2-l5', title: 'Karışık 3-5', type: 'multiply', story: 'Üç tablo bir arada.',
        cfg: { tables: [3, 4, 5], mode: 'result', rounds: 8, options: 4, lives: 3 } }
    ]
  },
  {
    id: 'w3',
    name: 'Kristal Mağara',
    emoji: '💎',
    mood: 'ooo',
    intro: 'Kristaller kenar ve köşe sayıyor. Sayabilir misin?',
    levels: [
      { id: 'w3-l1', title: 'Kenarları Say', type: 'sides', story: 'Kaç kenarı var?',
        cfg: { ask: 'kenar', shapes: ['kare', 'dikdortgen', 'ucgen'], rounds: 6, lives: 3 } },
      { id: 'w3-l2', title: 'Köşeleri Say', type: 'sides', story: 'Kaç köşesi var?',
        cfg: { ask: 'kose', shapes: ['kare', 'dikdortgen', 'ucgen', 'besgen'], rounds: 6, lives: 3 } },
      { id: 'w3-l3', title: 'Kenar mı Köşe mi?', type: 'sides', story: 'Karışık sorular geliyor!',
        cfg: { ask: 'mix', shapes: ['kare', 'dikdortgen', 'ucgen', 'besgen', 'altigen'], rounds: 7, lives: 3, time: 22 } },
      { id: 'w3-l4', title: 'Yeni Şekiller', type: 'sides', story: 'Beşgen, altıgen ve daire!',
        cfg: { ask: 'mix', shapes: ['besgen', 'altigen', 'daire'], rounds: 6, lives: 3 } },
      { id: 'w3-l5', title: 'Mağara Sınavı', type: 'boss', story: 'Kristal canavar uyandı!',
        cfg: { include: ['sides', 'multiply'], tables: [2, 3, 4], shapes: ['kare', 'dikdortgen', 'ucgen', 'besgen'], rounds: 9, lives: 3, time: 110, timePerQ: 16 } }
    ]
  },
  {
    id: 'w4',
    name: 'Gökkuşağı Zirvesi',
    emoji: '🌈',
    mood: 'cheer',
    intro: 'Sihirli kalemle şekilleri çiz, köprüyü tamamla!',
    levels: [
      { id: 'w4-l1', title: 'Kareyi Çiz', type: 'draw', story: 'Dört eşit kenar çiz.',
        cfg: { shapes: ['kare'], tol: 26, pass: 0.72 } },
      { id: 'w4-l2', title: 'Dikdörtgeni Çiz', type: 'draw', story: 'Uzun ve kısa kenarlar.',
        cfg: { shapes: ['dikdortgen'], tol: 26, pass: 0.72 } },
      { id: 'w4-l3', title: 'Üçgeni Çiz', type: 'draw', story: 'Üç kenar birleşir.',
        cfg: { shapes: ['ucgen'], tol: 26, pass: 0.72 } },
      { id: 'w4-l4', title: 'Daireyi Çiz', type: 'draw', story: 'Yuvarlak ve pürüzsüz.',
        cfg: { shapes: ['daire'], tol: 28, pass: 0.70 } },
      { id: 'w4-l5', title: 'Küçük Sihirbaz', type: 'draw', story: 'Üç şekli arka arkaya çiz!',
        cfg: { shapes: ['kare', 'ucgen', 'daire'], tol: 28, pass: 0.72 } }
    ]
  },
  {
    id: 'w5',
    name: 'Ejderha Kalesi',
    emoji: '🐉',
    mood: 'sad',
    intro: 'Ejderha hazineyi koruyor. Bildiklerini kullan ve kaleyi kazan!',
    levels: [
      { id: 'w5-l1', title: 'Ejderha Uyanıyor', type: 'boss', story: 'Hızlı cevap ver!',
        cfg: { include: ['multiply', 'sides'], tables: [1, 2, 3], shapes: ['kare', 'ucgen', 'dikdortgen'], rounds: 9, lives: 3, time: 100, timePerQ: 15 } },
      { id: 'w5-l2', title: 'Kenar Fırtınası', type: 'boss', story: 'Kenar ve köşe yağmuru!',
        cfg: { include: ['sides', 'tap'], shapes: ['kare', 'dikdortgen', 'ucgen', 'besgen', 'altigen', 'daire'], rounds: 9, lives: 3, time: 100, timePerQ: 16 } },
      { id: 'w5-l3', title: 'Eksik Sayı', type: 'multiply', story: '3 × ? = 12 — eksik sayıyı bul.',
        cfg: { tables: [2, 3, 4, 5], mode: 'missing', rounds: 9, options: 4, lives: 3, time: 16 } },
      { id: 'w5-l4', title: 'Ters Çarpım', type: 'multiply', story: '? × 4 = 20 — baştaki sayı kaç?',
        cfg: { tables: [2, 3, 4, 5], mode: 'reverse', rounds: 9, options: 4, lives: 3, time: 16 } },
      { id: 'w5-l5', title: 'Büyük Final', type: 'boss', story: 'Her şey karıştı, son sınav!',
        cfg: { include: ['multiply', 'sides', 'tap'], tables: [2, 3, 4, 5], shapes: ['kare', 'dikdortgen', 'ucgen', 'daire', 'besgen', 'altigen'], rounds: 12, lives: 2, time: 150, timePerQ: 14, maxB: 10 } }
    ]
  }
];

export const TYPE_LABEL = {
  multiply: 'Çarpım',
  shapehunt: 'Şekil Avı',
  sides: 'Kenar-Köşe',
  draw: 'Çizim',
  boss: 'Bölüm Sonu'
};

export function findWorld(id) {
  return WORLDS.find((w) => w.id === id);
}

export function findLevel(levelId) {
  for (const w of WORLDS) {
    const i = w.levels.findIndex((l) => l.id === levelId);
    if (i >= 0) return { world: w, level: w.levels[i], index: i };
  }
  return null;
}

/** Bir bölümün konularını veli paneli için etiketler */
export function levelTopics(level) {
  const c = level.cfg || {};
  const out = [];
  if (level.type === 'multiply') out.push('Çarpım: ' + (c.tables || []).map((t) => t + "'ler").join(', '));
  if (level.type === 'shapehunt') out.push('Şekil tanıma');
  if (level.type === 'sides') out.push(c.ask === 'kenar' ? 'Kenar sayma' : c.ask === 'kose' ? 'Köşe sayma' : 'Kenar-köşe');
  if (level.type === 'draw') out.push('Geometrik çizim');
  if (level.type === 'boss') out.push('Karışık tekrar');
  return out;
}
