/* ============================================================
   audio.js — ses efektleri (WebAudio), Türkçe sesli anlatım ve
   hafif müzik. Tüm sesler sentezlenir; dosya indirmeye gerek yok.
   ============================================================ */

let ctx = null;
let musicTimer = null;
let musicStep = 0;

export const audio = {
  sound: true,
  voice: true,
  music: false
};

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Kullanıcı etkileşiminde ses motorunu uyandır (iOS/Chrome kuralı) */
export function unlockAudio() {
  ac();
}

function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.16, delay = 0, glide = null, when = null }) {
  const c = ac();
  if (!c || !audio.sound) return;
  const t0 = when != null ? when : c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, glide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise({ dur = 0.18, gain = 0.12, hp = 900, delay = 0 }) {
  const c = ac();
  if (!c || !audio.sound) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + delay);
}

const SFX = {
  click: () => tone({ freq: 620, dur: 0.07, type: 'triangle', gain: 0.1 }),
  tap: () => tone({ freq: 420, dur: 0.06, type: 'square', gain: 0.07 }),
  pop: () => { noise({ dur: 0.14, gain: 0.16, hp: 500 }); tone({ freq: 300, glide: 1000, dur: 0.16, type: 'sine', gain: 0.14 }); },
  correct: () => {
    tone({ freq: 523, dur: 0.13, type: 'sine', gain: 0.15 });
    tone({ freq: 659, dur: 0.13, type: 'sine', gain: 0.15, delay: 0.1 });
    tone({ freq: 784, dur: 0.22, type: 'sine', gain: 0.16, delay: 0.2 });
  },
  wrong: () => {
    tone({ freq: 260, dur: 0.16, type: 'sawtooth', gain: 0.09, glide: 165 });
    tone({ freq: 190, dur: 0.2, type: 'sawtooth', gain: 0.08, delay: 0.12, glide: 130 });
  },
  star: () => { tone({ freq: 1180, dur: 0.1, type: 'sine', gain: 0.14 }); tone({ freq: 1560, dur: 0.14, type: 'sine', gain: 0.12, delay: 0.09 }); },
  coin: () => { tone({ freq: 990, dur: 0.07, type: 'square', gain: 0.09 }); tone({ freq: 1320, dur: 0.12, type: 'square', gain: 0.08, delay: 0.06 }); },
  whoosh: () => noise({ dur: 0.3, gain: 0.1, hp: 300 }),
  unlock: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.13, delay: i * 0.08 })); },
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.24, type: 'triangle', gain: 0.16, delay: i * 0.13 })); },
  lose: () => { [494, 415, 330, 262].forEach((f, i) => tone({ freq: f, dur: 0.26, type: 'sine', gain: 0.13, delay: i * 0.16 })); },
  tick: () => tone({ freq: 880, dur: 0.05, type: 'square', gain: 0.05 }),
  step: () => tone({ freq: 540, dur: 0.06, type: 'triangle', gain: 0.06 }),
  crack: () => { noise({ dur: 0.24, gain: 0.15, hp: 200 }); tone({ freq: 190, glide: 70, dur: 0.3, type: 'square', gain: 0.07 }); },
  goalArrive: () => { [659, 784, 988, 1319].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.15, delay: i * 0.1 })); noise({ dur: 0.3, gain: 0.08, hp: 900 }); },
  roar: () => { tone({ freq: 110, glide: 60, dur: 0.7, type: 'sawtooth', gain: 0.12 }); noise({ dur: 0.6, gain: 0.08, hp: 200 }); }
};

export function sfx(name) {
  if (!audio.sound) return;
  const fn = SFX[name];
  if (fn) { try { fn(); } catch (e) { /* sessiz geç */ } }
}

/* ---------------- Türkçe sesli anlatım ----------------
   TASARIM KARARI: 7 yaş çocuk için en önemli iki şey
     1) YAVAŞ konuşma (rate 0.62)
     2) CÜMLE ARASI DURAKLAMA — tek blok hâlinde okunursa anlaşılmıyor.
   Bu yüzden metin cümlelere bölünür ve her cümle AYRI söylenir;
   motor cümleler arasına doğal nefes payı koyar.
--------------------------------------------------------- */

let lastSpoken = '';
let voicesReady = false;
let trVoice = null;

/* Konuşma hızı — veli panelinden ayarlanır.
   0.62 çok yavaş, 0.78 çok hızlı bulundu → 0.72 denge noktası. */
export let speechRate = 0.72;
export function setSpeechRate(v) {
  const n = Number(v);
  speechRate = Math.max(0.45, Math.min(1.3, Number.isFinite(n) && n > 0 ? n : 0.72));
}
export function getSpeechRate() { return speechRate; }

/* Bilinen iyi Türkçe sesler — öncelik sırasıyla denenir.
   Tarayıcı varsayılanı bazen anlaşılmaz oluyor (kalite farkı çok yüksek). */
