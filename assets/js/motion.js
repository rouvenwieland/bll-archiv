// Kinomodus: Lenis + GSAP ScrollTrigger. Wird nur geladen, wenn Bewegung
// erlaubt ist und die Bibliotheken da sind; sonst bleibt die statische Seite.
import { $, $$, wait } from './util.js';

const HEAD = { x: 0.302, y: 0.70 }; // Spitze des Lesekopfs in Abbildung 1
const CELL_REL = 0.0273;            // Zellenbreite des gezeichneten Bandes relativ zur Bildbreite

export function initMotion({ stars, tape, selfref }) {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) throw new Error('GSAP nicht verfügbar');
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  let lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const mm = gsap.matchMedia();
  mm.add({ mobile: '(max-width: 767px)', desktop: '(min-width: 768px)' }, (c) => {
    const mobile = !!c.conditions.mobile;
    const cleanups = [
      stageScene(gsap, mobile, { stars, tape }),
      selfrefScene(gsap, ScrollTrigger, mobile, selfref),
      spliceScene(gsap),
      chaptersScene(gsap, mobile),
      demonScene(gsap),
    ];
    return () => cleanups.forEach((f) => typeof f === 'function' && f());
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());

  return {
    lenis,
    refresh: () => ScrollTrigger.refresh(),
    stop: () => lenis?.stop(),
    start: () => lenis?.start(),
    scrollTo(y, { immediate = false } = {}) {
      if (lenis) { lenis.resize?.(); }
      if (lenis) lenis.scrollTo(y, { immediate, force: true, duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
    },
  };
}

/* ---------- Hero → Kosmos ----------------------------------------------- */
function stageScene(gsap, mobile, { stars, tape }) {
  const stage = $('.stage');
  const pin = $('.stage__pin');
  const inner = $('.hero__inner');
  const foot = $('.hero__foot');
  const tapeEl = $('.tape');
  const cosmos = $('.cosmos');
  const frame = $('.cosmos__frame');
  const cap = $('.cosmos .plate__cap');
  const readout = $('.cosmos__readout');
  const ro = $('[data-readout]');
  if (!stage || !frame || !tapeEl) return null;

  const S0 = mobile ? 2.3 : 2.7;
  const fw = () => frame.offsetWidth;
  const fh = () => frame.offsetHeight;
  const cell = () => tape.cellWidth?.() || 44;
  const rowCenter = () => {
    let y = 0, el = tapeEl;
    while (el && el !== pin) { y += el.offsetTop; el = el.offsetParent; }
    return y + tapeEl.offsetHeight - cell() / 2;
  };
  const tapeScale = () => Math.min(2.4, Math.max(0.8, (CELL_REL * fw() * S0) / cell()));
  const panX = () => (fw() - window.innerWidth) / 2;

  gsap.set(frame, { xPercent: -50, yPercent: -50, transformOrigin: `${HEAD.x * 100}% ${HEAD.y * 100}%` });
  gsap.set(tapeEl, { transformOrigin: () => `50% ${tapeEl.offsetHeight - cell() / 2}px` });

  let last = -1;
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: stage,
      start: 'top top',
      end: () => `+=${window.innerHeight * (mobile ? 2.4 : 2.8)}`,
      pin,
      scrub: mobile ? 0.5 : 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate(self) {
        const p = self.progress;
        // Warp nur während des Herauszoomens
        stars.setWarp(p > 0.28 && p < 0.75 ? Math.sin(((p - 0.28) / 0.47) * Math.PI) : 0);
        if (p > 0.42) tape.pause(); else tape.resume();
        // Zellenzähler
        const n = Math.floor(Math.pow(Math.max(0, (p - 0.3) / 0.7), 3) * 999999);
        if (n !== last && ro) {
          last = n;
          ro.textContent = p > 0.985 ? '∞' : String(n).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1 $2');
        }
      },
    },
  });

  tl.to(inner, { y: mobile ? -50 : -80, autoAlpha: 0, duration: 0.14, ease: 'power1.in' }, 0)
    .to(foot, { autoAlpha: 0, duration: 0.12 }, 0)
    .to(tapeEl, { y: () => window.innerHeight / 2 - rowCenter(), scale: tapeScale, duration: 0.26, ease: 'power2.inOut' }, 0.08)
    .fromTo(cosmos, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, 0.3)
    .to(tapeEl, { autoAlpha: 0, duration: 0.1 }, 0.36)
    .fromTo(frame,
      { x: () => -(HEAD.x - 0.5) * fw(), y: () => -(HEAD.y - 0.5) * fh(), scale: S0 },
      { x: () => (mobile ? panX() * 0.92 : 0), y: 0, scale: 1, duration: 0.4, ease: 'power2.inOut' }, 0.3)
    .fromTo([cap, readout], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.62);
  if (mobile) tl.to(frame, { x: () => -panX(), duration: 0.28, ease: 'power1.inOut' }, 0.7);
  tl.to({}, { duration: 0.02 }, 0.98);

  return () => { stars.setWarp(0); tape.resume(); };
}

/* ---------- Selbstbezug ---------------------------------------------------- */
function selfrefScene(gsap, ScrollTrigger, mobile, selfref) {
  const sec = selfref?.el;
  if (!sec) return null;
  const inner = $('.scene__inner', sec);
  const fits = () => inner.offsetHeight + 40 <= window.innerHeight;
  const pinIt = fits();
  selfref.setProgress(0);
  const st = ScrollTrigger.create({
    trigger: sec,
    start: pinIt ? 'top top' : 'top 70%',
    end: pinIt ? () => `+=${window.innerHeight * (mobile ? 1.15 : 1.5)}` : 'bottom 75%',
    pin: pinIt,
    scrub: true,
    invalidateOnRefresh: true,
    onUpdate: (s) => selfref.setProgress(s.progress),
    onLeave: () => selfref.complete(),
  });
  const intro = gsap.fromTo($$('.scene__label, .disclaimer', sec), { autoAlpha: 0, y: 20 }, {
    autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12,
    scrollTrigger: { trigger: sec, start: 'top 80%', once: true },
  });
  return () => { st.kill(); intro.scrollTrigger?.kill(); selfref.complete(); };
}

