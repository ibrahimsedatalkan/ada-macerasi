/* ============================================================
   draw.js — Sihirli Kalem: kesikli hedef şeklin üzerinden geç
   Dokunmatik ve fare ile çalışır. Kapsama oranına göre başarı.
   ============================================================ */

import { el, clear, toast } from '../ui.js';
import { shapeOutline, SHAPES } from '../shapes.js';

export function createDrawGame({ root, level, api }) {
  const cfg = Object.assign({ shapes: ['kare'], tol: 26, pass: 0.72, maxTries: 3 }, level.cfg);
  const state = { i: 0, correct: 0, wrong: 0, tries: 0, drawing: false, cur: null, strokes: [], coverage: 0, samples: [], done: false };

  const bar = el('div', { class: 'game-bar' });
  const progEl = el('div', { class: 'hint-pill', text: 'Şekil 1 / ' + cfg.shapes.length });
  const hintPill = el('div', { class: 'hint-pill', text: '' });
  const covEl = el('div', { class: 'hint-pill', text: 'Kapsama: %0' });
  bar.append(progEl, el('div', { class: 'grow' }), hintPill, covEl);

  const canvas = el('canvas');
  const stage = el('div', { class: 'draw-stage', style: { height: 'clamp(280px, 54vh, 520px)' } }, canvas);
  const nameEl = el('div', { class: 'question', style: { fontSize: 'clamp(20px, 3.6vw, 32px)' } });
  // Sürekli görünen "nasıl çizilir" satırı — çocuk her an görebilsin
  const howEl = el('div', { class: 'how-to' });

  const btnClear = el('button', { class: 'btn ghost sm', text: '🧽 Sil', onClick: () => { api.sfx('tap'); state.strokes = []; redraw(); } });
  const btnWatch = el('button', { class: 'btn sm blue', text: '👀 Nasıl çizilir?', onClick: () => { api.sfx('tap'); playDemo(); } });
  const btnHint = el('button', { class: 'btn ghost sm', text: '💡 İpucu', onClick: () => { api.sfx('tap'); api.speak(state.cur ? hintText(state.cur.id) : ''); toast(hintText(state.cur?.id || 'kare')); } });
  const btnSkip = el('button', { class: 'btn ghost sm', text: '⏭️ Bunu geç', onClick: () => { api.sfx('tap'); failShape('geçildi'); } });
  const btnRow = el('div', { class: 'btn-row', style: { justifyContent: 'center' } }, btnWatch, btnClear, btnHint, btnSkip);

  root.append(bar, nameEl, howEl, stage, btnRow);

  let ctx = null, W = 0, H = 0, dpr = 1;

  /** Şekil bazlı çizim yönergesi — "nasıl çizilir" (2. sınıf dili) */
  function hintText(id) {
    const H = {
      kare: '1 numaradan başla. Sağa düz git, sonra aşağı, sonra sola, en son yukarı — başladığın yere dön. Dört kenar eşit olmalı.',
      dikdortgen: '1 numaradan başla. Önce uzun kenarı çiz, sonra kısa kenarı. Karşılıklı kenarlar birbirine eşit olacak.',
      ucgen: '1 numaradan başla, 2 numaraya düz git. Sonra 3 numaraya, en son 1 numaraya geri dön. Üç kenar birleşince üçgen olur.',
      daire: '1 numaradan başla ve saat yönünde yuvarlak çiz. Köşe yapma, elin hiç durmasın. Başladığın yere gelince daire tamam.',
      besgen: 'Beş kenar var. Numaraları sırayla takip et: 1 → 2 → 3 → 4 → 5 → 1. Her kenarı düz çiz.',
      altigen: 'Altı kenar var. Numaraları sırayla takip et: 1 → 2 → 3 → 4 → 5 → 6 → 1. Düz git, acele etme.'
    };
    return H[id] || 'Numaraları sırayla birleştir. Kenarları düz çiz.';
  }

  /** Kısa "nasıl" satırı — ekranda sürekli görünür */
  function howTo(id) {
    if (id === 'daire') return 'Saat yönünde yuvarlak çiz, köşe yapma.';
    if (id === 'kare') return 'Sağa → aşağı → sola → yukarı. 4 eşit kenar.';
    if (id === 'dikdortgen') return 'Uzun kenar → kısa kenar. Karşılıklılar eşit.';
    if (id === 'ucgen') return '1 → 2 → 3 → 1. Üç kenar birleşir.';
    if (id === 'besgen') return '1 → 2 → 3 → 4 → 5 → 1. Beş kenar.';
    if (id === 'altigen') return '1 → 2 → 3 → 4 → 5 → 6 → 1. Altı kenar.';
    return 'Numaraları sırayla birleştir.';
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // clientWidth/Height kenarlıkları hariç tutar → tuval taşmaz
    W = Math.max(200, stage.clientWidth || rect.width - 6);
    H = Math.max(200, stage.clientHeight || rect.height - 6);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildTarget();
    redraw();
  }

  function buildTarget() {
    if (!state.cur) return;
    const size = Math.min(W, H) * 0.94;
    state.outline = shapeOutline(state.cur.id, { size, cx: W / 2, cy: H / 2 });
    state.samples = sampleOutline(state.outline);
  }

  function sampleOutline(o) {
    const pts = [];
    if (o.kind === 'circle') {
      for (let i = 0; i < 180; i++) {
        const a = (i / 180) * Math.PI * 2;
        pts.push([o.cx + o.r * Math.cos(a), o.cy + o.r * Math.sin(a)]);
      }
      return pts;
    }
    const p = o.pts;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(2, Math.round(d / 5));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return pts;
  }

  function redraw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const o = state.outline;
    if (!o) return;

    drawDotGrid(o);

    // Hedef: kesikli çizgi + köşe noktaları
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#9db4d6';
    ctx.lineCap = 'round';
    if (o.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(o.cx, o.cy, o.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      o.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    if (o.kind !== 'circle') {
      for (const p of o.pts) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 7, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#23324d';
        ctx.stroke();
      }
      drawDrawOrder(o);
    } else {
      drawCircleGuide(o);
    }

    // Kullanıcı çizimi
    const good = state.coverage >= cfg.pass;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = good ? '#34a94a' : '#ff9a3d';
    for (const stroke of state.strokes) {
      if (stroke.length < 2) {
        ctx.beginPath();
        ctx.arc(stroke[0][0], stroke[0][1], 4.5, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      stroke.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
  }

  /**
   * Noktalı kâğıt zemini — 2. sınıfta düz çizgi çizmeyi öğrenirken
   * kullanılan yöntemin ekran karşılığı. Çocuk noktalara bakarak
   * düz gidebilir.
   */
  function drawDotGrid(o) {
    const adim = Math.max(26, Math.min(W, H) / 14);
    ctx.save();
    ctx.fillStyle = 'rgba(35,50,77,.16)';
    for (let x = adim / 2; x < W; x += adim) {
      for (let y = adim / 2; y < H; y += adim) {
        // Şeklin çizgisi üzerindeki noktaları atla (görsel kirlilik olmasın)
        ctx.beginPath();
        ctx.arc(x, y, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Çizim sırası: her köşeye NUMARA koy ve ok yönünü göster.
   * "Nereden başlayıp hangi yöne gideceğim?" sorusunu cevaplar.
   */
  function drawDrawOrder(o) {
    const pts = o.pts;
    // Kenar orta noktalarına yön okları
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      drawArrow(mx, my, ang, i === 0);
    }
    // Köşe numaraları
    pts.forEach((p, i) => {
      const off = 26;
      const cxm = pts.reduce((s, q) => s + q[0], 0) / pts.length;
      const cym = pts.reduce((s, q) => s + q[1], 0) / pts.length;
      const dx = p[0] - cxm, dy = p[1] - cym;
      const L = Math.hypot(dx, dy) || 1;
      const lx = p[0] + (dx / L) * off * 0.9;
      const ly = p[1] + (dy / L) * off * 0.9;
      ctx.beginPath();
      ctx.arc(lx, ly, 13, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#58cf6a' : '#ffd23d';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#23324d';
      ctx.stroke();
      ctx.fillStyle = '#23324d';
      ctx.font = '800 14px Fredoka, Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), lx, ly + 1);
    });
  }

  /** Kenarın ortasına yön oku — hangi tarafa çizileceğini gösterir */
  function drawArrow(x, y, ang, vurgu) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-11, -8);
    ctx.lineTo(6, 0);
    ctx.lineTo(-11, 8);
    ctx.closePath();
    ctx.fillStyle = vurgu ? 'rgba(88,207,106,.95)' : 'rgba(61,189,255,.9)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(35,50,77,.85)';
    ctx.stroke();
    ctx.restore();
  }

  /** Daire: saat yönünde oklar (tek yön, köşe yok) */
  function drawCircleGuide(o) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = o.cx + o.r * Math.cos(a);
      const y = o.cy + o.r * Math.sin(a);
      drawArrow(x, y, a + Math.PI / 2, i === 0);
    }
    ctx.beginPath();
    ctx.arc(o.cx, o.cy, o.r, 0, Math.PI * 2);
    ctx.arc(o.cx, o.cy, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#58cf6a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#23324d';
    ctx.stroke();
    ctx.fillStyle = '#23324d';
    ctx.font = '800 13px Fredoka, Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', o.cx + o.r, o.cy + 1);
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function onDown(e) {
    if (state.done || !state.cur) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    state.drawing = true;
    state.strokes.push([pos(e)]);
    redraw();
  }
  function onMove(e) {
    if (!state.drawing) return;
    e.preventDefault();
    const stroke = state.strokes[state.strokes.length - 1];
    const p = pos(e);
    const last = stroke[stroke.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 4) return;
    stroke.push(p);
    redraw();
    // CANLI geri bildirim: parmağını kaldırmadan ilerlemeyi görsün
    state.moveTick = (state.moveTick || 0) + 1;
    if (state.moveTick % 7 === 0) liveCoverage();
  }

  /** Çizerken kapsama oranını güncelle — çocuk anında görsün */
  function liveCoverage() {
    const tol = cfg.tol;
    const userPts = state.strokes.flat();
    if (!userPts.length || !state.samples.length) return;
    let covered = 0;
    for (const t of state.samples) {
      let best = Infinity;
      for (const u of userPts) {
        const d = Math.abs(u[0] - t[0]) + Math.abs(u[1] - t[1]);
        if (d < best) best = d;
        if (best < tol) break;
      }
      if (best < tol * 1.35) covered++;
    }
    state.coverage = covered / state.samples.length;
    covEl.textContent = 'Kapsama: %' + Math.round(state.coverage * 100);
    covEl.classList.toggle('good', state.coverage >= cfg.pass);
    // Şeklin rengi canlı değişsin (yeşile dönerse doğru gidiyor)
    redrawUser();
  }

  /** Yalnızca kullanıcı çizimini yeniden boya (hızlı, tüm tuvali silmez) */
  function redrawUser() {
    if (!ctx) return;
    redraw();   // basit ve güvenli: tüm sahne yeniden çizilir
  }
  function onUp() {
    if (!state.drawing) return;
    state.drawing = false;
    evaluate();
  }

  function evaluate() {
    const tol = cfg.tol;
    const userPts = state.strokes.flat();
    if (!userPts.length) return;
    let covered = 0;
    for (const t of state.samples) {
      let best = Infinity;
      for (const u of userPts) {
        const d = Math.abs(u[0] - t[0]) + Math.abs(u[1] - t[1]);
        if (d < best) best = d;
        if (best < tol) break;
      }
      if (best < tol * 1.35) covered++;
    }
    state.coverage = covered / state.samples.length;

    // Kalem hedeften çok mu saptı?
    let stray = 0;
    for (const u of userPts) {
      let best = Infinity;
      for (const t of state.samples) {
        const d = Math.hypot(u[0] - t[0], u[1] - t[1]);
        if (d < best) best = d;
        if (best < tol * 2) break;
      }
      if (best > tol * 2.4) stray++;
    }
    const neat = 1 - stray / Math.max(1, userPts.length);

    covEl.textContent = 'Kapsama: %' + Math.round(state.coverage * 100);
    redraw();

    // Yolculuk şeridi: çizim ilerledikçe karakter hedefe yaklaşır
    api.journeyProgress?.((state.i + state.coverage) / cfg.shapes.length);

    if (state.coverage >= cfg.pass) successShape();
    else if (state.coverage >= cfg.pass * 0.75) api.speak('Çok yakın, biraz daha devam et.');
    else api.speak('Şeklin üzerinden geç.');
  }

  function successShape() {
    if (state.done) return;
    state.correct++;
    api.journeyProgress?.((state.i + 1) / cfg.shapes.length);
    api.recordAnswer({ correct: true, shape: state.cur.id });
    api.sfx('unlock');
    api.confetti({ count: 70, duration: 1600 });
    api.speak('Harika, çizdin!');
    setTimeout(nextShape, 1100);
  }

  function failShape(reason) {
    state.tries++;
    if (state.tries < cfg.maxTries && reason !== 'geçildi') {
      api.speak('Tekrar dene, noktaları takip et.');
      api.toast('Tekrar dene!');
      state.strokes = [];
      state.coverage = 0;
      redraw();
      return;
    }
    state.wrong++;
    api.recordAnswer({ correct: false, shape: state.cur.id });
    api.sfx('wrong');
    setTimeout(nextShape, 700);
  }

  function nextShape() {
    state.i++;
    state.tries = 0;
    state.coverage = 0;
    if (state.i >= cfg.shapes.length) return finish(true);
    loadShape();
  }

  function loadShape() {
    const id = cfg.shapes[state.i];
    state.cur = { id };
    state.strokes = [];
    state.coverage = 0;
    state.moveTick = 0;
    progEl.textContent = `Şekil ${state.i + 1} / ${cfg.shapes.length}`;
    const s = SHAPES[id];
    nameEl.innerHTML = `<span class="q-mark">${s.name}</span> çiz — ${s.prompt}`;
    howEl.textContent = '👉 ' + howTo(id);
    hintPill.textContent = `Kenar: ${s.sides === 0 ? 'yok' : s.sides} · Köşe: ${s.corners === 0 ? 'yok' : s.corners}`;
    covEl.textContent = 'Kapsama: %0';
    covEl.classList.remove('good');
    buildTarget();
    redraw();
    api.speak(`${s.name} çiz. ${howTo(id)}`);
    // İlk kez gelen şekilde çizimi otomatik göster
    if (!state.seen) state.seen = {};
    if (!state.seen[id]) { state.seen[id] = true; setTimeout(() => { if (!state.done) playDemo(); }, 900); }
  }

  /**
   * "Nasıl çizilir?" demosu — kalem şeklin çevresini canlı çizer,
   * çocuk nereden başlayıp hangi yöne gideceğini GÖRÜR.
   */
  function playDemo() {
    if (!state.samples.length || state.demo) return;
    state.demo = true;
    const pts = state.samples;
    const sure = 2400;                       // ms
    const t0 = performance.now();
    let idx = 0;
    const cizm = () => {
      if (state.done) { state.demo = false; return; }
      const gecen = performance.now() - t0;
      idx = Math.min(pts.length - 1, Math.floor((gecen / sure) * pts.length));
      redraw();
      // Demo izini çiz (yeşil kalın çizgi)
      ctx.save();
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(88,207,106,.85)';
      ctx.beginPath();
      for (let i = 0; i <= idx; i++) {
        const p = pts[i];
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
      // Kalem ucu
      const u = pts[idx];
      ctx.beginPath();
      ctx.arc(u[0], u[1], 12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd23d';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#23324d';
      ctx.stroke();
      ctx.restore();

      if (gecen < sure) requestAnimationFrame(cizm);
      else {
        state.demo = false;
        redraw();
        api.speak('Şimdi sıra sende! Aynı şekilde çiz.');
      }
    };
    api.sfx('step');
    requestAnimationFrame(cizm);
  }

  function finish(completed) {
    if (state.done) return;
    state.done = true;
    api.finish({ correct: state.correct, wrong: state.wrong, completed, rounds: cfg.shapes.length, hintsUsed: state.hintsUsed || 0, total: cfg.shapes.length });
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointerleave', onUp);
  canvas.addEventListener('pointercancel', onUp);
  window.addEventListener('resize', resize);

  return {
    start() {
      state.i = 0; state.correct = 0; state.wrong = 0; state.done = false;
      requestAnimationFrame(() => { resize(); loadShape(); });
    },
    destroy() {
      state.done = true;
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    }
  };
}
