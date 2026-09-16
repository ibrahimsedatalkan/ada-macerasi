/* ============================================================
   duel-online.js — Arkadaşla CANLI düello (oda kodu ile)

   Tasarım: her iki oyuncu da aynı oda kodundan türetilen AYNI soru
   dizisini görür (tohum = oda kodu). Böylece sunucu soru dağıtmak
   zorunda kalmaz, oyun adil olur. Sunucu yalnızca oyuncu listesini
   ve hamleleri (skor) canlı yayınlar (SSE).

   Sunucu yoksa (ada.api boş) bu ekran çevrimdışı uyarısı verir.
   ============================================================ */

import { el, clear, avatarHTML, avatarInline, esc, toast } from './ui.js';
import { makeMultiplyQuestion, questionSpeech } from './games/questions.js';
import { techniqueFor, techniqueSpeech } from './games/hints.js';
import { resetSpeech, speak } from './audio.js';
import * as online from './online.js';

/* Oda kodundan deterministik rastgele sayı üreteci (mulberry32) */
function seededRandom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROUNDS = 8;
const TABLE_SETS = [[1, 2], [2, 3], [3, 4], [2, 5], [4, 5]];

/** Oda kodundan aynı soru dizisini üret (iki tarafta birebir aynı) */
function buildQuestions(roomCode) {
  const rnd = seededRandom(roomCode);
  const qs = [];
  for (let i = 0; i < ROUNDS; i++) {
    const tables = TABLE_SETS[Math.floor(rnd() * TABLE_SETS.length)];
    const a = tables[Math.floor(rnd() * tables.length)];
    const b = 1 + Math.floor(rnd() * 5);
    const product = a * b;
    const opts = new Set([product]);
    const pool = [product + a, product - a, product + 1, product - 1, a + b, product + b];
    let guard = 0;
    while (opts.size < 4 && guard++ < 60) {
      const c = pool[Math.floor(rnd() * pool.length)];
      if (c > 0 && c !== product) opts.add(c);
    }
    const options = [...opts].sort(() => rnd() - 0.5);
    qs.push({ kind: 'multiply', mode: 'result', a, b, table: a, answer: product, prompt: `${a} × ${b} = ?`, options });
  }
  return qs;
}

