/* ============================================================
   collect.js — Ödül ekonomisi: aksesuar, evcil hayvan, çıkartma
   AMAÇ: Jetonu HARCANACAK yer yaratmak ("biriktirme" motivasyonu)
   ve oynamayı ödüllendirmek. Tüm görseller SVG — her cihazda aynı.
   ============================================================ */

/* ---------------- Aksesuarlar ----------------
   slot: head (tepede) | frame (çerçeve) | pet (yanda)          */
export const ITEMS = [
  /* --- Şapkalar (head) --- */
  {
    id: 'hat_party', slot: 'head', name: 'Parti Şapkası', price: 25, tier: 1,
    art: `<polygon points="50,6 68,62 32,62" fill="#ff6f9c" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
          <circle cx="50" cy="6" r="7" fill="#ffd23d" stroke="#23324d" stroke-width="5"/>
          <path d="M36 44 h28 M39 32 h22" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`
  },
  {
    id: 'hat_cowboy', slot: 'head', name: 'Kovboy Şapkası', price: 45, tier: 1,
    art: `<ellipse cx="50" cy="60" rx="42" ry="11" fill="#d68a4a" stroke="#23324d" stroke-width="5"/>
          <path d="M28 58 q4 -34 22 -34 q18 0 22 34 z" fill="#f0a860" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
          <path d="M28 52 h44" stroke="#8a4f1c" stroke-width="6" stroke-linecap="round"/>`
  },
  {
    id: 'hat_wizard', slot: 'head', name: 'Büyücü Şapkası', price: 90, tier: 2,
    art: `<ellipse cx="50" cy="62" rx="40" ry="11" fill="#7b5bd6" stroke="#23324d" stroke-width="5"/>
          <path d="M26 60 q6 -50 24 -54 q18 4 24 54 z" fill="#9b7bec" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
          <path d="M48 2 l4 10 l10 -3 l-6 9 l7 7 l-11 -1 l-1 11 l-5 -10 l-10 4 l6 -9 l-8 -7 l11 1 z" fill="#ffd23d" transform="translate(2,14) scale(.85)"/>`
  },
  {
    id: 'crown_gold', slot: 'head', name: 'Altın Taç', price: 160, tier: 3,
    art: `<path d="M20 62 l4 -34 l16 14 l10 -24 l10 24 l16 -14 l4 34 z" fill="#ffd23d" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
          <circle cx="50" cy="34" r="5" fill="#ff5a5f" stroke="#23324d" stroke-width="4"/>
          <circle cx="28" cy="40" r="4" fill="#3dbdff" stroke="#23324d" stroke-width="3.5"/>
          <circle cx="72" cy="40" r="4" fill="#58cf6a" stroke="#23324d" stroke-width="3.5"/>`
  },

  /* --- Çerçeveler (frame) --- */
  {
    id: 'frame_gold', slot: 'frame', name: 'Altın Çerçeve', price: 70, tier: 1, ring: ['#ffe27a', '#f5b40b'],
  },
  {
    id: 'frame_rainbow', slot: 'frame', name: 'Gökkuşağı Çerçeve', price: 130, tier: 2, ring: ['#ff6f9c', '#3dbdff', '#58cf6a'],
  },
  {
    id: 'frame_star', slot: 'frame', name: 'Yıldızlı Çerçeve', price: 200, tier: 3, ring: ['#ffd23d', '#ff9a3d'] },

  /* --- Evcil hayvanlar (pet) --- */
  { id: 'pet_bee', slot: 'pet', name: 'Arı Vız', price: 40, tier: 1, art: beeSVG() },
  { id: 'pet_frog', slot: 'pet', name: 'Kurbağa Zıp', price: 65, tier: 1, art: frogSVG() },
  { id: 'pet_cat', slot: 'pet', name: 'Kedi Mır', price: 110, tier: 2, art: catSVG() },
  { id: 'pet_dragon', slot: 'pet', name: 'Küçük Ejderha', price: 260, tier: 3, art: dragonSVG() }
];

