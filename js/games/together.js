/* ============================================================
   together.js — BİRLİKTE OYNA (veli + çocuk)

   PEDAGOJİK GEREKÇE
   -----------------
   Erken çocuklukta matematik başarısını en çok artıran etkenlerden
   biri VELİ KATILIMIDIR. Ancak velinin en sık yaptığı hata cevabı
   söylemektir; bu öğrenmeyi durdurur (çocuk "öğrenilmiş çaresizlik"
   geliştirir, kendi başına düşünmeyi bırakır).

   Bu mod veliyi İYİ BİR ÖĞRETİCİ yapar:
     • Veliye o an NE SORACAĞINI söyler ("Cevabı söylemeyin, sorun:")
     • Yanlışta nasıl yönlendireceğini gösterir (ipucu merdiveni)
     • Sıra değişimli: veli model olur, çocuk dener, birlikte kutlarlar
     • Süre YOK, can YOK — amaç hız değil anlama

   Kademeli sorumluluk aktarımı ("ben yaparım → birlikte yaparız →
   sen yaparsın") bu modun temelidir.
   ============================================================ */

import { el, clear, starsEl, elemandanPatlama, komboYazisi } from '../ui.js';
import { makeMultiplyQuestion, makeAddQuestion, questionSpeech, questionSpeechParts, sayiMetni } from './questions.js';
import { techniqueFor } from './hints.js';
import { resetSpeech } from '../audio.js';
import { muzikYogunluk } from '../music.js';
import { titretDogru } from '../his.js';

/* ---------------- Veli için konuşma kılavuzu ----------------
   Her soru tipi için: ne sorulacak, yanlışta nasıl yönlendirilecek.
   Kural: İLK cümle asla cevabı söylemez. */
function veliKilavuzu(q) {
  if (q.kind === 'multiply') {
    const a = q.table, b = q.b;
    const teknik = [
      `Cevabı söylemeyin. Önce sorun: "Bunu nasıl bulabilirsin?"`,
      `Bekleyin — 10 saniye sessiz kalın. Düşünmesi için zaman tanıyın.`,
      `Gerekirse ipucu verin: "${a} kere ${a}'yi biliyor musun? Oradan sayabilir misin?"`
    ];
    if (a === 9) teknik.push('Dokuzlar kolay: "10 kere ' + b + ' kaç eder? Şimdi bir tane ' + b + ' çıkar."');
    else if (a === 4) teknik.push('Dörtler için: "Önce 2 ile çarp, sonucu bir daha 2 ile çarp."');
    else if (a === 6) teknik.push('Altılar için: "5 kere ' + b + ' artı 1 kere ' + b + '."');
    else if (a === 8) teknik.push('Sekizler için: "İki kez ikiye katla: 2 → 4 → 8."');
    else if (a === 7) teknik.push('Yediler zordur: "5 kere ' + b + ' artı 2 kere ' + b + '."');
    else if (a === 5) teknik.push('Beşler için: "Beşer beşer say." Sonuç 0 ya da 5 ile biter.');
    else if (a === 3) teknik.push('Üçler için: "Üçer üçer say: 3, 6, 9, 12..."');
    else if (a === 2) teknik.push('İkiler için: "Aynı sayıyı kendisiyle topla."');
    return { baslik: 'Nasıl yardım edeyim?', adimlar: teknik };
  }
  if (q.kind === 'addsub') {
    const toplama = q.mode === 'add';
    return {
      baslik: 'Nasıl yardım edeyim?',
      adimlar: [
        'Cevabı söylemeyin. Önce sorun: "Sence kaç olabilir? Tahmin et."',
        toplama
          ? 'Sonra: "Önce birlikleri toplasak? Sonra onlukları?"'
          : 'Sonra: "Önce birlikleri çıkarabilir misin? 10\'u geçiyor mu, bozmamız gerekir mi?"',
        'Parmakla ya da nesneyle göstermesini isteyin (kalem, lego, nohut).',
        'Doğruysa: "Nasıl buldun? Anlat bakalım." — anlatmak öğrenmeyi pekiştirir.'
      ]
    };
  }
  if (q.kind === 'sides') {
    return {
      baslik: 'Nasıl yardım edeyim?',
      adimlar: [
        'Cevabı söylemeyin. Sorun: "Parmağınla kenarları sayar mısın?"',
        'Birlikte sayın ama ÇOCUĞUN parmağı saysın, sizinki değil.',
        'Çevresindeki eşyaları gösterin: "Şu kitabın kapağı hangi şekil?"'
      ]
    };
  }
  return { baslik: 'Nasıl yardım edeyim?', adimlar: ['Cevabı söylemeyin — bekleyin ve dinleyin.'] };
}

