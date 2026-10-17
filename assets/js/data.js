// Laden und Normalisieren von data/site.json. Jedes Feld darf fehlen.
import { str, arr, fold, slugify, formatDate, isIsoDate, cleanTex } from './util.js';

export function dataUrl() {
  const p = new URLSearchParams(location.search).get('data');
  const name = p && /^[a-z0-9-]{1,32}$/.test(p) ? p : null;
  return name ? `data/site.${name}.json` : 'data/site.json';
}

export async function loadData() {
  const url = dataUrl();
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const raw = await res.json();
  return normalize(raw && typeof raw === 'object' ? raw : {});
}

const TYP = {
  article: 'Aufsatz', book: 'Buch', incollection: 'Sammelbandbeitrag', inbook: 'Buchkapitel',
  inproceedings: 'Konferenzbeitrag', proceedings: 'Tagungsband', collection: 'Sammelband',
  online: 'Online-Quelle', misc: 'Sonstiges', thesis: 'Abschlussarbeit', phdthesis: 'Dissertation',
  mastersthesis: 'Abschlussarbeit', report: 'Bericht', techreport: 'Bericht', unpublished: 'Unveröffentlicht',
  software: 'Software', video: 'Video', audio: 'Audio', dataset: 'Datensatz', reference: 'Nachschlagewerk',
  inreference: 'Lexikonartikel', manual: 'Handbuch', booklet: 'Broschüre', periodical: 'Zeitschrift',
};

