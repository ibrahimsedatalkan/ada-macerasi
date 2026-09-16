/* ============================================================
   state.js — profil, ilerleme, kayıt (localStorage)
   Çok çocuklu tek cihaz senaryosu: her (sınıf kodu + takma ad)
   ayrı bir profildir. E-posta/kişisel veri toplanmaz.
   ============================================================ */

const INDEX_KEY = 'ada.index.v2';
const PROFILE_PREFIX = 'ada.p.v2.';
const SETTINGS_KEY = 'ada.settings.v2';
const BOARD_KEY = 'ada.board.v2';

export const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦉', '🐙', '🦄', '🐝', '🐢', '🦁', '🐨', '🐧'];
export const WORLD_EMOJI = { w1: '🌱', w2: '🌳', w3: '💎', w4: '🌈', w5: '🐉' };

/** Emoji → üretilmiş karakter görseli eşlemesi (assets/avatars/<slug>.jpg) */
export const AVATAR_SLUGS = {
  '🦊': 'fox', '🐼': 'panda', '🐯': 'tiger', '🐸': 'frog', '🦉': 'owl', '🐙': 'octopus',
  '🦄': 'unicorn', '🐝': 'bee', '🐢': 'turtle', '🦁': 'lion', '🐨': 'koala', '🐧': 'penguin'
};

export function avatarSlug(emoji) {
  return AVATAR_SLUGS[emoji] || 'fox';
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('okuma hatası', key, e);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('yazma hatası', key, e);
    return false;
  }
}

function normNick(nick) {
  return String(nick || '').trim().replace(/\s+/g, ' ').slice(0, 14);
}
function normCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SINIF';
}
function profileKey(nick, code) {
  return PROFILE_PREFIX + normCode(code) + '.' + normNick(nick).toLocaleLowerCase('tr');
}

export function newProfile(nick, code, avatar) {
  const now = Date.now();
  return {
    v: 2,
    nick: normNick(nick) || 'Oyuncu',
    classCode: normCode(code),
    avatar: avatar || AVATARS[0],
    coins: 0,
    results: {},              // "w1-l1": { stars, best, plays }
    /* --- Koleksiyon / ödül ekonomisi --- */
    items: [],                // satın alınan aksesuar+evcil hayvan id'leri
    equipped: {},             // { head: id, pet: id }
    stickers: [],             // kazanılan çıkartma id'leri
    treasures: [],            // hikaye: toplanan hazine parçaları (w1..w5)
    worldDoneIds: [],         // tamamlanan adalar
    /* --- Günlük seri --- */
    streak: { count: 0, best: 0, lastDay: '' },
    stats: {
      plays: 0,
      correct: 0,
      wrong: 0,
      correctNoHint: 0,       // ipucu kullanmadan doğru (ödül için)
      drawDone: 0,
      bossDone: 0,
      byTable: {},            // "3": { c: 8, w: 2 }
      byShape: {},            // "kare": { c: 5, w: 1 }
      bestStreak: 0
    },
    createdAt: now,
    updatedAt: now
  };
}

export function listProfiles() {
  const idx = read(INDEX_KEY, []);
  return Array.isArray(idx) ? idx : [];
}

function touchIndex(profile) {
  const idx = listProfiles().filter(
    (p) => !(p.nick === profile.nick && p.classCode === profile.classCode)
  );
  idx.unshift({
    nick: profile.nick,
    classCode: profile.classCode,
    avatar: profile.avatar,
    stars: totalStars(profile),
    coins: profile.coins,
    updatedAt: Date.now()
  });
  write(INDEX_KEY, idx.slice(0, 24));
}

export function saveProfile(profile) {
  profile.updatedAt = Date.now();
  write(profileKey(profile.nick, profile.classCode), profile);
  touchIndex(profile);
  return profile;
}

export function loadProfile(nick, code) {
  const p = read(profileKey(nick, code), null);
  if (!p || p.v !== 2) return null;
  return migrate(p);
}

/** Eski kayıtlara yeni alanları ekle (geriye dönük uyumlu) */
export function migrate(p) {
  if (!p) return p;
  p.items = p.items || [];
  p.equipped = p.equipped || {};
  p.stickers = p.stickers || [];
  p.treasures = p.treasures || [];
  p.worldDoneIds = p.worldDoneIds || [];
  p.streak = p.streak || { count: 0, best: 0, lastDay: '' };
  p.stats = p.stats || {};
  p.stats.correctNoHint = p.stats.correctNoHint || 0;
  p.stats.drawDone = p.stats.drawDone || 0;
  p.stats.bossDone = p.stats.bossDone || 0;
  p.stats.plays = p.stats.plays || 0;
  p.stats.correct = p.stats.correct || 0;
  p.stats.wrong = p.stats.wrong || 0;
  p.stats.byTable = p.stats.byTable || {};
  p.stats.byShape = p.stats.byShape || {};
  p.stats.recent = p.stats.recent || [];      // adaptif zorluk için son cevaplar
  p.missed = p.missed || [];                  // aralıklı tekrar kuyruğu
  p.lessonsSeen = p.lessonsSeen || [];        // görülen dersler (ders ekranı)
  p.gunluk = p.gunluk || null;                // günlük görev durumu
  return p;
}

