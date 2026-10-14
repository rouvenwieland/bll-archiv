// Interaktive Turingmaschine: zwei echte kleine Programme mit Übergangstabelle.
// Läuft nur auf Knopfdruck; pausiert außerhalb des Sichtbereichs.
import { $, $$, h, reduceMotion } from './util.js';

const L = -1, R = 1;
const PROGRAMS = {
  biber: {
    name: 'Fleißiger Biber',
    blank: '0',
    alphabet: ['0', '1'],
    start: 'A',
    tape: {},
    states: [
      { k: 'A', label: 'q₀' },
      { k: 'B', label: 'q₁' },
      { k: 'C', label: 'q₂' },
    ],
    rules: {
      A: { 0: ['1', R, 'B'], 1: ['1', R, 'H'] },
      B: { 0: ['0', R, 'C'], 1: ['1', R, 'B'] },
      C: { 0: ['1', L, 'C'], 1: ['1', L, 'A'] },
    },
  },
  zaehler: {
    name: 'Binärzähler',
    blank: '␣',
    alphabet: ['␣', '0', '1'],
    start: 'A',
    tape: { 0: '0' },
    states: [
      { k: 'A', label: 'q₀', hint: '+1' },
      { k: 'B', label: 'q₁', hint: 'nach rechts' },
    ],
    rules: {
      A: { '␣': ['1', R, 'B'], 0: ['1', R, 'B'], 1: ['0', L, 'A'] },
      B: { '␣': ['␣', L, 'A'], 0: ['0', R, 'B'], 1: ['1', R, 'B'] },
    },
  },
};
const SPEEDS = { langsam: 900, mittel: 420, schnell: 90 };
const arrow = (m) => (m === L ? '←' : '→');