export function createDuelOnline({ root, api, onExit }) {
  const st = {
    phase: 'lobby',     // lobby | waiting | play | result
    room: '',
    me: null,
    players: [],
    questions: [],
    i: 0,
    score: 0, correct: 0, wrong: 0,
    streak: 0, best: 0,
    locked: false,
    usedHint: false,
    stream: null,
    rakip: { score: 0, correct: 0, i: 0 },
    missed: [],
    destroyed: false
  };
  const profile = () => api.profile;

  /* ---------- Ortak iskelet ---------- */
  const wrap = el('div', { class: 'game-wrap' });
  root.append(wrap);

  function render() {
    if (st.destroyed) return;
    clear(wrap);
    if (st.phase === 'lobby') return renderLobby();
    if (st.phase === 'waiting') return renderWaiting();
    if (st.phase === 'play') return renderPlay();
    return renderResult();
  }

  function head(title, altyazi) {
    return el('div', { class: 'duel-head' },
      el('button', { class: 'btn sm ghost', text: '← Çık', onClick: () => exit() }),
      el('div', { class: 'grow', style: { flex: '1' } }),
      el('div', { class: 'hint-pill', text: title }),
      altyazi ? el('div', { class: 'hint-pill', text: altyazi }) : el('span')
    );
  }

  /* ---------- 1) Lobi ---------- */
  function renderLobby() {
    const yok = !online.isConfigured();
    const p = profile();

    // Sunucu var ama hesap yok → PIN ile hesap kur / giriş yap
    if (!yok && !p.token) return renderHesap();

    wrap.append(
      head('Canlı Düello'),
      el('div', { class: 'panel' },
        el('h1', { text: 'Arkadaşınla canlı yarış' }),
        el('p', { class: 'small muted', text: 'Aynı anda oynayın. Biri oda kurar, diğeri kodla katılır. İkiniz de AYNI soruları görürsünüz — kazanan hızlı ve doğru olandır.' }),
        yok ? el('div', { class: 'reward-row', style: { marginTop: '12px' } },
          el('span', {}, 'Çevrimdışı mod: canlı düello için oyun sunucusuna bağlanmak gerekiyor.')) : el('span'),

        el('div', { class: 'btn-row', style: { marginTop: '18px', justifyContent: 'center' } },
          el('button', {
            class: 'btn primary', text: 'Oda kur', disabled: yok,
            onClick: () => odaKur()
          })
        ),

        el('div', { class: 'field', style: { marginTop: '16px', maxWidth: '320px', margin: '16px auto 0' } },
          el('label', { text: 'Oda kodun varsa yaz' }),
          el('div', { class: 'btn-row' },
            joinInput(),
            el('button', { class: 'btn green', text: 'Katıl', disabled: yok, onClick: () => odayaKatil() })
          )
        ),

        el('div', { class: 'btn-row', style: { marginTop: '18px', justifyContent: 'center' } },
          el('button', { class: 'btn ghost', text: 'Aynı cihazda 2 kişi oyna', onClick: () => exit(true) }),
          el('button', { class: 'btn ghost', text: 'Haritaya dön', onClick: () => exit() })
        )
      )
    );
  }

  /* ---------- 1b) Hesap (takma ad + 4 haneli PIN) ---------- */
  let pinEl = null;
  function renderHesap() {
    const p = profile();
    pinEl = el('input', {
      type: 'password', inputmode: 'numeric', maxlength: 4, placeholder: '4 haneli PIN',
      style: { letterSpacing: '.3em', fontWeight: '800', textAlign: 'center', maxWidth: '160px', margin: '0 auto' }
    });
    wrap.append(
      head('Canlı Düello'),
      el('div', { class: 'panel' },
        el('div', { class: 'center' },
          el('div', { html: avatarHTML(p.avatar, { size: 72 }) }),
          el('h1', { text: p.nick }),
          el('p', { class: 'small muted', text: `Sınıf ${p.classCode} — arkadaşların seni bu isimle görecek.` })
        ),
        el('div', { class: 'field', style: { maxWidth: '280px', margin: '16px auto 0' } },
          el('label', { text: '4 haneli PIN seç (ailenle paylaş)' }),
          pinEl
        ),
        el('p', { class: 'small muted', style: { textAlign: 'center' },
          text: 'Kayıt olurken PIN gerekir. Sonra giriş yaparken aynı PIN’i kullanırsın.' }),
        el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '14px' } },
          el('button', { class: 'btn primary', text: 'Hesap oluştur', onClick: () => hesapOlustur() }),
          el('button', { class: 'btn ghost', text: 'Giriş yap', onClick: () => hesapGiris() })
        ),
        el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '10px' } },
          el('button', { class: 'btn ghost sm', text: '← Geri', onClick: () => exit() })
        )
      )
    );
    speak('Arkadaşlarınla canlı oynamak için 4 haneli bir PIN seç.');
  }

  async function hesapOlustur() {
    const p = profile();
    const pin = (pinEl?.value || '').trim();
    if (!/^\d{4}$/.test(pin)) { api.sfx('wrong'); toast('PIN 4 haneli sayı olmalı'); return; }
    try {
      const r = await online.register({ nick: p.nick, classCode: p.classCode, pin, avatar: p.avatar });
      p.token = r.token;
      api.saveProfile?.();
      api.sfx('unlock');
      api.toast('Hesabın hazır!');
      render();
    } catch (e) {
      api.sfx('wrong');
      toast(e.message || 'Hesap oluşturulamadı');
    }
  }

  async function hesapGiris() {
    const p = profile();
    const pin = (pinEl?.value || '').trim();
    if (!/^\d{4}$/.test(pin)) { api.sfx('wrong'); toast('PIN 4 haneli sayı olmalı'); return; }
    try {
      const r = await online.login({ nick: p.nick, classCode: p.classCode, pin });
      p.token = r.token;
      api.saveProfile?.();
      api.sfx('unlock');
      api.toast('Giriş yapıldı!');
      render();
    } catch (e) {
      api.sfx('wrong');
      toast(e.message || 'Giriş yapılamadı');
    }
  }

  let joinEl = null;
  function joinInput() {
    joinEl = el('input', { type: 'text', maxlength: 4, placeholder: 'Örn: K7M2',
      style: { textTransform: 'uppercase', letterSpacing: '.24em', fontWeight: '800', textAlign: 'center' } });
    return joinEl;
  }

  async function odaKur() {
    const p = profile();
    try {
      const r = await online.duelCreate({ nick: p.nick, classCode: p.classCode, avatar: p.avatar }, p.token);
      st.room = r.roomCode;
      st.players = r.players || [{ nick: p.nick }];
      st.phase = 'waiting';
      api.sfx('unlock');
      baglan();
      render();
    } catch (e) {
      api.sfx('wrong');
      toast('Oda kurulamadı: ' + (e.message || 'bağlantı yok'));
    }
  }

  async function odayaKatil() {
    const p = profile();
    const code = (joinEl?.value || '').toUpperCase().trim();
    if (code.length !== 4) { toast('Oda kodu 4 karakter olmalı'); api.sfx('wrong'); return; }
    try {
      const r = await online.duelJoin({ roomCode: code, nick: p.nick, avatar: p.avatar }, p.token);
      st.room = code;
      st.players = r.players || [];
      st.phase = 'play';
      api.sfx('unlock');
      hazirla();
      baglan();
      render();
    } catch (e) {
      api.sfx('wrong');
      toast(e.message || 'Odaya katılınamadı');
    }
  }

  /* ---------- 2) Bekleme ---------- */
  function renderWaiting() {
    const p = profile();
    wrap.append(
      head('Oda: ' + st.room),
      el('div', { class: 'panel' },
        el('h1', { text: 'Arkadaşını bekliyorsun' }),
        el('p', { class: 'small muted', text: 'Bu kodu arkadaşına gönder. O da "Oda kodun varsa yaz" alanına yazıp katılsın.' }),
        el('div', { class: 'room-code', text: st.room }),
        el('div', { class: 'btn-row', style: { justifyContent: 'center' } },
          el('button', { class: 'btn sm ghost', text: 'Kodu kopyala', onClick: () => kopyala(st.room) })
        ),
        el('div', { class: 'duel-players', style: { marginTop: '18px' } },
          ...oyuncuKartlari()
        ),
        el('p', { class: 'small muted', style: { textAlign: 'center' }, text: 'İki oyuncu da hazır olunca yarış kendiliğinden başlar.' })
      )
    );
    speak('Oda kodu ' + st.room.split('').join(' ') + '. Arkadaşını bekliyoruz.');
  }

  function oyuncuKartlari() {
    const p = profile();
    const list = st.players.length ? st.players : [{ nick: p.nick, avatar: p.avatar }];
    return list.map((x) => el('div', { class: 'duel-side' },
      el('div', { class: 'ds-avatar', html: avatarHTML(x.avatar || '🦊', { size: 46 }) }),
      el('div', { class: 'ds-name', text: x.nick }),
      el('div', { class: 'small muted', text: x.nick === p.nick ? 'sen' : 'rakip' })
    ));
  }

  /* ---------- 3) Oyun ---------- */
  function hazirla() {
    st.questions = buildQuestions(st.room);
    st.i = 0; st.score = 0; st.correct = 0; st.wrong = 0; st.streak = 0; st.best = 0;
  }

  const progressBar = el('div', { class: 'duel-progress' });
  const qBox = el('div', { class: 'question' });
  const hintEl = el('div', { class: 'q-hint' });
  const visualEl = el('div', { class: 'bubble', style: { display: 'none', textAlign: 'center' } });
  const answersEl = el('div', { class: 'answers' });
  const hintBtn = el('button', { class: 'btn ghost sm tap-hint', text: '💡 Nasıl düşünmeliyim?', onClick: () => ipucu() });
  const scoreBox = el('div', { class: 'duel-scoreline' });

  function renderPlay() {
    const p = profile();
    wrap.append(
      head('Oda: ' + st.room, `${Math.min(st.i + 1, ROUNDS)} / ${ROUNDS}`),
      scoreBox,
      progressBar,
      qBox, hintEl, visualEl, answersEl,
      el('div', { class: 'btn-row', style: { justifyContent: 'center' } }, hintBtn)
    );
    soruGoster();
    speak(`Hazır mısın ${p.nick}? Başlıyoruz!`);
  }

  function soruGoster() {
    const q = st.questions[st.i];
    if (!q) return bitir();
    st.locked = false;
    st.usedHint = false;
    resetSpeech();
    hintBtn.textContent = '💡 Nasıl düşünmeliyim?';
    hintEl.textContent = '';
    visualEl.style.display = 'none';
    clear(answersEl);

    qBox.innerHTML = q.prompt.replace('?', '<span class="q-mark">?</span>').replace('×', '<span class="q-mark">×</span>');
    for (const opt of q.options) {
      const b = el('button', { class: 'answer-btn', text: String(opt), type: 'button' });
      b.addEventListener('click', () => cevapla(opt, b));
      answersEl.append(b);
    }
    skorCiz();
    speak(questionSpeech(q));
  }

  function skorCiz() {
    const p = profile();
    clear(scoreBox);
    scoreBox.append(
      el('div', { class: 'duel-side' },
        el('div', { class: 'ds-name', text: 'Sen' }),
        el('div', { class: 'ds-score', text: String(st.score) }),
        el('div', { class: 'small muted', text: `${st.correct} doğru · ${Math.min(st.i, ROUNDS)}/${ROUNDS}` })
      ),
      el('div', { class: 'duel-vs', text: 'VS' }),
      el('div', { class: 'duel-side' },
        el('div', { class: 'ds-name', text: st.rakipNick || 'Rakip' }),
        el('div', { class: 'ds-score', text: String(st.rakip.score) }),
        el('div', { class: 'small muted', text: `${st.rakip.correct} doğru · ${st.rakip.i}/${ROUNDS}` })
      )
    );
    const yuzde = Math.round(((st.i) / ROUNDS) * 100);
    clear(progressBar);
    progressBar.append(el('i', { style: { width: yuzde + '%' } }));
  }

  function cevapla(deger, btn) {
    if (st.locked) return;
    st.locked = true;
    const q = st.questions[st.i];
    const ok = deger === q.answer;
    if (ok) {
      const bonus = Math.max(0, 60 - st.streak * 5);
      st.score += 100 + bonus;
      st.correct++;
      st.streak++;
      st.best = Math.max(st.best, st.streak);
      btn.classList.add('correct');
      api.sfx('correct');
    } else {
      st.wrong++;
      st.streak = 0;
      btn.classList.add('wrong');
      st.missed.push(q);
      api.sfx('wrong');
      for (const b of answersEl.children) if (Number(b.textContent) === q.answer) b.classList.add('correct');
    }
    // Sunucuya hamle bildir (rakip canlı görsün)
    hamleGonder(ok, ok ? 100 : 0);
    st.i++;
    skorCiz();
    setTimeout(() => { if (!st.destroyed) { if (st.i >= ROUNDS) bitir(); else soruGoster(); } }, ok ? 550 : 1300);
  }

  async function hamleGonder(correct, points) {
    const p = profile();
    try {
      await online.duelMove({ roomCode: st.room, move: { correct, points, i: st.i, score: st.score, correctCount: st.correct } }, p.token);
    } catch (e) { /* çevrimdışıysa yoksay */ }
  }

  function ipucu() {
    const q = st.questions[st.i];
    if (!q) return;
    st.usedHint = true;
    api.sfx('tap');
    const t = techniqueFor(q);
    visualEl.style.display = '';
    clear(visualEl);
    if (!t) return;
    visualEl.append(
      el('div', { class: 'hint-title', text: '💡 ' + t.name }),
      el('div', { class: 'hint-body', text: t.teach }),
      el('div', { class: 'hint-tip', text: '👉 ' + t.countHint })
    );
    speak(techniqueSpeech(q), { force: true });
  }

  /* ---------- 4) Sonuç ---------- */
  function bitir() {
    st.phase = 'result';
    render();
  }

  function renderResult() {
    const p = profile();
    const rakip = st.rakip;
    const kazandi = st.score > rakip.score;
    const berabere = st.score === rakip.score;
    const baslik = berabere ? 'Berabere!' : (kazandi ? 'Kazandın!' : 'Bu sefer olmadı');
    const mood = berabere ? 'think' : (kazandi ? 'cheer' : 'sad');

    wrap.append(
      head('Düello bitti', 'Oda: ' + st.room),
      el('div', { class: 'panel' },
        el('h1', { text: baslik }),
        el('div', { class: 'duel-scoreline' },
          el('div', { class: 'duel-side' },
            el('div', { class: 'ds-name', text: 'Sen' }),
            el('div', { class: 'ds-score', text: String(st.score) }),
            el('div', { class: 'small muted', text: `${st.correct} doğru` })
          ),
          el('div', { class: 'duel-vs', text: 'VS' }),
          el('div', { class: 'duel-side' },
            el('div', { class: 'ds-name', text: st.rakipNick || 'Rakip' }),
            el('div', { class: 'ds-score', text: String(rakip.score) })
          )
        ),
        st.missed.length
          ? el('div', { style: { marginTop: '14px' } },
              el('h3', { text: 'Tekrar bak: bunlarda zorlandın' }),
              ...st.missed.slice(0, 4).map((q) => {
                const t = techniqueFor(q);
                return el('div', { class: 'reward-row' },
                  el('b', { text: `${q.a} × ${q.b} = ${q.answer}` }),
                  el('span', { text: t ? '— ' + t.name : '' })
                );
              }))
          : el('span'),
        el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '16px' } },
          el('button', { class: 'btn primary', text: 'Yeniden oyna', onClick: () => { hazirla(); st.rakip = { score: 0, correct: 0, i: 0 }; st.phase = 'play'; render(); } }),
          el('button', { class: 'btn ghost', text: 'Haritaya dön', onClick: () => exit() })
        )
      )
    );
    if (kazandi) api.confetti({ count: 130 });
    api.sfx(kazandi ? 'win' : 'click');
    speak(baslik);
  }

  /* ---------- SSE: rakibin hamlelerini dinle ---------- */
  function baglan() {
    if (st.stream) return;
    st.stream = online.duelStream(st.room, {
      onEvent: (ev) => {
        if (ev.type === 'joined') {
          st.players = ev.players || [];
          const rakip = st.players.find((x) => x.nick !== profile().nick);
          if (rakip) st.rakipNick = rakip.nick;
          if (st.players.length >= 2 && st.phase === 'waiting') {
            st.phase = 'play';
            hazirla();
            api.sfx('unlock');
            api.toast('Rakip katıldı — başlıyoruz!');
            render();
          } else render();
        }
        if (ev.type === 'move' && ev.move && ev.move.nick !== profile().nick) {
          st.rakip = { score: ev.move.score || 0, correct: ev.move.correctCount || 0, i: ev.move.i || 0 };
          st.rakipNick = ev.move.nick;
          if (st.phase === 'play') skorCiz();
        }
      },
      onError: () => { /* bağlantı koptu — oyun yerel devam eder */ }
    });
  }

  function kopyala(t) {
    try {
      navigator.clipboard?.writeText(t);
      toast('Kod kopyalandı: ' + t);
    } catch (e) { toast('Kod: ' + t); }
    api.sfx('tap');
  }

  function exit(yerelDuelle) {
    if (st.stream?.close) { try { st.stream.close(); } catch (e) {} }
    st.destroyed = true;
    onExit?.(yerelDuelle ? 'local' : null);
  }

  return {
    start() { render(); },
    destroy() { st.destroyed = true; try { st.stream?.close(); } catch (e) {} }
  };
}
