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
    stats: {
      plays: 0,
      correct: 0,
      wrong: 0,
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
  return p && p.v === 2 ? p : null;
}

export function deleteProfile(nick, code) {
  localStorage.removeItem(profileKey(nick, code));
  write(INDEX_KEY, listProfiles().filter((p) => !(p.nick === normNick(nick) && p.classCode === normCode(code))));
}

/* ---------------- Ayarlar (cihaz bazlı) ---------------- */
export const defaultSettings = () => ({ sound: true, voice: true, music: false, bigText: false });

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

/** Bölüm açık mı? İlk bölüm her zaman açık; sonrası bir önceki bölümden ≥1 yıldız ister. */
export function isLevelUnlocked(profile, world, levelIndex) {
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
export function recordAnswer(profile, { correct, table, shape }) {
  const s = profile.stats;
  if (correct) s.correct++; else s.wrong++;
  if (table != null) {
    const k = String(table);
    s.byTable[k] = s.byTable[k] || { c: 0, w: 0 };
    if (correct) s.byTable[k].c++; else s.byTable[k].w++;
  }
  if (shape) {
    s.byShape[shape] = s.byShape[shape] || { c: 0, w: 0 };
    if (correct) s.byShape[shape].c++; else s.byShape[shape].w++;
  }
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