export function initMachine() {
  const root = $('[data-tm]');
  if (!root) return null;
  const tapeEl = $('.tm__tape', root);
  const track = $('.tm__track', root);
  const stateEl = $('[data-tm-state]', root);
  const table = $('[data-tm-table]', root);
  const out = {
    step: $('[data-out="step"]', root),
    state: $('[data-out="state"]', root),
    read: $('[data-out="read"]', root),
    extraLabel: $('[data-out-label="extra"]', root),
    extra: $('[data-out="extra"]', root),
  };
  const status = $('[data-tm-status]', root);
  const runBtn = $('[data-tm="run"]', root);
  const stepBtn = $('[data-tm="step"]', root);
  const still = reduceMotion();

  let P = PROGRAMS.biber, progKey = 'biber';
  let tape, head, state, steps, count, running = false, timer = 0, visible = true;
  let speed = 'mittel';
  let cellW = 48, half = 6;
  const label = (k) => (k === 'H' ? 'H' : P.states.find((s) => s.k === k)?.label || k);
  // „q₀“ als q + echtes <sub>, damit die Ziffer in der Serifenschrift lesbar bleibt
  const SUBD = { '₀': '0', '₁': '1', '₂': '2', '₃': '3' };
  const qNode = (k) => {
    const l = label(k);
    return l.length > 1 && SUBD[l[1]] ? [l[0], h('sub', null, SUBD[l[1]])] : [l];
  };
  const sym = (pos) => tape.get(pos) ?? P.blank;
  const shown = (s) => (s === '␣' ? '' : s);

  function measure() {
    cellW = parseFloat(getComputedStyle(tapeEl).getPropertyValue('--cell')) || 48;
    half = Math.ceil(tapeEl.clientWidth / cellW / 2) + 2;
    track.style.marginLeft = `${-(half + 0.5) * cellW}px`;
  }

  function renderTape() {
    if (track.children.length !== half * 2 + 1) {
      track.textContent = '';
      for (let i = 0; i < half * 2 + 1; i++) track.appendChild(h('span', { class: 'tape__cell' }));
    }
    Array.from(track.children).forEach((c, i) => {
      const s = sym(head - half + i);
      c.textContent = shown(s);
      c.classList.toggle('is-blank', s === P.blank && P.blank === '␣');
      c.classList.remove('is-write');
    });
  }

  function buildTable() {
    table.textContent = '';
    const head = h('tr', null, h('th', { scope: 'col' }, 'Zustand'),
      P.alphabet.map((a) => h('th', { scope: 'col' }, 'liest ', h('b', null, a === '␣' ? 'leer' : a))));
    const body = P.states.map((s) => h('tr', null,
      h('th', { scope: 'row' }, qNode(s.k), s.hint ? h('small', null, s.hint) : null),
      P.alphabet.map((a) => {
        const r = P.rules[s.k][a];
        return h('td', { 'data-rule': `${s.k}:${a}` },
          h('span', { class: 'tm__w' }, r[0] === '␣' ? 'leer' : r[0]),
          h('span', { class: 'tm__m', 'aria-label': r[1] === L ? 'nach links' : 'nach rechts' }, arrow(r[1])),
          h('span', { class: 'tm__n' + (r[2] === 'H' ? ' is-halt' : '') }, qNode(r[2])));
      })));
    table.append(h('caption', { class: 'sr-only' }, `Übergangstabelle für ${P.name}: geschriebenes Zeichen, Bewegung, neuer Zustand`),
      h('thead', null, head), h('tbody', null, body));
  }

  function renderInfo() {
    stateEl.textContent = '';
    stateEl.append(...qNode(state));
    root.classList.toggle('is-halted', state === 'H');
    out.step.textContent = steps.toLocaleString('de-DE');
    out.state.textContent = '';
    out.state.append(...qNode(state));
    const r = sym(head);
    out.read.textContent = r === '␣' ? 'leer' : r;
    if (progKey === 'biber') {
      out.extraLabel.textContent = 'einsen';
      out.extra.textContent = String([...tape.values()].filter((v) => v === '1').length);
    } else {
      out.extraLabel.textContent = 'zahl';
      out.extra.textContent = count.toLocaleString('de-DE');
    }
    $$('td[data-rule]', table).forEach((td) => td.classList.toggle('is-next', td.dataset.rule === `${state}:${r}`));
    stepBtn.disabled = state === 'H';
    runBtn.disabled = state === 'H';
  }

  function reset() {
    stop();
    tape = new Map(Object.entries(P.tape).map(([k, v]) => [+k, v]));
    head = 0; state = P.start; steps = 0; count = 0;
    renderTape();
    renderInfo();
  }

  function step() {
    if (state === 'H') return false;
    const r = sym(head);
    const [w, m, next] = P.rules[state][r];
    if (w === P.blank && P.blank === '␣') tape.delete(head); else tape.set(head, w);
    if (progKey === 'zaehler' && state === 'B' && r === '␣') count++;
    head += m; state = next; steps++;
    renderTape();
    const written = track.children[half - m];
    if (written && w !== r) { void written.offsetWidth; written.classList.add('is-write'); }
    const dur = still ? 0 : Math.min(SPEEDS[speed] * 0.78, 380);
    if (dur > 0 && typeof track.animate === 'function') {
      track.animate([{ transform: `translateX(${m * cellW}px)` }, { transform: 'translateX(0)' }],
        { duration: dur, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' });
    }
    renderInfo();
    if (state === 'H') {
      stop();
      const ones = [...tape.values()].filter((v) => v === '1').length;
      status.textContent = `Angehalten nach ${steps} Schritten, ${ones} Einsen auf dem Band.`;
      root.classList.remove('is-pulse'); void root.offsetWidth; root.classList.add('is-pulse');
    }
    return true;
  }

  function tick() {
    timer = 0;
    if (!running) return;
    if (visible && !document.hidden) step();
    if (running) timer = setTimeout(tick, SPEEDS[speed]);
  }
  function setRun(on) {
    running = on;
    runBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('[data-run-label]', runBtn).textContent = on ? 'Pause' : 'Start';
    root.classList.toggle('is-running', on);
  }
  function start() {
    if (state === 'H') return;
    status.textContent = '';
    setRun(true);
    clearTimeout(timer);
    step();
    timer = setTimeout(tick, SPEEDS[speed]);
  }
  function stop() { setRun(false); clearTimeout(timer); timer = 0; }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !root.contains(b) || b.disabled) return;
    if (b.dataset.tm === 'step') { stop(); status.textContent = ''; step(); }
    else if (b.dataset.tm === 'run') (running ? stop() : start());
    else if (b.dataset.tm === 'reset') { reset(); status.textContent = 'Band und Zustand zurückgesetzt.'; }
    else if (b.dataset.prog && b.dataset.prog !== progKey) {
      progKey = b.dataset.prog; P = PROGRAMS[progKey];
      $$('[data-prog]', root).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      root.dataset.prog = progKey;
      buildTable(); reset(); status.textContent = `Programm: ${P.name}.`;
    } else if (b.dataset.speed) {
      speed = b.dataset.speed;
      $$('[data-speed]', root).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    }
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.15 }).observe(root);
  }

  measure();
  buildTable();
  reset();
  let rw = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - rw) < 2) return;
    rw = window.innerWidth;
    measure(); track.textContent = ''; renderTape();
  });
  return { stop };
}
