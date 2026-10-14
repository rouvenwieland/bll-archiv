// Kinomodus: Lenis + GSAP ScrollTrigger. Wird nur geladen, wenn Bewegung
// erlaubt ist und die Bibliotheken da sind; sonst bleibt die statische Seite.
import { $, $$, wait } from './util.js';

const HEAD = { x: 0.302, y: 0.70 }; // Spitze des Lesekopfs in Abbildung 1
const CELL_REL = 0.0273;            // Zellenbreite des gezeichneten Bandes relativ zur Bildbreite

export function initMotion({ stars, tape, selfref, traj }) {
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
      machineIntro(gsap),
      selfrefScene(gsap, ScrollTrigger, mobile, selfref),
      cutScene(gsap, ScrollTrigger, mobile),
      chaptersScene(gsap, mobile),
      demonScene(gsap, ScrollTrigger, mobile, traj),
      stillScenes(gsap),
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

/* ---------- Turingmaschine: ruhiger Auftritt ------------------------- */
function machineIntro(gsap) {
  const sec = $('#maschine');
  if (!sec) return null;
  const items = $$('.scene__label, .scene__title, .machine__lead, .tm', sec);
  const tw = gsap.fromTo(items, { autoAlpha: 0, y: 28 }, {
    autoAlpha: 1, y: 0, duration: 0.95, ease: 'power3.out', stagger: 0.08,
    scrollTrigger: { trigger: sec, start: 'top 78%', once: true },
  });
  return () => { tw.scrollTrigger?.kill(); gsap.set(items, { clearProps: 'all' }); };
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

/* ---------- Schere und Band (Abschnitt 4.3) -------------------------- */
// Das Band läuft wie bei einer Turingmaschine unter der feststehenden Schere
// hindurch: zwei Schnitte, Abschrift heraus, an der Stelle „hier“ einkleben.
function cutScene(gsap, ScrollTrigger, mobile) {
  const sec = $('#schere');
  if (!sec) return null;
  const q = (s) => $(s, sec);
  const pin = q('.cut__pin'), head = q('.cut__head'), foot = q('.cut__foot');
  const theatre = q('.cut__theatre'), plate = q('.cut__plate'), stage = q('.cut__stage');
  const band = q('[data-band]'), piece = q('[data-piece]'), gap = q('[data-gap]'), copy = q('[data-copy]');
  const slitA = q('[data-slit="a"]'), slitB = q('[data-slit="b"]'), sc = q('[data-scissors]'), result = q('[data-result]');
  const steps = $$('[data-steps] li', sec);
  if (!band || !piece || !sc) return null;

  sec.classList.add('is-live');
  const fits = () => head.offsetHeight + foot.offsetHeight + (mobile ? 300 : 340) <= window.innerHeight;
  if (!fits()) { sec.classList.remove('is-live'); return null; }

  const m = {};
  const cam = { t: 0, s: 1 };
  const apply = () => { band.style.transform = `translate3d(${(m.cx - cam.t * cam.s).toFixed(2)}px,0,0) scale(${cam.s.toFixed(4)})`; };
  function measure() {
    const fs = parseFloat(getComputedStyle(band).fontSize) || 28;
    m.W = theatre.clientWidth;
    m.H = theatre.clientHeight;
    m.cx = m.W / 2;
    m.x0 = piece.offsetLeft;
    m.pieceW = piece.offsetWidth - gap.offsetWidth;
    m.x1 = m.x0 + m.pieceW;
    m.slot = gap.offsetLeft;
    m.copyW = copy.offsetWidth;
    m.bandH = piece.offsetHeight;
    m.s = mobile ? 0.46 : 0.5;
    m.gap = fs * 0.28;
    m.insW = m.copyW * m.s + m.gap * 2;
    m.lift = -m.bandH * 1.35;
    const fitAll = Math.min(1, (m.W * 0.92) / (m.pieceW + m.insW + fs * 4));
    // Schmale Bildschirme: nicht alles zeigen (wäre winzig), sondern die eingesetzte Abschrift
    m.zoom = Math.max(fitAll, mobile ? 0.36 : 0);
    m.zoomT = fitAll >= m.zoom ? m.x0 + (m.pieceW + m.insW) / 2 : m.x0 + m.slot + m.insW / 2;
    m.mid = Math.min(1, mobile ? 0.82 : 1);
    slitA.style.left = `${m.x0}px`;
    slitB.style.left = `${m.x1}px`;
    // Scherenspitze genau über der Bildmitte, knapp unter der Bandkante
    const sw = sc.offsetWidth, sh = sc.offsetHeight;
    const bandTop = m.H / 2 - m.bandH / 2;
    sc.style.left = `${m.cx - 0.13 * sw}px`;
    sc.style.top = `${bandTop + m.bandH + 4 - 0.96 * sh}px`;
    apply();
  }
  measure();
  cam.t = m.x0 - m.W * 0.46;
  apply();
  ScrollTrigger.addEventListener('refreshInit', measure);

  gsap.set(plate, { xPercent: -50, yPercent: -50, transformOrigin: '62% 24%' });
  let stepIdx = -1;
  const setStep = (i) => {
    if (i === stepIdx) return;
    stepIdx = i;
    steps.forEach((li, k) => li.classList.toggle('is-on', k === i));
  };
  setStep(0);

  const snip = (tl, at, slit) => {
    tl.to(sc, { y: 7, rotation: -5, duration: 0.014, ease: 'power2.in' }, at)
      .to(sc, { y: 0, rotation: 0, duration: 0.026, ease: 'power2.out' }, at + 0.014)
      .fromTo(slit, { opacity: 0, scaleY: 0.3 }, { opacity: 1, scaleY: 1, duration: 0.012 }, at + 0.01);
  };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: sec,
      start: 'top top',
      end: () => `+=${window.innerHeight * (mobile ? 2.6 : 3)}`,
      pin,
      scrub: mobile ? 0.5 : 0.9,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate(self) {
        const p = self.progress;
        setStep(p < 0.19 ? 0 : p < 0.5 ? 1 : p < 0.79 ? 2 : 3);
      },
    },
  });
  const camTo = (vars, at, dur, ease = 'power2.inOut') => tl.to(cam, { ...vars, duration: dur, ease, onUpdate: apply }, at);

  // 1 · Zeichnung → Band
  tl.fromTo(plate, { autoAlpha: 1, scale: 1, filter: 'blur(0px)' }, { autoAlpha: 0, scale: 1.7, filter: 'blur(8px)', duration: 0.12, ease: 'power1.in' }, 0.03)
    .fromTo(stage, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07 }, 0.09)
    .fromTo(sc, { autoAlpha: 0, x: 40, y: -60, rotation: 10 }, { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: 0.08, ease: 'power3.out' }, 0.12);
  camTo({ t: () => m.x0 }, 0.09, 0.12, 'power2.out');
  // 2 · zwei Schnitte, dazwischen läuft der ganze Satz unter der Schere durch
  snip(tl, 0.215, slitA);
  camTo({ t: () => m.x1 }, 0.255, 0.2, 'power1.inOut');
  snip(tl, 0.46, slitB);
  // 3 · herausheben, Abschrift einsetzen
  tl.to(sc, { autoAlpha: 0, x: 30, y: -50, rotation: 8, duration: 0.06, ease: 'power2.in' }, 0.5)
    .to(piece, { y: () => m.lift, duration: 0.08, ease: 'power2.inOut' }, 0.52)
    .to([slitA, slitB], { opacity: 0, duration: 0.04 }, 0.56);
  camTo({ t: () => m.x0 + m.slot, s: () => m.mid }, 0.52, 0.12);
  tl.fromTo(copy, { opacity: 0, x: 0, y: 0, scale: 1 }, { opacity: 1, y: () => -m.bandH * 1.15, duration: 0.06, ease: 'power2.out' }, 0.58)
    .to(gap, { width: () => m.insW, duration: 0.1, ease: 'power2.inOut' }, 0.63)
    .to(copy, { x: () => m.slot + m.gap, y: 0, scale: () => m.s, duration: 0.11, ease: 'power2.inOut' }, 0.63)
    .to(piece, { y: 0, duration: 0.07, ease: 'power2.inOut' }, 0.74);
  // 4 · Rückblick auf das Ganze
  camTo({ t: () => m.zoomT, s: () => m.zoom }, 0.8, 0.12);
  tl.fromTo(result, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.06 }, 0.88)
    .to({}, { duration: 0.04 }, 0.96);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', measure);
    sec.classList.remove('is-live');
    gsap.set([plate, stage, band, piece, gap, copy, sc, slitA, slitB, result], { clearProps: 'all' });
  };
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

