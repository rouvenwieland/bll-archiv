// Leuchtende Bahnen über Abbildung 3 (Dämon, flaches Universum):
// eine Trajektorie entsteht, dann fächert sie sich in mehrere gleichwertige
// Verläufe auf – „eine Theorie, mehrere Modelle“ (Abschnitt 4.6).
import { $ } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
// Stützpunkte in Bildkoordinaten (viewBox 1000 × 586): von der Hand des Dämons
// über die Galaxien der Scheibe.
const BASE = [
  [575, 246], [566, 292], [536, 334], [470, 318], [440, 290], [392, 318], [350, 356],
  [290, 334], [236, 300], [176, 322], [152, 358], [176, 404], [214, 424], [300, 440],
  [400, 438], [476, 424], [548, 404], [604, 390],
];
const FAN = [
  { off: -2, c: 'var(--c-quellen)' },
  { off: -1, c: 'var(--c-glossar)' },
  { off: 1, c: 'var(--c-prompts)' },
  { off: 2, c: 'var(--c-praemissen)' },
];
const SPREAD = 19;

function normals(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
}
// Catmull-Rom → kubische Bézier
function pathD(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function initTrajectories() {
  const svg = $('[data-traj]');
  const noop = { setDraw() {}, setFan() {}, complete() {}, el: null };
  if (!svg) return noop;
  const N = normals(BASE);
  const n = BASE.length;
  const shifted = (k, f) => BASE.map((p, i) => {
    const w = Math.pow(i / (n - 1), 0.85) * SPREAD * k * f;
    return [p[0] + N[i][0] * w, p[1] + N[i][1] * w];
  });

  const gFan = el('g', { class: 'traj__fan' });
  const fans = FAN.map((f) => {
    const g = el('g', { class: 'traj__model', style: `--c:${f.c}` });
    const glow = el('path', { class: 'traj__glow', pathLength: '1' });
    const core = el('path', { class: 'traj__core', pathLength: '1' });
    const end = el('circle', { class: 'traj__end', r: '3.2' });
    g.append(glow, core, end);
    gFan.appendChild(g);
    return { ...f, g, glow, core, end };
  });
  const gMain = el('g', { class: 'traj__main' });
  const mGlow = el('path', { class: 'traj__glow', pathLength: '1', d: pathD(BASE) });
  const mCore = el('path', { class: 'traj__core', pathLength: '1', d: pathD(BASE) });
  const halo = el('circle', { class: 'traj__halo', r: '11' });
  const dot = el('circle', { class: 'traj__dot', r: '3.6' });
  const start = el('circle', { class: 'traj__start', r: '4', cx: BASE[0][0], cy: BASE[0][1] });
  gMain.append(mGlow, mCore, halo, dot, start);
  svg.append(gFan, gMain);

  let len = 0;
  try { len = mCore.getTotalLength(); } catch (_) { len = 0; }

  function setDraw(p) {
    const t = Math.max(0, Math.min(1, p));
    const off = String(1 - t);
    mGlow.style.strokeDashoffset = off;
    mCore.style.strokeDashoffset = off;
    let pt = { x: BASE[0][0], y: BASE[0][1] };
    if (len) { try { pt = mCore.getPointAtLength(len * t); } catch (_) { /* egal */ } }
    dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
    halo.setAttribute('cx', pt.x); halo.setAttribute('cy', pt.y);
    const vis = t > 0.002 && t < 0.998 ? '1' : '0';
    dot.style.opacity = vis; halo.style.opacity = vis;
    start.style.opacity = t > 0 ? '1' : '0';
  }
  let lastF = -1;
  function setFan(f) {
    const t = Math.max(0, Math.min(1, f));
    if (Math.abs(t - lastF) < 0.002) return;
    lastF = t;
    const e = 1 - Math.pow(1 - t, 3);
    for (const m of fans) {
      const pts = shifted(m.off, e);
      const d = pathD(pts);
      m.glow.setAttribute('d', d);
      m.core.setAttribute('d', d);
      const last = pts[pts.length - 1];
      m.end.setAttribute('cx', last[0].toFixed(1));
      m.end.setAttribute('cy', last[1].toFixed(1));
      m.g.style.opacity = String(Math.min(1, t * 1.6));
    }
    svg.classList.toggle('is-fanned', t > 0.95);
  }
  function complete() { setDraw(1); setFan(1); }

  setDraw(0);
  setFan(0);
  return { setDraw, setFan, complete, el: svg };
}
