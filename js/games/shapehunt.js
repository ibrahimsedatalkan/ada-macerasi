/* ============================================================
   shapehunt.js — Şekil Avı: şekilleri doğru sepete taşı
   Parmakla sürükleme VE "dokun-seç, sepete dokun" desteği var.
   ============================================================ */

import { el, clear, randInt, shake } from '../ui.js';
import { shapeSVG, SHAPES } from '../shapes.js';

export function createShapeHuntGame({ root, level, api }) {
  const cfg = Object.assign({ shapes: ['kare', 'ucgen'], rounds: 4, tokensPerRound: 4, lives: 5 }, level.cfg);
  const lives = Math.max(cfg.lives, 5);
  const state = { round: 0, correct: 0, wrong: 0, livesLeft: lives, selected: null, done: false };

  const bar = el('div', { class: 'game-bar' });
  const livesEl = el('div', { class: 'lives', html: hearts(lives) });
  const progEl = el('div', { class: 'hint-pill', text: `Tur 1 / ${cfg.rounds}` });
  const targetEl = el('div', { class: 'hint-pill', text: '' });
  bar.append(livesEl, el('div', { class: 'grow' }), targetEl, progEl);

  const area = el('div', { class: 'hunt-area' });
  const basketsEl = el('div', { class: 'hunt-baskets' });
  const stage = el('div', { class: 'game-wrap', style: { gap: '10px' } }, area, basketsEl);

  root.append(bar, stage);

  function hearts(n) { return Array.from({ length: lives }, (_, i) => (i < n ? '♥' : '♡')).join(' '); }

  function buildBaskets() {
    clear(basketsEl);
    for (const id of cfg.shapes) {
      const label = SHAPES[id].name;
      const inner = el('div', { style: { display: 'grid', placeItems: 'center', gap: '2px' } },
        el('div', { html: shapeSVG(id, { size: 58, opacity: 0.45, dashed: true, fill: '#ffffff' }) }),
        el('div', { class: 'b-label', text: label.toUpperCase() })
      );
      const basket = el('div', { class: 'basket', dataset: { shape: id } }, inner);
      basket.addEventListener('click', () => { if (state.selected) drop(state.selected, basket); });
      basketsEl.append(basket);
    }
  }

  function spawnRound() {
    clear(area);
    state.selected = null;
    const rect = area.getBoundingClientRect();
    const W = rect.width || 600, H = rect.height || 320;
    const tokens = [];
    for (let i = 0; i < cfg.tokensPerRound; i++) {
      tokens.push(cfg.shapes[randInt(0, cfg.shapes.length - 1)]);
    }
    const cols = 2, rows = Math.ceil(tokens.length / cols);
    tokens.forEach((shapeId, idx) => {
      const size = Math.min(96, Math.max(64, W / 7));
      const padX = size * 0.8, padY = size * 0.7;
      const cellW = (W - padX * 2) / cols;
      const cellH = (H - padY * 2) / rows;
      const x = padX + (idx % cols) * cellW + randInt(0, Math.max(0, cellW - size - 4));
      const y = padY + Math.floor(idx / cols) * cellH + randInt(0, Math.max(0, cellH - size - 4));
      const tok = el('div', {
        class: 'shape-tok', dataset: { shape: shapeId, home: `${x},${y}` },
        style: { left: x + 'px', top: y + 'px', width: size + 'px', height: size + 'px', touchAction: 'none' },
        html: shapeSVG(shapeId, { size, strokeWidth: 5 })
      });
      bindDrag(tok);
      area.append(tok);
    });
    progEl.textContent = `Tur ${state.round + 1} / ${cfg.rounds}`;
    targetEl.textContent = 'Sepetlere bak ve şekilleri yerleştir';
  }

  function bindDrag(tok) {
    let dragging = false, moved = false, offX = 0, offY = 0, startX = 0, startY = 0;
    const areaRect = () => area.getBoundingClientRect();

    tok.addEventListener('pointerdown', (e) => {
      if (state.done) return;
      e.preventDefault();
      const a = areaRect();
      const tr = tok.getBoundingClientRect();
      offX = e.clientX - tr.left;
      offY = e.clientY - tr.top;
      startX = e.clientX; startY = e.clientY;
      moved = false; dragging = true;
      tok.setPointerCapture(e.pointerId);
      tok.classList.add('dragging');
      api.sfx('tap');
    });

    tok.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      if (!moved) return;
      const a = areaRect();
      let x = e.clientX - a.left - offX;
      let y = e.clientY - a.top - offY;
      const maxX = a.width - tok.offsetWidth, maxY = a.height - tok.offsetHeight;
      tok.style.left = Math.max(0, Math.min(maxX, x)) + 'px';
      tok.style.top = Math.max(0, Math.min(maxY, y)) + 'px';
      highlightBasket(e.clientX, e.clientY);
    });

    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      tok.classList.remove('dragging');
      clearHighlight();
      if (!moved) {
        // dokunma = seçim
        select(tok);
        return;
      }
      const basket = basketAt(e.clientX, e.clientY);
      if (basket) drop(tok, basket);
      else returnHome(tok);
    };
    tok.addEventListener('pointerup', end);
    tok.addEventListener('pointercancel', end);
  }

  function select(tok) {
    if (state.selected && state.selected !== tok) state.selected.style.outline = '';
    state.selected = tok;
    tok.style.outline = '4px dashed #ff9a3d';
    tok.style.outlineOffset = '2px';
    api.speak('Sepete dokun.');
  }

  function basketAt(x, y) {
    const el0 = document.elementFromPoint(x, y);
    const b = el0?.closest?.('.basket');
    return b || null;
  }

  function highlightBasket(x, y) {
    clearHighlight();
    const b = basketAt(x, y);
    if (b) b.classList.add('hot');
  }
  function clearHighlight() {
    for (const b of basketsEl.children) b.classList.remove('hot');
  }

  function returnHome(tok) {
    const [x, y] = (tok.dataset.home || '0,0').split(',');
    tok.style.left = x + 'px';
    tok.style.top = y + 'px';
    if (state.selected === tok) { tok.style.outline = ''; state.selected = null; }
  }

  function drop(tok, basket) {
    const target = basket.dataset.shape;
    const shape = tok.dataset.shape;
    if (state.selected === tok) { tok.style.outline = ''; state.selected = null; }

    if (target === shape) {
      state.correct++;
      api.recordAnswer({ correct: true, shape });
      api.sfx('correct');
      basket.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260 });
      tok.classList.add('placed');
      tok.remove();
      if (!area.querySelector('.shape-tok')) nextRound();
    } else {
      state.wrong++;
      state.livesLeft--;
      livesEl.innerHTML = hearts(Math.max(0, state.livesLeft));
      api.recordAnswer({ correct: false, shape });
      api.sfx('wrong');
      api.speak(`Bu ${SHAPES[shape].name.toLowerCase()} değil.`);
      shake(basket);
      shake(tok);
      returnHome(tok);
      if (state.livesLeft <= 0) finishLevel(false);
    }
  }

  function nextRound() {
    state.round++;
    if (state.round >= cfg.rounds) return finishLevel(true);
    api.sfx('whoosh');
    setTimeout(() => { if (!state.done) spawnRound(); }, 320);
  }

  function finishLevel(completed) {
    if (state.done) return;
    state.done = true;
    api.finish({ correct: state.correct, wrong: state.wrong, completed, rounds: cfg.rounds || 1, hintsUsed: state.hintsUsed || 0, total: state.correct + state.wrong });
  }

  return {
    start() { state.round = 0; buildBaskets(); requestAnimationFrame(() => requestAnimationFrame(spawnRound)); },
    destroy() { state.done = true; }
  };
}
