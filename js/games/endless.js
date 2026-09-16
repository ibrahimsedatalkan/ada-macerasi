/* ============================================================
   endless.js — SONSUZ MACERA

   PEDAGOJİK GEREKÇE
   -----------------
   45 bölüm bitince çocuk "oyun bitti" durumuna düşüyordu. Oysa akıcılık
   (flow) kuramına göre (Csikszentmihalyi) en verimli öğrenme, ZORLUK ile
   BECERİ dengesi korunduğunda olur: çok kolay → sıkılma, çok zor → kaygı.
   Sonsuz mod bu dengeyi otomatik kurar: çocuk doğru yaptıkça zorlaşır,
   zorlandıkça kolaylaşır. Bitmez, ama istediği an bırakabilir.

   İKİNCİ PEDAGOJİK KARAR — KARŞILAŞTIRMA KİMİNLE?
   Rekor tablosu YOK. Çocuk yalnız KENDİ önceki rekoruyla karşılaştırılır:
   "34 bildin — kendi rekorun 41'di, yaklaşıyorsun!" Bu, ustalık odaklı
   (mastery) geri bildirimdir; sosyal karşılaştırma özgüveni zedeler.
   ============================================================ */

import { el, clear, elemandanPatlama, ekranSars, hitStop, komboYazisi } from '../ui.js';
import { makeMultiplyQuestion, makeAddQuestion, makeSidesQuestion, questionSpeech, questionSpeechParts } from './questions.js';
import { techniqueFor, techniqueSpeech } from './hints.js';
import { resetSpeech } from '../audio.js';
import { muzikYogunluk } from '../music.js';
import { titretDogru, titretYanlis, titretKombo } from '../his.js';
import { shuffle } from '../ui.js';

const TIPLER = ['multiply', 'addsub', 'sides'];

