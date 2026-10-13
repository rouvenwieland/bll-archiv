// Endloses Turing-Band im Hero: bewegt sich Zelle für Zelle unter dem
// Lese-/Schreibkopf (Zustand q₃) hindurch und überschreibt gelegentlich.
import { $, reduceMotion } from './util.js';

// Band-Inhalt: die Bits (UTF-8) des Satzes „Dieser Satz ist nicht beweisbar.“
function bits(text) {
  return Array.from(new TextEncoder().encode(text)).map((b) => b.toString(2).padStart(8, '0')).join('');
}

export function initTape(root = document) {
  const tape = $('.tape', root);
  if (!tape) return { pause() {}, resume() {}, el: null };
  const track = $('.tape__track', tape);
  const source = bits('Dieser Satz ist nicht beweisbar.');
  let pos = 0;
  let cellW = 0;
  let timer = 0, paused = false, visible = true, busy = false;
  const still = reduceMotion();

  function build() {
    cellW = parseFloat(getComputedStyle(tape).getPropertyValue('--cell')) || 44;
    const need = Math.ceil(window.innerWidth / cellW) + 6;
    const half = Math.ceil(need / 2);
    track.textContent = '';
    for (let i = 0; i < need; i++) {
      const c = document.createElement('span');
      c.className = 'tape__cell';
      c.textContent = source[(pos + i) % source.length];
      track.appendChild(c);
    }
    // Zelle `half` liegt unter dem Kopf (Spur beginnt bei 50 %)
    track.style.marginLeft = `${-(half + 0.5) * cellW}px`;
    track.dataset.half = String(half);
    track.style.transform = 'translateX(0)';
  }

  function headCell() {
    return track.children[+track.dataset.half] || null;
  }

  function step() {
    if (busy || paused || !visible || document.hidden) return;
    busy = true;
    const anim = track.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${-cellW}px)` }],
      { duration: 420, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'forwards' }
    );
    anim.onfinish = () => {
      const first = track.firstElementChild;
      pos = (pos + 1) % source.length;
      first.textContent = source[(pos + track.children.length - 1) % source.length];
      track.appendChild(first);
      anim.cancel();
      track.style.transform = 'translateX(0)';
      // Schreiben: jede dritte Bewegung kippt der Kopf das Bit
      if (pos % 3 === 0) {
        const c = headCell();
        if (c) {
          c.textContent = c.textContent === '0' ? '1' : '0';
          c.classList.remove('is-write');
          void c.offsetWidth;
          c.classList.add('is-write');
        }
      }
      busy = false;
    };
  }

  build();
  let rw = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - rw) < 2) return;
    rw = window.innerWidth;
    build();
  });

  if (!still && typeof track.animate === 'function') {
    timer = setInterval(step, 1100);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(tape);
    }
  }

  return {
    el: tape,
    cellWidth: () => cellW,
    pause() { paused = true; },
    resume() { paused = false; },
    destroy() { clearInterval(timer); },
  };
}