function uniqueId(base, used) {
  let id = base, n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function authorList(autor) {
  return str(autor).split(/\s+(?:and|und)\s+|;\s*/).map((s) => s.trim()).filter(Boolean);
}
function surname(a) {
  const s = a.includes(',') ? a.split(',')[0] : a.split(/\s+/).slice(-1)[0];
  return s.replace(/[{}]/g, '').trim();
}
function shortLabel(q) {
  const list = authorList(q.autor);
  let who = '';
  if (list.length === 1) who = surname(list[0]);
  else if (list.length === 2) who = `${surname(list[0])} & ${surname(list[1])}`;
  else if (list.length > 2) who = `${surname(list[0])} u. a.`;
  if (!who) who = q.titel ? q.titel.split(/\s+/).slice(0, 3).join(' ') + (q.titel.split(/\s+/).length > 3 ? ' …' : '') : q.id;
  return q.jahr ? `${who} ${q.jahr}` : who;
}

function normRef(r) {
  if (typeof r === 'string') return { id: r.trim(), stelle: '' };
  if (r && typeof r === 'object') return { id: str(r.id || r.key || r.quelle), stelle: str(r.stelle || r.seite || r.seiten) };
  return null;
}

function sectionsOf(list) {
  return arr(list).map((x) => (typeof x === 'object' ? str(x.abschnitt || x.nr) : str(x))).filter(Boolean);
}

export function normalize(raw) {
  const metaRaw = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  const meta = {};
  for (const [k, v] of Object.entries(metaRaw)) meta[k] = str(v);

  // Gliederung
  const sectionTitles = new Map();
  const kapitel = arr(raw.kapitel).map((k, i) => {
    const nr = str(k && k.nr) || String(i + 1);
    const titel = str(k && k.titel);
    if (titel) sectionTitles.set(nr, titel);
    const abschnitte = arr(k && k.abschnitte).map((a) => {
      const o = { nr: str(a && a.nr), titel: str(a && a.titel) };
      if (o.nr && o.titel) sectionTitles.set(o.nr, o.titel);
      return o;
    }).filter((a) => a.nr || a.titel);
    return { nr, titel, abschnitte };
  }).filter((k) => k.titel || k.abschnitte.length);

  // Quellen
  const usedQ = new Set();
  const quellen = arr(raw.quellen).filter((q) => q && typeof q === 'object').map((q, i) => {
    const o = {
      id: uniqueId(str(q.id) || `quelle-${i + 1}`, usedQ),
      typ: str(q.typ),
      gruppe: str(q.gruppe) || 'Weitere',
      autor: str(q.autor),
      jahr: str(q.jahr),
      titel: cleanTex(str(q.titel)),
      untertitel: cleanTex(str(q.untertitel)),
      in: cleanTex(str(q.in)),
      seiten: str(q.seiten),
      verlag: str(q.verlag),
      ort: str(q.ort),
      auflage: str(q.auflage),
      doi: str(q.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''),
      url: str(q.url),
      isbn: str(q.isbn),
      verwendung: cleanTex(str(q.verwendung)),
      zitat: cleanTex(str(q.zitat)),
      zitiert_in: sectionsOf(q.zitiert_in),
      fundstellen: arr(q.fundstellen).map((f) =>
        typeof f === 'string'
          ? { abschnitt: '', stelle: '', aussage: cleanTex(f) }
          : { abschnitt: str(f.abschnitt), stelle: str(f.stelle), aussage: cleanTex(str(f.aussage)) }
      ).filter((f) => f.abschnitt || f.stelle || f.aussage),
      verweise_anhang: arr(q.verweise_anhang),
    };
    o.typLabel = TYP[o.typ.toLowerCase()] || o.typ;
    o.autorDisplay = authorList(o.autor).join('; ');
    o.label = shortLabel(o);
    o.sections = new Set([...o.zitiert_in, ...o.fundstellen.map((f) => f.abschnitt).filter(Boolean)]);
    o.text = fold([o.id, o.autor, o.jahr, o.titel, o.untertitel, o.in, o.verlag, o.ort, o.doi, o.url, o.isbn,
      o.verwendung, o.zitat, o.gruppe, o.typLabel, ...o.fundstellen.flatMap((f) => [f.stelle, f.aussage])].join(' \u0001 '));
    return o;
  });
  const quellenById = new Map(quellen.map((q) => [q.id, q]));
  const quellenByLower = new Map(quellen.map((q) => [q.id.toLowerCase(), q]));

  // Prämissen
  const usedP = new Set();
  const praemissen = arr(raw.praemissen).filter((p) => p && typeof p === 'object').map((p, i) => {
    const o = {
      id: uniqueId(str(p.id) || `P${i + 1}`, usedP),
      gruppe: str(p.gruppe) || 'Weitere',
      name: cleanTex(str(p.name)),
      gehalt: cleanTex(str(p.gehalt)),
      fundstellen: sectionsOf(p.fundstellen),
      einwand: cleanTex(str(p.einwand)),
      folge: cleanTex(str(p.folge)),
      quellen: arr(p.quellen).map(normRef).filter((r) => r && r.id),
    };
    o.sections = new Set(o.fundstellen);
    o.text = fold([o.id, o.name, o.gehalt, o.einwand, o.folge, o.gruppe,
      ...o.quellen.map((r) => `${r.id} ${(quellenById.get(r.id) || {}).label || ''} ${r.stelle}`)].join(' \u0001 '));
    return o;
  });
  const praemissenById = new Map(praemissen.map((p) => [p.id, p]));

  // Glossar
  const usedG = new Set();
  const glossar = arr(raw.glossar).filter((g) => g && typeof g === 'object').map((g, i) => {
    const begriff = cleanTex(str(g.begriff)) || `Begriff ${i + 1}`;
    const o = {
      begriff,
      slug: uniqueId(slugify(str(g.slug) || begriff), usedG),
      kategorie: str(g.kategorie),
      einfach: cleanTex(str(g.einfach)),
      praezise: cleanTex(str(g.praezise)),
      abschnitte: sectionsOf(g.abschnitte),
      quellen: arr(g.quellen).map(normRef).filter((r) => r && r.id),
    };
    o.id = o.slug;
    const first = begriff.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toLocaleUpperCase('de-DE');
    o.letter = first.normalize('NFD').replace(/[̀-ͯ]/g, '') || '#';
    if (!/[A-Z]/.test(o.letter)) o.letter = '#';
    o.sections = new Set(o.abschnitte);
    o.text = fold([o.begriff, o.kategorie, o.einfach, o.praezise,
      ...o.quellen.map((r) => `${r.id} ${(quellenById.get(r.id) || {}).label || ''} ${r.stelle}`)].join(' \u0001 '));
    return o;
  }).sort((a, b) => a.begriff.localeCompare(b.begriff, 'de', { sensitivity: 'base' }));
  const glossarBySlug = new Map(glossar.map((g) => [g.slug, g]));
  const glossarByLower = new Map(glossar.map((g) => [fold(g.begriff), g]));

  // Prompts
  const usedR = new Set();
  const tpl = meta.zitierweise_ki;
  const prompts = arr(raw.prompts).filter((p) => p && typeof p === 'object').map((p, i) => {
    const o = {
      id: uniqueId(slugify(str(p.id) || str(p.titel) || `prompt-${i + 1}`), usedR),
      titel: str(p.titel) || `Chat ${i + 1}`,
      datum: str(p.datum),
      werkzeug: str(p.werkzeug),
      url: str(p.url),
      verfasser: str(p.verfasser),
      zweck: str(p.zweck),
      ergebnis: str(p.ergebnis),
      zitierweise: str(p.zitierweise),
      reihenfolge: Number.isFinite(+p.reihenfolge) ? +p.reihenfolge : 0,
      index: i,
      teile: arr(p.teile).map((t, j) => ({
        titel: str(t && t.titel) || `Teil ${j + 1}`,
        markdown: typeof t === 'string' ? t : (t && typeof t.markdown === 'string' ? t.markdown : str(t && t.text)),
        zitat: str(t && t.zitat),
      })).filter((t) => t.markdown || t.titel),
    };
    if (!o.zitierweise && tpl) {
      o.zitierweise = tpl
        .replace('<URL der KI>', o.url || '<URL der KI>')
        .replace('<Vorname Nachname>', o.verfasser || meta.autor || '<Vorname Nachname>')
        .replace('<Datum>', isIsoDate(o.datum) ? formatDate(o.datum) : (o.datum || '<Datum>'))
        .replace('<Angabe des verwendeten Prompts>', o.teile.length ? o.teile.map((t) => t.titel).join(', ') : '<Angabe des verwendeten Prompts>');
      o.zitierweiseAbgeleitet = true;
    }
    o.chars = o.teile.reduce((n, t) => n + t.markdown.length, 0);
    o.teile.forEach((t) => { t.fold = fold(t.titel + ' \u0001 ' + t.markdown); });
    o.sections = new Set();
    o.text = fold([o.id, o.titel, o.datum, formatDate(o.datum), o.werkzeug, o.url, o.verfasser, o.zweck, o.ergebnis, o.zitierweise].join(' \u0001 '))
      + ' \u0001 ' + o.teile.map((t) => t.fold).join(' \u0001 ');
    return o;
  }).sort((a, b) => {
    const da = isIsoDate(a.datum) ? a.datum : '9999', db = isIsoDate(b.datum) ? b.datum : '9999';
    if (da !== db) return da < db ? -1 : 1;
    if (a.reihenfolge !== b.reihenfolge) return a.reihenfolge - b.reihenfolge;
    return a.index - b.index;
  });

  // Zähler je Abschnitt (für die Gliederung)
  const sectionCounts = new Map();
  const bump = (sec, key) => {
    if (!sectionCounts.has(sec)) sectionCounts.set(sec, { quellen: 0, praemissen: 0, glossar: 0 });
    sectionCounts.get(sec)[key]++;
  };
  quellen.forEach((q) => q.sections.forEach((s) => bump(s, 'quellen')));
  praemissen.forEach((p) => p.sections.forEach((s) => bump(s, 'praemissen')));
  glossar.forEach((g) => g.sections.forEach((s) => bump(s, 'glossar')));

  return {
    meta, kapitel, sectionTitles, sectionCounts,
    quellen, praemissen, glossar, prompts,
    quellenById, quellenByLower, praemissenById, glossarBySlug, glossarByLower,
  };
}