const IYI_SESLER = [
  /google.*türkçe/i, /google.*turkish/i,   // Chrome / Android — en net
  /microsoft.*(emel|tolga)/i,              // Windows — doğal
  /yelda/i, /filiz/i,                      // iOS / macOS
  /türkçe/i, /turkish/i, /tr[-_]TR/i
];

function pickTurkishVoice() {
  try {
    const list = window.speechSynthesis.getVoices() || [];
    if (!list.length) return null;
    const trler = list.filter((v) => /tr([-_]TR)?$/i.test(v.lang) || /tr[-_]TR/i.test(v.lang));
    if (!trler.length) return null;
    for (const rx of IYI_SESLER) {
      const bulunan = trler.find((v) => rx.test(v.name));
      if (bulunan) return bulunan;
    }
    // yerel (offline) ses genelde daha akıcı
    return trler.find((v) => v.localService) || trler[0];
  } catch (e) { return null; }
}

function markVoicesReady() {
  try {
    if (window.speechSynthesis.getVoices().length) {
      voicesReady = true;
      trVoice = pickTurkishVoice();
    }
  } catch (e) {}
}
if ('speechSynthesis' in window) {
  markVoicesReady();
  try { window.speechSynthesis.addEventListener('voiceschanged', markVoicesReady); } catch (e) {}
}
export function warmUpVoices() { markVoicesReady(); }

/** Metni cümlelere böl — her cümle ayrı okunur, aralarına nefes payı girer */
function cumlelereBol(t) {
  return String(t || '')
    .split(/(?<=[.?!;])\s+|\s*[—–]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/**
 * Metni Türkçe seslendir — CÜMLE CÜMLE, yavaş.
 * @param {string} text
 * @param {{force?:boolean, rate?:number, key?:string, onDone?:Function}} opts
 */
export function speak(text, { force = false, rate = null, key = '', onDone = null } = {}) {
  if (!audio.voice && !force) return;
  if (!('speechSynthesis' in window)) return;
  const hiz = Number.isFinite(rate) && rate > 0 ? rate : speechRate;
  const t = String(text || '').trim();
  const token = key || t;
  if (!t || (token === lastSpoken && !force)) return;
  lastSpoken = token;

  try {
    window.speechSynthesis.cancel();
    if (!trVoice) trVoice = pickTurkishVoice();

    const parcalar = cumlelereBol(t).slice(0, 6);   // çok uzun metni sınırla
    if (!parcalar.length) return;

    let son = 0;
    parcalar.forEach((cumle, i) => {
      const u = new SpeechSynthesisUtterance(cumle);
      u.lang = 'tr-TR';
      u.rate = hiz;           // ayarlanabilir hız (varsayılan 0.72)
      u.pitch = 1.02;         // çok tiz olmasın (anlaşılırlık)
      u.volume = 1;
      if (trVoice) u.voice = trVoice;
      if (i === parcalar.length - 1 && typeof onDone === 'function') u.onend = () => onDone();
      window.speechSynthesis.speak(u);   // motor sıraya koyar, aralara nefes payı ekler
      son = i;
    });

    // Sesler henüz yüklenmediyse: hazır olunca Türkçe sesi bağla ve tekrar dene
    if (!trVoice && !voicesReady) {
      try {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          markVoicesReady();
          if (trVoice) speak(t, { force: true, rate, key: token });
        }, { once: true });
      } catch (e) {}
    }
  } catch (e) { /* sesli anlatım desteklenmiyor */ }
}

/** Yeni soruya geçildiğinde çağrılır — tekrar okumayı engelleyen kilidi açar */
export function resetSpeech() {
  lastSpoken = '';
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch (e) {}
}

/* ---------------- Müzik: basit, neşeli döngü ---------------- */
const MELODY = [523, 587, 659, 784, 659, 587, 523, 392, 440, 523, 587, 523, 440, 392, 330, 392];
const BASS = [131, 165, 175, 196];

export function startMusic() {
  if (musicTimer) return;
  const c = ac();
  if (!c) return;
  audio.music = true;
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (!audio.music) return;
    const n = MELODY[musicStep % MELODY.length];
    const prevSound = audio.sound;
    audio.sound = true; // müzik ses ayarından bağımsız ama kısık
    tone({ freq: n, dur: 0.34, type: 'triangle', gain: 0.045 });
    if (musicStep % 4 === 0) tone({ freq: BASS[(musicStep / 4) % BASS.length], dur: 0.6, type: 'sine', gain: 0.04 });
    audio.sound = prevSound;
    musicStep++;
  }, 340);
}

export function stopMusic() {
  audio.music = false;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

export function toggleMusic() {
  if (audio.music) stopMusic(); else startMusic();
  return audio.music;
}