/* ---------------- Günlük seri ---------------- */
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Bugün ilk kez oynanıyorsa seriyi ilerlet.
 * Dün oynadıysa +1, ara verildiyse 1'e döner.
 * @returns {{count:number, best:number, arttı:boolean, yeniRekor:boolean}}
 */
export function touchDailyStreak(profile) {
  const today = dayKey();
  const s = profile.streak || (profile.streak = { count: 0, best: 0, lastDay: '' });
  if (s.lastDay === today) return { count: s.count, best: s.best, artti: false, yeniRekor: false };

  const d = new Date(); d.setDate(d.getDate() - 1);
  const dun = dayKey(d);
  const artti = s.lastDay === dun;
  s.count = artti ? s.count + 1 : 1;
  s.lastDay = today;
  const yeniRekor = s.count > (s.best || 0);
  if (yeniRekor) s.best = s.count;
  saveProfile(profile);
  return { count: s.count, best: s.best, artti, yeniRekor };
}

/** Bugün oynandı mı? */
export function playedToday(profile) {
  return (profile?.streak?.lastDay || '') === dayKey();
}

/* ---------------- Hikaye: hazine parçaları ---------------- */
export const TREASURE_NAMES = {
  w1: 'Çayır Kristali', w2: 'Orman Tılsımı', w3: 'Mağara Elması',
  w4: 'Gökkuşağı Mücevheri', w5: 'Ejderha Tacı', w6: 'Yıldız Kalbi',
  w7: 'Deniz İncisi'
};

/** Ada tamamlandı mı? Tüm bölümlerde en az 1 yıldız. */
export function markWorldProgress(profile, worlds) {
  const yeni = [];
  for (const w of worlds) {
    if ((profile.worldDoneIds || []).includes(w.id)) continue;
    const hepsi = w.levels.every((l) => getResult(profile, l.id).stars > 0);
    if (hepsi) {
      profile.worldDoneIds = [...(profile.worldDoneIds || []), w.id];
      if (!(profile.treasures || []).includes(w.id)) {
        profile.treasures = [...(profile.treasures || []), w.id];
        yeni.push({ worldId: w.id, name: TREASURE_NAMES[w.id] || 'Hazine' });
      }
    }
  }
  if (yeni.length) saveProfile(profile);
  return yeni;
}

export function deleteProfile(nick, code) {
  localStorage.removeItem(profileKey(nick, code));
  write(INDEX_KEY, listProfiles().filter((p) => !(p.nick === normNick(nick) && p.classCode === normCode(code))));
}

/* ---------------- Ayarlar (cihaz bazlı) ---------------- */
export const defaultSettings = () => ({ sound: true, voice: true, music: false, bigText: false, timeMode: 'normal', freeMode: false, speechSpeed: 0.72, difficulty: 'kolay', gunlukSure: 30, gunlukSureKilit: false });

export function loadSettings() {
  return Object.assign(defaultSettings(), read(SETTINGS_KEY, {}));
}
export function saveSettings(s) {
  write(SETTINGS_KEY, s);
}

/* ---------------- İlerleme ---------------- */
export function resultKey(level) {
  return level.id;
}

export function getResult(profile, levelId) {
  return profile?.results?.[levelId] || { stars: 0, best: 0, plays: 0 };
}

export function hasStars(profile, levelId) {
  return getResult(profile, levelId).stars > 0;
}

/* ---------------- Serbest Mod (veli kontrolü) ----------------
   Çocuk okulda konuyu henüz görmediyse kilitli bölüme takılıyordu.
   Veli panelinden açılır: tüm bölümler kilit kontrolü olmadan açılır. */
let freeModeOn = false;
export function setFreeMode(v) { freeModeOn = !!v; }
export function getFreeMode() { return freeModeOn; }

/** Bölüm açık mı? İlk bölüm her zaman açık; sonrası bir önceki bölümden ≥1 yıldız ister.
    Serbest Mod açıksa kilit kontrolü atlanır. */
export function isLevelUnlocked(profile, world, levelIndex) {
  if (freeModeOn) return true;
  if (levelIndex === 0) {
    // Dünya kilidi: önceki dünyanın son bölümünden en az 1 yıldız
    const wi = worldsIndexOf(world.id);
    if (wi <= 0) return true;
    const prev = worldsRef[wi - 1];
    const last = prev.levels[prev.levels.length - 1];
    return hasStars(profile, last.id);
  }
  const prevLevel = world.levels[levelIndex - 1];
  return hasStars(profile, prevLevel.id);
}

export function isWorldUnlocked(profile, world) {
  if (freeModeOn) return true;
  const wi = worldsIndexOf(world.id);
  if (wi <= 0) return true;
  const prev = worldsRef[wi - 1];
  const last = prev.levels[prev.levels.length - 1];
  return hasStars(profile, last.id);
}

