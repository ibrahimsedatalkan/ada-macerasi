/* ============================================================
   music.js — Katmanlı, yoğunluğu değişen müzik motoru

   ÖNCE: 16 notalık tek döngü, 340ms aralık ("bip" sesi)
   ŞİMDİ: akor yürüyüşü + bas + arpej + perküsyon, ve YOĞUNLUK
          seviyesi (0-3) — çocuk seri yaptıkça müzik coşar.
          Konsol oyunlarında müzik skora göre yükselir; bu onun
          basit ama etkili hâli.

   Tüm sesler Web Audio ile SENTEZLENİR — dosya yok, indirme yok.
   ============================================================ */

let ctx = null;
let anaKazanc = null;
let zamanlayici = null;
let adim = 0;
let yogunluk = 1;          // 0 sessiz-sakin, 1 normal, 2 tempolu, 3 coşkulu
let mod = 'menu';          // 'menu' | 'play' | 'victory'
let victoryTimer = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    anaKazanc = ctx.createGain();
    anaKazanc.gain.value = 0.5;
    anaKazanc.connect(ctx.destination);
    // his.js müzik kısma (ducking) için bu düğüme erişir
    window.__adaMuzikKazanc = anaKazanc;
  }
  if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
  return ctx;
}

/* ---------------- Müzikal malzeme ----------------
   C majör, çocuk dostu akor yürüyüşü: I - V - vi - IV
   Her akor 4 vuruş. Nota frekansları (Hz). */
const AKORLAR = [
  { kok: 130.81, notalar: [261.63, 329.63, 392.00] },  // C
  { kok: 196.00, notalar: [293.66, 392.00, 493.88] },  // G
  { kok: 220.00, notalar: [261.63, 329.63, 440.00] },  // Am
  { kok: 174.61, notalar: [261.63, 349.23, 440.00] }   // F
];

/* Arpej deseni (akor içindeki nota sırası) */
const ARPEJ = [0, 1, 2, 1, 2, 1, 0, 1];

