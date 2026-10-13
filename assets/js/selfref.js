// Selbstbezug-Moment: Satz wird getippt und live in Zeichencodes und ein
// Primzahlpotenz-Produkt übersetzt (ausdrücklich nur eine Illustration).
import { $, h } from './util.js';

const SENTENCE = 'Dieser Satz ist nicht beweisbar.';

function primes(n) {
  const out = [];
  for (let k = 2; out.length < n; k++) if (out.every((p) => k % p)) out.push(k);
  return out;
}
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

export function initSelfRef() {
  const sec = $('#selbstbezug');
  if (!sec) return { setProgress() {}, complete() {}, el: null };
  const typed = $('[data-typed]', sec);
  const cellsEl = $('[data-cells]', sec);
  const chainEl = $('[data-chain]', sec);
  const numEl = $('[data-num]', sec);

  const chars = Array.from(SENTENCE);
  const codes = chars.map((c) => c.codePointAt(0));
  const P = primes(chars.length);
  const N = chars.length;

  const cells = chars.map((c, i) => h('div', { class: 'code-cell' },
    h('b', null, c === ' ' ? '␣' : c),
    h('small', null, String(codes[i]))));
  cellsEl.append(...cells);

  // Teilprodukte lazy berechnen (BigInt)
  let partial = null;
  function computePartials() {
    if (partial) return partial;
    partial = [{ len: 0, head: '' }];
    if (typeof BigInt !== 'function') return partial;
    let prod = 1n;
    for (let i = 0; i < N; i++) {
      prod *= BigInt(P[i]) ** BigInt(codes[i]);
      const s = prod.toString();
      partial.push({ len: s.length, head: s.slice(0, 27) });
    }
    return partial;
  }

  const group3 = (s) => s.replace(/(\d{3})(?=\d)/g, '$1 ');
  let shown = -1;

  function render(n) {
    if (n === shown) return;
    shown = n;
    typed.textContent = chars.slice(0, n).join('');
    cells.forEach((c, i) => {
      c.classList.toggle('is-off', i >= n);
      c.classList.toggle('is-last', i === n - 1 && n < N);
    });
    // Kette: die letzten Faktoren
    chainEl.textContent = '';
    if (n > 0) {
      const from = Math.max(0, n - 4);
      if (from > 0) chainEl.append('… · ');
      for (let i = from; i < n; i++) {
        chainEl.append(String(P[i]), h('sup', null, String(codes[i])));
        if (i < n - 1) chainEl.append(' · ');
      }
    } else chainEl.append('2', h('sup', null, 'c₁'), ' · 3', h('sup', null, 'c₂'), ' · 5', h('sup', null, 'c₃'), ' · …');
    const pr = computePartials()[n];
    numEl.textContent = '';
    if (n > 0 && pr && pr.len) {
      numEl.append('= ', group3(pr.head), pr.len > 27 ? '…' : '', h('em', null, `  (${pr.len.toLocaleString('de-DE')} Stellen)`));
    } else numEl.append(h('em', null, '= …'));
    sec.classList.toggle('is-done', n >= N);
  }

  render(N); // statischer Ausgangszustand: alles sichtbar

  return {
    el: sec,
    setProgress(p) {
      const t = Math.min(1, Math.max(0, (p - 0.06) / 0.74));
      render(Math.round(t * N));
    },
    complete() { render(N); },
    // Hochzahlen-Hilfe (für spätere Zwecke)
    sup: (n) => String(n).split('').map((d) => SUP[d]).join(''),
  };
}
