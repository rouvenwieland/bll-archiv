// Einstieg: Daten laden, statische Teile füllen, Archiv aufbauen,
// Kinomodus nur dann zuschalten, wenn er sicher funktioniert.
import { $, h, reduceMotion, wait, toast } from './util.js';
import { loadData, dataUrl } from './data.js';
import { fillMeta, splitTitle, fitTitle, renderChapters, emptyState } from './render.js';
import { initArchive, parseRoute } from './archive.js';
import { initStars } from './stars.js';
import { initTape } from './tape.js';
import { initSelfRef } from './selfref.js';
import { initMachine } from './machine.js';
import { initTrajectories } from './trajectories.js';
import { initNet } from './net.js';
import { initMotion, runPreloader, heroIntro } from './motion.js';

const html = document.documentElement;
const route0 = parseRoute(location.hash);
if (route0) html.classList.add('deeplink');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const stars = initStars($('.stars'));
const tape = initTape();
const selfref = initSelfRef();
try { initMachine(); } catch (e) { console.error('[bll] Turingmaschine:', e); }
const traj = initTrajectories();
traj.complete();
const titleEl = $('#hero-title');

let motion = null;

/* Scrollen: kurz = weich, sehr weit = harter Schnitt (Abblende) */
let cutEl = null;
function cutOverlay() {
  if (!cutEl) {
    cutEl = h('div', { 'aria-hidden': 'true', style: 'position:fixed;inset:0;z-index:85;background:#080D18;opacity:0;pointer-events:none;transition:opacity 170ms ease' });
    document.body.appendChild(cutEl);
  }
  return cutEl;
}
const scroller = {
  scrollTo(y, opt = {}) {
    const immediate = !!opt.immediate || reduceMotion();
    if (motion && !immediate && Math.abs(y - window.scrollY) > window.innerHeight * 2.5) {
      const o = cutOverlay();
      o.style.opacity = '1';
      setTimeout(() => {
        motion.scrollTo(y, { immediate: true });
        setTimeout(() => {
          o.style.transition = 'opacity 420ms ease';
          o.style.opacity = '0';
          setTimeout(() => { o.style.transition = 'opacity 170ms ease'; }, 450);
        }, 40);
      }, 180);
      return;
    }
    if (motion) motion.scrollTo(y, { immediate });
    else window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
  },
};

function showDataError(err) {
  const panels = $('[data-panels]');
  $('[data-skeleton]', panels)?.remove();
  const local = location.protocol === 'file:';
  panels.appendChild(emptyState(
    'Die Daten konnten nicht geladen werden.',
    local
      ? 'Die Seite wurde direkt als Datei geöffnet. Bitte über einen Webserver aufrufen (z. B. GitHub Pages oder einen lokalen Server).'
      : `${dataUrl()} ist gerade nicht erreichbar${err && err.message ? ` (${err.message})` : ''}.`,
    [
      h('button', { class: 'btn btn--sm btn--accent', type: 'button', on: { click: () => location.reload() } }, 'Erneut versuchen'),
      h('a', { class: 'btn btn--sm btn--ghost', href: dataUrl() }, 'Rohdaten öffnen'),
    ], ['!']));
  panels.lastElementChild.classList.add('state--error');
  $('.archive__bar').hidden = true;
}

function progressBar() {
  const bar = $('.progress i');
  if (!bar) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

async function boot() {
  const gsap = window.gsap;
  const canCine = html.classList.contains('cine') && !!gsap && !!window.ScrollTrigger;
  if (!canCine) html.classList.remove('cine');
  if (!('IntersectionObserver' in window)) html.classList.remove('motion');

  const dataP = loadData();
  const hasPreloader = canCine && !route0;
  if (hasPreloader) html.style.overflow = 'hidden';
  const preP = runPreloader(canCine ? gsap : null, dataP.catch(() => null));

  let D = null, err = null;
  try { D = await dataP; } catch (e) { err = e; console.error('[bll] Daten:', e); }

  if (D) {
    fillMeta(D.meta);
    renderChapters(D);
  }
  const words = splitTitle(titleEl);
  fitTitle(titleEl);

  let archive = null;
  if (D) {
    try {
      archive = initArchive(D, {
        scrollTo: (y, o) => scroller.scrollTo(y, o),
        onArchive: (inside) => stars.setActive(!inside),
      });
    } catch (e) {
      console.error('[bll] Archiv:', e);
      showDataError(e);
    }
  } else showDataError(err);

  if (D && archive) {
    try {
      initNet(D, $('[data-net]'), {
        open: (href) => {
          if (location.hash !== href) history.pushState(null, '', href);
          archive.go(parseRoute(href));
        },
      });
    } catch (e) { console.error('[bll] Quellen-Netz:', e); $('[data-net]')?.remove(); }
  }

  if (canCine) {
    try {
      motion = initMotion({ stars, tape, selfref, traj });
    } catch (e) {
      console.error('[bll] Kinomodus aus:', e);
      html.classList.remove('cine');
      selfref.complete();
      traj.complete();
    }
  }

  await preP;
  html.style.overflow = '';
  if (motion && !route0) heroIntro(gsap, words);

  await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(1500)]);
  fitTitle(titleEl);
  motion?.refresh();
  archive?.refreshIndicator();

  if (route0 && archive) {
    archive.go(route0, { initial: true });
    // Nach dem Laden von Bildern kann sich die Höhe ändern: Ziel nachführen
    window.addEventListener('load', () => setTimeout(() => {
      motion?.refresh();
      if (window.scrollY > 0) archive.go(parseRoute(location.hash) || route0, { initial: true });
    }, 50), { once: true });
  } else if (route0 && !archive) {
    toast('Der verlinkte Eintrag konnte nicht geöffnet werden.');
  } else {
    window.scrollTo(0, 0);
  }

  let rw = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - rw) < 2) return;
    rw = window.innerWidth;
    fitTitle(titleEl);
  });
  progressBar();
}

boot().catch((e) => {
  console.error('[bll] Start fehlgeschlagen:', e);
  html.classList.remove('cine');
  html.style.overflow = '';
  $('.preloader')?.remove();
});
