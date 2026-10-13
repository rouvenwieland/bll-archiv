// Kleine Helfer ohne Abhängigkeiten.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const reduceMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
export const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
export const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Element erzeugen: h('div', {class:'x', text:'…', on:{click}}, kind1, kind2 …) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // nur für eigene, statische Strings
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'props') Object.assign(el, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === '') continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/** String robust lesen: null/undefined/Objekte -> '' */
export function str(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}
/** Array robust lesen */
export function arr(v) {
  if (Array.isArray(v)) return v.filter((x) => x != null && x !== '');
  if (v == null || v === '') return [];
  return [v];
}

/**
 * Faltung für die Suche: Kleinbuchstaben, Diakritika weg — längentreu
 * (jede UTF-16-Einheit bleibt genau eine), damit Treffer-Positionen
 * direkt auf den Originaltext passen.
 */
const foldCache = new Map();
export function fold(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let f = foldCache.get(c);
    if (f === undefined) {
      const code = c.charCodeAt(0);
      if (code >= 0xd800 && code <= 0xdfff) f = c;
      else {
        const lower = c.toLowerCase();
        f = (lower.normalize('NFD')[0] || c);
        if (f.length !== 1) f = c;
        if (c === '’' || c === '‘' || c === '‚') f = "'";
        else if (c === '“' || c === '”' || c === '„') f = '"';
        else if (c === '–' || c === '—') f = '-';
      }
      foldCache.set(c, f);
    }
    out += f;
  }
  return out;
}

export function slugify(s) {
  return str(s)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\$[^$]*\$/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'eintrag';
}

export function formatDate(v) {
  const s = str(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return s;
}

export function isIsoDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str(v));
}

/** Leichte Aufräumung von LaTeX-Resten außerhalb der Mathematik. */
export function cleanTex(s) {
  if (!s) return '';
  return s
    .replace(/\\begin\{[a-zA-Z*]+\}(?:\[([^\]]*)\])?\s*/g, (_, t) => (t ? `${t}: ` : ''))
    .replace(/\s*\\end\{[a-zA-Z*]+\}/g, '')
    .replace(/\\(?:emph|textit|textbf|enquote)\{([^{}]*)\}/g, '$1');
}

export function plural(n, one, many) {
  return `${n.toLocaleString('de-DE')} ${n === 1 ? one : many}`;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* Fallback unten */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) {
    return false;
  }
}

const scriptCache = new Map();
export function loadScript(src, integrity, timeout = 8000) {
  if (scriptCache.has(src)) return scriptCache.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
    const t = setTimeout(() => reject(new Error('timeout ' + src)), timeout);
    s.onload = () => { clearTimeout(t); resolve(); };
    s.onerror = () => { clearTimeout(t); reject(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
  scriptCache.set(src, p);
  p.catch(() => scriptCache.delete(src));
  return p;
}
export function loadCss(href, integrity) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  if (integrity) { l.integrity = integrity; l.crossOrigin = 'anonymous'; }
  document.head.appendChild(l);
}

export const idle = (fn, timeout = 1500) =>
  ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout }) : setTimeout(fn, 200));

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let toastTimer;
export function toast(msg) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
}

/** Inline-SVG-Icons (eigene, statische Strings). */
const ICONS = {
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.36 0l3-3a4.5 4.5 0 0 0-6.36-6.36l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.36 0l-3 3a4.5 4.5 0 0 0 6.36 6.36l1.2-1.2"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.7A2.2 2.2 0 0 0 13.3 4.5H6.7A2.2 2.2 0 0 0 4.5 6.7v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8"/>',
  ext: '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M17 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V8.5A1.5 1.5 0 0 1 6.5 7H10"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20Z"/><path d="M14 3.5V8h4"/>',
  book: '<path d="M5 4.5h5.5A2.5 2.5 0 0 1 13 7v12.5a2 2 0 0 0-2-2H5Z"/><path d="M19 4.5h-3.5A2.5 2.5 0 0 0 13 7"/><path d="M19 4.5v13h-4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};
export function icon(name, cls) {
  const span = document.createElement('span');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${cls ? ` class="${cls}"` : ''}>${ICONS[name] || ''}</svg>`;
  return span.firstChild;
}
