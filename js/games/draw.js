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

  const btnClear = el('button', { class: 'btn ghost sm', text: '🧽 Sil', onClick: () => { api.sfx('tap'); state.strokes = []; redraw(); } });
  const btnHint = el('button', { class: 'btn ghost sm', text: '💡 İpucu', onClick: () => { api.sfx('tap'); api.speak(state.cur ? hintText(state.cur.id) : ''); toast(hintText(state.cur?.id || 'kare')); } });
  const btnSkip = el('button', { class: 'btn ghost sm', text: '⏭️ Bunu geç', onClick: () => { api.sfx('tap'); failShape('geçildi'); } });
  const btnRow = el('div', { class: 'btn-row', style: { justifyContent: 'center' } }, btnClear, btnHint, btnSkip);

  root.append(bar, nameEl, stage, btnRow);

  let ctx = null, W = 0, H = 0, dpr = 1;

  function hintText(id) {
    if (id === 'daire') return 'Daireyi yuvarlak çiz, köşe yapma.';
    if (id === 'kare') return 'Dört eşit kenar çiz ve köşeleri birleştir.';
    if (id === 'dikdortgen') return 'İki uzun, iki kısa kenar çiz.';
    if (id === 'ucgen') return 'Üç kenarı birleştir, üç köşe olsun.';
    return 'Noktaları sırayla birleştir.';
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
      // başlangıç noktası
      const s = o.pts[0];
      ctx.beginPath();
      ctx.arc(s[0], s[1], 11, 0, Math.PI * 2);
      ctx.fillStyle = '#58cf6a';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#23324d';
      ctx.stroke();
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

    if (state.coverage >= cfg.pass) successShape();
    else if (state.coverage >= cfg.pass * 0.75) api.speak('Çok yakın, biraz daha devam et.');
    else api.speak('Şeklin üzerinden geç.');
  }

  function successShape() {
    if (state.done) return;
    state.correct++;
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
    progEl.textContent = `Şekil ${state.i + 1} / ${cfg.shapes.length}`;
    const s = SHAPES[id];
    nameEl.innerHTML = `<span class="q-mark">${s.name}</span> çiz — ${s.prompt}`;
    hintPill.textContent = `Kenar: ${s.sides === 0 ? 'yok' : s.sides} · Köşe: ${s.corners === 0 ? 'yok' : s.corners}`;
    buildTarget();
    redraw();
    api.speak(`${s.name} çiz. ${hintText(id)}`);
  }

  function finish(completed) {
    if (state.done) return;
    state.done = true;
    api.finish({ correct: state.correct, wrong: state.wrong, completed, total: cfg.shapes.length });
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
