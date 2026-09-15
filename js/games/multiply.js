/* ============================================================
   multiply.js — Balon Patlatma: "a × b = ?" soruları
   Dokunmatik dostu; ipucu olarak nokta dizisi gösterir.
   ============================================================ */

import { el, clear, starsEl, shake } from '../ui.js';
import { makeMultiplyQuestion, questionSpeech } from './questions.js';
import { techniqueFor, techniqueSpeech } from './hints.js';
import { resetSpeech } from '../audio.js';
import {
  pickAdaptiveTables, adaptiveMaxB, pushRecent, difficultyTier,
  initMissed, pushMissed, takeDueMissed, shouldReask
} from './adaptive.js';

export function createMultiplyGame({ root, level, api }) {
  const cfg = Object.assign({ tables: [2], mode: 'result', rounds: 7, options: 4, lives: 3, time: 0, maxB: 5, maxBHard: 10 }, level.cfg);
  const state = { i: 0, correct: 0, wrong: 0, lives: cfg.lives, streak: 0, best: 0, locked: false, timer: null, tLeft: 0, t0: 0, cur: null, hintStep: 0 };
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
    class: 'btn ghost sm tap-hint', text: '💡 Nasıl düşünmeliyim?',
    onClick: () => nextHint()
  });
  // Soruyu kaçıran çocuk tekrar dinleyebilsin (7 yaş için kritik)
  const replayBtn = el('button', {
    class: 'btn ghost sm', text: '🔊 Soruyu tekrar dinle',
    onClick: () => { api.sfx('tap'); replayQuestion(); }
  });
  const hintRow = el('div', { class: 'btn-row', style: { justifyContent: 'center' } }, replayBtn, hintBtn);

  // Soru kartına dokunmak da tekrar okur (çocuklar için doğal)
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
    initMissed(api.profile);

    /* Adaptif seçim: zayıf tablolar daha sık çıkar, zorluk çocuğa uyar.
       Her 3. soruda daha önce yanlış yapılan soru tekrar sorulur. */
    let q = null;
    let reask = false;
    if (shouldReask(state.i - 1)) {
      const m = takeDueMissed(api.profile);
      if (m) {
        q = makeMultiplyQuestion({ tables: [m.a], mode: m.mode, maxB: Math.max(m.b, 4) });
        reask = true;
      }
    }
    if (!q) {
      const secilenTablolar = pickAdaptiveTables(api.profile, cfg.tables, 1);
      const temelMax = cfg.mode === 'result' ? cfg.maxB : Math.min(10, cfg.maxBHard);
      const maxB = adaptiveMaxB(api.profile, temelMax, cfg.maxBHard);
      q = makeMultiplyQuestion({ tables: secilenTablolar, mode: cfg.mode, maxB });
    }
    state.cur = q;
    state.reask = reask;
    state.usedHint = false;
    state.locked = false;
    state.hintStep = 0;
    resetSpeech();
    hintBtn.textContent = '💡 Nasıl düşünmeliyim?';

    qEl.innerHTML = state.cur.prompt.replace('?', '<span class="q-mark">?</span>').replace('×', '<span class="q-mark">×</span>');
    hintEl.textContent = reask ? 'Bunu bir kez yanlış yapmıştın — şimdi başarabilirsin!' : '';
    hintEl.classList.toggle('reask', !!reask);
    visualEl.style.display = 'none';
    clear(answersEl);

    for (const opt of state.cur.options) {
      const b = el('button', { class: 'answer-btn', text: String(opt), type: 'button' });
      b.addEventListener('click', () => answer(opt, b));
      answersEl.append(b);
    }

    api.speak(questionSpeech(state.cur), { force: true, key: 'q' + state.i });
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
    pushRecent(api.profile, false);
    pushMissed(api.profile, state.cur);          // süre doldu → tekrar sorulacak
    api.recordAnswer({ correct: false, table: state.cur?.table, usedHint: state.usedHint, kind: 'multiply' });
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
    pushRecent(api.profile, ok);
    if (ok) {
      state.correct++;
      state.streak++;
      state.best = Math.max(state.best, state.streak);
      btn.classList.add('correct');
      api.sfx('correct');
      if (state.streak > 0 && state.streak % 5 === 0) { api.sfx('coin'); api.toast(`${state.streak} doğru seri! Süpersin!`); }
      api.recordAnswer({ correct: true, table: state.cur.table, usedHint: state.usedHint, kind: 'multiply' });
      streakEl.textContent = 'Seri: ' + state.streak;
      setTimeout(nextQuestion, 620);
    } else {
      state.wrong++;
      state.streak = 0;
      state.lives--;
      pushMissed(api.profile, state.cur);        // yanlış → birkaç soru sonra tekrar
      streakEl.textContent = 'Seri: 0';
      api.recordAnswer({ correct: false, table: state.cur.table, usedHint: state.usedHint, kind: 'multiply' });
      api.sfx('wrong');
      btn.classList.add('wrong');
      shake(btn);
      livesEl.innerHTML = hearts(Math.max(0, state.lives));
      showCorrect();
      // Öğretici an: doğru cevabı söylemek yerine nasıl bulunacağını göster
      state.hintStep = 1;
      hintBtn.textContent = '🔢 Grupları göster';
      showTechnique();
      setTimeout(() => { if (!destroyed) { showGroups(); } }, 1500);
      setTimeout(nextQuestion, 4200);
    }
  }

  function showCorrect() {
    for (const b of answersEl.children) {
      if (Number(b.textContent) === state.cur.answer) b.classList.add('correct');
    }
  }

  /** Soruyu tekrar sesli oku — çocuk kaçırdıysa dinleyebilsin */
  function replayQuestion() {
    if (!state.cur) return;
    resetSpeech();                                  // tekrar kilidini aç
    api.speak(questionSpeech(state.cur), { force: true, rate: 0.7, key: 'replay' + state.i + '-' + Date.now() });
  }

  /**
   * İpucu sistemi — CEVABI VERMEZ, düşünme tekniği öğretir.
   * 1. basış: tekniği anlat (akıldan nasıl hesaplanır)
   * 2. basış: grupları göster (çocuk sayarak bulur)
   * 3. basış: kapat
   */
  function nextHint() {
    api.sfx('tap');
    state.hintStep = (state.hintStep + 1) % 3;
    if (state.hintStep === 0) {
      visualEl.style.display = 'none';
      hintBtn.textContent = '💡 Nasıl düşünmeliyim?';
      return;
    }
    state.usedHint = true;          // ipucu kullanıldı → "ipucsuz doğru" ödülü sayılmaz (dürüst ölçüm)
    if (state.hintStep === 1) {
      showTechnique();
      hintBtn.textContent = '🔢 Grupları göster';
    } else {
      showGroups();
      hintBtn.textContent = '✖️ İpucunu kapat';
    }
  }

  /** Teknik açıklaması — cevabı içermez */
  function showTechnique() {
    const t = techniqueFor(state.cur);
    visualEl.style.display = '';
    clear(visualEl);
    if (!t) {
      visualEl.append(el('div', { class: 'small muted', text: 'Önce soruyu bir kez daha düşün.' }));
      return;
    }
    visualEl.append(
      el('div', { class: 'hint-title', text: '💡 ' + t.name }),
      el('div', { class: 'hint-body', text: t.teach }),
      el('div', { class: 'hint-tip', text: '👉 ' + t.countHint })
    );
    if (t.strategy) visualEl.append(el('div', { class: 'hint-tip', text: t.strategy }));
    api.speak(techniqueSpeech(state.cur), { force: true, key: 'hint' + state.i });
  }

  /** Nokta dizisi — sayılacak gruplar. Sonucu YAZMAZ. */
  function showGroups() {
    const q = state.cur;
    if (!q || q.kind !== 'multiply' || q.mode !== 'result' || q.a > 6 || q.b > 6) {
      // Büyük sayılarda nokta dizisi anlamsız → tekniğe geri dön
      showTechnique();
      return;
    }
    visualEl.style.display = '';
    clear(visualEl);
    visualEl.append(el('div', { class: 'hint-title', text: `🔢 ${q.b} grup, her grupta ${q.a} tane` }));
    const wrap = el('div', { style: { display: 'grid', gap: '6px', justifyItems: 'center', justifyContent: 'center', marginTop: '8px' } });
    for (let r = 0; r < q.b; r++) {
      const row = el('div', { style: { display: 'flex', gap: '5px' } });
      for (let c = 0; c < q.a; c++) {
        row.append(el('span', { style: {
          width: '18px', height: '18px', borderRadius: '50%',
          background: 'linear-gradient(180deg,#7fd4ff,#3dbdff)',
          boxShadow: '0 1px 2px rgba(20,40,70,.25)', display: 'inline-block'
        } }));
      }
      wrap.append(row);
    }
    visualEl.append(wrap, el('div', { class: 'hint-tip', text: `👉 Grupları say: ${q.b} grup ${q.a}'erli. Toplamı sen bul!` }));
    api.speak(`${q.b} grup var, her grupta ${q.a} tane. Sayarak toplamı bul.`, { force: true, key: 'groups' + state.i });
  }

  return {
    start() { nextQuestion(); },
    destroy() { destroyed = true; stopTimer(); }
  };
}