/* ---------- Dämon: Blick öffnet sich, Bahnen entstehen, fächern auf ---- */
function demonScene(gsap, ScrollTrigger, mobile, traj) {
  const sec = $('#daemon');
  const media = $('.demon__media');
  const cap = $('[data-demon-cap]');
  if (!sec || !media) return null;
  const inner = $('.scene__inner', sec);
  sec.classList.add('is-live');
  const pinIt = inner.offsetHeight + 40 <= window.innerHeight;
  if (!pinIt) sec.classList.remove('is-live');
  traj?.setDraw(0); traj?.setFan(0);
  const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: sec,
      start: pinIt ? 'top top' : 'top 80%',
      end: pinIt ? () => `+=${window.innerHeight * (mobile ? 1.6 : 1.9)}` : 'bottom 30%',
      pin: pinIt,
      scrub: mobile ? 0.5 : 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate(self) {
        const p = self.progress;
        traj?.setDraw(seg(p, 0.2, 0.62));
        traj?.setFan(seg(p, 0.66, 0.9));
      },
    },
  });
  tl.fromTo(media, { clipPath: 'circle(8% at 58% 42%)', scale: 1.06 }, { clipPath: 'circle(125% at 58% 42%)', scale: 1, ease: 'power1.out', duration: 0.28 }, 0)
    .fromTo(cap, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.86)
    .to({}, { duration: 0.06 }, 0.94);
  return () => { sec.classList.remove('is-live'); traj?.complete(); gsap.set([media, cap], { clearProps: 'all' }); };
}