/** Veliye çocuğun cevabı sonrası geri bildirim */
function veliGeriBildirim(dogru, q) {
  if (dogru) {
    const t = techniqueFor(q);
    return {
      baslik: '✅ Doğru! Şimdi ne yapmalı?',
      adimlar: [
        'Şunu sorun: "Nasıl buldun? Bana anlat." — Anlatmak öğrenmeyi kalıcı yapar.',
        t ? `Kullandığı yöntemi adlandırın: "${t.name}". Adlandırmak farkındalık yaratır.` : 'Yöntemini birlikte adlandırın.',
        'Kutlayın: "Bunu kendi başına buldun!" — Övgü ÇABAYA olsun, zekâya değil.'
      ]
    };
  }
  return {
    baslik: '🤝 Birlikte çözelim',
    adimlar: [
      'Paniklemeyin, "yanlış" demeyin. Şunu söyleyin: "Birlikte bakalım."',
      'Kolaylaştırın: "Önce şunu halledelim: 5 kere ' + (q.b || 2) + ' kaç eder?"',
      'Sonra parçalayın: "Peki 2 kere ' + (q.b || 2) + '? İkisini toplayalım."',
      'Cevabı yine siz söylemeyin — çocuk toplasın.'
    ]
  };
}

export function createTogetherGame({ root, level, api }) {
  const cfg = level.cfg || {};
  const tur = cfg.turns || 6;                 // toplam tur (çocuk + veli)
  const state = { i: 0, cur: null, sira: 'cocuk', correct: 0, wrong: 0, bekliyor: false, destroyed: false };
  let klavuzEl, soruEl, answersEl, barEl, adimEl;

  /* Soru üret — birlikte modda zorluk düşük tutulur (amaç anlama) */
  function soruUret(veliSirasi) {
    const tables = cfg.tables || [2, 3, 4, 5];
    const t = tables[Math.floor(Math.random() * tables.length)];
    // Veli sırasında ÇOK kolay soru (model olmak için), çocukta normal
    const b = veliSirasi ? 1 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 9);
    if (cfg.mod === 'addsub' || cfg.kind === 'addsub') {
      return makeAddQuestion({ max: 20, carry: false, mode: cfg.mode === 'sub' ? 'sub' : 'add' });
    }
    return makeMultiplyQuestion({ tables: [t], b, mode: 'result' });
  }

  function kur() {
    clear(root);
    root.append(el('div', { class: 'together-wrap' },
      el('div', { class: 'tg-ust' },
        el('div', { class: 'tg-baslik' }, el('span', { text: '🤝 Birlikte Oyna' })),
        el('div', { class: 'tg-kural', text: 'Süre yok · Can yok · Amaç anlamak' })
      ),
      (barEl = el('div', { class: 'tg-bar' })),
      (soruEl = el('div', { class: 'tg-soru' })),
      (answersEl = el('div', { class: 'answers tg-answers' })),
      (klavuzEl = el('div', { class: 'tg-klavuz' })),
      el('div', { class: 'tg-alt' },
        el('button', { class: 'btn ghost sm', text: '⏭️ Atla', onClick: () => sonraki() }),
        el('button', { class: 'btn ghost sm', text: '👨‍👩‍👦 Bitir', onClick: () => bitir(false) })
      )
    ));
  }

  function kilavuzCiz(kilavuz, ton = '') {
    clear(klavuzEl);
    klavuzEl.className = 'tg-klavuz' + (ton ? ' ' + ton : '');
    klavuzEl.append(
      el('div', { class: 'tg-k-baslik', text: kilavuz.baslik }),
      ...kilavuz.adimlar.map((a, i) => el('div', { class: 'tg-k-adim' },
        el('span', { class: 'tg-k-no', text: String(i + 1) }), el('span', { text: a })))
    );
  }

  function soruCiz() {
    const veliSirasi = state.sira === 'veli';
    const q = state.cur = soruUret(veliSirasi);
    state.bekliyor = false;

    soruEl.innerHTML = '';
    soruEl.append(
      el('div', { class: 'tg-sira ' + (veliSirasi ? 'veli' : 'cocuk'),
        text: veliSirasi ? '👨‍👩‍👦 VELİ SIRASI — siz gösterin' : '🧒 ÇOCUK SIRASI — o bulsun' }),
      el('div', { class: 'tg-soru-metin', text: q.prompt || (q.a + ' ' + (q.mode === 'sub' ? '−' : '+') + ' ' + q.b + ' = ?') })
    );

    // Şıklar
    clear(answersEl);
    const secenekler = q.options && q.options.length ? q.options
      : [q.answer, q.answer + 1, Math.max(1, q.answer - 1), q.answer + 2];
    [...new Set(secenekler)].slice(0, 4).sort((a, b) => a - b).forEach((opt) => {
      const btn = el('button', { class: 'answer-btn', text: String(opt) });
      btn.addEventListener('click', () => cevapla(opt, btn));
      answersEl.append(btn);
    });

    // Veli kılavuzu
    kilavuzCiz(veliKilavuzu(q));

    // Sıra bilgisi
    clear(barEl);
    barEl.append(el('div', { class: 'tg-tur', text: `Tur ${state.i + 1} / ${tur}` }));

    // Sesli okuma (doğal ses)
    resetSpeech();
    const parcalar = questionSpeechParts(q);
    if (parcalar && api.speakSeq) api.speakSeq(parcalar);
    else api.speak(questionSpeech(q), { force: true, key: 'tg' + state.i });
  }

  function cevapla(secim, btn) {
    if (state.bekliyor || state.destroyed) return;
    state.bekliyor = true;
    const q = state.cur;
    const dogru = Number(secim) === Number(q.answer);
    const veliSirasi = state.sira === 'veli';

    [...answersEl.children].forEach((b) => {
      const v = Number(b.textContent);
      if (v === Number(q.answer)) b.classList.add('dogru');
      else if (b === btn) b.classList.add('yanlis');
      b.disabled = true;
    });

    if (dogru) {
      state.correct++;
      api.sfx('correct');
      elemandanPatlama(btn, { adet: 16 });
      titretDogru();
      if (!veliSirasi) {
        // Çocuk doğru yaptı: veliye "anlattır" adımı
        kilavuzCiz(veliGeriBildirim(true, q), 'iyi');
      } else {
        kilavuzCiz({ baslik: '👨‍👩‍👦 Model oldunuz', adimlar: ['Sıra çocuğunuzda — bekleyin ve dinleyin.'] }, 'iyi');
      }
    } else {
      state.wrong++;
      api.sfx('wrong');
      kilavuzCiz(veliGeriBildirim(false, q), 'yardim');
    }

    api.recordAnswer({ correct: dogru, kind: q.kind, table: q.table, usedHint: false });
    setTimeout(() => { if (!state.destroyed) sonraki(); }, dogru ? 2000 : 3600);
  }

  function sonraki() {
    if (state.destroyed) return;
    state.i++;
    if (state.i >= tur) return bitir(true);
    // Sıra değişimi: çocuk 2 tur, veli 1 tur (model olma azalır — kademeli aktarım)
    state.sira = (state.i % 3 === 2) ? 'veli' : 'cocuk';
    soruCiz();
  }

  function bitir(tamamlandi) {
    if (state.destroyed) return;
    state.destroyed = true;
    const toplam = state.correct + state.wrong;
    api.finish({
      correct: state.correct,
      wrong: state.wrong,
      completed: !!tamamlandi && toplam > 0,
      rounds: tur,
      hintsUsed: 0,
      total: toplam
    });
  }

  return {
    start() {
      kur();
      // İlk tur: VELİ model olur (kademeli sorumluluk aktarımı — "ben yaparım")
      state.sira = 'veli';
      soruCiz();
      muzikYogunluk(1);
    },
    destroy() { state.destroyed = true; resetSpeech(); }
  };
}