export function createEndlessGame({ root, level, api }) {
  const cfg = level.cfg || {};
  const state = {
    i: 0, cur: null, correct: 0, wrong: 0, lives: 3, streak: 0, best: 0,
    locked: false, destroyed: false, zorluk: 1, hintStep: 0, usedHint: false
  };
  let soruEl, cevapEl, barEl, hintEl, visualEl, hintBtn;

  /* ---------- Uyarlanan soru seçimi ---------- */
  function soruUret() {
    // Zorluk kademesi: doğru yaptıkça artar, kaybettikçe düşer (flow dengesi)
    const z = state.zorluk;
    const tip = TIPLER[Math.floor(Math.random() * TIPLER.length)];

    if (tip === 'multiply') {
      // Zorluk 1 → tablolar 2-5 · 2 → 2-7 · 3 → 2-10 · 4+ → 6-10 ağırlıklı
      const havuz = z <= 1 ? [2, 3, 4, 5] : z === 2 ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6, 7, 8, 9, 10];
      return makeMultiplyQuestion({ tables: havuz, mode: 'result', maxB: Math.min(10, 3 + z * 2) });
    }
    if (tip === 'addsub') {
      const mode = Math.random() < 0.5 ? 'add' : 'sub';
      const carry = z >= 3;
      return makeAddQuestion({ max: z <= 1 ? 20 : 100, carry, mode });
    }
    // Kenar/köşe
    const sekiller = z <= 1 ? ['kare', 'ucgen'] : ['kare', 'dikdortgen', 'ucgen', 'besgen', 'altigen', 'daire'];
    return makeSidesQuestion({ ask: Math.random() < 0.5 ? 'sides' : 'corners', shapes: sekiller });
  }

  /* ---------- Arayüz ---------- */
  function kur() {
    clear(root);
    barEl = el('div', { class: 'game-bar' });
    soruEl = el('div', { class: 'question' });
    hintEl = el('div', { class: 'q-hint' });
    visualEl = el('div', { class: 'bubble', style: { display: 'none', textAlign: 'center' } });
    cevapEl = el('div', { class: 'answers' });
    hintBtn = el('button', { class: 'btn ghost sm', text: '💡 Nasıl düşünmeliyim?', onClick: () => ipucu() });
    const bitirBtn = el('button', { class: 'btn ghost sm', text: '🏁 Bitir', onClick: () => bitir() });
    root.append(barEl, soruEl, hintEl, visualEl, cevapEl,
      el('div', { class: 'btn-row', style: { justifyContent: 'center' } }, hintBtn, bitirBtn));
  }

  function kalpCiz() {
    return Array.from({ length: 3 }, (_, i) => (i < state.lives ? '♥' : '♡')).join(' ');
  }

  function barCiz() {
    clear(barEl);
    barEl.append(
      el('div', { class: 'lives', text: kalpCiz() }),
      el('div', { class: 'grow' }),
      el('div', { class: 'hint-pill', text: `✅ ${state.correct}` }),
      state.streak >= 3 ? el('div', { class: 'hint-pill streak-pill', text: `🔥 ${state.streak}` }) : el('div')
    );
  }

  function soruCiz() {
    const q = state.cur = soruUret();
    state.locked = false;
    state.usedHint = false;
    state.hintStep = 0;
    hintBtn.textContent = '💡 Nasıl düşünmeliyim?';
    visualEl.style.display = 'none';
    hintEl.textContent = '';
    barCiz();

    soruEl.innerHTML = '';
    if (q.kind === 'sides') {
      soruEl.append(el('div', { class: 'q-mark', html: q.svg || '' }), el('div', { text: q.prompt }));
    } else {
      soruEl.innerHTML = String(q.prompt || '').replace('?', '<span class="q-mark">?</span>')
        .replace('×', '<span class="q-mark">×</span>').replace('+', '<span class="q-mark">+</span>')
        .replace('−', '<span class="q-mark">−</span>');
    }

    clear(cevapEl);
    (q.options || []).forEach((opt) => {
      const b = el('button', { class: 'answer-btn', text: String(opt) });
      b.addEventListener('click', () => cevapla(opt, b));
      cevapEl.append(b);
    });

    resetSpeech();
    const parcalar = questionSpeechParts(q);
    if (parcalar && api.speakSeq) api.speakSeq(parcalar);
    else api.speak(questionSpeech(q), { force: true, key: 'son' + state.i });
  }

  function ipucu() {
    if (!state.cur || state.locked) return;
    api.sfx('tap');
    state.hintStep = (state.hintStep + 1) % 2;
    if (state.hintStep === 0) {
      visualEl.style.display = 'none';
      hintBtn.textContent = '💡 Nasıl düşünmeliyim?';
      return;
    }
    state.usedHint = true;
    const t = techniqueFor(state.cur);
    hintBtn.textContent = '💡 İpucunu kapat';
    if (!t) { hintEl.textContent = 'Önce kolay yoldan dene: bildiğin bir çarpımdan yola çık.'; return; }
    clear(visualEl);
    visualEl.style.display = '';
    visualEl.append(
      el('div', { class: 'hint-title', text: '💡 ' + t.name }),
      el('div', { class: 'hint-body', text: t.teach }),
      t.countHint ? el('div', { class: 'hint-tip', text: '👉 ' + t.countHint }) : null
    );
    api.speak(techniqueSpeech(state.cur), { force: true, key: 'sonhint' + state.i });
  }

  function cevapla(secim, btn) {
    if (state.locked || state.destroyed) return;
    state.locked = true;
    const dogru = Number(secim) === Number(state.cur.answer);

    [...cevapEl.children].forEach((b) => {
      if (Number(b.textContent) === Number(state.cur.answer)) b.classList.add('dogru');
      else if (b === btn) b.classList.add('yanlis');
      b.disabled = true;
    });

    api.recordAnswer({
      correct: dogru, kind: state.cur.kind, table: state.cur.table,
      b: state.cur.b, shape: state.cur.shape, usedHint: state.usedHint
    });

    if (dogru) {
      state.correct++;
      state.streak++;
      state.best = Math.max(state.best, state.streak);
      api.sfx('correct');
      elemandanPatlama(btn, { adet: 14 + Math.min(14, state.streak * 2) });
      titretDogru();
      // Akış dengesi: seri büyüdükçe zorluk artar
      if (state.streak > 0 && state.streak % 3 === 0) state.zorluk = Math.min(4, state.zorluk + 1);
      muzikYogunluk(state.streak >= 6 ? 3 : state.streak >= 3 ? 2 : 1);
      if (state.streak >= 3) titretKombo(state.streak);
      if (state.streak === 5) komboYazisi("5'Lİ KOMBO!");
      else if (state.streak === 10) komboYazisi("10'LU KOMBO! MUHTEŞEM!", '#58cf6a');
      else if (state.streak === 15) komboYazisi("15'Lİ KOMBO! EFSANE!", '#ff6f9c');
      barCiz();
      setTimeout(() => { if (!state.destroyed) { state.i++; soruCiz(); } }, 900);
    } else {
      state.wrong++;
      state.streak = 0;
      state.lives--;
      // Akış dengesi: zorlandıkça kolaylaşır (kaygıyı önler)
      state.zorluk = Math.max(1, state.zorluk - 1);
      api.sfx('wrong');
      ekranSars(1.15);
      hitStop(110);
      titretYanlis();
      muzikYogunluk(1);
      barCiz();
      if (state.lives <= 0) {
        hintEl.textContent = 'Canlar bitti — ama soruları bildin!';
        setTimeout(() => bitir(), 1400);
      } else {
        setTimeout(() => { if (!state.destroyed) { state.i++; soruCiz(); } }, 1200);
      }
    }
  }

  function bitir() {
    if (state.destroyed) return;
    state.destroyed = true;
    const oncekiRekor = api.profile?.rekor || 0;
    const yeniRekor = state.correct > oncekiRekor;
    if (api.profile) {
      api.profile.rekor = Math.max(oncekiRekor, state.correct);
      api.profile.sonSonsuz = state.correct;
      api.saveProfile();
    }
    api.finish({
      correct: state.correct, wrong: state.wrong,
      completed: state.correct > 0, rounds: state.correct + state.wrong,
      hintsUsed: 0, total: state.correct + state.wrong,
      sonsuz: true, oncekiRekor, yeniRekor
    });
  }

  return {
    start() { kur(); state.i = 0; soruCiz(); muzikYogunluk(1); },
    destroy() { state.destroyed = true; resetSpeech(); }
  };
}
