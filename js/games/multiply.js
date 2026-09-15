/* ============================================================
   multiply.js — Balon Patlatma: "a × b = ?" soruları
   Dokunmatik dostu; ipucu olarak nokta dizisi gösterir.
   ============================================================ */

import { el, clear, starsEl, shake } from '../ui.js';
import { makeMultiplyQuestion, questionSpeech } from './questions.js';

export function createMultiplyGame({ root, level, api }) {
  const cfg = Object.assign({ tables: [2], mode: 'result', rounds: 7, options: 4, lives: 3, time: 0, maxB: 5, maxBHard: 10 }, level.cfg);
  const state = { i: 0, correct: 0, wrong: 0, lives: cfg.lives, streak: 0, best: 0, locked: false, timer: null, tLeft: 0, t0: 0, cur: null };
  let destroyed = false;

  const bar = el('div', { class: 'game-bar' });
  const livesEl = el('div', { class: 'lives', html: hearts(cfg.lives) });
  const progEl = el('div', { class: 'hint-pill', text: `Soru 1 / ${cfg.rounds}` });
  const streakEl = el('div', { class: 'hint-pill', text: 'Seri: 0' });
  const timerWrap = el('div', { class: 'timer-bar', style: { display: cfg.time ? '' : 'none' } }, el('i'));
  bar.append(livesEl, el('div', { class: 'grow' }), streakEl, progEl);
  bar.append(timerWrap);

  const qEl = el('div', { class: 'question' });
  const hintEl = el('div', { class: 'q-hint' });
  const visualEl = el('div', { class: 'bubble', style: { display: 'none', textAlign: 'center' } });
  const answersEl = el('div', { class: 'answers' });
  const hintBtn = el('button', {
    class: 'btn ghost sm tap-hint', text: 'İpucu göster',
    onClick: () => { api.sfx('tap'); renderVisual(true); api.speak(state.cur?.hint || 'Noktaları say!'); }
  });
  const hintRow = el('div', { class: 'btn-row', style: { justifyContent: 'center' } }, hintBtn);

  root.append(bar, qEl, hintEl, visualEl, answersEl, hintRow);

  function hearts(n) {
    return Array.from({ length: cfg.lives }, (_, i) => (i < n ? '♥' : '♡')).join(' ');
  }

  function nextQuestion() {
    if (destroyed) return;
    if (state.i >= cfg.rounds || state.lives <= 0) return api.finish({
      correct: state.correct, wrong: state.wrong,
      completed: state.i >= cfg.rounds && state.lives > 0,
      streak: state.best, total: state.correct + state.wrong
    });

    state.i++;
    progEl.textContent = `Soru ${state.i} / ${cfg.rounds}`;
    const useMax = cfg.mode !== 'result' || state.i > cfg.rounds - 3 ? cfg.maxBHard : cfg.maxB;
    state.cur = makeMultiplyQuestion({ tables: cfg.tables, mode: cfg.mode, maxB: cfg.mode === 'result' ? cfg.maxB : Math.min(10, cfg.maxBHard) });
    state.locked = false;

    qEl.innerHTML = state.cur.prompt.replace('?', '<span class="q-mark">?</span>').replace('×', '<span class="q-mark">×</span>');
    hintEl.textContent = '';
    visualEl.style.display = 'none';
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
    state.tLeft = cfg.time;
    state.t0 = performance.now();
    timerWrap.firstChild.style.width = '100%';
    timerWrap.classList.remove('warn');
    state.timer = setInterval(() => {
      if (destroyed) return stopTimer();
      const pct = Math.max(0, (state.tLeft - (performance.now() - state.t0) / 1000) / cfg.time);
      timerWrap.firstChild.style.width = (pct * 100).toFixed(1) + '%';
      if (pct < 0.3) {
        timerWrap.classList.add('warn');
        if (pct < 0.34 && pct > 0.28) api.sfx('tick');
      }
      if (pct <= 0) { stopTimer(); timeout(); }
    }, 120);
  }
  function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }

  function timeout() {
    if (state.locked) return;
    state.locked = true;
    state.wrong++;
    state.streak = 0;
    state.lives--;
    api.recordAnswer({ correct: false, table: state.cur?.table });
    api.sfx('wrong');
    livesEl.innerHTML = hearts(Math.max(0, state.lives));
    streakEl.textContent = 'Seri: 0';
    showCorrect();
    setTimeout(nextQuestion, 1400);
  }

  function answer(value, btn) {
    if (state.locked) return;
    state.locked = true;
    stopTimer();
    const ok = value === state.cur.answer;
    if (ok) {
      state.correct++;
      state.streak++;
      state.best = Math.max(state.best, state.streak);
      btn.classList.add('correct');
      api.sfx('correct');
      if (state.streak > 0 && state.streak % 5 === 0) { api.sfx('coin'); api.toast(`${state.streak} doğru seri! Süpersin!`); }
      api.recordAnswer({ correct: true, table: state.cur.table });
      streakEl.textContent = 'Seri: ' + state.streak;
      if (cfg.visualHint !== false) renderVisual(false);
      setTimeout(nextQuestion, 620);
    } else {
      state.wrong++;
      state.streak = 0;
      state.lives--;
      streakEl.textContent = 'Seri: 0';
      api.recordAnswer({ correct: false, table: state.cur.table });
      api.sfx('wrong');
      btn.classList.add('wrong');
      shake(btn);
      livesEl.innerHTML = hearts(Math.max(0, state.lives));
      showCorrect();
      setTimeout(nextQuestion, 1500);
    }
  }

  function showCorrect() {
    for (const b of answersEl.children) {
      if (Number(b.textContent) === state.cur.answer) b.classList.add('correct');
    }
  }

  /** Eğitici ipucu: a satır × b nokta dizisi (küçük sayılarda) */
  function renderVisual(force) {
    const q = state.cur;
    if (!q || q.mode !== 'result' || q.a > 6 || q.b > 6) {
      visualEl.style.display = 'none';
      return;
    }
    visualEl.style.display = '';
    clear(visualEl);
    const rows = q.b, cols = q.a;
    const wrap = el('div', { style: { display: 'grid', gap: '4px', justifyItems: 'center', justifyContent: 'center' } });
    for (let r = 0; r < rows; r++) {
      const row = el('div', { style: { display: 'flex', gap: '4px' } });
      for (let c = 0; c < cols; c++) row.append(el('span', { style: {
        width: '16px', height: '16px', borderRadius: '50%', background: '#3dbdff', display: 'inline-block'
      } }));
      wrap.append(row);
    }
    visualEl.append(el('div', { class: 'small muted', text: `${q.b} satır × ${q.a} nokta = ${q.a * q.b}` }), wrap);
  }

  return {
    start() { nextQuestion(); },
    destroy() { destroyed = true; stopTimer(); }
  };
}
