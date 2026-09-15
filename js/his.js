/* ============================================================
   his.js — Duyusal katman: titreme (haptik), ortam sesleri, müzik kısma

   NEDEN: PS5'in DualSense titreşimi oyun hissinin yarısı. Mobilde
   `navigator.vibrate` var — kullanmıyorduk. Ayrıca konsol oyunlarında
   müzik, konuşma başlayınca KISILIR (ducking) ve her ortamın kendi
   ambiyansı vardır (kuş, rüzgâr, su). Bunlar atmosferi kuran detaylar.
   ============================================================ */

let ctx = null;
let ortamDugum = null;
let ortamKazanc = null;
let ortamZaman = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/* ---------------- TİTREME (haptik) ----------------
   Türkiye'de çocukların çoğu Android tablet/telefon kullanıyor;
   titreşim orada da çalışır. Desteklenmiyorsa sessizce geçer. */
export const titresimAcik = () => typeof navigator !== 'undefined' && !!navigator.vibrate;

export function titre(desen) {
  if (!titresimAcik()) return false;
  try { navigator.vibrate(desen); return true; } catch (e) { return false; }
}

/** Doğru cevap: kısa, tatmin edici tek tık */
export const titretDogru = () => titre(28);
/** Yanlış cevap: iki kısa tık (hata hissi) */
export const titretYanlis = () => titre([40, 60, 40]);
/** Seri/kombo: artan güç */
export function titretKombo(seri) {
  const guc = Math.min(5, Math.max(1, Math.round(seri / 3)));
  titre(Array.from({ length: guc * 2 }, (_, i) => (i % 2 ? 35 : 18)));
}
/** Trofe: konsollardaki "ödül" hissi — uzun-kısa-uzun */
export const titretTrofe = () => titre([60, 50, 120]);
/** Buton dokunuşu: çok hafif */
export const titretDokun = () => titre(12);

/* ---------------- MÜZİK KISMA (ducking) ----------------
   Konuşma başlarken müziği kısar, bitince geri açar.
   Konsol oyunlarında diyalog sırasında müzik hep kısılır. */
let sesSeviyesi = 1;          // 0..1 ana müzik seviyesi
let konusmaAcik = false;

/** Müzik motorunun ana kazancını ayarla (0..1) */
export function muzikSeviye(deger) {
  sesSeviyesi = Math.max(0, Math.min(1, deger));
  uygula();
}

/** Konuşma başladı/bitti — müziği geçici olarak kıs */
export function konusmaDurumu(acik) {
  konusmaAcik = !!acik;
  uygula();
}

function uygula() {
  // Konuşma sırasında müzik %32'ye iner (konuşma net duyulsun)
  const hedef = sesSeviyesi * (konusmaAcik ? 0.32 : 1);
  try {
    const m = window.__adaMuzikKazanc;
    // DİKKAT: AudioParam'ın `.context` özelliği YOKTUR — context düğümde
    // (GainNode) bulunur. Önceden `m.gain.context` yazılmıştı, bu yüzden
    // çağrı sessizce hata fırlatıp yutuluyordu ve müzik HİÇ kısılmıyordu.
    if (m && m.gain && m.context) {
      m.gain.setTargetAtTime(hedef * 0.5, m.context.currentTime, 0.08);
    }
  } catch (e) {}
}

/* ---------------- ORTAM SESLERİ (ambiyans) ----------------
   Her adanın kendi atmosferi: orman kuşları, mağara damlası,
   deniz dalgası, kale rüzgârı... Sentezlenir, dosya gerekmez. */
const ORTAM = {
  w1: { tip: 'kus',  yogunluk: 0.5 },   // Çayır — kuş cıvıltısı
  w2: { tip: 'kus',  yogunluk: 0.9 },   // Orman — yoğun kuş
  w3: { tip: 'damla', yogunluk: 0.6 },  // Mağara — su damlası
  w4: { tip: 'ruzgar', yogunluk: 0.5 }, // Gökkuşağı — hafif rüzgâr
  w5: { tip: 'ruzgar', yogunluk: 0.9 }, // Kale — güçlü rüzgâr
  w6: { tip: 'yildiz', yogunluk: 0.7 }, // Yıldız — parıltı/çan
  w7: { tip: 'dalga',  yogunluk: 0.7 }  // Deniz — dalga
};

function gurultu(sure) {
  const c = ac(); if (!c) return null;
  const n = Math.max(1, Math.floor(c.sampleRate * sure));
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function ambiyansSesi(modal, kazanc, filtreTip, kesim, sure) {
  const c = ac(); if (!c) return;
  const kaynak = c.createBufferSource();
  kaynak.buffer = gurultu(sure);
  const f = c.createBiquadFilter();
  f.type = filtreTip; f.frequency.value = kesim;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(kazanc, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
  kaynak.connect(f); f.connect(g); g.connect(ortamDugum || c.destination);
  kaynak.start(t); kaynak.stop(t + sure);
}

const kus = (k) => {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  const t = c.currentTime;
  const f0 = 1800 + Math.random() * 1600;
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.5), t + 0.07);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.13);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(k * 0.05, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g); g.connect(ortamDugum || c.destination);
  o.start(t); o.stop(t + 0.2);
};

/** Ortam sesini başlat (ada id ile) */
export function ortamBaslat(worldId, seviye = 1) {
  ortamDurdur();
  const ayar = ORTAM[worldId];
  const c = ac(); if (!c || !ayar) return;

  ortamDugum = c.createGain();
  ortamKazanc = Math.max(0, Math.min(1, seviye)) * 0.5;
  ortamDugum.gain.value = ortamKazanc;
  ortamDugum.connect(c.destination);

  const k = ayar.yogunluk;
  ortamZaman = setInterval(() => {
    try {
      switch (ayar.tip) {
        case 'kus':
          if (Math.random() < 0.9) kus(k);
          if (Math.random() < 0.3) setTimeout(() => kus(k * 0.7), 180);
          break;
        case 'damla':
          if (Math.random() < 0.5) {
            const o = ac().createOscillator(); const g = ac().createGain();
            const t = ac().currentTime;
            o.type = 'sine';
            o.frequency.setValueAtTime(900 + Math.random() * 700, t);
            o.frequency.exponentialRampToValueAtTime(300, t + 0.16);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(k * 0.07, t + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
            o.connect(g); g.connect(ortamDugum);
            o.start(t); o.stop(t + 0.34);
          }
          break;
        case 'ruzgar':
          ambiyansSesi('ruzgar', k * 0.045, 'lowpass', 420, 2.2);
          break;
        case 'dalga':
          ambiyansSesi('dalga', k * 0.055, 'lowpass', 700, 2.8);
          break;
        case 'yildiz':
          if (Math.random() < 0.35) {
            const notalar = [1046.5, 1318.5, 1568, 2093];
            const f = notalar[Math.floor(Math.random() * notalar.length)];
            const o = ac().createOscillator(); const g = ac().createGain();
            const t = ac().currentTime;
            o.type = 'sine'; o.frequency.value = f;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(k * 0.03, t + 0.05);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
            o.connect(g); g.connect(ortamDugum);
            o.start(t); o.stop(t + 1.2);
          }
          break;
      }
    } catch (e) {}
  }, 1100);
}

export function ortamDurdur() {
  if (ortamZaman) { clearInterval(ortamZaman); ortamZaman = null; }
  if (ortamDugum) { try { ortamDugum.disconnect(); } catch (e) {} ortamDugum = null; }
}

export function ortamCaliyor() { return !!ortamZaman; }
