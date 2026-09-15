/* ============================================================
   sides.js — Şekil Dedektifi: "kaç kenarı / kaç köşesi var?"
   ============================================================ */

import { el, clear, shake } from '../ui.js';
import { shapeSVG, SHAPES } from '../shapes.js';
import { makeSidesQuestion, questionSpeech } from './questions.js';

export function createSidesGame({ root, level, api }) {
  const cfg = Object.assign({ ask: 'mix', shapes: ['kare', 'dikdortgen', 'ucgen'], rounds: 6, lives: 3, time: 0 }, level.cfg);
  const state = { i: 0, correct: 0, wrong: 0, lives: cfg.lives, locked: false, cur: null, timer: null, t0: 0 };

  const bar = el('div', { class: 'game-bar' });
  const livesEl = el('div', { class: 'lives', html: hearts(cfg.lives) });
  const progEl = el('div', { class: 'hint-pill', text: `Soru 1 / ${cfg.rounds}` });
  const timerWrap = el('div', { class: 'timer-bar', style: { display: cfg.time ? '' : 'none' } }, el('i'));
  bar.append(livesEl, el('div', { class: 'grow' }), progEl, timerWrap);

  const shapeBox = el('div', { style: { display: 'grid', placeItems: 'center', padding: '6px' } });
  const qEl = el('div', { class: 'question', style: { fontSize: 'clamp(22px, 4.4vw, 40px)' } });
  const hintEl = el('div', { class: 'q-hint' });
  const answersEl = el('div', { class: 'answers' });

  const stage = el('div', { class: 'bubble', style: { display: 'grid', gap: '8px' } }, shapeBox, qEl, hintEl);
  root.append(bar, stage, answersEl);

  function hearts(n) { return Array.from({ length: cfg.lives }, (_, i) => (i < n ? '♥' : '♡')).join(' '); }

  function nextQuestion() {
    if (state.i >= cfg.rounds || state.lives <= 0) {
      return api.finish({ correct: state.correct, wrong: state.wrong, completed: state.i >= cfg.rounds && state.lives > 0, rounds: cfg.rounds || 1, hintsUsed: state.hintsUsed || 0, total: state.correct + state.wrong });
    }
    state.i++;
    progEl.textContent = `Soru ${state.i} / ${cfg.rounds}`;
    state.cur = makeSidesQuestion({ ask: cfg.ask, shapes: cfg.shapes });
    state.locked = false;

    clear(shapeBox);
    shapeBox.append(el('div', { html: shapeSVG(state.cur.shapeId, { size: 210, strokeWidth: 6, showDots: true }) }));

    const s = SHAPES[state.cur.shapeId];
    qEl.innerHTML = `${s.name} — kaç <span class="q-mark">${state.cur.ask === 'kenar' ? 'kenar' : 'köşe'}</span>?`;
    hintEl.textContent = state.i > 1 ? '' : (state.cur.hint || '');

    clear(answersEl);
    for (const opt of state.cur.options) {
      const b = el('button', { class: 'answer-btn', text: String(opt), type: 'button' });
      b.addEventListener('click', () => answer(opt, b));
      answersEl.append(b);
    }
    api.speak(questionSpeech(state.cur));
    startTimer();
  }

  function startTimer() {
    stopTimer();
    if (!cfg.time) return;
    state.t0 = performance.now();
    timerWrap.firstChild.style.width = '100%';
    timerWrap.classList.remove('warn');
    state.timer = setInterval(() => {
      const pct = Math.max(0, 1 - (performance.now() - state.t0) / 1000 / cfg.time);
      timerWrap.firstChild.style.width = (pct * 100).toFixed(1) + '%';
      if (pct < 0.3) timerWrap.classList.add('warn');
      if (pct <= 0) { stopTimer(); timeout(); }
    }, 120);
  }
  function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }

  function timeout() {
    if (state.locked) return;
    state.locked = true;
    state.wrong++; state.lives--;
    api.recordAnswer({ correct: false, shape: state.cur.shapeId });
    sfxWrong();
    livesEl.innerHTML = hearts(Math.max(0, state.lives));
    revealCorrect();
    setTimeout(nextQuestion, 1500);
  }

  function answer(v, btn) {
    if (state.locked) return;
    state.locked = true;
    stopTimer();
    if (v === state.cur.answer) {
      state.correct++;
      btn.classList.add('correct');
      api.sfx('correct');
      api.recordAnswer({ correct: true, shape: state.cur.shapeId });
      window.adaConfetti?.({ count: 26, duration: 900 });
      setTimeout(nextQuestion, 700);
    } else {
      state.wrong++; state.lives--;
      btn.classList.add('wrong');
      shake(btn);
      sfxWrong();
      livesEl.innerHTML = hearts(Math.max(0, state.lives));
      api.recordAnswer({ correct: false, shape: state.cur.shapeId });
      revealCorrect();
      setTimeout(nextQuestion, 1600);
    }
  }
  function sfxWrong() { api.sfx('wrong'); api.speak('Tekrar dene.'); }
  function revealCorrect() {
    for (const b of answersEl.children) if (Number(b.textContent) === state.cur.answer) b.classList.add('correct');
  }

  return { start() { nextQuestion(); }, destroy() { stopTimer(); } };
}
