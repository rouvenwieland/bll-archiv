// DOM-Aufbau für Hero-Metadaten, Gliederung und die Archiv-Abteile.
import { h, icon, formatDate, slugify, fold, plural, str } from './util.js';

export const TABS = [
  { key: 'ueberblick', label: 'Überblick' },
  { key: 'quellen', label: 'Quellen' },
  { key: 'praemissen', label: 'Prämissen' },
  { key: 'glossar', label: 'Glossar' },
  { key: 'prompts', label: 'Prompts' },
];

/* ---------- Metadaten in statisches Markup ------------------------------ */
export function fillMeta(meta) {
  document.querySelectorAll('[data-meta]').forEach((el) => {
    const key = el.dataset.meta;
    const val = meta[key];
    if (key === 'stand') {
      if (val) { el.textContent = formatDate(val); el.setAttribute('datetime', val); }
      else el.closest('span')?.setAttribute('hidden', '');
      return;
    }
    if (val) el.textContent = key === 'art' ? shortArt(val) : val;
    else if (key === 'hinweis') el.hidden = true;
  });
  if (meta.titel) document.title = `${meta.titel} · Digitaler Anhang`;
}
function shortArt(art) {
  // „Besondere Lernleistung (BLL) im Rahmen der Abiturprüfung“ -> Label bleibt vollständig,
  // nur sehr lange Texte werden im Kicker nicht gekürzt, sondern umbrochen.
  return art;
}

