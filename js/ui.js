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

/** Maskot görseli (üretilmiş). Yüklenemezse SVG maskota düşer. */
export function mascotHTML(size = 150) {
  return `<img class="mascot-img" src="assets/mascot/pofi.jpg" alt="Pofi" width="${size}" height="${size}" `
    + `decoding="async" onerror="this.onerror=null;this.outerHTML='${mascot('happy', size).replace(/'/g, '&#39;').replace(/\n/g, '')}'">`;
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