function beeSVG() {
  return `<ellipse cx="50" cy="55" rx="26" ry="21" fill="#ffd23d" stroke="#23324d" stroke-width="5"/>
    <path d="M34 42 q16 14 32 0 M32 56 h36 M34 68 q16 -12 32 0" stroke="#23324d" stroke-width="4" fill="none"/>
    <ellipse cx="34" cy="30" rx="16" ry="11" fill="#dff1ff" stroke="#23324d" stroke-width="4" opacity=".95"/>
    <ellipse cx="66" cy="30" rx="16" ry="11" fill="#dff1ff" stroke="#23324d" stroke-width="4" opacity=".95"/>
    <circle cx="42" cy="50" r="4.5" fill="#23324d"/><circle cx="58" cy="50" r="4.5" fill="#23324d"/>
    <path d="M44 64 q6 6 12 0" stroke="#23324d" stroke-width="4" fill="none" stroke-linecap="round"/>`;
}
function frogSVG() {
  return `<ellipse cx="50" cy="60" rx="30" ry="24" fill="#58cf6a" stroke="#23324d" stroke-width="5"/>
    <circle cx="34" cy="36" r="13" fill="#7ce08c" stroke="#23324d" stroke-width="4"/>
    <circle cx="66" cy="36" r="13" fill="#7ce08c" stroke="#23324d" stroke-width="4"/>
    <circle cx="34" cy="36" r="5" fill="#23324d"/><circle cx="66" cy="36" r="5" fill="#23324d"/>
    <path d="M38 62 q12 12 24 0" stroke="#23324d" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <circle cx="26" cy="74" r="6" fill="#7ce08c" stroke="#23324d" stroke-width="3.5"/>
    <circle cx="74" cy="74" r="6" fill="#7ce08c" stroke="#23324d" stroke-width="3.5"/>`;
}
function catSVG() {
  return `<ellipse cx="50" cy="62" rx="27" ry="23" fill="#ffb15c" stroke="#23324d" stroke-width="5"/>
    <polygon points="26,46 22,16 46,34" fill="#ffb15c" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="74,46 78,16 54,34" fill="#ffb15c" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
    <path d="M30 28 l6 12 M70 28 l-6 12" stroke="#ff8fa8" stroke-width="5" stroke-linecap="round"/>
    <circle cx="39" cy="58" r="5" fill="#23324d"/><circle cx="61" cy="58" r="5" fill="#23324d"/>
    <path d="M46 70 q4 5 8 0" stroke="#23324d" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M24 66 h-12 M24 74 h-12 M76 66 h12 M76 74 h12" stroke="#23324d" stroke-width="3" stroke-linecap="round"/>`;
}
function dragonSVG() {
  return `<path d="M50 26 q26 0 26 22 q0 20 -18 28 l-16 0 q-18 -8 -18 -28 q0 -22 26 -22 z" fill="#9b7bec" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="34,28 26,8 44,20" fill="#b07cff" stroke="#23324d" stroke-width="4.5" stroke-linejoin="round"/>
    <polygon points="66,28 74,8 56,20" fill="#b07cff" stroke="#23324d" stroke-width="4.5" stroke-linejoin="round"/>
    <circle cx="40" cy="46" r="5.5" fill="#23324d"/><circle cx="60" cy="46" r="5.5" fill="#23324d"/>
    <path d="M42 60 q8 8 16 0" stroke="#23324d" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M46 66 l-4 6 M54 66 l4 6" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M22 54 q-14 -6 -16 -18 q12 2 20 12 z" fill="#b07cff" stroke="#23324d" stroke-width="4"/>`;
}

/** Slota göre konumlandırma (yüzde) */
export const SLOT_STYLE = {
  head:  { top: '-16%', left: '50%', width: '60%', transform: 'translateX(-50%)', zIndex: 3 },
  pet:   { bottom: '-6%', right: '-14%', width: '46%', zIndex: 4 },
  frame: { inset: '-7%', width: '114%', height: '114%', transform: 'none', zIndex: 2 }
};

export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;

/* ============================================================
   TROFELER — PS5 tarzı madalya sistemi
   Aynı başarım kontrolü, konsol oyunlarındaki gibi sunulur:
   bronz / gümüş / altın / platin. Platin = hepsini topla.
   ============================================================ */
export const TROPHY_META = {
  bronze:   { ad: 'Bronz',  renk: '#d08a52', renk2: '#8a5228', puan: 1 },
  silver:   { ad: 'Gümüş',  renk: '#d7e0ea', renk2: '#8d99a8', puan: 2 },
  gold:     { ad: 'Altın',  renk: '#ffd23d', renk2: '#d99a00', puan: 3 },
  platinum: { ad: 'Platin', renk: '#9fe9ff', renk2: '#3aa8d8', puan: 4 }
};
export const TROPHY_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

