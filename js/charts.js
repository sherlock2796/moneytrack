// Grafici SVG: anello per categoria, barre mensili
import { esc, money, num } from './format.js';

// slices: [{id, value, color}] — ritorna markup svg (senza centro)
export function donutSVG(slices, { size = 300, thickness = 34 } = {}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  let acc = 0, parts = '';
  if (total <= 0) {
    parts = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${thickness}"/>`;
  } else {
    for (const s of slices) {
      if (s.value <= 0) continue;
      const frac = s.value / total;
      const len = frac * C; const gap = slices.length > 1 ? Math.min(3, len * 0.1) : 0;
      const offset = C * 0.25 - acc * C; // parte dalle 12
      parts += `<circle class="donut-slice" data-cat="${esc(s.id)}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${esc(s.color)}" stroke-width="${thickness}"
        stroke-dasharray="${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}" stroke-dashoffset="${offset}"><title>${esc(s.title || '')}</title></circle>`;
      acc += frac;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}">${parts}</svg>`;
}

// posizioni delle bolle-categoria attorno all'anello (percentuali del contenitore)
export function ringPositions(n, radiusPct = 50) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i / n) * 2 * Math.PI;
    out.push({ x: 50 + radiusPct * Math.cos(ang), y: 50 + radiusPct * Math.sin(ang) });
  }
  return out;
}

// bars: [{label, values:[{v,color}]}] — barre raggruppate
export function barsSVG(groups, { width = 640, height = 220, fmt = (v) => num(v, 0) } = {}) {
  const padL = 44, padR = 8, padT = 14, padB = 26;
  const W = width - padL - padR, H = height - padT - padB;
  const max = Math.max(1, ...groups.flatMap(g => g.values.map(v => v.v)));
  const nice = niceMax(max);
  const gw = W / groups.length;
  let s = `<svg class="chart" viewBox="0 0 ${width} ${height}" font-size="11" font-family="inherit">`;
  // griglia
  for (let i = 0; i <= 4; i++) {
    const y = padT + H - (H * i) / 4;
    s += `<line x1="${padL}" x2="${width - padR}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`;
    s += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="var(--text-2)">${esc(fmt((nice * i) / 4))}</text>`;
  }
  groups.forEach((g, gi) => {
    const n = g.values.length; const bw = Math.min(22, (gw - 8) / n);
    const x0 = padL + gi * gw + (gw - bw * n) / 2;
    g.values.forEach((v, vi) => {
      const h = (v.v / nice) * H; const x = x0 + vi * bw, y = padT + H - h;
      s += `<rect x="${x}" y="${y}" width="${bw - 2}" height="${h}" rx="3" fill="${esc(v.color)}"><title>${esc(g.label)}: ${esc(money(v.v))}</title></rect>`;
    });
    s += `<text x="${padL + gi * gw + gw / 2}" y="${height - 8}" text-anchor="middle" fill="var(--text-2)">${esc(g.label)}</text>`;
  });
  return s + '</svg>';
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return n * p;
}
