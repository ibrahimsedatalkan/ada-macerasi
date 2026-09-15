/* ============================================================
   shapes.js — 2. sınıf geometri sözlüğü + SVG üretici
   Kare, dikdörtgen, üçgen, daire (+ beşgen, altıgen uzantı)
   ============================================================ */

export const SHAPES = {
  kare: { name: 'Kare', sides: 4, corners: 4, color: '#3dbdff', deep: '#1c93d8', prompt: 'dört eşit kenar' },
  dikdortgen: { name: 'Dikdörtgen', sides: 4, corners: 4, color: '#58cf6a', deep: '#34a94a', prompt: 'karşılıklı kenarları eşit' },
  ucgen: { name: 'Üçgen', sides: 3, corners: 3, color: '#ff9a3d', deep: '#ef7f1a', prompt: 'üç kenar' },
  daire: { name: 'Daire', sides: 0, corners: 0, color: '#ff6f9c', deep: '#e04a7d', prompt: 'kenarı ve köşesi yok' },
  besgen: { name: 'Beşgen', sides: 5, corners: 5, color: '#b07cff', deep: '#8a55e0', prompt: 'beş kenar' },
  altigen: { name: 'Altıgen', sides: 6, corners: 6, color: '#ffd23d', deep: '#d9a800', prompt: 'altı kenar' }
};

export const SHAPE_IDS = Object.keys(SHAPES);

export function shapeName(id) {
  return SHAPES[id]?.name || id;
}

/** Düzgün çokgenin köşe noktaları (merkez cx,cy yarıçap r) */
export function polyPoints(n, cx, cy, r, rotateDeg = 0) {
  const out = [];
  const start = (rotateDeg - 90) * (Math.PI / 180);
  for (let i = 0; i < n; i++) {
    const a = start + (i * 2 * Math.PI) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

export function pointsToPath(pts, close = true) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + (close ? ' Z' : '');
}

/**
 * Çizilecek şeklin dış hattı — çizim oyununun hedefi.
 * Daire için {kind:'circle'} döner, çokgenler için nokta listesi.
 */
export function shapeOutline(id, { size = 320, cx = size / 2, cy = size / 2 } = {}) {
  const r = size * 0.4;
  switch (id) {
    case 'daire':
      return { kind: 'circle', cx, cy, r };
    case 'kare':
    case 'dikdortgen': {
      const w = id === 'kare' ? r * 1.7 : r * 2.1;
      const h = r * 1.7;
      return {
        kind: 'poly',
        pts: [
          [cx - w / 2, cy - h / 2],
          [cx + w / 2, cy - h / 2],
          [cx + w / 2, cy + h / 2],
          [cx - w / 2, cy + h / 2]
        ]
      };
    }
    case 'ucgen':
      return { kind: 'poly', pts: polyPoints(3, cx, cy + r * 0.1, r * 1.15, 0) };
    case 'besgen':
      return { kind: 'poly', pts: polyPoints(5, cx, cy, r * 1.05, 0) };
    case 'altigen':
      return { kind: 'poly', pts: polyPoints(6, cx, cy, r * 1.05, 0) };
    default:
      return { kind: 'poly', pts: polyPoints(4, cx, cy, r, 45) };
  }
}

/** Şekli SVG olarak döndürür (oyun içi görsel + eğitici gerçek şekil) */
export function shapeSVG(id, opts = {}) {
  const {
    size = 96, fill, stroke = '#23324d', strokeWidth = 4, dashed = false,
    className = '', opacity = 1, showDots = false
  } = opts;
  const s = SHAPES[id] || SHAPES.kare;
  const c = fill || s.color;
  const half = size / 2;
  const r = size * 0.38;
  const dash = dashed ? ' stroke-dasharray="9 8"' : '';
  let body = '';

  if (id === 'daire') {
    body = `<circle cx="${half}" cy="${half}" r="${r}" fill="${c}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash}/>`;
  } else {
    const n = id === 'kare' || id === 'dikdortgen' ? 4 : s.sides;
    let pts;
    if (id === 'kare' || id === 'dikdortgen') {
      const w = (id === 'kare' ? r * 1.75 : r * 2.15) / 2;
      const h = (r * 1.55) / 2;
      pts = [[half - w, half - h], [half + w, half - h], [half + w, half + h], [half - w, half + h]];
    } else {
      pts = polyPoints(n, half, half, r * 1.08, 0);
    }
    body = `<path d="${pointsToPath(pts)}" fill="${c}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"${dash}/>`;
    if (showDots) {
      body += pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${Math.max(3, strokeWidth * 1.2)}" fill="#fff" stroke="${stroke}" stroke-width="2"/>`).join('');
    }
  }

  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}">${body}</svg>`;
}