/** Kazanılan trofeleri kademeye göre say */
export function trophyCounts(profile) {
  const kazanilan = evaluateStickers(profile);
  const t = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  for (const s of STICKERS) if (kazanilan.includes(s.id)) t[s.tier || 'bronze']++;
  return t;
}

/** Toplam trofe puanı (kademeye göre ağırlıklı) */
export function trophyScore(profile) {
  const t = trophyCounts(profile);
  return TROPHY_ORDER.reduce((top, k) => top + t[k] * TROPHY_META[k].puan, 0);
}

/** Her kademede toplam kaç trofe var? */
export function trophyTotals() {
  const t = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  for (const s of STICKERS) t[s.tier || 'bronze']++;
  return t;
}

/** Trofe madalyası SVG'si (her cihazda aynı görünür) */
export function trophySVG(tier, boyut = 40) {
  const m = TROPHY_META[tier] || TROPHY_META.bronze;
  return `<svg viewBox="0 0 64 64" width="${boyut}" height="${boyut}" aria-hidden="true">
    <path d="M18 8 h28 v12 a14 14 0 0 1 -28 0 z" fill="${m.renk}" stroke="#23324d" stroke-width="4" stroke-linejoin="round"/>
    <path d="M18 12 h-7 a9 9 0 0 0 9 9" fill="none" stroke="#23324d" stroke-width="4" stroke-linecap="round"/>
    <path d="M46 12 h7 a9 9 0 0 1 -9 9" fill="none" stroke="#23324d" stroke-width="4" stroke-linecap="round"/>
    <rect x="28" y="34" width="8" height="10" fill="${m.renk2}" stroke="#23324d" stroke-width="4"/>
    <rect x="18" y="44" width="28" height="8" rx="3" fill="${m.renk2}" stroke="#23324d" stroke-width="4"/>
    <circle cx="32" cy="20" r="5" fill="#fff" opacity=".55"/>
  </svg>`;
}

/* ---------------- Çıkartmalar (başarımla kazanılır) ----------------
   Satın alınmaz — oynayarak kazanılır. Koleksiyon motivasyonu.      */