/** Tek nota çal */
function nota(freq, sure, tip = 'triangle', kazanc = 0.12, gecikme = 0, hedef = null) {
  const c = ac(); if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = tip;
  osc.frequency.value = freq;
  const t0 = c.currentTime + gecikme;
  const hedefDugum = hedef || anaKazanc;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(kazanc, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  osc.connect(g); g.connect(hedefDugum);
  osc.start(t0); osc.stop(t0 + sure + 0.05);
}

/** Gürültü patlaması (perküsyon) */
function vurus(sure = 0.06, kazanc = 0.07, gecikme = 0, tip = 'highpass', kesim = 6000) {
  const c = ac(); if (!c) return;
  const uzunluk = Math.max(1, Math.floor(c.sampleRate * sure));
  const tampon = c.createBuffer(1, uzunluk, c.sampleRate);
  const veri = tampon.getChannelData(0);
  for (let i = 0; i < uzunluk; i++) veri[i] = Math.random() * 2 - 1;
  const kaynak = c.createBufferSource(); kaynak.buffer = tampon;
  const filtre = c.createBiquadFilter();
  filtre.type = tip; filtre.frequency.value = kesim;
  const g = c.createGain();
  const t0 = c.currentTime + gecikme;
  g.gain.setValueAtTime(kazanc, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  kaynak.connect(filtre); filtre.connect(g); g.connect(anaKazanc);
  kaynak.start(t0); kaynak.stop(t0 + sure + 0.02);
}

/** Kick (bas davul) — alçalan sinüs */
function kick(gecikme = 0, kazanc = 0.16) {
  const c = ac(); if (!c) return;
  const osc = c.createOscillator(); const g = c.createGain();
  const t0 = c.currentTime + gecikme;
  osc.frequency.setValueAtTime(150, t0);
  osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.12);
  g.gain.setValueAtTime(kazanc, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  osc.connect(g); g.connect(anaKazanc);
  osc.start(t0); osc.stop(t0 + 0.2);
}

/* ---------------- Ritim motoru ----------------
   Her "adım" = bir sekizlik. Mod ve yoğunluğa göre katmanlar eklenir. */
function adimCal() {
  const akor = AKORLAR[Math.floor(adim / 8) % AKORLAR.length];
  const icinde = adim % 8;

  // 1) BAS — her zaman (temel)
  if (icinde % 4 === 0) nota(akor.kok, 0.42, 'sine', 0.13, 0);

  // 2) AKOR PEDİ — yoğunluk ≥1
  if (yogunluk >= 1 && icinde % 8 === 0) {
    akor.notalar.forEach((n, k) => nota(n, 1.5, 'triangle', 0.042, k * 0.012));
  }

  // 3) ARPEJ (melodi) — oyunda her zaman, menüde sakin
  if (mod === 'play' || yogunluk >= 2) {
    const n = akor.notalar[ARPEJ[icinde % ARPEJ.length]];
    if (icinde % 2 === 0 || yogunluk >= 2) {
      nota(n * 2, 0.20, 'triangle', 0.055);
    }
  } else if (mod === 'menu' && icinde % 4 === 0) {
    nota(akor.notalar[0] * 2, 0.5, 'sine', 0.032);
  }

  // 4) PERKÜSYON — yoğunluk ≥1
  if (yogunluk >= 1) {
    if (icinde % 4 === 0) kick(0, yogunluk >= 3 ? 0.19 : 0.14);
    if (yogunluk >= 2 && icinde % 8 === 4) vurus(0.09, 0.07, 0, 'bandpass', 2200);  // snare
    if (yogunluk >= 2 && icinde % 2 === 1) vurus(0.03, 0.035, 0, 'highpass', 8000); // hi-hat
  }

  adim++;
}

/* ---------------- Açık API ---------------- */
const TEMPO_MS = { menu: 300, play: 250, victory: 200 };

export function muzikBaslat(yeniMod = 'menu') {
  const c = ac(); if (!c) return;
  mod = yeniMod;
  if (zamanlayici) return;          // zaten çalıyor — yalnız mod değişti
  adim = 0;
  zamanlayici = setInterval(() => {
    try { adimCal(); } catch (e) { /* ses bağlamı kapandıysa geç */ }
  }, TEMPO_MS[mod] || 260);
}

export function muzikModu(yeniMod) {
  if (mod === yeniMod) return;
  mod = yeniMod;
  if (!zamanlayici) return;
  clearInterval(zamanlayici);
  zamanlayici = setInterval(() => {
    try { adimCal(); } catch (e) {}
  }, TEMPO_MS[mod] || 260);
}

/** Yoğunluk 0-3 — çocuk seri yaptıkça müzik coşar */
export function muzikYogunluk(n) {
  yogunluk = Math.max(0, Math.min(3, Math.round(n)));
}

export function muzikDurdur() {
  if (zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
  if (victoryTimer) { clearTimeout(victoryTimer); victoryTimer = null; }
}

export function muzikCaliyor() { return !!zamanlayici; }
export function muzikMod() { return mod; }

/** Zafer fanfarı — kısa, coşkulu, sonra normale döner */
export function zaferFanfari(geriDon = 'menu') {
  const c = ac(); if (!c) return;
  const dizi = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
  dizi.forEach((f, i) => {
    nota(f, i === dizi.length - 1 ? 0.6 : 0.18, 'triangle', 0.15, i * 0.13);
    if (i % 2 === 0) nota(f / 2, 0.3, 'sine', 0.09, i * 0.13);
  });
  // Fanfar sırasında müziği kıs
  const eski = anaKazanc ? anaKazanc.gain.value : 0.5;
  if (anaKazanc) {
    anaKazanc.gain.setValueAtTime(0.16, c.currentTime);
    victoryTimer = setTimeout(() => {
      if (anaKazanc) anaKazanc.gain.setValueAtTime(eski, c.currentTime);
      muzikModu(geriDon);
    }, 1500);
  }
}

/** Trofe/ödül için kısa parıltı */
export function odulParlitisi() {
  [1046.50, 1318.51, 1567.98].forEach((f, i) => nota(f, 0.28, 'sine', 0.11, i * 0.06));
}
