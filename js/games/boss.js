/* ============================================================
   boss.js — Ejderha Kalesi: karışık hızlı tur + ejderha canı
   include: ['multiply','sides','tap']
   ============================================================ */

import { el, clear, shake, randInt } from '../ui.js';
import { shapeSVG, SHAPES } from '../shapes.js';
import { makeMultiplyQuestion, makeSidesQuestion, makeTapQuestion, makeAddQuestion, questionSpeech } from './questions.js';

function dragonSVG(hpRatio, mood = 'angry', size = 160) {
  const hurt = mood === 'hit';
  const eyeL = hurt
    ? '<path d="M30 64 q9 -10 18 -1" stroke="#23324d" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : '<ellipse cx="39" cy="66" rx="9" ry="11" fill="#4a2b1a" stroke="#23324d" stroke-width="3"/><circle cx="36" cy="62" r="3.4" fill="#fff"/>';
  const eyeR = hurt
    ? '<path d="M152 64 q9 -9 18 1" stroke="#23324d" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : '<ellipse cx="161" cy="66" rx="9" ry="11" fill="#4a2b1a" stroke="#23324d" stroke-width="3"/><circle cx="158" cy="62" r="3.4" fill="#fff"/>';
  const mouth = hurt
    ? '<path d="M74 130 q26 16 52 0" stroke="#23324d" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : '<path d="M70 128 q30 24 60 0 z" fill="#a8323f" stroke="#23324d" stroke-width="3"/>';
  const teeth = hurt ? '' : '<polygon points="84,132 92,146 100,132" fill="#fff"/><polygon points="100,132 108,146 116,132" fill="#fff"/>';
  const tailWag = hurt ? 'rotate(-6 40 150)' : 'rotate(4 40 150)';

  return `<svg width="${size}" height="${size}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g transform="${tailWag}">
      <path d="M52 150 C20 158 6 132 12 112 C24 126 34 122 40 132 Z" fill="#8a55e0" stroke="#23324d" stroke-width="4" stroke-linejoin="round"/>
    </g>
    <polygon points="16,96 52,74 44,132" fill="#9a6ae8" stroke="#23324d" stroke-width="4" stroke-linejoin="round"/>
    <polygon points="184,96 148,74 156,132" fill="#9a6ae8" stroke="#23324d" stroke-width="4" stroke-linejoin="round"/>
    <rect x="64" y="158" width="26" height="30" rx="12" fill="#9a6ae8" stroke="#23324d" stroke-width="4"/>
    <rect x="110" y="158" width="26" height="30" rx="12" fill="#9a6ae8" stroke="#23324d" stroke-width="4"/>
    <ellipse cx="100" cy="128" rx="52" ry="48" fill="#b07cff" stroke="#23324d" stroke-width="4"/>
    <ellipse cx="100" cy="140" rx="32" ry="32" fill="#e2d2ff" stroke="#23324d" stroke-width="3"/>
    <polygon points="56,42 62,6 84,36" fill="#ffd23d" stroke="#23324d" stroke-width="4" stroke-linejoin="round"/>
    <polygon points="144,42 138,6 116,36" fill="#ffd23d" stroke="#23324d" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="100" cy="74" r="46" fill="${hurt ? '#c79cff' : '#c79cff'}" stroke="#23324d" stroke-width="4"/>
    <ellipse cx="100" cy="104" rx="30" ry="22" fill="#dcc6ff" stroke="#23324d" stroke-width="3"/>
    ${eyeL}${eyeR}
    <circle cx="88" cy="112" r="3.6" fill="#23324d"/><circle cx="112" cy="112" r="3.6" fill="#23324d"/>
    ${mouth}${teeth}
    <path d="M62 118 q-14 4 -18 16" stroke="#23324d" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M138 118 q14 4 18 16" stroke="#23324d" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`;
}


