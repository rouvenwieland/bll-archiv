// Archiv: Tabs, globale Suche, Filter, Deep-Links, Kopieren, Markdown & Mathe.
import { $, $$, h, fold, slugify, debounce, copyText, toast, loadScript, loadCss, idle, canHover, plural } from './util.js';
import { TABS, renderTabs, buildListPanel, buildOverview, emptyState } from './render.js';

const LIST_TABS = ['quellen', 'praemissen', 'glossar', 'prompts'];
const TAB_LABEL = Object.fromEntries(TABS.map((t) => [t.key, t.label]));

const CDN = 'https://cdn.jsdelivr.net/npm/';
const LIBS = {
  marked: [CDN + 'marked@12.0.2/marked.min.js', 'sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi'],
  purify: [CDN + 'dompurify@3.1.6/dist/purify.min.js', 'sha384-+VfUPEb0PdtChMwmBcBmykRMDd+v6D/oFmB3rZM/puCMDYcIvF968OimRh4KQY9a'],
  katexCss: [CDN + 'katex@0.16.11/dist/katex.min.css', 'sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+'],
  katex: [CDN + 'katex@0.16.11/dist/katex.min.js', 'sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg'],
  katexAuto: [CDN + 'katex@0.16.11/dist/contrib/auto-render.min.js', 'sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk'],
};

