// Quellen-Netz: Abschnitte der Arbeit als Sternbild auf einem Ring, Quellen
// als Sterne; jede Linie ist eine Belegstelle (zitiert_in / fundstellen).
// Canvas 2D, gezeichnet nur bei Bedarf (kein Dauer-Loop).
import { h, icon, plural, reduceMotion, canHover } from './util.js';

const C = {
  ring: 'rgba(159,183,232,0.42)',
  sec: '#e2eaff',
  src: '34,211,238',
  edge: 'rgba(34,211,238,0.17)',
  hot: 'rgba(34,211,238,0.9)',
  label: '#8a97ae',
  text: '#f2f6ff',
};

function buildModel(D) {
  const secs = [];
  const secById = new Map();
  D.kapitel.forEach((k, ci) => k.abschnitte.forEach((a) => {
    if (!a.nr) return;
    const s = { kind: 'sec', id: `s:${a.nr}`, nr: a.nr, titel: a.titel, ch: ci, chNr: k.nr, chTitel: k.titel, links: [] };
    secs.push(s);
    secById.set(a.nr, s);
  }));
  const srcs = [];
  const edges = [];
  for (const q of D.quellen) {
    const list = [...q.sections].filter((nr) => secById.has(nr));
    if (!list.length) continue;
    const s = { kind: 'src', id: `q:${q.id}`, q, links: [] };
    srcs.push(s);
    for (const nr of list) {
      const sec = secById.get(nr);
      const w = q.fundstellen.filter((f) => f.abschnitt === nr).length || 1;
      const e = { a: sec, b: s, w };
      edges.push(e);
      sec.links.push(e);
      s.links.push(e);
    }
  }
  // Ring: Abschnitte gleichmäßig, mit Lücke zwischen Kapiteln
  const GAP = 1.4;
  const nCh = D.kapitel.length;
  const slots = secs.length + GAP * nCh;
  let pos = GAP / 2, lastCh = secs[0]?.ch;
  secs.forEach((s) => {
    if (s.ch !== lastCh) { pos += GAP; lastCh = s.ch; }
    s.a = -Math.PI / 2 + (pos / slots) * Math.PI * 2;
    s.x = Math.cos(s.a); s.y = Math.sin(s.a);
    pos += 1;
  });
  const chapters = D.kapitel.map((k, ci) => {
    const list = secs.filter((s) => s.ch === ci);
    if (!list.length) return null;
    const mx = list.reduce((n, s) => n + s.x, 0), my = list.reduce((n, s) => n + s.y, 0);
    return { nr: k.nr, titel: k.titel, a: Math.atan2(my, mx), list };
  }).filter(Boolean);

  // Quellen: einfach belegte außen am Abschnitt, mehrfach belegte nach innen
  const perSec = new Map();
  srcs.forEach((s) => {
    const ls = s.links.map((e) => e.a);
    if (ls.length === 1) {
      const sec = ls[0];
      const k = perSec.get(sec.id) || 0;
      perSec.set(sec.id, k + 1);
      s.home = sec; s.k = k; s.outer = true;
    } else {
      const mx = ls.reduce((n, x) => n + x.x, 0) / ls.length, my = ls.reduce((n, x) => n + x.y, 0) / ls.length;
      const m = Math.hypot(mx, my);
      const r = 0.16 + 0.64 * m;
      const a = Math.atan2(my, mx);
      s.x = Math.cos(a) * r; s.y = Math.sin(a) * r; s.outer = false;
    }
  });
  srcs.filter((s) => s.outer).forEach((s) => {
    const n = perSec.get(s.home.id);
    const spread = 0.075;
    const a = s.home.a + (s.k - (n - 1) / 2) * spread;
    const r = 1.24 + (s.k % 2) * 0.12;
    s.x = Math.cos(a) * r; s.y = Math.sin(a) * r;
  });
  // kleine, deterministische Entzerrung
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < srcs.length; i++) {
      for (let j = i + 1; j < srcs.length; j++) {
        const A = srcs[i], B = srcs[j];
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-6;
        const min = 0.1;
        if (d < min) {
          const push = (min - d) / 2;
          A.x -= (dx / d) * push; A.y -= (dy / d) * push;
          B.x += (dx / d) * push; B.y += (dy / d) * push;
        }
      }
    }
    srcs.forEach((s) => {
      const r = Math.hypot(s.x, s.y) || 1e-6;
      const rr = s.outer ? Math.min(1.42, Math.max(1.16, r)) : Math.min(0.84, r);
      s.x *= rr / r; s.y *= rr / r;
    });
  }
  srcs.forEach((s) => { s.deg = s.links.length; });
  return { secs, srcs, edges, chapters, nodes: [...secs, ...srcs], unlinked: D.quellen.length - srcs.length };
}