export const STICKERS = [
  { id: 'st_first',    name: 'İlk Adım',        desc: 'İlk bölümü bitir',              test: (p) => totalPlays(p) >= 1,        art: starSticker('#ffd23d', '#f5b40b') , tier: 'gold' },
  { id: 'st_10c',      name: '10 Doğru',        desc: '10 doğru cevap ver',            test: (p) => p.stats.correct >= 10,     art: starSticker('#3dbdff', '#1c93d8') , tier: 'bronze' },
  { id: 'st_streak5',  name: 'Seri Ustası',     desc: '5 doğruyu üst üste yap',        test: (p) => (p.stats.bestStreak || 0) >= 5,  art: starSticker('#ff9a3d', '#ef7f1a') , tier: 'bronze' },
  { id: 'st_t1',       name: 'Birler Bitti',    desc: "1'ler tablosunu bitir",         test: (p) => tableMastered(p, '1'),     art: badgeSticker('1', '#ff6f9c') , tier: 'bronze' },
  { id: 'st_t2',       name: 'İkiler Bitti',    desc: "2'ler tablosunu bitir",         test: (p) => tableMastered(p, '2'),     art: badgeSticker('2', '#58cf6a') , tier: 'bronze' },
  { id: 'st_t5',       name: 'Beşler Bitti',    desc: "5'ler tablosunu bitir",         test: (p) => tableMastered(p, '5'),     art: badgeSticker('5', '#3dbdff') , tier: 'silver' },
  { id: 'st_shape',    name: 'Şekil Avcısı',    desc: 'Kenar/köşe sorularında 10 doğru', test: (p) => shapeCorrect(p) >= 10,   art: badgeSticker('◆', '#b07cff') , tier: 'bronze' },
  { id: 'st_draw',     name: 'Küçük Ressam',    desc: 'İlk çizim bölümünü bitir',      test: (p) => p.stats.drawDone >= 1,     art: badgeSticker('✎', '#ff9a3d') , tier: 'bronze' },
  { id: 'st_boss',     name: 'Ejderha Yenen',   desc: 'Boss bölümünü bitir',           test: (p) => p.stats.bossDone >= 1,     art: badgeSticker('D', '#ff5a5f') , tier: 'silver' },
  { id: 'st_50c',      name: '50 Doğru',        desc: '50 doğru cevap ver',            test: (p) => p.stats.correct >= 50,     art: starSticker('#b07cff', '#8a5ee0') , tier: 'bronze' },
  { id: 'st_world1',   name: 'Çayır Fatihi',    desc: '1. adayı tamamla',              test: (p) => worldDone(p, 'w1'),        art: badgeSticker('1', '#58cf6a') , tier: 'bronze' },
  { id: 'st_100c',     name: '100 Doğru',       desc: '100 doğru cevap ver',           test: (p) => p.stats.correct >= 100,    art: starSticker('#ffd23d', '#ff9a3d') , tier: 'silver' },
  { id: 'st_nohelp',   name: 'Kendi Başına',    desc: 'İpuçsuz 10 soruyu doğru yap',   test: (p) => (p.stats.correctNoHint || 0) >= 10, art: starSticker('#58cf6a', '#34a94a') , tier: 'silver' },
  { id: 'st_allday',   name: 'Her Gün Burada',  desc: '3 gün üst üste oyna',           test: (p) => (p.streak?.best || 0) >= 3, art: badgeSticker('☀', '#ffd23d') , tier: 'silver' },
  { id: 'st_300c',     name: '300 Doğru',       desc: '300 doğru cevap ver',           test: (p) => p.stats.correct >= 300,    art: starSticker('#ff6f9c', '#ff5a5f') , tier: 'silver' },
  { id: 'st_allshapes', name: 'Geometri Ustası', desc: 'Tüm şekillerde ustalaş',       test: (p) => shapeMasteredAll(p),       art: badgeSticker('★', '#b07cff') , tier: 'gold' },
  /* --- 6-10 tabloları (2. sınıfın ikinci yarısı) --- */
  { id: 'st_t6',       name: 'Altılar Bitti',   desc: "6'lar tablosunu bitir",         test: (p) => tableMastered(p, '6'),     art: badgeSticker('6', '#ff9a3d') , tier: 'silver' },
  { id: 'st_t7',       name: 'Yediler Bitti',   desc: "7'ler tablosunu bitir",         test: (p) => tableMastered(p, '7'),     art: badgeSticker('7', '#3dbdff') , tier: 'silver' },
  { id: 'st_t8',       name: 'Sekizler Bitti',  desc: "8'ler tablosunu bitir",         test: (p) => tableMastered(p, '8'),     art: badgeSticker('8', '#58cf6a') , tier: 'silver' },
  { id: 'st_t9',       name: 'Dokuzlar Bitti',  desc: "9'lar tablosunu bitir",         test: (p) => tableMastered(p, '9'),     art: badgeSticker('9', '#b07cff') , tier: 'silver' },
  { id: 'st_t10',      name: 'Onlar Bitti',     desc: "10'lar tablosunu bitir",        test: (p) => tableMastered(p, '10'),    art: badgeSticker('10', '#ffd23d') , tier: 'gold' },
  { id: 'st_alltables', name: 'Tüm Tablolar',   desc: "1'den 10'a tüm tablolarda ustalaş", test: (p) => allTablesMastered(p),  art: starSticker('#ffd23d', '#f5b40b') , tier: 'platinum' },
  { id: 'st_world6',   name: 'Yıldız Fatihi',   desc: 'Yıldız Adası’nı tamamla',       test: (p) => worldDone(p, 'w6'),        art: badgeSticker('★', '#ffe27a') , tier: 'gold' },
  { id: 'st_500c',     name: '500 Doğru',       desc: '500 doğru cevap ver',           test: (p) => p.stats.correct >= 500,    art: starSticker('#58cf6a', '#1c93d8') , tier: 'gold' },
  /* --- Toplama/Çıkarma (2. sınıf çekirdek kazanımı) --- */
  { id: 'st_world7',   name: 'Deniz Fatihi',    desc: 'Sayı Denizi’ni tamamla',        test: (p) => worldDone(p, 'w7'),        art: badgeSticker('+', '#3dbdff') , tier: 'gold' },
  { id: 'st_add800',   name: '800 Doğru',       desc: '800 doğru cevap ver',           test: (p) => p.stats.correct >= 800,    art: starSticker('#3dbdff', '#1c93d8') , tier: 'gold' }
];

