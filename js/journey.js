/* ============================================================
   journey.js — "Hedefe ilerleme" şeridi
   Her doğru cevap karakteri bir adım ilerletir, önündeki engel
   parçalanır. Yolun ortasındaki BÜYÜK ENGEL yıkılınca yol açılır.
   Bölüm sonunda hedef (sandık/kule/kristal/köprü) açılır.
   Çizim bölümlerinde ilerleme kapsama oranına bağlıdır.
   ============================================================ */

import { el } from './ui.js';

const THEMES = {
  w1: { obstacle: 'cali', big: 'kaya', goal: 'sandik', label: 'Hazine Sandığı', ground: 'linear-gradient(180deg,#e6fbd6,#a9e08c)', sky: '#eaf9ff' },
  w2: { obstacle: 'kaya', big: 'kaya', goal: 'kule', label: 'Orman Kulesi', ground: 'linear-gradient(180deg,#dcf3d0,#9ed486)', sky: '#eefbe6' },
  w3: { obstacle: 'kristal', big: 'kristal', goal: 'kristal', label: 'Kristal Kalp', ground: 'linear-gradient(180deg,#d7d9f7,#9aa0e0)', sky: '#e5e6ff' },
  w4: { obstacle: 'tahta', big: 'tahta', goal: 'kopru', label: 'Gökkuşağı Köprüsü', ground: 'linear-gradient(180deg,#ffe8f3,#ffbed9)', sky: '#fff2f8' },
  w5: { obstacle: 'kaya', big: 'kapi', goal: 'kule', label: 'Ejderha Kalesi', ground: 'linear-gradient(180deg,#eccfcf,#c19393)', sky: '#f7e2e2' }
};

