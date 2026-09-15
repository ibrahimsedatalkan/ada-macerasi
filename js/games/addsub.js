/* ============================================================
   addsub.js — Toplama / Çıkarma oyunu (2. sınıf çekirdek kazanımı)
   multiply.js ile aynı kalıp: ipucu düşünme tekniği öğretir,
   yanlışta öğretici an, soru tekrar dinlenebilir.
   ============================================================ */

import { el, clear, shake } from '../ui.js';
import { makeAddQuestion, questionSpeech } from './questions.js';
import { techniqueFor, techniqueSpeech } from './hints.js';
import { resetSpeech, getSpeechRate } from '../audio.js';
import { pushRecent, pushMissed, takeDueMissed, shouldReask } from './adaptive.js';

export function createAddSubGame({ root, level, api }) {
  const cfg = Object.assign({ max: 20, carry: false, mode: 'add', rounds: 7, lives: 3, time: 0 }, level.cfg);
  const state = { i: 0, correct: 0, wrong: 0, lives: cfg.lives, streak: 0, best: 0, locked: false, timer: null, tLeft: 0, t0: 0, cur: null, hintStep: 0, usedHint: false, reask: false };
  let destroyed = false;

  const bar = el('div', { class: 'game-bar' });
  const livesEl = el('div', { class: 'lives', html: hearts(cfg.lives) });
  const progEl = el('div', { class: 'hint-pill', text: `Soru 1 / ${cfg.rounds}` });
  const streakEl = el('div', { class: 'hint-pill', text: 'Seri: 0' });
  const timerWrap = el('div', { class: 'timer-bar', style: { display: cfg.time ? '' : 'none' } }, el('i'));
  bar.append(livesEl, el('div', { class: 'grow' }), streakEl, progEl, timerWrap);

  const qEl = el('div', { class: 'question' });
  const hintEl = el('div', { class: 'q-hint' });
  const visualEl = el('div', { class: 'bubble', style: { display: 'none', textAlign: 'center' } });
  const answersEl = el('div', { class: 'answers' });
  const replayBtn = el('button', {
    class: 'btn ghost sm', text: '🔊 Soruyu tekrar dinle',
    onClick: () => { api.sfx('tap'); replayQuestion(); }
  });
  const hintBtn = el('button', {
    class: 'btn ghost sm tap-hint', text: '💡 Nasıl düşünmeliyim?',
    onClick: () => nextHint()
  });
  const hintRow = el('div', { class: 'btn-row', style: { justifyContent: 'center' } }, replayBtn, hintBtn);

  qEl.addEventListener('click', () => { api.sfx('tap'); replayQuestion(); });
  qEl.style.cursor = 'pointer';
  qEl.title = 'Tekrar dinlemek için dokun';

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

    /* Aralıklı tekrar: yanlış yapılan toplama/çıkarma her 3. soruda geri gelir */
    let q = null, reask = false;
    if (shouldReask(state.i - 1)) {
      const m = takeDueMissed(api.profile);
      if (m && m.mode === 'add' || m && m.mode === 'sub') {
        q = makeAddQuestion({ max: Math.max(cfg.max, m.a, m.b), carry: cfg.carry, mode: m.mode });
        reask = true;
      }
    }
    if (!q) q = makeAddQuestion({ max: cfg.max, carry: cfg.carry, mode: cfg.mode });

    state.cur = q;
    state.reask = reask;
    state.usedHint = false;
    state.locked = false;
    state.hintStep = 0;
    resetSpeech();
    hintBtn.textContent = '💡 Nasıl düşünmeliyim?';

    qEl.innerHTML = q.prompt.replace('?', '<span class="q-mark">?</span>')
      .replace('+', '<span class="q-mark">+</span>')
      .replace('−', '<span class="q-mark">−</span>');
    hintEl.textContent = reask ? 'Bunu bir kez yanlış yapmıştın — şimdi başarabilirsin!' : '';
    hintEl.classList.toggle('reask', !!reask);
    visualEl.style.display = 'none';
    clear(answersEl);

    for (const opt of q.options) {
      const b = el('button', { class: 'answer-btn', text: String(opt), type: 'button' });
      b.addEventListener('click', () => answer(opt, b));
      answersEl.append(b);
    }

    api.speak(questionSpeech(q), { force: true, key: 'add' + state.i });
    startTimer();
  }

  function replayQuestion() {
    if (!state.cur) return;
    resetSpeech();
    api.speak(questionSpeech(state.cur), { force: true, rate: Math.max(0.5, getSpeechRate() * 0.92), key: 'addreplay' + state.i + '-' + Date.now() });
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
      if (pct < 0.3) timerWrap.classList.add('warn');
      if (pct <= 0) { stopTimer(); timeout(); }
    }, 120);
  }
  function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }

  function timeout() {
    if (state.locked) return;
    state.locked = true;
    state.wrong++; state.streak = 0; state.lives--;
    pushRecent(api.profile, false);
    pushMissed(api.profile, state.cur);
    api.recordAnswer({ correct: false, kind: 'addsub', usedHint: state.usedHint });
    api.sfx('wrong');
    livesEl.innerHTML = hearts(Math.max(0, state.lives));
    streakEl.textContent = 'Seri: 0';
    showCorrect();
    teachMoment();
    setTimeout(nextQuestion, 4200);
  }

  function answer(value, btn) {
    if (state.locked) return;
    state.locked = true;
    stopTimer();
    const ok = value === state.cur.answer;
    pushRecent(api.profile, ok);
    if (ok) {
      state.correct++; state.streak++;
      state.best = Math.max(state.best, state.streak);
      btn.classList.add('correct');
      api.sfx('correct');
      if (state.streak % 5 === 0) { api.sfx('coin'); api.toast(`${state.streak} doğru seri! Süpersin!`); }
      api.recordAnswer({ correct: true, kind: 'addsub', usedHint: state.usedHint });
      streakEl.textContent = 'Seri: ' + state.streak;
      setTimeout(nextQuestion, 620);
    } else {
      state.wrong++; state.streak = 0; state.lives--;
      pushMissed(api.profile, state.cur);
      streakEl.textContent = 'Seri: 0';
      api.recordAnswer({ correct: false, kind: 'addsub', usedHint: state.usedHint });
      api.sfx('wrong');
      btn.classList.add('wrong');
      shake(btn);
      livesEl.innerHTML = hearts(Math.max(0, state.lives));
      showCorrect();
      teachMoment();
      setTimeout(nextQuestion, 4200);
    }
  }

  function showCorrect() {
    for (const b of answersEl.children) {
      if (Number(b.textContent) === state.cur.answer) b.classList.add('correct');
    }
  }

  /** Yanlışta öğretici an: cevabı söylemek yerine yöntemi göster */
  function teachMoment() {
    state.hintStep = 1;
    hintBtn.textContent = '🔢 Adımları göster';
    showTechnique();
    setTimeout(() => { if (!destroyed) showSteps(); }, 1500);
  }

  function nextHint() {
    api.sfx('tap');
    state.hintStep = (state.hintStep + 1) % 3;
    if (state.hintStep === 0) {
      visualEl.style.display = 'none';
      hintBtn.textContent = '💡 Nasıl düşünmeliyim?';
      return;
    }
    state.usedHint = true;
    if (state.hintStep === 1) { showTechnique(); hintBtn.textContent = '🔢 Adımları göster'; }
    else { showSteps(); hintBtn.textContent = '✖️ İpucunu kapat'; }
  }

  function showTechnique() {
    const t = techniqueFor(state.cur);
    visualEl.style.display = '';
    clear(visualEl);
    if (!t) { visualEl.append(el('div', { class: 'small muted', text: 'Önce soruyu bir kez daha düşün.' })); return; }
    visualEl.append(
      el('div', { class: 'hint-title', text: '💡 ' + t.name }),
      el('div', { class: 'hint-body', text: t.teach })
    );
    if (t.countHint) visualEl.append(el('div', { class: 'hint-tip', text: '👉 ' + t.countHint }));
    api.speak(techniqueSpeech(state.cur), { force: true, key: 'addhint' + state.i });
  }

  /** Adımları göster: sayıyı onluk+birlik diye ayır — SONUCU YAZMAZ */
  function showSteps() {
    const q = state.cur;
    visualEl.style.display = '';
    clear(visualEl);
    const onluk = (n) => Math.floor(n / 10) * 10;
    const birlik = (n) => n % 10;

    if (q.mode === 'add') {
      visualEl.append(
        el('div', { class: 'hint-title', text: '🔢 Onluk + birlik diye ayır' }),
        el('div', { class: 'hint-body', text: `${q.a} = ${onluk(q.a)} + ${birlik(q.a)}   ·   ${q.b} = ${onluk(q.b)} + ${birlik(q.b)}` }),
        el('div', { class: 'hint-tip', text: `👉 Birleri topla: ${birlik(q.a)} + ${birlik(q.b)} = ?  — sonra onlukları ekle. Toplamı sen bul!` })
      );
    } else {
      const boz = birlik(q.a) < birlik(q.b);
      visualEl.append(
        el('div', { class: 'hint-title', text: boz ? '🔢 Onluk boz' : '🔢 Onlukları ve birlikleri ayrı çıkar' }),
        el('div', { class: 'hint-body', text: boz
          ? `${q.a} = ${onluk(q.a) - 10} + ${birlik(q.a) + 10}   (bir onluk bozduk)`
          : `${q.a} = ${onluk(q.a)} + ${birlik(q.a)}   ·   ${q.b} = ${onluk(q.b)} + ${birlik(q.b)}` }),
        el('div', { class: 'hint-tip', text: boz
          ? `👉 Şimdi birlikler yeter: ${birlik(q.a) + 10} − ${birlik(q.b)} = ?  — sonucu sen bul!`
          : `👉 Birlikleri çıkar: ${birlik(q.a)} − ${birlik(q.b)} = ?  — sonra onlukları. Sonucu sen bul!` })
      );
    }
    api.speak('Sayıyı onluk ve birlik diye ayır. Sırayla hesapla.', { force: true, key: 'addsteps' + state.i });
  }

  return {
    start() { nextQuestion(); },
    destroy() { destroyed = true; stopTimer(); }
  };
}
