/* ============================================================
   ui.js — DOM yardımcıları, yıldızlar, konfeti, maskot, diyalog
   ============================================================ */

import { avatarSlug } from './state.js';

/** Karakter görseli (üretilmiş). Yüklenemezse emoji'ye düşer. */
export function avatarHTML(emoji, { size = 40, cls = '' } = {}) {
  const slug = avatarSlug(emoji);
  return `<img class="ava-img ${cls}" src="assets/avatars/${slug}.jpg" alt="" width="${size}" height="${size}" `
    + `loading="lazy" decoding="async" onerror="this.onerror=null;this.replaceWith(document.createTextNode('${emoji}'))">`;
}

/**
 * Satır içi küçük avatar — metin akışında emoji YERİNE kullanılır.
 * Ham emoji bazı cihazlarda kutu/kod olarak görünür; görsel her yerde aynı çıkar.
 */
export function avatarInline(emoji, size = 22) {
  const slug = avatarSlug(emoji);
  return `<img class="ava-inline" src="assets/avatars/${slug}.jpg" alt="" width="${size}" height="${size}" `
    + `loading="lazy" decoding="async" onerror="this.style.display='none'">`;
}

/** Kullanıcı girdisini HTML'e güvenle koy (XSS koruması). */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Ruh haline göre rozet (SVG — her cihazda aynı görünür) */
const MOOD_BADGE = {
  cheer: `<svg viewBox="0 0 100 100"><path d="M50 8 l11 24 l26 4 l-19 18 l5 26 l-23 -13 l-23 13 l5 -26 l-19 -18 l26 -4 z"
    fill="#ffd23d" stroke="#23324d" stroke-width="5" stroke-linejoin="round"/></svg>`,
  happy: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="26" fill="#58cf6a" stroke="#23324d" stroke-width="5"/>
    <path d="M34 44 q6 -10 12 0 M54 44 q6 -10 12 0" stroke="#23324d" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M36 60 q14 14 28 0" stroke="#23324d" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
  think: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="26" fill="#ffd23d" stroke="#23324d" stroke-width="5"/>
    <circle cx="38" cy="48" r="5" fill="#23324d"/><circle cx="50" cy="48" r="5" fill="#23324d"/><circle cx="62" cy="48" r="5" fill="#23324d"/></svg>`,
  sad: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="26" fill="#7fd4ff" stroke="#23324d" stroke-width="5"/>
    <path d="M36 46 q7 -9 14 0 M50 46 q7 -9 14 0" stroke="#23324d" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M38 64 q12 -12 24 0" stroke="#23324d" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
  ooo: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="26" fill="#b07cff" stroke="#23324d" stroke-width="5"/>
    <circle cx="38" cy="46" r="7" fill="#23324d"/><circle cx="62" cy="46" r="7" fill="#23324d"/>
    <ellipse cx="50" cy="66" rx="7" ry="9" fill="#23324d"/></svg>`
};

/**
 * Maskot görseli (üretilmiş AI portresi) + ruh hali.
 * Ruh hali bir rozet ve hafif animasyonla gösterilir.
 * @param {number} size
 * @param {'happy'|'cheer'|'think'|'sad'|'ooo'} mood
 */