export function createBossGame({ root, level, api }) {
  const cfg = Object.assign({
    include: ['multiply'], tables: [2, 3], shapes: ['kare', 'ucgen'],
    rounds: 9, lives: 3, time: 110, timePerQ: 15, maxB: 5
  }, level.cfg);
  const hp0 = Math.max(4, Math.ceil(cfg.rounds * 0.7));
  const state = { i: 0, correct: 0, wrong: 0, lives: cfg.lives, hp: hp0, hp0, locked: false, cur: null, timer: null, t0: 0, over: false };

  const bar = el('div', { class: 'game-bar' });
  const livesEl = el('div', { class: 'lives', html: hearts(cfg.lives) });
  const progEl = el('div', { class: 'hint-pill', text: `Soru 1 / ${cfg.rounds}` });
  const timerBar = el('div', { class: 'timer-bar', style: { width: '100%' } }, el('i'));
  bar.append(livesEl, el('div', { class: 'grow' }), progEl);

  const dragonBox = el('div', { style: { display: 'grid', placeItems: 'center' } });
  const hpBar = el('div', { class: 'timer-bar dragon', style: { width: '100%', maxWidth: '620px' } }, el('i'));
  const hpLabel = el('div', { class: 'hint-pill', text: 'Ejderha canı %100' });
  const hpWrap = el('div', { style: { display: 'grid', gap: '6px', justifyItems: 'center', maxWidth: '620px', width: '100%', margin: '0 auto' } }, hpLabel, hpBar);
  const qEl = el('div', { class: 'question' });
  const subEl = el('div', { class: 'q-hint' });
  const answersEl = el('div', { class: 'answers' });
  const tapArea = el('div', { style: { display: 'none' } });

  root.append(bar, timerBar, hpWrap, dragonBox, qEl, subEl, answersEl, tapArea);

  function hearts(n) { return Array.from({ length: cfg.lives }, (_, i) => (i < n ? '♥' : '♡')).join(' '); }

  function paintDragon(mood) {
    const ratio = state.hp / state.hp0;
    dragonBox.innerHTML = dragonSVG(ratio, mood || 'angry', 160);
    hpBar.firstChild.style.width = (ratio * 100).toFixed(1) + '%';
    hpLabel.textContent = `Ejderha canı %${Math.round(ratio * 100)}`;
  }
  paintDragon();

  function pickQuestion() {
    const kinds = cfg.include.filter(Boolean);
    let kind = kinds.length > 1 ? kinds[randInt(0, kinds.length - 1)] : kinds[0];
    for (let attempt = 0; attempt < 4; attempt++) {
      if (kind === 'multiply') {
        const tables = cfg.tables || [2];
        const mode = state.i > cfg.rounds - 3 ? 'mix' : 'result';
        return makeMultiplyQuestion({ tables, mode, maxB: cfg.maxB });
      }
      if (kind === 'sides') return makeSidesQuestion({ ask: 'mix', shapes: cfg.shapes });
      if (kind === 'tap') return makeTapQuestion({ shapes: cfg.shapes, count: 3, distractors: 3 });
      if (kind === 'addsub') {
        return makeAddQuestion({
          mode: Math.random() < 0.5 ? 'add' : 'sub',
          max: cfg.addMax || 100,
          carry: cfg.addCarry !== false
        });
      }
      kind = kinds[randInt(0, kinds.length - 1)];
    }
    return makeMultiplyQuestion({ tables: cfg.tables || [2], mode: 'result', maxB: cfg.maxB });
  }

  function nextQuestion() {
    if (state.over) return;
    if (state.i >= cfg.rounds || state.lives <= 0 || state.hp <= 0) return endLevel();
    state.i++;
    progEl.textContent = `Soru ${state.i} / ${cfg.rounds}`;
    state.cur = pickQuestion();
    state.locked = false;
    subEl.textContent = '';
    clear(answersEl);
    tapArea.style.display = 'none';
    clear(tapArea);

    if (state.cur.kind === 'tap') {
      qEl.innerHTML = state.cur.prompt.replace('!', ' <span class="q-mark">!</span>');
      answersEl.style.display = 'none';
      tapArea.style.display = 'grid';
      tapArea.style.gridTemplateColumns = 'repeat(auto-fit, minmax(84px, 1fr))';
      tapArea.style.gap = '10px';
      for (const t of state.cur.tokens) {
        const b = el('button', {
          class: 'answer-btn', type: 'button', style: { minHeight: '84px' },
          html: shapeSVG(t.shape, { size: 62, strokeWidth: 4 })
        });
        b.addEventListener('click', () => onTapToken(t, b));
        tapArea.append(b);
      }
      api.speak(questionSpeech(state.cur));
    } else {
      answersEl.style.display = '';
      if (state.cur.kind === 'sides') {
        qEl.innerHTML = `${SHAPES[state.cur.shapeId].name} — kaç ${state.cur.ask === 'kenar' ? 'kenar' : 'köşe'}?`;
        qEl.style.fontSize = 'clamp(22px, 4.2vw, 40px)';
        subEl.innerHTML = shapeSVG(state.cur.shapeId, { size: 150, strokeWidth: 6, showDots: true });
      } else {
        qEl.innerHTML = state.cur.prompt.replace('?', '<span class="q-mark">?</span>');
        qEl.style.fontSize = '';
      }
      for (const opt of state.cur.options) {
        const b = el('button', { class: 'answer-btn', text: String(opt), type: 'button' });
        b.addEventListener('click', () => onAnswer(opt, b));
        answersEl.append(b);
      }
      api.speak(questionSpeech(state.cur));
    }
    startTimer();
  }

  function startTimer() {
    stopTimer();
    state.t0 = performance.now();
    timerBar.firstChild.style.width = '100%';
    timerBar.classList.remove('warn');
    state.timer = setInterval(() => {
      const pct = Math.max(0, 1 - (performance.now() - state.t0) / 1000 / cfg.timePerQ);
      timerBar.firstChild.style.width = (pct * 100).toFixed(1) + '%';
      if (pct < 0.3) timerBar.classList.add('warn');
      if (pct <= 0) { stopTimer(); onTimeout(); }
    }, 120);
  }
  function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }

  function onTimeout() {
    if (state.locked) return;
    state.locked = true;
    api.sfx('wrong');
    state.wrong++; state.lives--;
    api.recordAnswer({ correct: false, table: state.cur?.table, shape: state.cur?.shapeId });
    livesEl.innerHTML = hearts(Math.max(0, state.lives));
    revealCorrect();
    setTimeout(nextQuestion, 1400);
  }

  function onAnswer(v, btn) {
    if (state.locked) return;
    state.locked = true;
    stopTimer();
    if (v === state.cur.answer) {
      state.correct++;
      btn.classList.add('correct');
      hitDragon();
    } else {
      state.wrong++; state.lives--;
      btn.classList.add('wrong');
      shake(btn);
      api.sfx('wrong');
      api.recordAnswer({ correct: false, table: state.cur.table });
      livesEl.innerHTML = hearts(Math.max(0, state.lives));
      revealCorrect();
      setTimeout(nextQuestion, 1500);
    }
  }

  function onTapToken(t, btn) {
    if (state.locked) return;
    if (t.mine) {
      t.mine = false;
      btn.style.opacity = '.25';
      btn.disabled = true;
      api.sfx('pop');
      api.recordAnswer({ correct: true, shape: t.shape });
      state.correct++;
      const remaining = (state.cur.tokens || []).some((x) => x.mine);
      if (!remaining) { stopTimer(); state.locked = true; hitDragon(); }
    } else {
      state.wrong++; state.lives--;
      api.sfx('wrong');
      shake(btn);
      api.recordAnswer({ correct: false, shape: t.shape });
      livesEl.innerHTML = hearts(Math.max(0, state.lives));
      api.speak('Bu değil.');
      if (state.lives <= 0) { stopTimer(); setTimeout(nextQuestion, 1200); }
    }
  }

  function hitDragon() {
    state.hp = Math.max(0, state.hp - 1);
    paintDragon('hit');
    api.sfx('roar');
    setTimeout(() => paintDragon(), 420);
    if (state.hp <= 0) { api.confetti({ count: 110, duration: 2400 }); api.sfx('win'); setTimeout(endLevel, 900); return; }
    setTimeout(nextQuestion, 700);
  }

  function revealCorrect() {
    if (state.cur?.kind === 'tap') {
      tapArea.querySelectorAll('button').forEach((b, i) => {
        if (state.cur.tokens[i]?.mine) b.classList.add('correct');
      });
    } else {
      for (const b of answersEl.children) if (Number(b.textContent) === state.cur.answer) b.classList.add('correct');
    }
  }

  function endLevel() {
    if (state.over) return;
    state.over = true;
    stopTimer();
    const completed = state.hp <= 0 || (state.i > cfg.rounds && state.lives > 0);
    api.finish({ correct: state.correct, wrong: state.wrong, completed, dragonDefeated: state.hp <= 0, rounds: cfg.rounds || 1, hintsUsed: state.hintsUsed || 0, total: state.correct + state.wrong });
  }

  return {
    start() { nextQuestion(); },
    destroy() { state.over = true; stopTimer(); }
  };
}