function svg(inner) {
  return `<svg class="j-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

const OBSTACLES = {
  cali: () => svg(`<circle cx="22" cy="42" r="13" fill="#4fbb63" stroke="#23324d" stroke-width="3"/><circle cx="42" cy="40" r="11" fill="#58cf6a" stroke="#23324d" stroke-width="3"/><circle cx="32" cy="31" r="13" fill="#6fd97a" stroke="#23324d" stroke-width="3"/>`),
  kaya: () => svg(`<path d="M10 50 L20 22 L36 16 L54 34 L50 50 Z" fill="#9aa6b8" stroke="#23324d" stroke-width="3" stroke-linejoin="round"/><path d="M20 22 L31 38 L17 44" fill="none" stroke="#23324d" stroke-width="2.2"/>`),
  kristal: () => svg(`<path d="M32 8 L50 30 L32 56 L14 30 Z" fill="#b07cff" stroke="#23324d" stroke-width="3" stroke-linejoin="round"/><path d="M32 8 V56 M14 30 H50" stroke="#23324d" stroke-width="2" opacity=".45"/>`),
  tahta: () => svg(`<rect x="4" y="30" width="56" height="12" rx="3" fill="#c98a3d" stroke="#23324d" stroke-width="3"/><path d="M26 30 l6 6 l-6 6" fill="none" stroke="#23324d" stroke-width="2.5"/>`),
  kapi: () => svg(`<path d="M12 56 V32 a20 20 0 0 1 40 0 V56 Z" fill="#8a6a4a" stroke="#23324d" stroke-width="3" stroke-linejoin="round"/><path d="M22 56 V33 M32 56 V30 M42 56 V33" stroke="#23324d" stroke-width="2.4"/>`)
};

const GOALS = {
  sandik: () => svg(`<rect x="8" y="28" width="48" height="28" rx="5" fill="#c98a3d" stroke="#23324d" stroke-width="3"/>
    <path class="j-open-part" d="M8 28 q24 -18 48 0" fill="#e0a44e" stroke="#23324d" stroke-width="3" stroke-linejoin="round"/>
    <rect x="27" y="33" width="10" height="13" rx="2" fill="#ffd23d" stroke="#23324d" stroke-width="2.4"/>
    <circle cx="32" cy="39" r="2.2" fill="#23324d"/>`),
  kule: () => svg(`<rect x="18" y="18" width="28" height="40" fill="#aab3cc" stroke="#23324d" stroke-width="3"/>
    <rect x="12" y="10" width="40" height="10" rx="2" fill="#96a0bd" stroke="#23324d" stroke-width="3"/>
    <polygon points="32,0 41,10 23,10" fill="#ff5a5f" stroke="#23324d" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="32" cy="28" r="4.4" fill="#ffd23d" stroke="#23324d" stroke-width="2.2"/>
    <rect class="j-open-part" x="26" y="38" width="12" height="20" rx="2" fill="#7a5334" stroke="#23324d" stroke-width="2.6"/>`),
  kristal: () => svg(`<path d="M32 4 L52 28 L32 60 L12 28 Z" fill="#e6dbff" stroke="#23324d" stroke-width="3" stroke-linejoin="round"/>
    <path class="j-open-part" d="M32 15 L43 28 L32 49 L21 28 Z" fill="#b07cff" stroke="#23324d" stroke-width="2.6" stroke-linejoin="round"/>`),
  kopru: () => svg(`<rect x="2" y="34" width="20" height="11" rx="3" fill="#c98a3d" stroke="#23324d" stroke-width="3"/>
    <rect x="42" y="34" width="20" height="11" rx="3" fill="#c98a3d" stroke="#23324d" stroke-width="3"/>
    <g class="j-open-part"><rect x="22" y="34" width="20" height="11" rx="3" fill="#e0a44e" stroke="#23324d" stroke-width="3"/></g>
    <path d="M4 52 q28 10 56 0" fill="none" stroke="#23324d" stroke-width="2.5" opacity=".35"/>`)
};

/** Bölüm tipine göre "kaç adım" beklenir */
export function expectedSteps(level) {
  const cfg = level.cfg || {};
  switch (level.type) {
    case 'multiply': return cfg.rounds || 7;
    case 'sides': return cfg.rounds || 6;
    case 'boss': return Math.max(cfg.rounds || 8, Math.round((cfg.rounds || 8) * 1.4));
    case 'shapehunt': return (cfg.rounds || 4) * (cfg.tokensPerRound || 4);
    case 'draw': return Math.max(4, (cfg.shapes || ['kare']).length * 3);
    default: return cfg.rounds || 6;
  }
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));

export class Journey {
  constructor({ steps = 6, worldId = 'w1', avatar = '🦊', goalLabel } = {}) {
    this.steps = Math.max(2, Math.round(steps));
    this.vis = Math.min(this.steps, 12);
    this.theme = THEMES[worldId] || THEMES.w1;
    this.goalLabel = goalLabel || this.theme.label;
    this.avatar = avatar;
    this.done = 0;
    this.f = 0;
    this.destroyed = false;
    this.markDone = new Array(this.vis).fill(false);
    this.bigDone = false;
    this.arrived = false;
  }

  mount(container) {
    const t = this.theme;
    this.root = el('div', { class: 'journey' });
    this.labelEl = el('span', { class: 'j-label', text: `🎯 Hedef: ${this.goalLabel}` });
    this.countEl = el('span', { class: 'j-count', text: `0 / ${this.steps}` });
    const head = el('div', { class: 'j-head' }, this.labelEl, this.countEl);

    this.track = el('div', { class: 'j-track', style: { backgroundImage: t.ground } });
    this.track.append(el('div', { class: 'j-path' }));

    this.markers = [];
    for (let i = 0; i < this.vis; i++) {
      const left = 8 + (74 * (i + 1)) / this.vis;      // % konum
      const mark = el('div', { class: 'j-mark', style: { left: left + '%' } },
        el('span', { class: 'j-mark-ob', html: OBSTACLES[t.obstacle]() }),
        el('span', { class: 'j-mark-dot' })
      );
      this.markers.push(mark);
      this.track.append(mark);
    }

    this.big = el('div', { class: 'j-big', html: OBSTACLES[t.big]() });
    this.track.append(this.big);

    this.walker = el('div', { class: 'j-walker', text: this.avatar, style: { left: '8%' } });
    this.track.append(this.walker);

    this.goal = el('div', { class: 'j-goal', dataset: { goal: t.goal }, html: GOALS[t.goal]() });
    this.track.append(this.goal);

    this.bubble = el('div', { class: 'j-bubble', text: '' });
    this.track.append(this.bubble);

    this.root.append(head, this.track);
    container.append(this.root);
    this.container = container;
  }

  /** 0..1 arası ilerleme */
  setProgress(fraction) {
    if (this.destroyed || !this.root) return;
    const f = clamp01(fraction);
    if (f <= this.f) { this.f = Math.max(this.f, f); }

    // işaretçiler: kontrol noktaları (i+1)/vis
    for (let i = 0; i < this.vis; i++) {
      const cp = (i + 1) / this.vis;
      if (!this.markDone[i] && f >= cp - 0.001) {
        this.markDone[i] = true;
        this.markers[i].classList.add('done');
        this.markers[i].classList.add('burst');
        this.shatterAt(this.markers[i]);
      }
    }

    if (!this.bigDone && f >= 0.5) {
      this.bigDone = true;
      this.big.classList.add('done');
      this.shatterAt(this.big, 20);
      this.say('🧱 Büyük engel yıkıldı! Yol açıldı.');
    }

    this.f = f;
    this.done = Math.round(f * this.steps);
    const left = 8 + 74 * f;
    this.walker.style.left = left + '%';
    this.walker.classList.add('walking');
    clearTimeout(this._walkT);
    this._walkT = setTimeout(() => this.walker?.classList.remove('walking'), 700);
    this.updateCount();
  }

  advance(step = 1) { this.setProgress((this.done + step) / this.steps); }

  /** Yanlış cevap: karakter sendeler, ilerleme korunur (motivasyon) */
  stumble() {
    if (this.destroyed || !this.walker) return;
    this.walker.classList.remove('stumble');
    void this.walker.offsetWidth;
    this.walker.classList.add('stumble');
    this.bubble.textContent = '💦';
    this.bubble.classList.add('show');
    setTimeout(() => { this.bubble?.classList.remove('show'); }, 900);
    setTimeout(() => this.walker?.classList.remove('stumble'), 600);
  }

  /** Bölüm bitti: hedefe varış. Ulaşılamayan engeller işaretlenir. */
  arrive({ completed = false, perfect = false } = {}) {
    if (this.destroyed || !this.root) return;
    this.arrived = true;
    this.walker.style.left = '84%';
    this.walker.classList.add('arrived');
    if (!completed) {
      this.goal.classList.add('closed');
      this.countEl.textContent = `${this.done} / ${this.steps} · hedefe ulaşılamadı`;
      return;
    }
    this.goal.classList.add('open');
    for (let i = 0; i < this.vis; i++) {
      if (!this.markDone[i]) this.markers[i].classList.add('missed');
    }
    if (perfect || this.done >= this.steps) {
      this.goal.classList.add('perfect');
      this.say('🎉 Yol tamamen açıldı!');
    } else {
      this.say('🏁 Hedefe ulaştın! Kalan engeller yolda kaldı.');
    }
    this.updateCount();
  }

  /** Alias: bölüm tamamlandığında */
  finish(opts) { this.arrive(Object.assign({ completed: true }, opts)); }

  shatterAt(node, count = 12) {
    const burst = el('span', { class: 'j-burst' });
    for (let i = 0; i < count; i++) {
      const p = el('i', {});
      p.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(1) + 'px');
      p.style.setProperty('--dy', (-Math.random() * 46 - 10).toFixed(1) + 'px');
      p.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
      burst.append(p);
    }
    node.append(burst);
    setTimeout(() => burst.remove(), 900);
  }

  say(text) {
    if (!this.labelEl) return;
    this.labelEl.textContent = text;
    this.labelEl.classList.add('flash');
    setTimeout(() => this.labelEl?.classList.remove('flash'), 1800);
    // kısa süre sonra hedef etiketini geri getir (amaç ekranda kalsın)
    clearTimeout(this._sayT);
    this._sayT = setTimeout(() => {
      if (this.destroyed || !this.labelEl || this.arrived) return;
      this.labelEl.textContent = `🎯 Hedef: ${this.goalLabel}`;
    }, 2400);
  }

  updateCount() {
    if (!this.countEl) return;
    const kalan = Math.max(0, this.steps - this.done);
    this.countEl.textContent = this.arrived
      ? `${this.done} / ${this.steps}`
      : `${this.done} / ${this.steps} · ${kalan} adım kaldı`;
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this._walkT);
    clearTimeout(this._sayT);
    this.root?.remove();
  }
}