export function initNet(D, root, { open } = {}) {
  if (!root || !D.kapitel.length || !D.quellen.length) { root?.remove(); return null; }
  const M = buildModel(D);
  if (!M.edges.length) { root.remove(); return null; }
  const hoverable = canHover();
  const still = reduceMotion();

  const canvas = h('canvas', {
    class: 'net__canvas', role: 'img',
    'aria-label': `Netz aus ${M.secs.length} Abschnitten und ${M.srcs.length} Quellen mit ${M.edges.length} Belegstellen. Eine Liste der Verbindungen folgt unterhalb.`,
  });
  const info = h('div', { class: 'net__info', 'aria-live': 'polite' });
  const listEl = h('details', { class: 'more net__list' },
    h('summary', null, h('span', null, 'Verbindungen als Liste'), icon('chev', 'chev')),
    h('div', { class: 'more__body' }, h('ul', { class: 'net__ul' }, M.secs.filter((s) => s.links.length).map((s) =>
      h('li', null,
        h('a', { class: 'ref', href: `#/abschnitt/${encodeURIComponent(s.nr)}` }, `${s.nr} ${s.titel}`),
        h('span', null, ': '),
        s.links.map((e, i) => [i ? ', ' : '', h('a', { class: 'ref', href: `#/quellen/${encodeURIComponent(e.b.q.id)}` }, e.b.q.label)]))))));

  root.append(
    h('div', { class: 'net__head' },
      h('h4', null, 'quellen-netz'),
      h('p', { class: 'net__stats' }, `${M.srcs.length} Quellen · ${M.secs.length} Abschnitte · ${M.edges.length} Belegstellen`)),
    h('div', { class: 'net__body' }, h('div', { class: 'net__stage' }, canvas), info),
    h('p', { class: 'net__legend' },
      h('span', { class: 'net__key net__key--sec' }, 'Abschnitt'),
      h('span', { class: 'net__key net__key--src' }, 'Quelle'),
      h('span', { class: 'net__key net__key--edge' }, 'Belegstelle'),
      M.unlinked ? h('span', null, `${plural(M.unlinked, 'weitere Quelle', 'weitere Quellen')} ohne Abschnittsbezug`) : null),
    listEl);

  const ctx = canvas.getContext('2d');
  let W = 0, Hh = 0, dpr = 1, R = 1, cx = 0, cy = 0;
  let hover = null, sel = null, t = still ? 1 : 0, introDone = still;
  const P = (n) => [cx + n.x * R, cy + n.y * R];
  const nodeR = (n) => (n.kind === 'sec' ? 2.4 : 1.8 + Math.sqrt(n.deg) * 1.25);

  // Leuchtpunkt einmal vorrendern
  const glow = document.createElement('canvas');
  glow.width = glow.height = 48;
  { const g = glow.getContext('2d'); const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, `rgba(${C.src},0.55)`); gr.addColorStop(1, `rgba(${C.src},0)`); g.fillStyle = gr; g.fillRect(0, 0, 48, 48); }

  function size() {
    const w = canvas.parentElement.clientWidth;
    if (!w) return false;
    const narrow = w < 560;
    W = w;
    Hh = Math.round(narrow ? w * 1.02 : Math.min(620, w * 0.78));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hh * dpr);
    canvas.style.height = `${Hh}px`;
    cx = W / 2; cy = Hh / 2;
    R = (Math.min(W, Hh) / 2 - (narrow ? 12 : 26)) / 1.46;
    return true;
  }

  function related(n) {
    if (!n) return null;
    const set = new Set([n]);
    n.links.forEach((e) => { set.add(e.a); set.add(e.b); });
    return set;
  }

  function draw() {
    if (!W) return;
    const focus = sel || hover;
    const rel = related(focus);
    const dim = (n) => (rel && !rel.has(n) ? 0.2 : 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hh);
    const e1 = 1 - Math.pow(1 - t, 3);

    // Kapitel-Sternbild (der Gang der Arbeit)
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.ring;
    ctx.globalAlpha = (rel ? 0.45 : 1) * e1;
    for (const ch of M.chapters) {
      ctx.beginPath();
      ch.list.forEach((s, i) => { const [x, y] = P(s); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    }
    // Kapitelnummern
    ctx.globalAlpha = e1;
    ctx.fillStyle = C.label;
    ctx.font = `500 ${R > 150 ? 11 : 10}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const ch of M.chapters) {
      const active = focus && ch.list.some((s) => rel.has(s));
      ctx.fillStyle = active ? C.text : C.label;
      ctx.fillText(`kap. ${ch.nr}`, cx + Math.cos(ch.a) * R * 0.8, cy + Math.sin(ch.a) * R * 0.8);
    }

    // Belegstellen
    for (const e of M.edges) {
      const on = rel && rel.has(e.a) && rel.has(e.b) && (e.a === focus || e.b === focus);
      const [x1, y1] = P(e.a), [x2, y2] = P(e.b);
      const k = introDone ? 1 : Math.min(1, Math.max(0, t * 1.6 - (Math.hypot(e.b.x, e.b.y) * 0.25)));
      if (k <= 0) continue;
      ctx.globalAlpha = on ? 1 : rel ? 0.35 : 1;
      ctx.strokeStyle = on ? C.hot : C.edge;
      ctx.lineWidth = on ? 1.4 : Math.min(2, 0.7 + e.w * 0.25);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k);
      ctx.stroke();
    }

    // Abschnitte
    const showNr = (2 * Math.PI * R) / (M.secs.length * 1.2) > 24;
    ctx.font = '400 9px "JetBrains Mono", ui-monospace, monospace';
    for (const s of M.secs) {
      const [x, y] = P(s);
      ctx.globalAlpha = dim(s) * e1;
      ctx.fillStyle = C.sec;
      ctx.beginPath(); ctx.arc(x, y, s === focus ? 3.6 : nodeR(s), 0, Math.PI * 2); ctx.fill();
      if (showNr || (rel && rel.has(s))) {
        ctx.fillStyle = rel && rel.has(s) ? C.text : C.label;
        ctx.globalAlpha = (rel && !rel.has(s) ? 0.35 : 1) * e1;
        ctx.fillText(s.nr, cx + s.x * R * 1.085, cy + s.y * R * 1.085);
      }
    }
    // Quellen
    for (const s of M.srcs) {
      const [x, y] = P(s);
      const r = nodeR(s);
      const a = dim(s) * Math.min(1, t * 1.4);
      ctx.globalAlpha = a * (s === focus ? 1 : 0.7);
      const g = r * (s === focus ? 6 : 4.2);
      ctx.drawImage(glow, x - g, y - g, g * 2, g * 2);
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${C.src})`;
      ctx.beginPath(); ctx.arc(x, y, s === focus ? r + 1.2 : r, 0, Math.PI * 2); ctx.fill();
    }
    // Beschriftung der hervorgehobenen Quellen
    if (rel) {
      ctx.globalAlpha = 1;
      ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      for (const s of M.srcs) {
        if (!rel.has(s)) continue;
        const [x, y] = P(s);
        const right = x >= cx;
        const txt = s.q.label;
        ctx.textAlign = right ? 'left' : 'right';
        const tx = x + (right ? 8 : -8);
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = 'rgba(8,13,24,0.78)';
        ctx.fillRect(right ? tx - 3 : tx - tw - 3, y - 8, tw + 6, 16);
        ctx.fillStyle = s === focus ? C.text : '#c7d2e5';
        ctx.fillText(txt, tx, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  function sectionChips(nrs) {
    return h('span', { class: 'chips' }, nrs.map((nr) => h('a', { class: 'chip', href: `#/abschnitt/${encodeURIComponent(nr)}` }, nr)));
  }
  function renderInfo() {
    const n = sel || hover;
    info.textContent = '';
    if (!n) {
      info.append(
        h('p', { class: 'net__hint' }, hoverable
          ? 'Mit der Maus über einen Stern fahren, um seine Belegstellen zu sehen; ein Klick öffnet den Eintrag.'
          : 'Einen Stern antippen, um seine Belegstellen zu sehen; ein zweites Antippen öffnet den Eintrag.'),
        h('p', { class: 'net__hint net__hint--sub' }, 'Außen: Quellen, die in einem Abschnitt belegt sind. Innen: Quellen, die über mehrere Abschnitte hinweg tragen.'));
      return;
    }
    if (n.kind === 'src') {
      const q = n.q;
      info.append(
        h('p', { class: 'mono-label' }, `quelle · ${q.gruppe}`),
        h('p', { class: 'net__title' }, q.label),
        q.titel ? h('p', { class: 'net__sub' }, q.titel) : null,
        h('p', { class: 'net__row' }, h('span', { class: 'chips__label' }, 'belegt in'), sectionChips(n.links.map((e) => e.a.nr))),
        h('a', { class: 'btn btn--sm btn--accent', href: `#/quellen/${encodeURIComponent(q.id)}` }, 'Quellenkarte öffnen'));
    } else {
      info.append(
        h('p', { class: 'mono-label' }, `abschnitt ${n.nr} · kapitel ${n.chNr}`),
        h('p', { class: 'net__title' }, n.titel || `Abschnitt ${n.nr}`),
        n.links.length
          ? h('p', { class: 'net__row' }, h('span', { class: 'chips__label' }, plural(n.links.length, 'quelle', 'quellen')),
            h('span', { class: 'net__refs' }, n.links.map((e, i) => [i ? ' · ' : '', h('a', { class: 'ref', href: `#/quellen/${encodeURIComponent(e.b.q.id)}` }, e.b.q.label)])))
          : h('p', { class: 'net__sub' }, 'Keine Quelle mit Belegstelle in diesem Abschnitt.'),
        h('a', { class: 'btn btn--sm btn--accent', href: `#/abschnitt/${encodeURIComponent(n.nr)}` }, `Alle Einträge zu §${n.nr}`));
    }
  }

  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = ev.pointerType === 'mouse' ? 12 : 22;
    for (const n of M.nodes) {
      const [nx, ny] = P(n);
      const d = Math.hypot(nx - x, ny - y) - nodeR(n);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  const hrefOf = (n) => (n.kind === 'src' ? `#/quellen/${encodeURIComponent(n.q.id)}` : `#/abschnitt/${encodeURIComponent(n.nr)}`);

  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const n = pick(ev);
    canvas.style.cursor = n ? 'pointer' : '';
    if (n !== hover) { hover = n; if (!sel) renderInfo(); draw(); }
  });
  canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; if (!sel) renderInfo(); draw(); } });
  let down = null;
  canvas.addEventListener('pointerdown', (ev) => { down = { x: ev.clientX, y: ev.clientY }; });
  canvas.addEventListener('pointerup', (ev) => {
    if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 10) { down = null; return; }
    down = null;
    const n = pick(ev);
    if (!n) { if (sel) { sel = null; renderInfo(); draw(); } return; }
    if (ev.pointerType === 'mouse' || sel === n) { open?.(hrefOf(n)); return; }
    sel = n; renderInfo(); draw();
  });

  function intro() {
    if (introDone) { draw(); return; }
    const t0 = performance.now();
    const step = (now) => {
      t = Math.min(1, (now - t0) / 1300);
      draw();
      if (t < 1) requestAnimationFrame(step); else { introDone = true; draw(); }
    };
    requestAnimationFrame(step);
  }

  renderInfo();
  if (size()) draw();
  if ('ResizeObserver' in window) {
    let lw = 0;
    new ResizeObserver(() => { const w = canvas.parentElement.clientWidth; if (w && Math.abs(w - lw) > 1) { lw = w; size(); draw(); } }).observe(canvas.parentElement);
  }
  document.fonts?.ready.then(() => draw());
  if (!introDone && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); intro(); } }, { threshold: 0.25 });
    io.observe(canvas);
  } else { t = 1; introDone = true; draw(); }
  return { redraw: () => { size(); draw(); } };
}