let worldsRef = [];
export function bindWorlds(worlds) {
  worldsRef = worlds || [];
}
function worldsIndexOf(id) {
  return worldsRef.findIndex((w) => w.id === id);
}

export function saveLevelResult(profile, level, { stars, score }) {
  const key = resultKey(level);
  const prev = profile.results[key] || { stars: 0, best: 0, plays: 0 };
  profile.results[key] = {
    stars: Math.max(prev.stars, stars),
    best: Math.max(prev.best, score),
    plays: prev.plays + 1,
    at: Date.now()
  };
  saveProfile(profile);
  return profile.results[key];
}

export function addCoins(profile, n) {
  profile.coins = Math.max(0, (profile.coins || 0) + n);
  saveProfile(profile);
  return profile.coins;
}

export function totalStars(profile) {
  if (!profile?.results) return 0;
  return Object.values(profile.results).reduce((a, r) => a + (r.stars || 0), 0);
}

export function worldStars(profile, world) {
  return world.levels.reduce((a, l) => a + getResult(profile, l.id).stars, 0);
}

export function maxStars(worlds) {
  return worlds.reduce((a, w) => a + w.levels.length * 3, 0);
}

/* İstatistik kaydı — her soru sonrası çağrılır */
export function recordAnswer(profile, { correct, table, shape, usedHint = false, kind = null }) {
  const s = profile.stats;
  if (correct) s.correct++; else s.wrong++;
  if (correct && !usedHint) s.correctNoHint = (s.correctNoHint || 0) + 1;
  if (table != null) {
    const k = String(table);
    s.byTable[k] = s.byTable[k] || { c: 0, w: 0 };
    if (correct) s.byTable[k].c++; else s.byTable[k].w++;
  }
  if (shape) {
    s.byShape[shape] = s.byShape[shape] || { c: 0, w: 0 };
    if (correct) s.byShape[shape].c++; else s.byShape[shape].w++;
  }
  return s;
}

/** Bölüm tipine göre tamamlama sayacı (çıkartma ödülleri için) */
export function markKindDone(profile, kind) {
  if (!profile?.stats) return;
  if (kind === 'draw') profile.stats.drawDone = (profile.stats.drawDone || 0) + 1;
  if (kind === 'boss') profile.stats.bossDone = (profile.stats.bossDone || 0) + 1;
}

/* ---------------- Yerel sınıf tablosu ---------------- */
export function readBoard() {
  const b = read(BOARD_KEY, []);
  return Array.isArray(b) ? b : [];
}
export function pushBoard(profile) {
  if (!profile) return readBoard();
  const board = readBoard().filter((r) => !(r.nick === profile.nick && r.classCode === profile.classCode));
  board.push({
    nick: profile.nick,
    classCode: profile.classCode,
    avatar: profile.avatar,
    stars: totalStars(profile),
    coins: profile.coins,
    correct: profile.stats.correct,
    updatedAt: Date.now()
  });
  write(BOARD_KEY, board);
  return board;
}
export function clearBoard() {
  write(BOARD_KEY, []);
}


/* ============================================================
   GÜNLÜK GÖREV — okuldan gelince dönme sebebi
   Her gün küçük, ulaşılabilir bir hedef. Alışkanlık yaratır.
   ============================================================ */
const GOREV_HEDEFLERI = [10, 12, 15, 18, 20];

/** Bugünün tarihi (yerel) — YYYY-MM-DD */
export function bugun() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Günlük görevi hazırla/oku — gün değiştiyse sıfırla, hedefi kademeli büyüt */
export function gunlukGorev(profile) {
  const t = bugun();
  if (!profile.gunluk || profile.gunluk.tarih !== t) {
    const oncekiHedef = profile.gunluk?.hedef || GOREV_HEDEFLERI[0];
    const basariyla = (profile.gunluk?.yapilan || 0) >= oncekiHedef && oncekiHedef > 0;
    // Dün tamamladıysa hedef biraz büyür (kademeli zorluk)
    const idx = GOREV_HEDEFLERI.indexOf(oncekiHedef);
    const yeniHedef = basariyla && idx >= 0 && idx < GOREV_HEDEFLERI.length - 1
      ? GOREV_HEDEFLERI[idx + 1] : GOREV_HEDEFLERI[0];
    profile.gunluk = { tarih: t, hedef: yeniHedef, yapilan: 0, odulAlindi: false };
  }
  return profile.gunluk;
}

/** Doğru cevap sonrası günlük görevi ilerlet. Tamamlandıysa ödül döner. */
export function gorevIlerlet(profile, adet = 1) {
  const g = gunlukGorev(profile);
  if (g.odulAlindi) return null;
  g.yapilan += adet;
  if (g.yapilan >= g.hedef) {
    g.odulAlindi = true;
    const odul = 30 + g.hedef * 5;         // 80-130 jeton
    profile.coins = (profile.coins || 0) + odul;
    return { hedef: g.hedef, odul, jeton: profile.coins };
  }
  return null;
}