export function parseRoute(hash) {
  const m = String(hash || '').match(/^#\/([a-z]+)(?:\/(.+))?$/);
  if (!m) return null;
  let id = null;
  if (m[2]) { try { id = decodeURIComponent(m[2]); } catch (_) { id = m[2]; } }
  return { tab: m[1], id };
}

export function initArchive(D, ctx) {
  const html = document.documentElement;
  const root = $('#archiv');
  const panelsEl = $('[data-panels]', root);
  const tabsEl = $('[data-tabs]', root);
  const ind = $('.tabs__ind', tabsEl);
  const form = $('[data-search]', root);
  const input = $('#q', root);
  const clearBtn = $('[data-clear]', root);
  const bar = $('.archive__bar', root);
  const sentinel = $('.archive__sentinel', root);

  const motionOk = () => html.classList.contains('motion');

  // ---- Aufbau ----------------------------------------------------------
  const built = { ueberblick: buildOverview(D) };
  LIST_TABS.forEach((k) => { built[k] = buildListPanel(k, D); });
  $('[data-skeleton]', panelsEl)?.remove();
  TABS.forEach((t) => panelsEl.appendChild(built[t.key].panel));
  renderTabs(tabsEl, Object.fromEntries(LIST_TABS.map((k) => [k, D[k].length])));
  const tabBtns = $$('[role="tab"]', tabsEl);

  const state = { tab: 'ueberblick', q: '', terms: [], secs: [], filters: {}, level: 'beide', hits: {} };

  // ---- Leiste messen ---------------------------------------------------
  const setBarH = () => html.style.setProperty('--bar-h', `${Math.round(bar.offsetHeight)}px`);
  setBarH();
  if ('ResizeObserver' in window) new ResizeObserver(setBarH).observe(bar);

  // „Im Archiv“: Topbar weg, Sterne gedimmt
  // (per Scroll geprüft: ein IntersectionObserver verpasst Sprünge über das Ziel hinweg)
  let insideState = null, insideTick = false;
  const checkInside = () => {
    insideTick = false;
    const inside = sentinel.getBoundingClientRect().top < 0;
    if (inside === insideState) return;
    insideState = inside;
    html.classList.toggle('in-archive', inside);
    ctx.onArchive?.(inside);
  };
  window.addEventListener('scroll', () => { if (!insideTick) { insideTick = true; requestAnimationFrame(checkInside); } }, { passive: true });
  checkInside();

  // ---- Einblenden beim Scrollen -----------------------------------------
  let io = null;
  if ('IntersectionObserver' in window && motionOk() && !html.classList.contains('deeplink')) {
    io = new IntersectionObserver((list) => {
      let n = 0;
      for (const en of list) {
        if (!en.isIntersecting) continue;
        en.target.style.setProperty('--rv-d', `${Math.min(n++, 6) * 55}ms`);
        en.target.classList.add('rv-in');
        io.unobserve(en.target);
      }
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0.01 });
    $$('.rv', panelsEl).forEach((el) => io.observe(el));
  } else {
    $$('.rv', panelsEl).forEach((el) => el.classList.add('rv-in'));
  }

  // ---- Lichtschein, der dem Cursor folgt ---------------------------------
  if (canHover()) {
    let raf = 0, last = null;
    panelsEl.addEventListener('pointermove', (ev) => {
      last = ev;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const card = last.target.closest?.('.card');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${last.clientX - r.left}px`);
        card.style.setProperty('--my', `${last.clientY - r.top}px`);
      });
    }, { passive: true });
  }

  // ---- Indikator -------------------------------------------------------
  function moveIndicator(instant) {
    const btn = tabBtns.find((b) => b.dataset.tab === state.tab);
    if (!btn) return;
    if (instant) ind.style.transition = 'none';
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.transform = `translateX(${btn.offsetLeft}px)`;
    if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
    // aktiven Reiter in der scrollbaren Leiste sichtbar halten
    const l = btn.offsetLeft, r = l + btn.offsetWidth;
    const pad = 24;
    if (l < tabsEl.scrollLeft + pad) tabsEl.scrollTo({ left: Math.max(0, l - pad), behavior: instant ? 'auto' : 'smooth' });
    else if (r > tabsEl.scrollLeft + tabsEl.clientWidth - pad) tabsEl.scrollTo({ left: r - tabsEl.clientWidth + pad, behavior: instant ? 'auto' : 'smooth' });
  }
  moveIndicator(true);
  window.addEventListener('resize', debounce(() => moveIndicator(true), 120));
  document.fonts?.ready.then(() => moveIndicator(true));

  // ---- Scroll-Helfer ---------------------------------------------------
  const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const barH = () => bar.offsetHeight;
  function scrollToArchive(immediate) {
    ctx.scrollTo(absTop(sentinel) + 1, { immediate });
  }
  function scrollToPanels(immediate) {
    const target = absTop(panelsEl) - barH() - 4;
    const top = panelsEl.getBoundingClientRect().top;
    if (top < barH() + 2 || top > window.innerHeight * 0.75) ctx.scrollTo(Math.max(target, absTop(sentinel) + 1), { immediate });
  }
  function scrollToEl(el, immediate) {
    ctx.scrollTo(absTop(el) - barH() - 14, { immediate });
    revealNear(absTop(el));
  }
  // Failsafe: alles rund um ein Sprungziel sofort sichtbar machen
  function revealNear(y) {
    const lo = y - window.innerHeight * 1.5, hi = y + window.innerHeight * 2.5;
    for (const el of $$('.rv:not(.rv-in)', panelsEl)) {
      const t = absTop(el);
      if (t > lo && t < hi) { el.classList.add('rv-in'); io?.unobserve(el); }
    }
  }

  // ---- Tabs ------------------------------------------------------------
  function setTab(key, opt = {}) {
    if (!built[key]) return;
    const { fromKeyboard = false, scroll = false, updateHash = true } = opt;
    const prevIdx = TABS.findIndex((t) => t.key === state.tab);
    const idx = TABS.findIndex((t) => t.key === key);
    if (key !== state.tab) {
      built[state.tab].panel.hidden = true;
      const p = built[key].panel;
      p.hidden = false;
      p.classList.remove('is-enter', 'from-left');
      if (motionOk() && !fromKeyboard) {
        void p.offsetWidth;
        p.classList.add('is-enter');
        if (idx < prevIdx) p.classList.add('from-left');
        p.addEventListener('animationend', () => p.classList.remove('is-enter', 'from-left'), { once: true });
      }
    }
    state.tab = key;
    tabBtns.forEach((b) => {
      const on = b.dataset.tab === key;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    html.dataset.abteil = key;
    moveIndicator(fromKeyboard);
    if (updateHash) history.replaceState(null, '', `#/${key}`);
    highlight();
    if (key === 'ueberblick') countUp();
    if (scroll) scrollToPanels();
  }

  tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[role="tab"]');
    if (b) setTab(b.dataset.tab, { scroll: true });
  });
  tabsEl.addEventListener('keydown', (e) => {
    let i = tabBtns.indexOf(document.activeElement);
    if (i < 0) i = tabBtns.findIndex((b) => b.dataset.tab === state.tab);
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % tabBtns.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabBtns.length) % tabBtns.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabBtns.length - 1;
    if (n == null) return;
    e.preventDefault();
    setTab(tabBtns[n].dataset.tab, { fromKeyboard: true });
    tabBtns[n].focus();
  });

  // ---- Suche -----------------------------------------------------------
  function parseQuery(q) {
    const terms = [], secs = [];
    for (const raw of q.trim().split(/\s+/)) {
      if (!raw) continue;
      if (raw.startsWith('§')) {
        const s = raw.slice(1).replace(/[.,;:]+$/, '');
        if (s) secs.push(s);
      } else terms.push(fold(raw));
    }
    return { terms, secs };
  }
  const matchSec = (e, secs) => !secs.length || secs.every((s) => [...e.data.sections].some((x) => x === s || x.startsWith(s + '.')));
  const matchText = (e, terms) => terms.every((t) => e.data.text.includes(t));

  function filterOk(e) {
    const f = state.filters[e.tab];
    return !f || f === '*' || e.group === f;
  }

  function setQuery(q, { fromInput = false } = {}) {
    state.q = q;
    if (!fromInput && input.value !== q) input.value = q;
    form.classList.toggle('has-q', !!q);
    clearBtn.hidden = !q;
    Object.assign(state, parseQuery(q));
    apply();
  }

  function bestTab() {
    let best = null, n = 0;
    for (const k of LIST_TABS) if ((state.hits[k] || 0) > n) { n = state.hits[k]; best = k; }
    return best;
  }

  function apply() {
    const active = state.terms.length > 0 || state.secs.length > 0;
    for (const k of LIST_TABS) {
      const b = built[k];
      let hits = 0, visible = 0;
      for (const e of b.entries) {
        const m = (!active) || (matchText(e, state.terms) && matchSec(e, state.secs));
        e.match = m;
        if (m) hits++;
        const show = m && filterOk(e);
        e.el.hidden = !show;
        if (show) visible++;
      }
      state.hits[k] = hits;
      // Gruppen ohne sichtbare Karten ausblenden
      $$('.group', b.list).forEach((g) => { g.hidden = !$$('.card', g).some((c) => !c.hidden); });

      const btn = tabBtns.find((t) => t.dataset.tab === k);
      const badge = btn && $('[data-count]', btn);
      if (badge) badge.textContent = String(active ? hits : b.entries.length);
      btn?.classList.toggle('is-hit', active && hits > 0);
      btn?.classList.toggle('is-zero', active && hits === 0);
      if (btn) btn.setAttribute('aria-label', `${TAB_LABEL[k]}, ${active ? plural(hits, 'Treffer', 'Treffer') : plural(b.entries.length, 'Eintrag', 'Einträge')}`);

      updateStatus(k, hits, visible, active);
      updateNoHits(k, visible, active);
      if (k === 'glossar') updateAZ();
      if (k === 'prompts' && state.terms.length) openPromptHits();
    }
    highlight();
  }

  function updateStatus(k, hits, visible, active) {
    const el = $(`#status-${k}`);
    if (!el) return;
    const total = built[k].entries.length;
    el.textContent = '';
    if (!total) return;
    const f = state.filters[k];
    const filtered = f && f !== '*';
    if (!active) {
      el.append(filtered ? h('span', null, h('strong', null, String(visible)), ` von ${total} · „${f}“`) : plural(total, 'Eintrag', 'Einträge'));
      return;
    }
    const sec = state.secs[0];
    const secTitle = sec && D.sectionTitles.get(sec);
    const what = [];
    if (state.secs.length) what.push(`Abschnitt ${state.secs.join(', ')}${secTitle ? ` · ${secTitle}` : ''}`);
    const words = state.q.split(/\s+/).filter((w) => w && !w.startsWith('§'));
    if (words.length) what.push(`„${words.join(' ')}“`);
    el.append(h('strong', null, String(hits)), ` ${hits === 1 ? 'Treffer' : 'Treffer'} für ${what.join(' + ')}`);
    if (filtered) el.append(` · ${visible} sichtbar mit Filter „${f}“`);
  }

  function updateNoHits(k, visible, active) {
    const b = built[k];
    b.noHits.textContent = '';
    const show = b.entries.length > 0 && visible === 0;
    b.noHits.hidden = !show;
    if (!show) return;
    const actions = [];
    const f = state.filters[k];
    if (f && f !== '*' && state.hits[k] > 0) actions.push(h('button', { class: 'btn btn--sm', type: 'button', 'data-reset-filter': k }, 'Filter zurücksetzen'));
    for (const o of LIST_TABS) {
      if (o !== k && (state.hits[o] || 0) > 0) actions.push(h('button', { class: 'btn btn--sm btn--accent', type: 'button', 'data-goto': o }, `${state.hits[o]} in ${TAB_LABEL[o]}`));
    }
    if (active) actions.push(h('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'data-clear-search': '' }, 'Suche leeren'));
    b.noHits.appendChild(emptyState(
      `Keine Treffer in ${TAB_LABEL[k]}.`,
      active ? `Für „${state.q}“ gibt es hier nichts${actions.length > 1 ? ' – aber in anderen Abteilen' : ''}.` : 'Der Filter blendet alle Einträge aus.',
      actions, ['?']));
  }

  function updateAZ() {
    const az = $('[data-az]', built.glossar.panel);
    if (!az) return;
    az.textContent = '';
    const present = new Set(built.glossar.entries.filter((e) => !e.el.hidden).map((e) => e.letter));
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    if ([...new Set(built.glossar.entries.map((e) => e.letter))].includes('#')) letters.push('#');
    for (const L of letters) {
      const id = `glossar-buchstabe-${L === '#' ? 'sonst' : L}`;
      az.appendChild(present.has(L)
        ? h('a', { href: `#${id}`, 'data-letter': id, 'aria-label': `Buchstabe ${L}` }, L)
        : h('span', { 'aria-hidden': 'true' }, L));
    }
  }

  // ---- Treffer markieren ----------------------------------------------
  const hlApi = typeof CSS !== 'undefined' && CSS.highlights && typeof window.Highlight === 'function';
  function clearMarks() {
    if (hlApi) { CSS.highlights.delete('hit'); return; }
    $$('mark.hl', panelsEl).forEach((m) => {
      const p = m.parentNode;
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();
    });
  }
  function highlight() {
    clearMarks();
    const terms = state.terms.filter((t) => t.length >= 1);
    if (!terms.length) return;
    const panel = built[state.tab].panel;
    const ranges = [];
    const seen = new Set();
    for (const c of $$('[data-hl]', panel)) {
      if (c.closest('[hidden]')) continue;
      const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement && n.parentElement.closest('.katex, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      let n;
      while ((n = walker.nextNode())) {
        if (seen.has(n)) continue;
        seen.add(n);
        const f = fold(n.data);
        for (const t of terms) {
          let i = 0;
          while ((i = f.indexOf(t, i)) !== -1) { ranges.push([n, i, i + t.length]); i += t.length; }
        }
        if (ranges.length > 3000) break;
      }
    }
    if (!ranges.length) return;
    if (hlApi) {
      const hl = new window.Highlight();
      for (const [node, a, b] of ranges) { const r = new Range(); r.setStart(node, a); r.setEnd(node, b); hl.add(r); }
      CSS.highlights.set('hit', hl);
      return;
    }
    // Fallback: <mark> einsetzen (je Textknoten von hinten nach vorn)
    const byNode = new Map();
    for (const [node, a, b] of ranges) { if (!byNode.has(node)) byNode.set(node, []); byNode.get(node).push([a, b]); }
    for (const [node, list] of byNode) {
      list.sort((x, y) => x[0] - y[0]);
      const merged = [];
      for (const r of list) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push([...r]); }
      for (let k = merged.length - 1; k >= 0; k--) {
        const [a, b] = merged[k];
        const mid = node.splitText(a);
        mid.splitText(b - a);
        const mark = document.createElement('mark');
        mark.className = 'hl';
        mid.parentNode.replaceChild(mark, mid);
        mark.appendChild(mid);
      }
    }
  }

  // ---- Prompts: Markdown lazy ------------------------------------------
  let mdReady = null;
  function ensureMd() {
    if (!mdReady) {
      mdReady = Promise.all([loadScript(...LIBS.marked), loadScript(...LIBS.purify)]).then(() => {
        if (window.DOMPurify && !window.__purifyHook) {
          window.DOMPurify.addHook('afterSanitizeAttributes', (node) => {
            if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
          });
          window.__purifyHook = true;
        }
        return !!(window.marked && window.DOMPurify);
      }).catch(() => false);
    }
    return mdReady;
  }
  async function renderPart(det) {
    const box = $('[data-md]', det);
    if (!box || box.dataset.done) return;
    box.dataset.done = '1';
    const [i, j] = box.dataset.md.split(':').map(Number);
    const md = D.prompts[i]?.teile[j]?.markdown || '';
    if (!md.trim()) { box.textContent = 'Kein Text hinterlegt.'; return; }
    box.textContent = 'Wird geladen …';
    const ok = await ensureMd();
    box.textContent = '';
    if (ok) {
      try {
        const out = window.marked.parse(md, { gfm: true, breaks: true });
        box.innerHTML = window.DOMPurify.sanitize(out, { FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe'], FORBID_ATTR: ['style'] });
      } catch (_) {
        box.appendChild(h('pre', { class: 'prose-plain' }, md));
      }
    } else {
      box.appendChild(h('pre', { class: 'prose-plain' }, md));
    }
    if (state.terms.length) highlight();
  }
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d instanceof HTMLDetailsElement && d.classList.contains('part') && d.open) renderPart(d);
  }, true);

  function openPromptHits() {
    if (state.q.trim().length < 2) return;
    for (const e of built.prompts.entries) {
      if (e.el.hidden) continue;
      e.data.teile.forEach((t, j) => {
        if (state.terms.some((term) => t.fold.includes(term))) {
          const d = e.parts[j];
          if (d && !d.open) { d.open = true; renderPart(d); }
        }
      });
    }
  }

  // ---- Mathe -----------------------------------------------------------
  const MATH_RE = /\$[^$]+\$|\\\(|\\\[/;
  const needsMath = ['quellen', 'praemissen', 'glossar'].some((k) => D[k].some((x) => MATH_RE.test(Object.values(x).filter((v) => typeof v === 'string').join(' ')) || (x.fundstellen || []).some?.((f) => MATH_RE.test(f.aussage || ''))));
  async function renderMath() {
    if (!needsMath) return;
    try {
      loadCss(...LIBS.katexCss);
      await loadScript(...LIBS.katex);
      await loadScript(...LIBS.katexAuto);
      if (!window.renderMathInElement) return;
      clearMarks();
      for (const k of ['quellen', 'praemissen', 'glossar', 'ueberblick']) {
        window.renderMathInElement(built[k].panel, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true },
          ],
          throwOnError: false,
          ignoredClasses: ['no-math', 'cite__text'],
        });
      }
      highlight();
    } catch (_) { /* Mathe bleibt als $…$ lesbar */ }
  }

  // ---- Zähler im Überblick ---------------------------------------------
  let counted = false;
  function countUp() {
    if (counted) return;
    counted = true;
    const nums = $$('[data-countup]', built.ueberblick.panel);
    if (!motionOk()) return;
    const start = performance.now(), dur = 900;
    const to = nums.map((n) => +n.dataset.countup || 0);
    nums.forEach((n) => { n.textContent = '0'; });
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      nums.forEach((n, i) => { n.textContent = String(Math.round(to[i] * e)); });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && state.tab === 'ueberblick') { countUp(); o.disconnect(); }
    }, { threshold: 0.3 });
    o.observe($('.tiles', built.ueberblick.panel));
  }

  // ---- Routing ---------------------------------------------------------
  function findEntry(tab, id) {
    const list = built[tab]?.entries || [];
    return list.find((e) => e.id === id)
      || list.find((e) => e.id.toLowerCase() === id.toLowerCase())
      || (tab === 'glossar' ? list.find((e) => e.id === slugify(id)) : null)
      || (tab === 'prompts' ? list.find((e) => e.id === slugify(id)) : null);
  }

  function flash(el) {
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    el.addEventListener('animationend', () => el.classList.remove('is-flash'), { once: true });
  }

  function go(r, { initial = false } = {}) {
    if (!r) return false;
    if (r.tab === 'abschnitt' && r.id) {
      setQuery(`§${r.id}`);
      setTab(bestTab() || 'ueberblick', { updateHash: false });
      scrollToArchive(initial);
      return true;
    }
    if (r.tab === 'netz') {
      setTab('ueberblick', { updateHash: false });
      const n = document.getElementById('netz');
      if (n) requestAnimationFrame(() => scrollToEl(n, initial));
      else scrollToArchive(initial);
      return true;
    }
    if (!built[r.tab]) return false;
    setTab(r.tab, { updateHash: false });
    if (!r.id) { scrollToArchive(initial); return true; }
    const e = findEntry(r.tab, r.id);
    if (!e) {
      toast(`Eintrag „${r.id}“ wurde nicht gefunden.`);
      scrollToArchive(initial);
      return true;
    }
    if (e.el.hidden) {
      state.filters[r.tab] = '*';
      $$(`.chiprow[data-filter] .fchip`, built[r.tab].panel).forEach((c) => c.setAttribute('aria-pressed', c.dataset.value === '*' ? 'true' : 'false'));
      setQuery('');
      toast('Suche und Filter zurückgesetzt, um den Eintrag zu zeigen.');
    }
    if (r.tab === 'quellen') e.details.forEach((d) => { d.open = true; });
    e.el.classList.add('rv-in');
    requestAnimationFrame(() => {
      scrollToEl(e.el, initial);
      setTimeout(() => { scrollToEl(e.el, true); flash(e.el); }, initial ? 60 : 900);
    });
    return true;
  }

  function focusSearch() {
    const r = bar.getBoundingClientRect();
    if (r.top > window.innerHeight || r.bottom < 0 || panelsEl.getBoundingClientRect().top > window.innerHeight) {
      scrollToArchive(false);
      setTimeout(() => input.focus({ preventScroll: true }), 700);
    } else input.focus({ preventScroll: true });
  }

  // ---- Ereignisse ------------------------------------------------------
  const onInput = debounce(() => {
    setQuery(input.value, { fromInput: true });
    if (state.q && (state.tab === 'ueberblick' || !(state.hits[state.tab] > 0))) {
      const b = bestTab();
      if (b) setTab(b, { updateHash: false });
    }
    if (state.q) scrollToPanels();
  }, 110);
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (input.value) { e.preventDefault(); setQuery(''); }
      else input.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
      scrollToPanels();
    }
  });
  clearBtn.addEventListener('click', () => { setQuery(''); input.focus({ preventScroll: true }); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    focusSearch();
  });

  const base = () => location.href.split('#')[0].split('?')[0];

  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const a = t.closest('a[href^="#/"]');
    if (a) {
      e.preventDefault();
      const href = a.getAttribute('href');
      if (location.hash !== href) history.pushState(null, '', href);
      go(parseRoute(href));
      return;
    }
    const letter = t.closest('a[data-letter]');
    if (letter) {
      e.preventDefault();
      const target = document.getElementById(letter.dataset.letter);
      if (target) scrollToEl(target);
      return;
    }
    const top = t.closest('[data-scrolltop]');
    if (top) {
      e.preventDefault();
      history.replaceState(null, '', location.pathname + location.search);
      ctx.scrollTo(0, {});
      return;
    }
    if (t.closest('[data-action="search"]')) { focusSearch(); return; }

    const cl = t.closest('[data-copy-link]');
    if (cl) {
      const ok = await copyText(base() + cl.dataset.copyLink);
      toast(ok ? 'Link kopiert.' : 'Kopieren nicht möglich.');
      return;
    }
    const cc = t.closest('[data-copy-cite]');
    if (cc) {
      const p = D.prompts[+cc.dataset.copyCite];
      const ok = p && await copyText(p.zitierweise);
      toast(ok ? 'Zitierzeile kopiert.' : 'Kopieren nicht möglich.');
      return;
    }
    const cp = t.closest('[data-copy-part]');
    if (cp) {
      const [i, j] = cp.dataset.copyPart.split(':').map(Number);
      const ok = await copyText(D.prompts[i]?.teile[j]?.markdown || '');
      toast(ok ? 'Prompt-Text kopiert.' : 'Kopieren nicht möglich.');
      return;
    }
    const col = t.closest('[data-collapse]');
    if (col) {
      const d = col.closest('details');
      if (d) { d.open = false; scrollToEl(d, false); $('summary', d)?.focus({ preventScroll: true }); }
      return;
    }
    const sec = t.closest('[data-section]');
    if (sec) {
      setQuery(`§${sec.dataset.section}`);
      if (!(state.hits[state.tab] > 0)) setTab(bestTab() || state.tab, { updateHash: false });
      scrollToPanels();
      return;
    }
    const gt = t.closest('[data-goto]');
    if (gt) { setTab(gt.dataset.goto, { scroll: true }); return; }
    if (t.closest('[data-clear-search]')) { setQuery(''); return; }
    const rf = t.closest('[data-reset-filter]');
    if (rf) {
      const k = rf.dataset.resetFilter;
      state.filters[k] = '*';
      $$(`.chiprow[data-filter] .fchip`, built[k].panel).forEach((c) => c.setAttribute('aria-pressed', c.dataset.value === '*' ? 'true' : 'false'));
      apply();
      return;
    }
    const chip = t.closest('.chiprow[data-filter] .fchip');
    if (chip) {
      const panel = chip.closest('.panel');
      const k = panel.id.replace('panel-', '');
      state.filters[k] = chip.dataset.value;
      $$('.fchip', chip.parentElement).forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
      apply();
      scrollToPanels();
      return;
    }
    const lv = t.closest('[data-level-switch] [data-level]');
    if (lv) {
      state.level = lv.dataset.level;
      built.glossar.panel.dataset.level = state.level;
      $$('[data-level]', lv.parentElement).forEach((b) => b.setAttribute('aria-pressed', b === lv ? 'true' : 'false'));
      highlight();
    }
  });

  window.addEventListener('popstate', () => {
    const r = parseRoute(location.hash);
    if (r) go(r);
  });

  apply();
  idle(() => renderMath(), 2500);

  return {
    go, setTab, focusSearch, renderMath,
    route: () => parseRoute(location.hash),
    refreshIndicator: () => moveIndicator(true),
  };
}