/** Titel in Wort-Masken zerlegen (für die gestaffelte Einblendung). */
const SOFT = new Set(['und', 'der', 'die', 'das', 'des', 'dem', 'den', 'im', 'in', 'von', 'zur', 'zum', 'als', 'über', 'oder', 'mit', 'für']);
export function splitTitle(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  text.split(/\s+/).forEach((word, i, all) => {
    const mask = h('span', { class: 'mask', 'aria-hidden': 'true' },
      h('span', { class: 'w' + (SOFT.has(word.toLowerCase()) ? ' w--soft' : '') }, word));
    el.appendChild(mask);
    if (i < all.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return Array.from(el.querySelectorAll('.w'));
}

/** Schrift verkleinern, falls ein einzelnes Wort breiter als der Container ist. */
export function fitTitle(el) {
  el.style.setProperty('--fit', '1');
  const maxW = el.parentElement.clientWidth;
  let fit = 1;
  for (let i = 0; i < 8; i++) {
    const widest = Math.max(...Array.from(el.querySelectorAll('.mask')).map((m) => m.scrollWidth));
    if (widest <= maxW + 0.5) break;
    fit *= Math.max(0.6, (maxW / widest) * 0.985);
    el.style.setProperty('--fit', fit.toFixed(3));
  }
}

/* ---------- Gliederung --------------------------------------------------- */
export function renderChapters(D) {
  const sec = document.getElementById('gliederung');
  const track = sec.querySelector('[data-chapters]');
  const meter = sec.querySelector('[data-meter]');
  if (!D.kapitel.length) { sec.hidden = true; return; }
  sec.hidden = false;
  track.textContent = '';
  meter.textContent = '';
  D.kapitel.forEach((k, i) => {
    const list = h('ul', { class: 'chapter__list' }, k.abschnitte.map((a) => h('li', null, sectionRow(a, D))));
    track.appendChild(h('article', { class: 'chapter', 'data-chapter': String(i) },
      h('div', { class: 'chapter__top' },
        h('span', { class: 'chapter__nr', 'aria-hidden': 'true' }, String(k.nr).padStart(2, '0')),
        h('span', { class: 'mono-label' }, `kapitel ${k.nr}`)),
      h('h3', { class: 'chapter__title' }, k.titel || `Kapitel ${k.nr}`),
      k.abschnitte.length ? list : null));
    meter.appendChild(h('i', null, String(k.nr)));
  });
}

export function sectionRow(a, D) {
  const c = D.sectionCounts.get(a.nr);
  const total = c ? c.quellen + c.praemissen + c.glossar : 0;
  const kids = [
    h('span', { class: 'nr' }, a.nr),
    h('span', null, a.titel || ''),
  ];
  if (total > 0) {
    const parts = [];
    if (c.quellen) parts.push(plural(c.quellen, 'Quelle', 'Quellen'));
    if (c.praemissen) parts.push(plural(c.praemissen, 'Prämisse', 'Prämissen'));
    if (c.glossar) parts.push(plural(c.glossar, 'Begriff', 'Begriffe'));
    kids.push(h('span', { class: 'cnt', title: parts.join(' · ') }, String(total)));
    return h('a', { class: 'chapter__row', href: `#/abschnitt/${encodeURIComponent(a.nr)}`, 'aria-label': `Abschnitt ${a.nr} ${a.titel}: ${parts.join(', ')} im Archiv anzeigen` }, kids);
  }
  return h('div', { class: 'chapter__row' }, kids);
}

/* ---------- Tabs ---------------------------------------------------------- */
export function renderTabs(container, counts) {
  const ind = container.querySelector('.tabs__ind');
  TABS.forEach((t, i) => {
    const btn = h('button', {
      class: 'tab', type: 'button', role: 'tab', id: `tab-${t.key}`, 'data-tab': t.key,
      'aria-controls': `panel-${t.key}`, 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1',
    },
    h('span', { class: 'tab__dot', 'aria-hidden': 'true' }),
    h('span', null, t.label),
    t.key === 'ueberblick' ? null : h('span', { class: 'tab__count', 'data-count': '' }, String(counts[t.key] ?? 0)));
    container.insertBefore(btn, ind);
  });
}

/* ---------- Bausteine ----------------------------------------------------- */
function idSafe(s) { return slugify(s).slice(0, 60); }

function linkTool(hash, label) {
  return h('button', { class: 'icon-btn', type: 'button', 'data-copy-link': hash, 'aria-label': `Link zu „${label}“ kopieren`, title: 'Link kopieren' }, icon('link'));
}

function sectionChip(nr, D) {
  const t = D.sectionTitles.get(nr);
  return h('button', {
    class: 'chip', type: 'button', 'data-section': nr,
    title: t ? `${nr} ${t}` : `Abschnitt ${nr}`,
    'aria-label': `Abschnitt ${nr}${t ? ' ' + t : ''}: alle Einträge zeigen`,
  }, nr);
}

function chips(label, list, D) {
  if (!list.length) return null;
  return h('div', { class: 'chips' }, h('span', { class: 'chips__label' }, label), list.map((nr) => sectionChip(nr, D)));
}

function fact(label, content, mod) {
  if (content == null || content === '' || (Array.isArray(content) && !content.length)) return null;
  return h('div', { class: 'fact' + (mod ? ` fact--${mod}` : '') },
    h('span', { class: 'fact__label' }, label),
    typeof content === 'string' ? h('p', { class: 'fact__val math', 'data-hl': '' }, content) : content);
}

function safeHref(u) {
  try {
    const url = new URL(u, location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch (_) { return null; }
}
function prettyUrl(u) {
  try {
    const url = new URL(u);
    const path = url.pathname.replace(/\/$/, '');
    return url.hostname.replace(/^www\./, '') + (path.length > 1 ? (path.length > 28 ? path.slice(0, 26) + '…' : path) : '');
  } catch (_) { return u; }
}

export function quelleRef(r, D) {
  const q = D.quellenById.get(r.id) || D.quellenByLower.get(r.id.toLowerCase());
  const label = q ? q.label : r.id;
  const node = q
    ? h('a', { class: 'ref', href: `#/quellen/${encodeURIComponent(q.id)}`, title: q.titel || q.id, 'data-hl': '' }, label)
    : h('span', { class: 'ref ref--missing', title: 'Nicht im Quellenverzeichnis dieser Seite', 'data-hl': '' }, label);
  return h('li', null, node, r.stelle ? h('span', { 'data-hl': '' }, `, ${r.stelle}`) : null);
}

function anhangRef(v, D) {
  let key = '', typ = '';
  if (typeof v === 'string') key = v.trim();
  else if (v && typeof v === 'object') { key = str(v.id || v.ziel || v.begriff || v.name || v.slug); typ = str(v.typ || v.art).toLowerCase(); }
  if (!key) return null;
  const m = key.match(/^(Prämisse|Praemisse|Premisse|Glossar|Begriff)\s*:?\s+(.+)$/i);
  if (m) { typ = m[1].toLowerCase().startsWith('pr') ? 'praemisse' : 'glossar'; key = m[2].trim(); }
  const p = (!typ || typ.startsWith('pr')) && D.praemissenById.get(key);
  if (p) return h('li', null, h('a', { class: 'ref ref--praemissen', href: `#/praemissen/${encodeURIComponent(p.id)}` }, `${p.id}${p.name ? ' · ' + p.name : ''}`));
  const g = D.glossarBySlug.get(slugify(key)) || D.glossarByLower.get(fold(key));
  if (g) return h('li', null, h('a', { class: 'ref ref--glossar', href: `#/glossar/${encodeURIComponent(g.slug)}` }, g.begriff));
  return h('li', null, h('span', { class: 'ref ref--missing' }, key));
}

/** *Hervorhebung* in Titeln als Kursive (nur Sternchen-Paare, kein weiteres Markdown). */
function inlineEm(text) {
  const parts = String(text).split(/\*([^*]+)\*/g);
  return parts.map((p, i) => (i % 2 ? h('em', null, p) : p));
}

function details(summaryText, body, cls = 'more') {
  const d = h('details', { class: cls },
    h('summary', null, h('span', null, summaryText), icon('chev', 'chev')),
    h('div', { class: 'more__body' }, body));
  return d;
}

/* ---------- Karten -------------------------------------------------------- */
function quelleCard(q, i, D, multiGroup) {
  const hash = `#/quellen/${encodeURIComponent(q.id)}`;
  const tid = `qt-${i}`;
  const pub = [];
  if (q.in) pub.push(`In: ${q.in}`);
  if (q.seiten) pub.push(`S. ${q.seiten}`);
  if (q.auflage) pub.push(/^\d+$/.test(q.auflage) ? `${q.auflage}. Aufl.` : q.auflage);
  const vo = [q.ort, q.verlag].filter(Boolean).join(': ');
  if (vo) pub.push(vo);

  const links = [];
  if (q.doi) {
    links.push(h('a', { class: 'xlink', href: `https://doi.org/${encodeURI(q.doi)}`, target: '_blank', rel: 'noopener', 'aria-label': `DOI ${q.doi} öffnen` },
      h('span', { 'data-hl': '' }, `doi:${q.doi}`), icon('ext')));
  }
  if (q.url) {
    const href = safeHref(q.url);
    links.push(href
      ? h('a', { class: 'xlink', href, target: '_blank', rel: 'noopener', 'aria-label': `Webseite ${prettyUrl(q.url)} öffnen` }, h('span', { 'data-hl': '' }, prettyUrl(q.url)), icon('ext'))
      : h('span', { class: 'xlink xlink--plain' }, h('span', { 'data-hl': '' }, q.url)));
  }
  if (q.isbn) links.push(h('span', { class: 'xlink xlink--plain' }, h('span', { 'data-hl': '' }, `ISBN ${q.isbn}`)));

  const kicker = [q.typLabel].filter(Boolean);
  const sections = [...new Set([...q.zitiert_in])];
  const anhang = q.verweise_anhang.map((v) => anhangRef(v, D)).filter(Boolean);

  const findBody = [];
  if (q.fundstellen.length) {
    findBody.push(h('ol', { class: 'finds' }, q.fundstellen.map((f) => h('li', { class: 'find' },
      f.abschnitt ? h('span', { class: 'find__sec' }, sectionChip(f.abschnitt, D)) : h('span', { class: 'find__sec' }),
      f.stelle ? h('span', { class: 'find__where', 'data-hl': '' }, f.stelle) : null,
      f.aussage ? h('blockquote', { class: 'find__what math' }, h('span', { 'data-hl': '' }, f.aussage)) : null))));
  }
  if (q.zitat) findBody.push(h('blockquote', { class: 'quote math', 'data-hl': '' }, q.zitat));
  let more = null;
  if (findBody.length) {
    const label = [q.fundstellen.length ? plural(q.fundstellen.length, 'Fundstelle', 'Fundstellen') : null, q.zitat ? 'Zitat' : null].filter(Boolean).join(' · ');
    more = details(label, findBody);
  }

  const card = h('article', { class: 'card qcard rv', id: `quelle-${i}`, 'aria-labelledby': tid },
    h('div', { class: 'card__top' },
      h('p', { class: 'card__kicker mono-label' }, kicker.map((k) => h('span', { 'data-hl': '' }, k)), h('span', { 'data-hl': '' }, q.id)),
      h('div', { class: 'card__tools' }, linkTool(hash, q.label))),
    q.autorDisplay || q.jahr
      ? h('p', { class: 'card__author' }, h('span', { 'data-hl': '' }, q.autorDisplay || '—'), q.jahr ? h('span', { class: 'yr', 'data-hl': '' }, ` · ${q.jahr}`) : null)
      : null,
    h('h4', { class: 'card__title math', id: tid, 'data-hl': '' }, inlineEm(q.titel || q.id), q.untertitel ? h('i', null, '. ', inlineEm(q.untertitel)) : null),
    pub.length ? h('p', { class: 'card__pub', 'data-hl': '' }, pub.join(', ')) : null,
    links.length ? h('div', { class: 'links' }, links) : null,
    q.verwendung ? h('p', { class: 'card__text math', 'data-hl': '' }, q.verwendung) : null,
    (sections.length || anhang.length) ? h('div', { class: 'facts' },
      chips('zitiert in', sections, D),
      anhang.length ? fact('im anhang', h('ul', { class: 'reflist' }, anhang)) : null) : null,
    more);
  return { el: card, details: more ? [more] : [] };
}

function praemisseCard(p, i, D) {
  const hash = `#/praemissen/${encodeURIComponent(p.id)}`;
  const tid = `pt-${i}`;
  const card = h('article', { class: 'card pcard rv', id: `praemisse-${i}`, 'aria-labelledby': tid },
    h('div', { class: 'card__top' },
      h('div', { class: 'pcard__head' },
        h('span', { class: 'pbadge', 'data-hl': '' }, p.id),
        h('h4', { class: 'pcard__name math', id: tid, 'data-hl': '' }, p.name || p.id)),
      h('div', { class: 'card__tools' }, linkTool(hash, p.id))),
    p.gehalt ? h('p', { class: 'card__text card__text--lead math', 'data-hl': '' }, p.gehalt) : null,
    h('div', { class: 'facts' },
      chips('fundstellen', p.fundstellen, D),
      fact('einwand', p.einwand, 'warn'),
      fact('folge', p.folge, 'plain'),
      p.quellen.length ? fact('quellen', h('ul', { class: 'reflist' }, p.quellen.map((r) => quelleRef(r, D)))) : null));
  return { el: card, details: [] };
}

function glossarCard(g, i, D) {
  const hash = `#/glossar/${encodeURIComponent(g.slug)}`;
  const tid = `gt-${i}`;
  const levels = [];
  if (g.einfach) levels.push(h('div', { class: 'level level--einfach' }, h('span', { class: 'level__label' }, 'einfach'), h('p', { class: 'level__text math', 'data-hl': '' }, g.einfach)));
  if (g.praezise) levels.push(h('div', { class: 'level level--praezise' }, h('span', { class: 'level__label' }, 'präzise'), h('p', { class: 'level__text math', 'data-hl': '' }, g.praezise)));
  const card = h('article', { class: 'card gcard rv', id: `begriff-${i}`, 'aria-labelledby': tid },
    h('div', { class: 'card__top' },
      h('p', { class: 'card__kicker mono-label' }, g.kategorie ? h('span', { 'data-hl': '' }, g.kategorie) : h('span', null, 'begriff')),
      h('div', { class: 'card__tools' }, linkTool(hash, g.begriff))),
    h('h4', { class: 'gterm math', id: tid, 'data-hl': '' }, g.begriff),
    levels.length ? h('div', { class: 'levels' }, levels) : null,
    (g.abschnitte.length || g.quellen.length) ? h('div', { class: 'facts' },
      chips('abschnitte', g.abschnitte, D),
      g.quellen.length ? fact('quellen', h('ul', { class: 'reflist' }, g.quellen.map((r) => quelleRef(r, D)))) : null) : null);
  return { el: card, details: [] };
}

function promptCard(p, i, D) {
  const hash = `#/prompts/${encodeURIComponent(p.id)}`;
  const tid = `rt-${i}`;
  const urlHref = p.url ? safeHref(p.url) : null;
  const meta = [
    ['datum', p.datum ? (formatDate(p.datum) === 'offen' ? 'offen' : formatDate(p.datum)) : ''],
    ['werkzeug', p.werkzeug],
    ['url der ki', p.url ? (urlHref ? h('a', { href: urlHref, target: '_blank', rel: 'noopener' }, p.url) : p.url) : ''],
    ['verfasser', p.verfasser],
  ].filter(([, v]) => v);

  const parts = p.teile.map((t, j) => {
    const body = h('div', { class: 'part__body' },
      h('div', { class: 'part__tools' },
        h('button', { class: 'btn btn--sm', type: 'button', 'data-copy-part': `${i}:${j}` }, icon('copy'), 'Text kopieren')),
      h('div', { class: 'prose', 'data-md': `${i}:${j}`, 'data-hl': '' }),
      h('div', { class: 'part__foot' },
        h('button', { class: 'btn btn--sm btn--ghost', type: 'button', 'data-collapse': '' }, 'Einklappen', icon('up'))));
    const d = h('details', { class: 'part', 'data-part': `${i}:${j}` },
      h('summary', null,
        h('span', { class: 'part__name', 'data-hl': '' }, t.titel),
        h('span', { class: 'part__len' }, plural(t.markdown.length, 'Zeichen', 'Zeichen')),
        icon('chev', 'chev')),
      body);
    return d;
  });

  const card = h('article', { class: 'card prcard rv', id: `prompt-${i}`, 'aria-labelledby': tid },
    h('div', { class: 'card__top' },
      h('p', { class: 'card__kicker mono-label' },
        p.datum ? h('span', { 'data-hl': '' }, formatDate(p.datum)) : null,
        h('span', null, plural(p.teile.length, 'Teil', 'Teile'))),
      h('div', { class: 'card__tools' }, linkTool(hash, p.titel))),
    h('h4', { class: 'prompt__title', id: tid, 'data-hl': '' }, p.titel),
    meta.length ? h('dl', { class: 'metagrid' }, meta.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', { 'data-hl': '' }, v)))) : null,
    (p.zweck || p.ergebnis) ? h('div', { class: 'facts' }, fact('zweck', p.zweck), fact('ergebnis', p.ergebnis)) : null,
    p.zitierweise ? h('div', { class: 'cite' },
      h('div', { class: 'cite__row' },
        h('span', { class: 'fact__label' }, p.zitierweiseAbgeleitet ? 'zitierzeile (aus der vorlage ergänzt)' : 'zitierzeile nach ki-infoblatt'),
        h('button', { class: 'btn btn--sm', type: 'button', 'data-copy-cite': String(i) }, icon('copy'), 'Kopieren')),
      h('p', { class: 'cite__text', 'data-hl': '' }, p.zitierweise)) : null,
    parts.length ? h('div', { class: 'parts' }, parts) : h('p', { class: 'card__text' }, 'Für diesen Chat sind keine Prompt-Texte hinterlegt.'));
  return { el: card, details: parts };
}

/* ---------- Panels -------------------------------------------------------- */
function panelShell(key, title, statusId) {
  return h('div', { class: 'panel', role: 'tabpanel', id: `panel-${key}`, 'aria-labelledby': `tab-${key}`, tabindex: '0', hidden: key !== 'ueberblick' },
    h('div', { class: 'panel__head' },
      h('h3', { class: 'panel__title' }, title),
      h('p', { class: 'panel__status', id: statusId, 'aria-live': 'polite' })));
}

export function emptyState(title, text, actions = [], cells = ['∅']) {
  return h('div', { class: 'state' },
    h('div', { class: 'state__cells', 'aria-hidden': 'true' },
      h('span', null, '…'), cells.map((c) => h('span', { class: 'hl' }, c)), h('span', null, '…')),
    h('p', { class: 'state__title' }, title),
    text ? h('p', null, text) : null,
    actions.length ? h('div', { class: 'state__actions' }, actions) : null);
}

function groupBy(list, keyFn) {
  const m = new Map();
  list.forEach((x, i) => { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push([x, i]); });
  return m;
}

function filterChips(name, groups, label) {
  if (groups.length < 2) return null;
  return h('div', { class: 'chiprow', role: 'group', 'aria-label': label, 'data-filter': name },
    h('button', { class: 'fchip', type: 'button', 'aria-pressed': 'true', 'data-value': '*' }, 'Alle'),
    groups.map(([g, n]) => h('button', { class: 'fchip', type: 'button', 'aria-pressed': 'false', 'data-value': g }, g, h('small', null, String(n)))));
}

export function buildListPanel(key, D) {
  const title = TABS.find((t) => t.key === key).label;
  const panel = panelShell(key, title, `status-${key}`);
  const controls = h('div', { class: 'controls' });
  const list = h('div', { class: 'panel__list' });
  const noHits = h('div', { class: 'panel__nohits', hidden: true });
  panel.append(controls, list, noHits);
  const entries = [];

  if (key === 'quellen' || key === 'praemissen') {
    const items = D[key];
    const groups = groupBy(items, (x) => x.gruppe);
    const multi = groups.size > 1;
    const fc = filterChips('gruppe', [...groups].map(([g, l]) => [g, l.length]), 'Nach Gruppe filtern');
    if (fc) controls.appendChild(fc);
    for (const [g, l] of groups) {
      const cards = h('div', { class: 'cards cards--2' });
      const sec = h('section', { class: 'group', 'data-group': g },
        multi ? h('div', { class: 'group__head' }, h('h4', { class: 'group__title' }, g), h('span', { class: 'group__count' }, String(l.length))) : null,
        cards);
      for (const [x, i] of l) {
        const built = key === 'quellen' ? quelleCard(x, i, D, multi) : praemisseCard(x, i, D);
        cards.appendChild(built.el);
        entries.push({ tab: key, id: x.id, data: x, el: built.el, group: g, details: built.details, groupEl: sec });
      }
      list.appendChild(sec);
    }
  }

  if (key === 'glossar') {
    const items = D.glossar;
    const kats = groupBy(items.filter((g) => g.kategorie), (x) => x.kategorie);
    const fc = filterChips('kategorie', [...kats].map(([g, l]) => [g, l.length]), 'Nach Kategorie filtern');
    const hasBoth = items.some((g) => g.einfach) && items.some((g) => g.praezise);
    if (hasBoth) {
      controls.appendChild(h('div', { class: 'seg', role: 'group', 'aria-label': 'Erklärungsebene', 'data-level-switch': '' },
        h('button', { type: 'button', 'aria-pressed': 'true', 'data-level': 'beide' }, 'Beide'),
        h('button', { type: 'button', 'aria-pressed': 'false', 'data-level': 'einfach' }, 'Einfach'),
        h('button', { type: 'button', 'aria-pressed': 'false', 'data-level': 'praezise' }, 'Präzise')));
    }
    if (items.length) controls.appendChild(h('nav', { class: 'az', 'aria-label': 'Alphabet', 'data-az': '' }));
    if (fc) controls.appendChild(fc);
    const letters = groupBy(items, (x) => x.letter);
    for (const [L, l] of letters) {
      const cards = h('div', { class: 'cards cards--2' });
      const sec = h('section', { class: 'group', 'data-letter': L },
        h('div', { class: 'group__head' }, h('h4', { class: 'group__letter', id: `glossar-buchstabe-${L === '#' ? 'sonst' : L}` }, L)),
        cards);
      for (const [x, i] of l) {
        const built = glossarCard(x, i, D);
        cards.appendChild(built.el);
        entries.push({ tab: key, id: x.slug, data: x, el: built.el, group: x.kategorie, letter: L, details: [], groupEl: sec });
      }
      list.appendChild(sec);
    }
  }

  if (key === 'prompts') {
    const cards = h('div', { class: 'cards' });
    D.prompts.forEach((x, i) => {
      const built = promptCard(x, i, D);
      cards.appendChild(built.el);
      entries.push({ tab: key, id: x.id, data: x, el: built.el, details: built.details, parts: built.details });
    });
    list.appendChild(cards);
  }

  if (!entries.length) {
    list.appendChild(emptyState('Noch keine Einträge.', D.meta.stand ? `Stand der Daten: ${formatDate(D.meta.stand)}.` : ''));
    controls.hidden = true;
  }
  return { panel, entries, controls, list, noHits };
}

function groupsSub(list) {
  const n = new Set(list.map((x) => x.gruppe)).size;
  if (!list.length) return 'noch keine Einträge';
  return n > 1 ? `in ${n} Gruppen` : plural(list.length, 'Eintrag', 'Einträge');
}

export function buildOverview(D) {
  const panel = panelShell('ueberblick', 'Überblick', 'status-ueberblick');
  const m = D.meta;
  const nParts = D.prompts.reduce((n, p) => n + p.teile.length, 0);
  const tile = (key, label, n, sub) =>
    h('button', { class: `tile tile--${key}`, type: 'button', 'data-goto': key, 'aria-label': `${label}: ${n} – Abteil öffnen` },
      h('span', { class: 'tile__label' }, label.toLowerCase()),
      h('span', { class: 'tile__num', 'data-countup': String(n) }, String(n)),
      h('span', { class: 'tile__sub' }, sub));

  const kv = [
    ['titel', m.titel], ['art', m.art], ['fach', m.fach], ['autor', m.autor],
    ['schule', m.schule], ['betreuung', m.betreuung], ['stand', m.stand ? formatDate(m.stand) : ''],
  ].filter(([, v]) => v);

  const toc = D.kapitel.length ? h('div', { class: 'toc' }, D.kapitel.map((k) =>
    h('div', { class: 'toc__ch' },
      h('p', { class: 'toc__chtitle' }, h('span', null, k.nr), k.titel),
      k.abschnitte.length ? h('ul', null, k.abschnitte.map((a) => h('li', null, sectionRow(a, D)))) : null))) : null;

  panel.append(
    h('div', { class: 'tiles' },
      tile('quellen', 'Quellen', D.quellen.length, groupsSub(D.quellen)),
      tile('praemissen', 'Prämissen', D.praemissen.length, groupsSub(D.praemissen)),
      tile('glossar', 'Glossar', D.glossar.length, D.glossar.length ? plural(D.glossar.length, 'Begriff', 'Begriffe') : 'noch keine Einträge'),
      tile('prompts', 'Prompts', D.prompts.length, D.prompts.length ? `${plural(D.prompts.length, 'Chat', 'Chats')} · ${plural(nParts, 'Teil', 'Teile')}` : 'noch keine Einträge')),
    h('section', { class: 'ov-card net', id: 'netz', 'data-net': '', 'aria-label': 'Quellen-Netz' }),
    h('div', { class: 'ov-grid' },
      h('div', { class: 'ov-card' },
        h('h4', null, 'zur arbeit'),
        kv.length ? h('dl', { class: 'kv' }, kv.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))) : null,
        m.hinweis ? h('p', { class: 'ov-note', style: 'margin-top:14px' }, m.hinweis) : null),
      h('div', { class: 'ov-card' },
        h('h4', null, 'suchen und verlinken'),
        h('p', { class: 'ov-note' }, 'Die Suche läuft über alle Abteile zugleich; die Zahl an jedem Reiter zeigt die Treffer. ',
          h('span', { class: 'kbd' }, '/'), ' springt in die Suche, ', h('span', { class: 'kbd' }, 'Esc'), ' leert sie.'),
        h('p', { class: 'ov-note' }, 'Eine Abschnittsnummer wie ', h('code', { class: 'kbd' }, '§2.4'), ' zeigt alle Einträge, die in diesem Abschnitt vorkommen. Jeder Eintrag hat einen eigenen Link zum Teilen.'),
        m.zitierweise_ki ? h('div', { class: 'cite', style: 'margin-top:14px' },
          h('span', { class: 'fact__label' }, 'zitierweise ki (vorlage)'),
          h('p', { class: 'cite__text' }, m.zitierweise_ki)) : null)),
    toc ? h('div', { class: 'ov-card', style: 'margin-top:12px' }, h('h4', null, 'gliederung'), toc) : null);
  return { panel, entries: [] };
}