function starSticker(c1, c2) {
  return `<path d="M50 10 l12 25 l27 4 l-20 19 l5 27 l-24 -13 l-24 13 l5 -27 l-20 -19 l27 -4 z"
    fill="${c1}" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
    <path d="M44 44 l6 6 l12 -14" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function badgeSticker(txt, color) {
  return `<circle cx="50" cy="50" r="36" fill="${color}" stroke="#23324d" stroke-width="5"/>
    <circle cx="50" cy="50" r="27" fill="rgba(255,255,255,.92)"/>
    <text x="50" y="64" text-anchor="middle" font-size="34" font-weight="900" fill="#23324d"
      font-family="Fredoka, Nunito, system-ui, sans-serif">${txt}</text>`;
}

/* ---------------- Başarım yardımcıları ---------------- */
export function totalPlays(p) {
  return Object.values(p?.results || {}).reduce((a, r) => a + (r.plays || 0), 0);
}
function tableMastered(p, table) {
  const st = p?.stats?.byTable?.[String(table)];
  return !!st && st.c >= 8 && st.c / (st.c + st.w) >= 0.8;
}
function shapeCorrect(p) {
  return Object.values(p?.stats?.byShape || {}).reduce((a, s) => a + (s.c || 0), 0);
}
function shapeMasteredAll(p) {
  const ids = Object.keys(p?.stats?.byShape || {});
  if (ids.length < 4) return false;
  return ids.every((k) => { const s = p.stats.byShape[k]; return s.c >= 4 && s.c / (s.c + s.w) >= 0.75; });
}
/** 1'den 10'a tüm tablolarda ustalık */
function allTablesMastered(p) {
  for (let t = 1; t <= 10; t++) if (!tableMastered(p, String(t))) return false;
  return true;
}
function worldDone(p, worldId) {
  // Bir dünyaya ait tüm bölümlerde en az 1 yıldız
  return (p?.worldDoneIds || []).includes(worldId);
}

/** Kazanılmış çıkartmaları döndür (profilde saklanır) */
export function evaluateStickers(profile) {
  const owned = new Set(profile.stickers || []);
  const yeni = [];
  for (const s of STICKERS) {
    if (owned.has(s.id)) continue;
    let ok = false;
    try { ok = !!s.test(profile); } catch (e) { ok = false; }
    if (ok) { owned.add(s.id); yeni.push(s); }
  }
  profile.stickers = [...owned];
  return yeni;   // yeni kazanılanlar
}

/* ---------------- Hikaye: hazine parçası görselleri ---------------- */
const TREASURE_ART = [
  /* w1 */ `<polygon points="50,12 74,36 50,74 26,36" fill="#58cf6a" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
           <polygon points="50,26 62,38 50,58 38,38" fill="#d9ffe2" stroke="none"/>`,
  /* w2 */ `<circle cx="50" cy="50" r="30" fill="#ffd23d" stroke="#23324d" stroke-width="5"/>
           <path d="M50 20 v60 M20 50 h60 M29 29 l42 42 M71 29 l-42 42" stroke="#ef7f1a" stroke-width="4"/>
           <circle cx="50" cy="50" r="9" fill="#fff4e6" stroke="#23324d" stroke-width="4"/>`,
  /* w3 */ `<polygon points="50,10 78,42 68,84 32,84 22,42" fill="#7fd4ff" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
           <path d="M36 44 l10 0 l-6 16 l12 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  /* w4 */ `<path d="M20 62 a30 30 0 0 1 60 0 z" fill="#b07cff" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
           <circle cx="50" cy="30" r="10" fill="#ffd23d" stroke="#23324d" stroke-width="4"/>
           <path d="M22 70 q28 14 56 0" stroke="#3dbdff" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  /* w5 */ `<path d="M22 64 l5 -32 l16 13 l7 -23 l7 23 l16 -13 l5 32 z" fill="#ffd23d" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
           <circle cx="50" cy="34" r="5" fill="#ff5a5f" stroke="#23324d" stroke-width="3.5"/>`,
  /* w6 */ `<path d="M50 8 l13 27 l30 5 l-22 21 l5 30 l-26 -14 l-26 14 l5 -30 l-22 -21 l30 -5 z"
             fill="#ffe27a" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
           <circle cx="50" cy="50" r="11" fill="#fff6d8" stroke="#23324d" stroke-width="4"/>
           <path d="M50 44 v12 M44 50 h12" stroke="#d99a00" stroke-width="4" stroke-linecap="round"/>`,
  /* w7 */ `<path d="M14 62 q18 -22 36 0 q18 -22 36 0 q0 18 -36 22 q-36 -4 -36 -22 z"
             fill="#3dbdff" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/>
           <path d="M30 44 q10 -8 20 0" stroke="#dff1ff" stroke-width="5" fill="none" stroke-linecap="round"/>
           <circle cx="50" cy="30" r="9" fill="#fff" stroke="#23324d" stroke-width="4"/>
           <path d="M50 25 v10 M45 30 h10" stroke="#1c93d8" stroke-width="3.5" stroke-linecap="round"/>`
];