export function mascotHTML(size = 150, mood = 'happy') {
  const badge = MOOD_BADGE[mood];
  /**
   * Yedek SVG'yi HTML niteliğine gömerken tırnakları KAÇIRMAK zorunlu.
   * Kaçırılmazsa nitelik SVG içindeki ilk " işaretinde biter ve SVG kodu
   * sayfada HAM METİN olarak görünür (ekranda "kod" olarak çıkıyordu).
   */
  const yedek = mascot(mood, size)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
  return `<span class="mascot-wrap mood-${mood}" style="width:${size}px;height:${size}px;">`
    + `<img class="mascot-img" src="assets/mascot/pofi.jpg" alt="Pofi" width="${size}" height="${size}" `
    + `decoding="async" onerror="this.onerror=null;this.outerHTML='${yedek}'">`
    + (badge ? `<span class="mascot-badge">${badge}</span>` : '')
    + `</span>`;
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'ariaPressed') node.setAttribute('aria-pressed', String(v));
    else if (k === 'ariaLabel') node.setAttribute('aria-label', String(v));
    else if (k in node && typeof v !== 'boolean' && k !== 'type') node[k] = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(3)) {
    if (c == null || c === false) continue;
    node.append(typeof c === 'string' || typeof c === 'number' ? String(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function starsHTML(n, max = 3) {
  let out = '<span class="stars">';
  for (let i = 0; i < max; i++) out += `<span class="s ${i < n ? 'on' : ''}">★</span>`;
  return out + '</span>';
}

export function starsEl(n, max = 3) {
  const wrap = el('span', { class: 'stars' });
  for (let i = 0; i < max; i++) wrap.append(el('span', { class: 's' + (i < n ? ' on' : ''), text: '★' }));
  return wrap;
}

/* ---------------- Toast ---------------- */
let toastTimer = null;
export function toast(msg, ms = 1700) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------------- Diyalog (modal) ---------------- */
export function dialog(content, { dismissible = true } = {}) {
  const layer = document.getElementById('dialog');
  clear(layer);
  const panel = el('div', { class: 'panel narrow', style: { pointerEvents: 'auto' } });
  panel.append(content);
  layer.append(panel);
  layer.hidden = false;
  const close = () => { layer.hidden = true; clear(layer); };
  if (dismissible) {
    layer.onclick = (e) => { if (e.target === layer) close(); };
  } else {
    layer.onclick = null;
  }
  return close;
}

export function confirmBox(message, { yes = 'Evet', no = 'Vazgeç', title = 'Emin misin?' } = {}) {
  return new Promise((resolve) => {
    const box = el('div', {},
      el('h3', { text: title }),
      el('p', { text: message }),
      el('div', { class: 'btn-row', style: { marginTop: '14px' } },
        el('button', { class: 'btn green', text: yes, onClick: () => { close(); resolve(true); } }),
        el('button', { class: 'btn ghost', text: no, onClick: () => { close(); resolve(false); } })
      )
    );
    const close = dialog(box, { dismissible: false });
  });
}

/* ---------------- Konfeti ---------------- */
const COLORS = ['#ff9a3d', '#ffd23d', '#58cf6a', '#3dbdff', '#b07cff', '#ff6f9c'];
let confettiParts = [];
let confettiRAF = null;

export function confetti({ count = 90, duration = 2200 } = {}) {
  const cv = document.getElementById('confetti');
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = window.innerWidth * dpr;
  cv.height = window.innerHeight * dpr;
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = window.innerWidth, H = window.innerHeight;

  for (let i = 0; i < count; i++) {
    confettiParts.push({
      x: W / 2 + (Math.random() - 0.5) * W * 0.7,
      y: H * 0.28 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 7,
      vy: -Math.random() * 9 - 3,
      g: 0.28,
      s: 6 + Math.random() * 9,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.28,
      col: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
      shape: Math.random() < 0.35 ? 'circle' : 'rect'
    });
  }

  const t0 = performance.now();
  if (confettiRAF) cancelAnimationFrame(confettiRAF);

  const step = (now) => {
    const elapsed = now - t0;
    c.clearRect(0, 0, W, H);
    confettiParts = confettiParts.filter((p) => p.y < H + 40 && p.life > 0);
    for (const p of confettiParts) {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (elapsed > duration * 0.6) p.life -= 0.012;
      c.save();
      c.globalAlpha = Math.max(0, Math.min(1, p.life));
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.col;
      if (p.shape === 'circle') { c.beginPath(); c.arc(0, 0, p.s / 2, 0, Math.PI * 2); c.fill(); }
      else c.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
      c.restore();
    }
    if (elapsed < duration || confettiParts.length) {
      confettiRAF = requestAnimationFrame(step);
    } else {
      c.clearRect(0, 0, W, H);
      confettiRAF = null;
    }
  };
  confettiRAF = requestAnimationFrame(step);
}

/* ---------------- Maskot: Pofi (basit şekillerden) ---------------- */
export function mascot(mood = 'happy', size = 120) {
  const eyes = {
    happy: '<circle cx="-13" cy="0" r="5.2" fill="#23324d"/><circle cx="13" cy="0" r="5.2" fill="#23324d"/><circle cx="-11.4" cy="-1.8" r="1.7" fill="#fff"/><circle cx="14.6" cy="-1.8" r="1.7" fill="#fff"/>',
    cheer: '<path d="M-19 -2 q6 -9 12 0" stroke="#23324d" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M7 -2 q6 -9 12 0" stroke="#23324d" stroke-width="3.4" fill="none" stroke-linecap="round"/>',
    think: '<circle cx="-13" cy="0" r="4" fill="#23324d"/><circle cx="13" cy="0" r="4" fill="#23324d"/><path d="M4 -14 q9 -4 12 2" stroke="#23324d" stroke-width="3" fill="none" stroke-linecap="round"/>',
    sad: '<path d="M-19 2 q6 -8 12 0" stroke="#23324d" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M7 2 q6 -8 12 0" stroke="#23324d" stroke-width="3.4" fill="none" stroke-linecap="round"/>',
    ooo: '<circle cx="-13" cy="0" r="7" fill="#23324d"/><circle cx="13" cy="0" r="7" fill="#23324d"/><circle cx="-10.6" cy="-2.4" r="2.2" fill="#fff"/><circle cx="15.4" cy="-2.4" r="2.2" fill="#fff"/>'
  };
  const mouth = {
    happy: '<path d="M-9 14 q9 10 18 0" stroke="#23324d" stroke-width="3.4" fill="none" stroke-linecap="round"/>',
    cheer: '<path d="M-11 12 q11 15 22 0 z" fill="#23324d"/><path d="M-5 14 q5 7 10 0" fill="#ff8fa8"/>',
    think: '<path d="M-6 15 h12" stroke="#23324d" stroke-width="3.4" fill="none" stroke-linecap="round"/>',
    sad: '<path d="M-9 19 q9 -10 18 0" stroke="#23324d" stroke-width="3.4" fill="none" stroke-linecap="round"/>',
    ooo: '<ellipse cx="0" cy="16" rx="6" ry="8" fill="#23324d"/>'
  };

  return `<svg width="${size}" height="${size}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polygon points="58,66 66,20 104,58" fill="#ef7f1a" stroke="#23324d" stroke-width="4" stroke-linejoin="round"/>
    <polygon points="142,66 134,20 96,58" fill="#ef7f1a" stroke="#23324d" stroke-width="4" stroke-linejoin="round"/>
    <rect x="44" y="86" width="112" height="96" rx="34" fill="#ffb15c" stroke="#23324d" stroke-width="4"/>
    <circle cx="100" cy="92" r="58" fill="#ff9a3d" stroke="#23324d" stroke-width="4"/>
    <ellipse cx="100" cy="126" rx="46" ry="34" fill="#fff4e6" stroke="#23324d" stroke-width="0"/>
    <g transform="translate(100,84)">${eyes[mood] || eyes.happy}</g>
    <ellipse cx="100" cy="118" rx="10" ry="7" fill="#23324d"/>
    <g transform="translate(100,104)">${mouth[mood] || mouth.happy}</g>
    <circle cx="100" cy="0" r="0" fill="none"/>
  </svg>`;
}

/** Bir görsel öğeyi sallama animasyonu ile geri bildirim */
export function shake(node) {
  if (!node) return;
  node.style.animation = 'none';
  void node.offsetWidth;
  node.style.animation = 'shake .34s ease';
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}


/* ============================================================
   OYUN "SULU"LUĞU (game juice)
   Konsol oyunlarında her aksiyonun görsel karşılığı vardır.
   Bunlar "hissi" belirler: doğru cevap tatmin edici olmalı.
   ============================================================ */

/** Parçacık patlaması — doğru cevapta kutlama */
export function patlama(x, y, { adet = 18, renkler = ['#ffd23d', '#58cf6a', '#4aa8ff', '#ff6f9c'], boyut = 1 } = {}) {
  const kat = document.createElement('div');
  kat.className = 'patlama-kat';
  document.body.append(kat);
  for (let i = 0; i < adet; i++) {
    const p = document.createElement('i');
    const aci = (Math.PI * 2 * i) / adet + Math.random() * 0.5;
    const mesafe = (46 + Math.random() * 78) * boyut;
    p.style.setProperty('--x', Math.cos(aci) * mesafe + 'px');
    p.style.setProperty('--y', Math.sin(aci) * mesafe + 'px');
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.background = renkler[i % renkler.length];
    p.style.animationDelay = (Math.random() * 60) + 'ms';
    p.style.width = p.style.height = (6 + Math.random() * 7) * boyut + 'px';
    kat.append(p);
  }
  setTimeout(() => kat.remove(), 900);
}

/** Bir DOM öğesinin merkezinden patlama (kolay kullanım) */
export function elemandanPatlama(node, opts) {
  if (!node?.getBoundingClientRect) return;
  const r = node.getBoundingClientRect();
  patlama(r.left + r.width / 2, r.top + r.height / 2, opts);
}

/** Ekran sarsıntısı — büyük olaylarda (kombo, patron vuruşu) */
export function ekranSars(siddet = 1) {
  const el0 = document.getElementById('app') || document.body;
  el0.style.setProperty('--sars', String(siddet));
  el0.classList.remove('sarsiliyor');
  void el0.offsetWidth;              // reflow → animasyon yeniden başlasın
  el0.classList.add('sarsiliyor');
  setTimeout(() => el0.classList.remove('sarsiliyor'), 320);
}

/** Hit-stop: çok kısa "donma" — vuruş hissi (konsol oyunlarında yaygın) */
export function hitStop(ms = 90) {
  const el0 = document.getElementById('app') || document.body;
  el0.style.transition = 'filter 40ms';
  el0.style.filter = 'brightness(1.25) contrast(1.08)';
  setTimeout(() => { el0.style.filter = ''; }, ms);
}

/** Kombo çağrısı — ekranda uçan yazı ("3'lü KOMBO!") */
export function komboYazisi(metin, renk = '#ffd23d') {
  const y = document.createElement('div');
  y.className = 'kombo-yazi';
  y.textContent = metin;
  y.style.color = renk;
  document.body.append(y);
  setTimeout(() => y.remove(), 1100);
}