/* ---------- Standbilder: Treppe, Zusammensturz, Filmrolle ------------- */
// Treppe: wird von unten nach oben aufgedeckt. Zusammensturz: die Zeichnung
// in waagerechte Bänder zerlegt, die von oben in ihre Lage fallen.
// Filmrolle: der Streifen läuft seitlich, ein Zähler nummeriert die Bilder.
const FALL_BANDS = [0, 30, 50, 68, 100]; // Bandgrenzen in % der Bildhöhe

function stillScenes(gsap) {
  const tweens = [];
  const undo = [];
  const st = (trigger, extra = {}) => ({ trigger, start: 'top 85%', end: 'bottom 40%', scrub: 0.6, invalidateOnRefresh: true, ...extra });

  const climb = $('[data-still="climb"]');
  if (climb) {
    tweens.push(gsap.fromTo(climb, { clipPath: 'inset(100% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: st(climb, { end: 'bottom 55%' }) }));
    undo.push(() => gsap.set(climb, { clearProps: 'clipPath' }));
  }

  const fall = $('[data-still="fall"]');
  const base = fall && $('img', fall);
  if (fall && base) {
    const n = FALL_BANDS.length - 1;
    const bands = [];
    for (let i = 0; i < n; i++) {
      const top = Math.max(0, FALL_BANDS[i] - 0.3);
      const bottom = 100 - FALL_BANDS[i + 1];
      const band = document.createElement('div');
      band.className = 'still__band';
      band.setAttribute('aria-hidden', 'true');
      band.style.clipPath = `inset(${top}% 0% ${bottom}% 0%)`;
      const img = base.cloneNode(true);
      img.alt = '';
      band.appendChild(img);
      fall.appendChild(band);
      bands.push(band);
    }
    base.style.visibility = 'hidden';
    const tl = gsap.timeline({ scrollTrigger: st(fall, { start: 'top 80%', end: 'center 45%' }) });
    bands.forEach((b, i) => {
      const lift = (n - i) * 5.5;
      tl.fromTo(b, { yPercent: -lift, rotation: (i % 2 ? 1 : -1) * 1.6, autoAlpha: 0.35 },
        { yPercent: 0, rotation: 0, autoAlpha: 1, ease: 'power2.in', duration: 1 }, (n - 1 - i) * 0.18);
    });
    tweens.push(tl);
    undo.push(() => { bands.forEach((b) => b.remove()); base.style.visibility = ''; });
  }

  const reel = $('[data-still="reel"]');
  const strip = reel && $('img', reel);
  const frame = reel && $('[data-frame]', reel);
  if (reel && strip) {
    tweens.push(gsap.fromTo(strip, { xPercent: 4 }, {
      xPercent: -4, ease: 'none',
      scrollTrigger: st(reel, { start: 'top bottom', end: 'bottom top',
        onUpdate(self) { if (frame) frame.textContent = String(1 + Math.round(self.progress * 2399)).padStart(4, '0'); } }),
    }));
    undo.push(() => { gsap.set(strip, { clearProps: 'transform' }); if (frame) frame.textContent = '0001'; });
  }

  return () => { tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); }); undo.forEach((f) => f()); };
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