/** Hazine parçası — kazanılmadıysa soluk/soru işaretli */
export function treasureSVG(has, index) {
  const inner = has
    ? TREASURE_ART[index % TREASURE_ART.length]
    : `<circle cx="50" cy="50" r="30" fill="#dfe7f2" stroke="#9fb0c7" stroke-width="5"/>
       <text x="50" y="64" text-anchor="middle" font-size="36" font-weight="900" fill="#9fb0c7"
         font-family="Fredoka, Nunito, system-ui, sans-serif">?</text>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

/* ---------------- Hazine: tüm parçalar tamam mı? ---------------- */
export const ALL_TREASURES = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'];
export function treasureComplete(profile) {
  const got = profile?.treasures || [];
  return ALL_TREASURES.every((id) => got.includes(id));
}

/* ---------------- Aksesuar yardımcıları ---------------- */
export function ownsItem(profile, id) {
  return (profile?.items || []).includes(id);
}
export function buyItem(profile, id) {
  const it = itemById(id);
  if (!it) return { ok: false, reason: 'bulunamadı' };
  if (ownsItem(profile, id)) return { ok: false, reason: 'zaten var' };
  if ((profile.coins || 0) < it.price) return { ok: false, reason: 'jeton yetersiz' };
  profile.coins -= it.price;
  profile.items = [...(profile.items || []), id];
  return { ok: true, item: it };
}
export function toggleEquip(profile, id) {
  const it = itemById(id);
  if (!it || it.slot === 'frame') return;   // çerçeve her zaman görünür
  profile.equipped = profile.equipped || {};
  const cur = profile.equipped[it.slot];
  profile.equipped[it.slot] = cur === id ? null : id;
}

/**
 * Avatar + aksesuar + evcil hayvan + çerçeve — tek HTML.
 * Tüm katmanlar SVG/görsel; emoji yok (her cihazda aynı görünür).
 */
export function avatarDressed(profile, { size = 90, avatarHTML } = {}) {
  const eq = profile?.equipped || {};
  const owned = profile?.items || [];
  const head = itemById(eq.head);
  const pet = itemById(eq.pet);
  const frames = owned.map(itemById).filter((i) => i && i.slot === 'frame');

  const ring = frames.length
    ? `box-shadow: 0 0 0 ${Math.max(3, size * 0.06)}px ${frames[frames.length - 1].ring[1]}, 0 0 0 ${Math.max(5, size * 0.095)}px ${frames[frames.length - 1].ring[0]};`
    : '';

  return `<span class="dress-wrap" style="width:${size}px;height:${size}px;">
    <span class="dress-avatar" style="${ring}">${avatarHTML(profile.avatar, { size })}</span>
    ${head ? `<span class="dress-layer" style="${styleStr(SLOT_STYLE.head)}">${svgBox(head.art)}</span>` : ''}
    ${pet ? `<span class="dress-layer" style="${styleStr(SLOT_STYLE.pet)}">${svgBox(pet.art)}</span>` : ''}
  </span>`;
}

function styleStr(o) {
  return Object.entries(o).map(([k, v]) => {
    const key = k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    return `${key}:${typeof v === 'number' ? v : v}`;
  }).join(';');
}

function svgBox(inner, vb = 100) {
  return `<svg viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="dress-svg">${inner}</svg>`;
}