/* ---------- Schere: zerschnitten und wieder zusammengefügt ------------- */
function spliceScene(gsap) {
  const fig = $('.splice .plate');
  const a = $('.splice__a'), b = $('.splice__b'), seam = $('.splice__seam');
  if (!fig || !a || !b) return null;
  const tl = gsap.timeline({ scrollTrigger: { trigger: fig, start: 'top 92%', end: 'center 48%', scrub: 0.8 } });
  tl.fromTo(a, { xPercent: -7, yPercent: -3, rotation: -3 }, { xPercent: 0, yPercent: 0, rotation: 0, ease: 'power2.out' }, 0)
    .fromTo(b, { xPercent: 7, yPercent: 3, rotation: 3 }, { xPercent: 0, yPercent: 0, rotation: 0, ease: 'power2.out' }, 0)
    .fromTo(seam, { opacity: 0.9 }, { opacity: 0, ease: 'none', duration: 0.3 }, 0.72);
  return null;
}

/* ---------- Gliederung als Band (horizontal) -------------------------- */
function chaptersScene(gsap, mobile) {
  const sec = $('#gliederung');
  if (!sec || sec.hidden) return null;
  const pinEl = $('.chapters__pin', sec);
  const track = $('.chapters__track', sec);
  const meter = $$('.chapters__meter i', sec);
  const cards = $$('.chapter', track);
  sec.classList.add('is-track');
  const dist = () => Math.max(0, track.offsetWidth - pinEl.clientWidth);
  const fitsV = pinEl.scrollHeight <= window.innerHeight + 2;
  if (!fitsV || dist() < 24) {
    sec.classList.remove('is-track');
    // Statische Variante: Karten gestaffelt einblenden
    const tw = gsap.fromTo(cards, { autoAlpha: 0, y: 30 }, {
      autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08,
      scrollTrigger: { trigger: track, start: 'top 85%', once: true },
    });
    return () => { tw.scrollTrigger?.kill(); gsap.set(cards, { clearProps: 'all' }); };
  }
  meter[0]?.classList.add('on');
  const tween = gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: pinEl,
      start: 'top top',
      end: () => `+=${dist() * (mobile ? 1 : 1.1)}`,
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate(self) {
        const i = Math.round(self.progress * (cards.length - 1));
        meter.forEach((m, k) => m.classList.toggle('on', k === i));
      },
    },
  });
  const per = cards.map((card) => gsap.fromTo(card, { opacity: 0.35, scale: 0.94 }, {
    opacity: 1, scale: 1, ease: 'none',
    scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 100%', end: 'left 62%', scrub: true },
  }));
  return () => {
    sec.classList.remove('is-track');
    per.forEach((t) => t.scrollTrigger?.kill());
    gsap.set([track, ...cards], { clearProps: 'all' });
  };
}

/* ---------- Dämon: Blick öffnet sich von der Hand aus ------------------- */
function demonScene(gsap) {
  const media = $('.demon__media');
  if (!media) return null;
  gsap.fromTo(media, { clipPath: 'circle(8% at 60% 42%)', scale: 1.06 }, {
    clipPath: 'circle(125% at 60% 42%)', scale: 1, ease: 'power1.out',
    scrollTrigger: { trigger: media, start: 'top 88%', end: 'center 42%', scrub: 0.8 },
  });
  return null;
}

/* ---------- Preloader + Hero-Auftritt --------------------------------- */
export async function runPreloader(gsap, ready) {
  const el = $('.preloader');
  if (!el) return;
  const html = document.documentElement;
  if (!gsap || html.classList.contains('deeplink') || !html.classList.contains('cine')) { el.remove(); return; }
  const cells = $$('.preloader__cells span', el);
  const bar = $('.preloader__bar i', el);
  let k = 0;
  const iv = setInterval(() => { cells[k % cells.length]?.classList.add('on'); k++; }, 85);
  gsap.to(bar, { scaleX: 0.85, duration: 1.3, ease: 'power2.out' });
  const t0 = performance.now();
  await Promise.race([ready, wait(2600)]);
  const rest = 760 - (performance.now() - t0);
  if (rest > 0) await wait(rest);
  clearInterval(iv);
  cells.forEach((c) => c.classList.add('on'));
  await new Promise((r) => gsap.to(bar, { scaleX: 1, duration: 0.25, ease: 'power2.out', onComplete: r }));
  el.style.animation = 'none';
  gsap.to(el, { yPercent: -100, duration: 0.9, ease: 'power4.inOut', onComplete: () => el.remove() });
  await wait(260);
}

export function heroIntro(gsap, words) {
  if (!gsap) return;
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.fromTo(words, { yPercent: 118 }, { yPercent: 0, duration: 1.05, stagger: 0.055 }, 0)
    .fromTo($$('[data-hero-kicker], [data-hero-sub], [data-hero-meta], .hero__foot > *'), { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' }, 0.32)
    .fromTo('.tape__viewport', { autoAlpha: 0, x: 80 }, { autoAlpha: 1, x: 0, duration: 1.3, ease: 'power3.out' }, 0.15)
    .fromTo($$('.tape__focus, .tape__head'), { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power2.out' }, 0.6);
  setTimeout(() => { if (tl.progress() < 1) tl.progress(1); }, 4500);
}
