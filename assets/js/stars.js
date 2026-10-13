// Sternenfeld im Hintergrund: Parallaxe beim Scrollen, Schweife bei Tempo.
// Gedrosselt auf Mobilgeräten, pausiert im Hintergrund-Tab und im Archiv.
import { isMobile, reduceMotion } from './util.js';

export function initStars(canvas) {
  const noop = { setWarp() {}, setActive() {}, kick() {} };
  if (!canvas || !canvas.getContext) return noop;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return noop;

  const still = reduceMotion();
  let mobile = isMobile();
  let dpr = 1, W = 0, H = 0;
  let stars = [];
  let raf = 0, running = false, active = true;
  let lastY = window.scrollY, vel = 0, warp = 0, frame = 0;
  const t0 = performance.now();

  function seed() {
    mobile = isMobile();
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const n = Math.round(Math.min(mobile ? 170 : 420, (W * H) / (mobile ? 2600 : 3600)));
    stars = Array.from({ length: n }, () => {
      const z = Math.pow(Math.random(), 1.6) * 0.9 + 0.1; // Tiefe
      const tint = Math.random();
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        z,
        r: (0.35 + z * 1.05) * (Math.random() < 0.04 ? 1.8 : 1),
        a: 0.25 + z * 0.65,
        tw: Math.random() * Math.PI * 2,
        ts: 0.4 + Math.random() * 1.4,
        c: tint < 0.08 ? '167,139,250' : tint < 0.16 ? '34,211,238' : tint < 0.2 ? '251,191,36' : '226,234,255',
      };
    });
  }

  function draw(now) {
    const t = (now - t0) / 1000;
    const y = still ? 0 : window.scrollY;
    const dy = y - lastY;
    lastY = y;
    vel += (dy - vel) * 0.18;
    const speed = Math.max(0, Math.abs(vel) - 14); // erst bei schnellem Scrollen
    const vlen = Math.min(10, speed * 0.25);
    const cx = W / 2, cy = H / 2, maxD = Math.hypot(cx, cy);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      // Parallaxe: tiefe Sterne bewegen sich langsamer
      let py = (s.y - y * s.z * 0.12) % H;
      if (py < 0) py += H;
      const tw = still ? 1 : 0.72 + Math.sin(t * s.ts + s.tw) * 0.28;
      const alpha = s.a * tw;
      let ex = 0, ey = 0;
      if (!still && warp > 0.02) {
        // radialer Warp vom Bildmittelpunkt weg (nur während des Herauszoomens)
        const dx = s.x - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1;
        const l = warp * 16 * s.z * (0.25 + d / maxD);
        ex = (dx / d) * l; ey = (dy / d) * l;
      } else if (!still && vlen > 0.5 && s.z > 0.55) {
        ey = vlen * s.z * (vel >= 0 ? 1 : -1);
      }
      if (Math.abs(ex) + Math.abs(ey) > 1.5) {
        ctx.strokeStyle = `rgba(${s.c},${(alpha * 0.45).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.6, s.r * 0.8);
        ctx.beginPath();
        ctx.moveTo(s.x, py);
        ctx.lineTo(s.x + ex, py + ey);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${s.c},${alpha.toFixed(3)})`;
        const d = s.r * 2;
        ctx.fillRect(s.x - s.r, py - s.r, d, d);
      }
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    frame++;
    if (mobile && frame % 2) return; // ~30 fps auf dem Handy
    draw(now);
  }
  function start() {
    if (running || still || document.hidden || !active) return;
    running = true;
    lastY = window.scrollY;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  seed();
  draw(performance.now());
  start();

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      // Nur bei echter Größenänderung neu säen (nicht beim Ein-/Ausblenden der URL-Leiste)
      if (Math.abs(window.innerWidth - W) > 40 || Math.abs(window.innerHeight - H) > 160) seed();
      else { W = window.innerWidth; H = window.innerHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      draw(performance.now());
    }, 150);
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  return {
    setWarp(v) { warp = Math.max(0, Math.min(1, v)); },
    setActive(on) {
      active = on;
      if (on) start();
      else { stop(); draw(performance.now()); }
    },
    kick() { draw(performance.now()); },
  };
}
