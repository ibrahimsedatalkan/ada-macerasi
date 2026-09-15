/* ============================================================
   duel.js — Düello: aynı cihazda 2 oyuncu (sırayla, aynı soru)
   Puan = 100 + hız bonusu. Kazanana taç.
   ============================================================ */

import { el, clear, starsHTML, avatarHTML, randInt, toast } from './ui.js';
import { shapeSVG, SHAPES } from './shapes.js';
import { makeMultiplyQuestion, makeSidesQuestion, makeTapQuestion, questionSpeech } from './games/questions.js';

const ROUNDS = 5;
const PER_Q_SECONDS = 14;

export function createDuel({ root, api, onExit }) {
  const state = {
    phase: 'setup',
    players: [
      { name: api.profile?.nick || 'Oyuncu 1', avatar: api.profile?.avatar || '🦊', score: 0, correct: 0 },
      { name: 'Oyuncu 2', avatar: '🐼', score: 0, correct: 0 }
    ],
    round: 0,
    turn: 0,
    cur: null,
    locked: false,
    timer: null,
    t0: 0
  };

  /* ---------------- Kurulum ---------------- */
  function renderSetup() {
    clear(root);
    const p1 = el('input', { type: 'text', value: state.players[0].name, maxlength: 14, class: 'js-p1' });
    const p2 = el('input', { type: 'text', value: state.players[1].name === 'Oyuncu 2' ? '' : state.players[1].name, maxlength: 14, placeholder: 'Arkadaşının adı', class: 'js-p2' });
    const avatars1 = ['🦊', '🐯', '🐸', '🐙', '🦄', '🐝'];
    const avatars2 = ['🐼', '🦉', '🐢', '🦁', '🐨', '🐧'];
    let a1 = state.players[0].avatar, a2 = state.players[1].avatar;

    const row1 = el('div', { class: 'avatar-grid', style: { maxWidth: '340px' } });
    const row2 = el('div', { class: 'avatar-grid', style: { maxWidth: '340px' } });
    const build1 = () => { clear(row1); avatars1.forEach((a) => { const b = el('button', { class: 'avatar-opt', type: 'button', html: avatarHTML(a, { size: 52 }), ariaPressed: a1 === a }); b.addEventListener('click', () => { api.sfx('tap'); a1 = a; build1(); }); row1.append(b); }); };
    const build2 = () => { clear(row2); avatars2.forEach((a) => { const b = el('button', { class: 'avatar-opt', type: 'button', html: avatarHTML(a, { size: 52 }), ariaPressed: a2 === a }); b.addEventListener('click', () => { api.sfx('tap'); a2 = a; build2(); }); row2.append(b); }); };
    build1(); build2();

    const panel = el('div', { class: 'panel' },
      el('h1', { class: 'center', text: '⚔️ Düello' }),
      el('p', { class: 'center', text: `Aynı cihazda ${ROUNDS} tur yarış. Aynı soruyu ikiniz de cevaplıyorsunuz — hızlı ve doğru olan puan kazanır.` }),
      el('div', { style: { display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginTop: '10px' } },
        el('div', { class: 'bubble' },
          el('div', { class: 'field' }, el('label', { text: '1. Oyuncu' }), p1),
          row1
        ),
        el('div', { class: 'bubble' },
          el('div', { class: 'field' }, el('label', { text: '2. Oyuncu' }), p2),
          row2
        )
      ),
      el('div', { class: 'btn-row', style: { marginTop: '18px' } },
        el('button', {
          class: 'btn primary', text: 'Başla!', onClick: () => {
            const n1 = (p1.value || '').trim().slice(0, 14) || 'Oyuncu 1';
            const n2 = (p2.value || '').trim().slice(0, 14) || 'Oyuncu 2';
            if (n1.toLocaleLowerCase('tr') === n2.toLocaleLowerCase('tr')) { toast('Farklı isimler gir'); return; }
            state.players[0] = { name: n1, avatar: a1, score: 0, correct: 0 };
            state.players[1] = { name: n2, avatar: a2, score: 0, correct: 0 };
            api.sfx('unlock');
            renderBoard();
            startRound();
          }
        }),
        el('button', { class: 'btn ghost', text: 'Vazgeç', onClick: onExit })
      )
    );
    root.append(panel);
  }

  /* ---------------- Oyun ---------------- */
  let headerEl, qBox, answerBox, timerBar;

  function renderBoard() {
    clear(root);
    headerEl = el('div', { class: 'duel-scores' });
    timerBar = el('div', { class: 'timer-bar' }, el('i'));
    qBox = el('div', { class: 'bubble', style: { display: 'grid', gap: '6px', placeItems: 'center', minHeight: '170px' } });
    answerBox = el('div');
    root.append(el('div', { class: 'game-bar' },
      el('button', { class: 'btn ghost sm', text: '⏹️ Bitir', onClick: onExit })),
      headerEl, timerBar, qBox, answerBox);
    drawScores();
  }

  function drawScores() {
    clear(headerEl);
    const side = (i) => el('div', { class: 'duel-side' + (state.turn === i && state.phase === 'play' ? ' active' : '') },
      el('div', { class: 'ds-avatar', html: avatarHTML(state.players[i].avatar, { size: 46 }) }),
      el('div', { class: 'ds-name', text: state.players[i].name }),
      el('div', { class: 'ds-score', text: String(state.players[i].score) }),
      el('div', { class: 'small muted', text: `Tur ${Math.min(state.round, ROUNDS)}/${ROUNDS} · ${state.players[i].correct} doğru` })
    );
    headerEl.append(side(0), el('div', { class: 'vs', text: 'VS' }), side(1));
  }

  function makeQuestion() {
    const kinds = ['multiply', 'multiply', 'sides', 'tap'];
    const kind = kinds[randInt(0, kinds.length - 1)];
    if (kind === 'sides') return makeSidesQuestion({ ask: 'mix', shapes: ['kare', 'dikdortgen', 'ucgen', 'besgen'] });
    if (kind === 'tap') return makeTapQuestion({ shapes: ['kare', 'ucgen', 'daire', 'dikdortgen'], count: 3, distractors: 3 });
    return makeMultiplyQuestion({ tables: [2, 3, 4, 5], mode: 'result', maxB: 5 });
  }

  function startRound() {
    state.round++;
    if (state.round > ROUNDS) return renderResult();
    state.cur = makeQuestion();
    state.turn = 0;
    state.phase = 'handoff';
    drawScores();
    renderHandoff();
  }

  function renderHandoff() {
    const p = state.players[state.turn];
    clear(qBox);
    clear(answerBox);
    qBox.append(
      el('div', { style: { textAlign: 'center' } },
        el('div', { class: 'duel-handoff', html: avatarHTML(p.avatar, { size: 96 }) }),
        el('h2', { class: 'center', text: `Sıra: ${p.name}` }),
        el('p', { class: 'center', text: 'Hazır olduğunda dokun. Telefonu arkadaşına ver!' }),
        el('button', { class: 'btn primary tap-hint', text: 'Hazırım!', onClick: () => { state.phase = 'play'; renderQuestion(); } })
      )
    );
    api.speak(`${p.name}, sıra sende. Hazır olduğunda dokun.`);
  }

  function renderQuestion() {
    const q = state.cur;
    const p = state.players[state.turn];
    clear(qBox);
    clear(answerBox);
    state.locked = false;

    const face = el('div', { class: 'q-hint', text: `${p.avatar} ${p.name} oynuyor` });
    qBox.append(face);

    if (q.kind === 'sides') {
      qBox.append(el('div', { html: shapeSVG(q.shapeId, { size: 130, strokeWidth: 6, showDots: true }) }));
      qBox.append(el('div', { class: 'question', style: { fontSize: 'clamp(22px, 4vw, 34px)' }, html: `${SHAPES[q.shapeId].name} — kaç <span class="q-mark">${q.ask === 'kenar' ? 'kenar' : 'köşe'}</span>?` }));
      const grid = el('div', { class: 'answers' });
      for (const o of q.options) {
        const b = el('button', { class: 'answer-btn', type: 'button', text: String(o) });
        b.addEventListener('click', () => resolve(o === q.answer, b));
        grid.append(b);
      }
      answerBox.append(grid);
    } else if (q.kind === 'tap') {
      qBox.append(el('div', { class: 'question', style: { fontSize: 'clamp(20px, 3.6vw, 32px)' }, text: q.prompt }));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: '10px' } });
      let remaining = q.tokens.filter((t) => t.mine).length;
      for (const t of q.tokens) {
        const b = el('button', { class: 'answer-btn', type: 'button', style: { minHeight: '82px' }, html: shapeSVG(t.shape, { size: 58, strokeWidth: 4 }) });
        b.addEventListener('click', () => {
          if (state.locked) return;
          if (t.mine) {
            t.mine = false; remaining--; b.style.opacity = '.25'; b.disabled = true;
            api.sfx('pop');
            if (remaining === 0) resolve(true, b);
          } else {
            api.sfx('wrong');
            resolve(false, b);
          }
        });
        grid.append(b);
      }
      answerBox.append(grid);
    } else {
      qBox.append(el('div', { class: 'question', html: q.prompt.replace('?', '<span class="q-mark">?</span>').replace('×', '<span class="q-mark">×</span>') }));
      if (q.mode === 'result' && q.a <= 5 && q.b <= 5) {
        const rows = [];
        for (let r = 0; r < q.b; r++) rows.push('●'.repeat(q.a));
        qBox.append(el('div', { class: 'q-hint', style: { letterSpacing: '4px', fontSize: '18px' }, text: rows.join('  ') }));
      }
      const grid = el('div', { class: 'answers' });
      for (const o of q.options) {
        const b = el('button', { class: 'answer-btn', type: 'button', text: String(o) });
        b.addEventListener('click', () => resolve(o === q.answer, b));
        grid.append(b);
      }
      answerBox.append(grid);
    }

    api.speak(questionSpeech(q));
    startTimer();
  }

  function startTimer() {
    if (state.timer) clearInterval(state.timer);
    state.t0 = performance.now();
    timerBar.firstChild.style.width = '100%';
    timerBar.classList.remove('warn');
    state.timer = setInterval(() => {
      const pct = Math.max(0, 1 - (performance.now() - state.t0) / 1000 / PER_Q_SECONDS);
      timerBar.firstChild.style.width = (pct * 100).toFixed(1) + '%';
      if (pct < 0.3) timerBar.classList.add('warn');
      if (pct <= 0) { clearInterval(state.timer); state.timer = null; resolve(false, null, true); }
    }, 120);
  }

  function resolve(correct, btn, timedOut = false) {
    if (state.locked) return;
    state.locked = true;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    const elapsed = (performance.now() - state.t0) / 1000;
    const speed = Math.max(0, Math.round(50 * (1 - elapsed / PER_Q_SECONDS)));
    const p = state.players[state.turn];
    if (correct) {
      p.score += 100 + speed;
      p.correct++;
      btn?.classList.add('correct');
      api.sfx('correct');
      api.speak(speed > 20 ? 'Hızlı cevap!' : 'Doğru!');
    } else {
      btn?.classList.add('wrong');
      api.sfx('wrong');
      api.speak(timedOut ? 'Süre bitti.' : 'Yanlış.');
    }
    drawScores();

    setTimeout(() => {
      if (state.turn === 0) {
        state.turn = 1;
        state.phase = 'handoff';
        drawScores();
        renderHandoff();
      } else {
        drawScores();
        toast(`Tur ${state.round} bitti!`);
        setTimeout(startRound, 700);
      }
    }, 1000);
  }

  function renderResult() {
    state.phase = 'done';
    clear(root);
    const [a, b] = state.players;
    const winner = a.score === b.score ? null : (a.score > b.score ? a : b);
    const panel = el('div', { class: 'panel narrow' },
      el('h1', { class: 'center', text: '🏆 Düello Sonucu' }),
      el('div', { class: 'duel-scores', style: { margin: '14px 0' } },
        el('div', { class: 'duel-side' }, el('div', { class: 'ds-avatar', html: avatarHTML(a.avatar, { size: 46 }) }), el('div', { class: 'ds-name', text: a.name }), el('div', { class: 'ds-score', text: String(a.score) }), el('div', { class: 'small muted', text: `${a.correct} doğru` })),
        el('div', { class: 'vs', text: 'VS' }),
        el('div', { class: 'duel-side' }, el('div', { class: 'ds-avatar', html: avatarHTML(b.avatar, { size: 46 }) }), el('div', { class: 'ds-name', text: b.name }), el('div', { class: 'ds-score', text: String(b.score) }), el('div', { class: 'small muted', text: `${b.correct} doğru` }))
      ),
      el('h2', { class: 'center', text: winner ? `🥇 ${winner.name} kazandı!` : '🤝 Berabere!' }),
      el('p', { class: 'center', text: 'İkiniz de harika oynadınız. Tekrar deneyin, daha hızlı olun!' }),
      el('div', { class: 'btn-row', style: { marginTop: '12px', justifyContent: 'center' } },
        el('button', { class: 'btn primary', text: '🔁 Tekrar', onClick: () => { state.players.forEach((p) => { p.score = 0; p.correct = 0; }); state.round = 0; renderBoard(); startRound(); } }),
        el('button', { class: 'btn ghost', text: 'Haritaya dön', onClick: onExit })
      )
    );
    root.append(panel);
    api.confetti({ count: 120, duration: 2600 });
    api.sfx('win');
    api.speak(winner ? `${winner.name} kazandı! Tebrikler.` : 'Berabere bitti!');
  }

  return {
    start() { renderSetup(); },
    destroy() { if (state.timer) clearInterval(state.timer); }
  };
}
