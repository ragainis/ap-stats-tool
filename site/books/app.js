/* Books: a Goodreads library enriched with Open Library data (see Books/tools in the source folder). */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const store = {
  get(k, d) { try { const v = localStorage.getItem('mz-books:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mz-books:' + k, JSON.stringify(v)); } catch {} },
};

/* ---------- vocabularies & icons ---------- */
const GENRE_ICON = {
  'Literary Fiction': '📖', 'Science Fiction': '🚀', 'Fantasy': '🐉', 'Mystery & Thriller': '🔍', 'Horror': '🕯️',
  'Historical Fiction': '🏰', 'Children & YA': '🧸', 'Romance': '🌹', 'Humor': '🎭', 'Comics & Graphic': '💬',
  'Poetry & Drama': '🪶', 'Essays & Letters': '✉️', 'Literature & Criticism': '🖋️', 'History': '🏛️',
  'Biography & Memoir': '👤', 'Religion & Spirituality': '🕊️', 'Philosophy': '🦉', 'Psychology & Self-Help': '🧠',
  'Business & Economics': '📈', 'Politics & Society': '⚖️', 'Science & Nature': '🔬', 'Technology & Math': '🧮',
  'Health & Fitness': '🏃', 'Arts & Music': '🎨', 'Travel & Places': '🧭', 'Language & Reference': '📚',
  'Food & Home': '🍳', 'Sports & Outdoors': '⛰️', 'Reference & Ideas': '💡', 'Uncategorized': '❔',
};
const STYLE_ICON = {
  'Novel': '📕', 'Short stories': '📑', 'Poetry': '🪶', 'Drama': '🎭', 'Memoir': '✍️', 'Biography': '👤', 'Letters': '✉️',
  'Essays': '🖋️', 'Practical guide': '🧰', 'Reference': '📚', 'Classic text': '📜', 'Narrative history': '🏺',
  'Ideas & argument': '💡', 'Graphic': '💬',
};
const POP = ['Iconic', 'Popular', 'Well known', 'Niche', 'Hidden gem'];
const POP_ICON = { 'Iconic': '🏆', 'Popular': '🔥', 'Well known': '⭐', 'Niche': '🌿', 'Hidden gem': '💎' };
const ERAS = ['Ancient', 'Medieval', 'Early modern', '19th century', 'Early 20th c.', 'Mid-century', 'Late 20th c.', '21st century', 'Unknown'];
const ERA_ICON = { 'Ancient': '🏺', 'Medieval': '🛡️', 'Early modern': '🧭', '19th century': '🎩', 'Early 20th c.': '📻', 'Mid-century': '🎷', 'Late 20th c.': '📼', '21st century': '💻', 'Unknown': '❔' };
const CLOTH = ['#6d2a22', '#2f4a36', '#24344f', '#7a5a1e', '#4d2d44', '#24484a', '#5a4030', '#3d4348', '#5b2433', '#34402a'];
const SHELVES = [['read', 'Read'], ['to-read', 'To read'], ['currently-reading', 'Reading'], ['all', 'All']];
const GROUPS = [['g', 'Genre'], ['s', 'Style'], ['p', 'Popularity'], ['e', 'Era'], ['tg', 'Key tags'], ['a', 'Author'], ['yr', 'Year read'], ['r', 'My rating'], ['none', 'No grouping']];
const SORTS = [['dr', 'Date read'], ['da', 'Date added'], ['r', 'My rating'], ['ps', 'Popularity'], ['y', 'Year published'], ['t', 'Title'], ['a', 'Author']];

const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const cloth = b => CLOTH[hash(b.g + b.a) % CLOTH.length];
const stars = n => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
const popDots = b => `<span class="pop" title="${esc(b.p)}">${[0, 1, 2, 3, 4].map(i => `<i class="${i < 5 - POP.indexOf(b.p) ? 'on' : ''}"></i>`).join('')}</span>`;
const coverUrl = (id, size) => `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;
const yearTxt = y => y == null ? '' : y < 0 ? `${-y} BC` : String(y);

/* ---------- state ---------- */
const S = {
  books: [], details: null, q: '',
  shelf: store.get('shelf', 'read'), group: store.get('group', 'g'), sort: store.get('sort', 'dr'), view: store.get('view', 'covers'),
  f: { g: new Set(), s: new Set(), p: new Set(), e: new Set(), r: new Set(), tg: new Set(), x: new Set() },
  visible: [], cur: -1, open: null,
};
const FACETS = [
  ['g', 'Genre', b => [b.g], v => GENRE_ICON[v] || '📘'],
  ['s', 'Style', b => [b.s], v => STYLE_ICON[v] || '📘'],
  ['p', 'Popularity', b => [b.p], v => POP_ICON[v], POP],
  ['e', 'Era', b => [b.e], v => ERA_ICON[v], ERAS],
  ['r', 'My rating', b => [b.r ? `${b.r}★` : 'Unrated'], v => v === 'Unrated' ? '·' : '★', ['5★', '4★', '3★', '2★', '1★', 'Unrated']],
  ['x', 'Special', b => [b.cl && 'Classic', b.se && 'Series', b.sv.includes('slow-reads') && 'Slow read', b.sv.includes('fast-reads') && 'Fast read', b.src === 'claude' && 'Hand-classified'].filter(Boolean), v => ({ 'Classic': '🏛️', 'Series': '🔗', 'Slow read': '🐢', 'Fast read': '🐇', 'Hand-classified': '✋' })[v]],
  ['tg', 'Key tags', b => b.tg, () => ''],
];

/* ---------- filtering ---------- */
function matchesQuery(b) {
  if (!S.q) return true;
  const hay = `${b.t} ${b.st || ''} ${b.a} ${b.se || ''} ${b.g} ${b.s} ${b.tg.join(' ')}`.toLowerCase();
  return S.q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
}
function passFacets(b, skip) {
  for (const [k, , get] of FACETS) {
    if (k === skip || !S.f[k].size) continue;
    const vals = get(b);
    if (!vals.some(v => S.f[k].has(v))) return false;
  }
  return true;
}
function base() { return S.books.filter(b => (S.shelf === 'all' || b.sh === S.shelf) && matchesQuery(b)); }

const cmp = {
  dr: (a, b) => (b.dr || '').localeCompare(a.dr || '') || (b.da || '').localeCompare(a.da || ''),
  da: (a, b) => (b.da || '').localeCompare(a.da || ''),
  r: (a, b) => b.r - a.r || cmp.dr(a, b),
  ps: (a, b) => b.ps - a.ps,
  y: (a, b) => (a.y ?? 9999) - (b.y ?? 9999),
  t: (a, b) => a.t.localeCompare(b.t),
  a: (a, b) => a.a.split(' ').pop().localeCompare(b.a.split(' ').pop()) || (a.y ?? 0) - (b.y ?? 0),
};

function groupsOf(list) {
  const key = S.group, map = new Map();
  const add = (k, b) => { if (!map.has(k)) map.set(k, []); map.get(k).push(b); };
  for (const b of list) {
    if (key === 'none') add('All', b);
    else if (key === 'tg') { if (b.tg.length) b.tg.slice(0, 3).forEach(t => add(t, b)); else add('No tags', b); }
    else if (key === 'yr') add(b.dr ? b.dr.slice(0, 4) : (b.sh === 'read' ? 'Date unknown' : 'Not read yet'), b);
    else if (key === 'r') add(b.r ? `${b.r} stars` : 'Unrated', b);
    else if (key === 'a') add(b.a, b);
    else add(b[key], b);
  }
  let entries = [...map.entries()];
  const order = { p: POP, e: ERAS }[key];
  if (order) entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  else if (key === 'yr' || key === 'r') entries.sort((a, b) => b[0].localeCompare(a[0]));
  else entries.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (key === 'tg' || key === 'a') {
    const big = entries.filter(([k, v]) => v.length >= 2 && k !== 'No tags');
    const rest = list.filter(b => !big.some(([, v]) => v.includes(b)));
    entries = big.slice(0, 40);
    if (rest.length) entries.push([key === 'a' ? 'Other authors' : 'Other books', rest]);
  }
  return entries;
}
const groupIcon = k => ({ g: GENRE_ICON, s: STYLE_ICON, p: POP_ICON, e: ERA_ICON })[S.group]?.[k] || (S.group === 'r' ? '★' : S.group === 'yr' ? '📅' : S.group === 'tg' ? '🏷️' : S.group === 'a' ? '✒️' : '');

/* ---------- rendering ---------- */
function renderStats() {
  const read = S.books.filter(b => b.sh === 'read');
  const rated = read.filter(b => b.r);
  const pages = read.reduce((a, b) => a + (b.pg || 0), 0);
  const oldest = S.books.reduce((m, b) => (b.y != null && b.y < m ? b.y : m), 9999);
  const stats = [
    [read.length.toLocaleString(), 'books read'], [pages.toLocaleString(), 'pages read'],
    [(rated.reduce((a, b) => a + b.r, 0) / Math.max(1, rated.length)).toFixed(2) + '★', 'average rating'],
    [S.books.filter(b => b.sh === 'to-read').length.toLocaleString(), 'to read'],
    [S.books.filter(b => b.cl).length, 'classics'],
    [new Set(read.map(b => b.a)).size.toLocaleString(), 'authors'],
    [yearTxt(oldest), 'oldest text'],
  ];
  $('#stats').innerHTML = stats.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
}

function renderControls() {
  $('#shelf').innerHTML = SHELVES.map(([k, l], i) => `<button data-shelf="${k}" aria-pressed="${S.shelf === k}" title="Key ${i + 1}">${l}</button>`).join('');
  $('#group').innerHTML = GROUPS.map(([k, l]) => `<option value="${k}"${S.group === k ? ' selected' : ''}>${l}</option>`).join('');
  $('#sort').innerHTML = SORTS.map(([k, l]) => `<option value="${k}"${S.sort === k ? ' selected' : ''}>${l}</option>`).join('');
  $('#view').innerHTML = [['covers', '🖼️ Covers'], ['list', '☰ List']].map(([k, l]) => `<button data-view="${k}" aria-pressed="${S.view === k}">${l}</button>`).join('') + '<kbd style="align-self:center;margin:0 4px">V</kbd>';
}

function renderFacets(list) {
  const html = FACETS.map(([k, title, get, icon, order]) => {
    const counts = new Map();
    for (const b of list) if (passFacets(b, k)) for (const v of get(b)) counts.set(v, (counts.get(v) || 0) + 1);
    for (const v of S.f[k]) if (!counts.has(v)) counts.set(v, 0);
    let vals = [...counts.entries()];
    if (order) vals.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    else vals.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (k === 'tg') vals = vals.slice(0, 45);
    if (!vals.length) return '';
    const opts = vals.map(([v, n]) => `<button class="opt${n ? '' : ' zero'}" data-facet="${k}" data-val="${esc(v)}" aria-pressed="${S.f[k].has(v)}">${k === 'tg' ? '' : `<span class="ic">${icon(v) || ''}</span>`}<span>${esc(v)}</span><span class="n">${n}</span></button>`).join('');
    return `<div class="facet"><h3>${title}${S.f[k].size ? `<button data-clear="${k}">clear</button>` : ''}</h3>${k === 'tg' ? `<div class="tagcloud">${opts}</div>` : opts}</div>`;
  }).join('');
  $('#facets').innerHTML = `<div class="facet" style="display:flex;justify-content:space-between;align-items:center"><b class="serif" style="font-size:1.3rem">Filter</b><span><button class="help-btn" data-clear="all">Clear all <kbd>C</kbd></button> <button class="help-btn filters-btn" id="closeFilters">Done</button></span></div>` + html;
}

function coverHTML(b, size = 'M') {
  const cl = `<div class="cloth" style="background-color:${cloth(b)}"><div class="orn">❦</div><div class="ct">${esc(b.t)}</div><div class="ca">${esc(b.a)}</div></div>`;
  const img = b.cv ? `<img loading="lazy" decoding="async" alt="" src="${coverUrl(b.cv, size)}" onerror="this.remove()" onload="if(this.naturalWidth<10)this.remove()">` : '';
  return cl + img;
}

function render() {
  const all = base();
  renderFacets(all);
  const list = all.filter(b => passFacets(b)).sort(cmp[S.sort]);
  S.visible = [];
  const groups = groupsOf(list);
  const active = FACETS.flatMap(([k, , , icon]) => [...S.f[k]].map(v => `<button data-facet="${k}" data-val="${esc(v)}" aria-pressed="true">${k === 'tg' ? '🏷️' : icon(v) || ''} ${esc(v)} ✕</button>`));
  $('#active').innerHTML = active.join('');
  const pages = list.reduce((a, b) => a + (b.pg || 0), 0);
  $('#summary').textContent = `${list.length.toLocaleString()} book${list.length === 1 ? '' : 's'} · ${pages.toLocaleString()} pages${S.q ? ` · matching “${S.q}”` : ''}`;
  if (!list.length) { $('#results').innerHTML = '<div class="empty">No books match. Press <kbd>C</kbd> to clear filters.</div>'; return; }
  let n = 0;
  $('#results').innerHTML = groups.map(([k, items]) => {
    const body = S.view === 'covers'
      ? `<div class="shelf">${items.map(b => { S.visible.push(b.id); return `
        <button class="book" data-id="${b.id}" data-n="${n++}" title="${esc(b.t)}${b.st ? ': ' + esc(b.st) : ''} — ${esc(b.a)}${b.y != null ? ' (' + yearTxt(b.y) + ')' : ''}">
          <div class="cover">${coverHTML(b)}<div class="badges">${b.cl ? '<span>CLASSIC</span>' : ''}${b.sh === 'currently-reading' ? '<span>READING</span>' : ''}</div></div>
          <div class="bt">${esc(b.t)}</div><div class="ba">${esc(b.a)}${b.y != null ? ' · ' + yearTxt(b.y) : ''}</div>
          ${b.r ? `<div class="stars">${stars(b.r)}</div>` : ''}
        </button>`; }).join('')}</div>`
      : `<div class="rows-head"><span></span><span>Title</span><span class="c">Author</span><span class="c">Year</span><span class="c">Genre</span><span class="c">Style</span><span class="c">Popular</span><span>Rating</span></div>
        <div class="rows">${items.map(b => { S.visible.push(b.id); return `
        <button class="row" data-id="${b.id}" data-n="${n++}">
          <span class="mini" style="background:${cloth(b)}">${b.cv ? `<img loading="lazy" alt="" src="${coverUrl(b.cv, 'S')}" onerror="this.remove()">` : ''}</span>
          <span class="rt"><b>${esc(b.t)}</b><span>${esc(b.st || b.se || '')}</span></span>
          <span class="c">${esc(b.a)}</span><span class="c">${yearTxt(b.y)}</span>
          <span class="c">${GENRE_ICON[b.g] || ''} ${esc(b.g)}</span><span class="c">${STYLE_ICON[b.s] || ''} ${esc(b.s)}</span>
          <span class="c">${popDots(b)}</span><span class="stars">${stars(b.r)}</span>
        </button>`; }).join('')}</div>`;
    return `<section class="group"><h2>${S.group !== 'none' ? `<span class="gi">${groupIcon(k)}</span>` : ''}${esc(k)} <small>${items.length}</small></h2>${body}</section>`;
  }).join('');
  S.cur = -1;
}

/* ---------- detail drawer ---------- */
async function loadDetails() {
  if (S.details) return S.details;
  try { S.details = await (await fetch('data/details.json')).json(); } catch { S.details = {}; }
  return S.details;
}
function chipBtn(k, v, icon) { return `<button class="chip k" data-facet="${k}" data-val="${esc(v)}" data-close="1">${icon ? icon + ' ' : ''}${esc(v)}</button>`; }

async function openBook(id) {
  const b = S.books.find(x => x.id === id); if (!b) return;
  S.open = id;
  const d = (await loadDetails())[id] || {};
  const au = d.au || {};
  const life = au.b || au.d ? ` <span class="note">(${au.b ? yearTxt(au.b) : '?'}–${au.d ? yearTxt(au.d) : ''})</span>` : '';
  const facts = [
    b.y != null && [yearTxt(b.y), 'first published'], b.pg && [b.pg.toLocaleString(), 'pages'],
    b.r && [stars(b.r), 'my rating'], b.dr && [b.dr.replace(/\//g, '-'), 'date read'],
    d.olr && [`${d.olr.toFixed(2)}★`, `Open Library (${d.olc})`], b.rd && [b.rd.toLocaleString(), 'OL readers'],
    d.ed && [d.ed, 'editions'], b.cy && [b.cy, 'cover edition'],
  ].filter(Boolean);
  $('#drawer').innerHTML = `
    <button class="close" data-act="close">Close <kbd>Esc</kbd></button>
    <div class="dhead">
      <div class="cover">${coverHTML(b, 'L')}</div>
      <div>
        <h2>${esc(b.t)}</h2>${b.st ? `<div class="sub">${esc(b.st)}</div>` : ''}
        <div class="by">by <b>${esc(b.a)}</b>${life}${b.se ? ` · <span class="note">${esc(b.se)}</span>` : ''}</div>
        <div class="chips">${chipBtn('g', b.g, GENRE_ICON[b.g])}${chipBtn('s', b.s, STYLE_ICON[b.s])}${chipBtn('p', b.p, POP_ICON[b.p])}${chipBtn('e', b.e, ERA_ICON[b.e])}${b.cl ? chipBtn('x', 'Classic', '🏛️') : ''}</div>
        <div class="chips">${b.tg.map(t => chipBtn('tg', t, '🏷️')).join('')}</div>
        ${b.src === 'claude' ? '<div class="note">Genre and style hand-classified (not in the Open Library catalog).</div>' : ''}
      </div>
    </div>
    <div class="dbody">
      <div class="facts">${facts.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
      ${d.fs ? `<h4>First sentence</h4><p class="fs">${esc(d.fs)}</p>` : ''}
      ${d.desc ? `<h4>About the book</h4>${d.desc.split(/\n\s*\n/).slice(0, 4).map(p => `<p>${esc(p.replace(/[*_]{1,2}/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))}</p>`).join('')}` : ''}
      ${(d.places || []).length ? `<h4>Places</h4><div class="chips">${d.places.map(p => `<span class="chip">📍 ${esc(p)}</span>`).join('')}</div>` : ''}
      ${(d.times || []).length ? `<h4>Periods</h4><div class="chips">${d.times.map(p => `<span class="chip">🕰️ ${esc(p)}</span>`).join('')}</div>` : ''}
      ${(d.people || []).length ? `<h4>People</h4><div class="chips">${d.people.map(p => `<span class="chip">👤 ${esc(p)}</span>`).join('')}</div>` : ''}
      ${au.bio ? `<h4>About ${esc(b.a)}</h4><p>${esc(au.bio.replace(/[*_]{1,2}/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))}</p>` : ''}
      <div class="links">
        <a href="https://www.goodreads.com/book/show/${b.id}" target="_blank" rel="noopener">Goodreads ↗</a>
        ${b.ol ? `<a href="https://openlibrary.org${b.ol}" target="_blank" rel="noopener">Open Library ↗</a>` : ''}
      </div>
      <p class="note" style="margin-top:14px">${[d.pub, d.bind].filter(Boolean).map(esc).join(' · ')}${b.cy ? ` · Cover shown: earliest edition with a cover (${b.cy})` : ''}</p>
      <p class="note"><kbd>←</kbd> <kbd>→</kbd> previous / next book</p>
    </div>`;
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('open');
  $('#drawer').scrollTop = 0;
  const n = S.visible.indexOf(id); if (n >= 0) setCur(n, false);
}
function closeBook() {
  S.open = null; $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('open');
}

/* ---------- keyboard focus ---------- */
function setCur(n, scroll = true) {
  const els = $$('#results [data-n]');
  if (!els.length) return;
  S.cur = Math.max(0, Math.min(els.length - 1, n));
  els.forEach(e => e.classList.toggle('cur', +e.dataset.n === S.cur));
  const el = els[S.cur];
  if (scroll) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function moveVertical(dir) {
  const els = $$('#results [data-n]'); if (!els.length) return;
  if (S.cur < 0) return setCur(0);
  if (S.view === 'list') return setCur(S.cur + dir);
  const r0 = els[S.cur].getBoundingClientRect(), cx = r0.left + r0.width / 2;
  let best = null;
  for (const e of els) {
    const r = e.getBoundingClientRect();
    const dy = dir > 0 ? r.top - r0.top : r0.top - r.top;
    if (dy <= 10) continue;
    const score = dy * 1000 + Math.abs(r.left + r.width / 2 - cx);
    if (!best || score < best[0]) best = [score, +e.dataset.n];
  }
  if (best) setCur(best[1]);
}

/* ---------- help ---------- */
const HELP = [['/', 'Search'], ['1 2 3 4', 'Read · To read · Reading · All'], ['G', 'Change grouping (genre, style, popularity, era…)'], ['O', 'Change sort order'], ['V', 'Covers / list view'],
  ['← → ↑ ↓', 'Move between books'], ['Enter', 'Open the highlighted book'], ['← →  (open book)', 'Previous / next book'], ['C', 'Clear all filters'], ['F', 'Show filters (phones)'], ['Esc', 'Close'], ['H', 'Back to mezins.com']];
function toggleHelp(show) {
  const o = $('#help'); const on = show ?? !o.classList.contains('open');
  $('#helpSheet').innerHTML = `<h2>Keyboard shortcuts</h2><table>${HELP.map(([k, v]) => `<tr><td>${k.split(' ').filter(Boolean).map(x => `<kbd>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
  o.classList.toggle('open', on);
}

/* ---------- actions ---------- */
function setShelf(k) { S.shelf = k; store.set('shelf', k); renderControls(); render(); }
function cycle(list, key, dir = 1) { const i = list.findIndex(([k]) => k === S[key]); S[key] = list[(i + dir + list.length) % list.length][0]; store.set(key, S[key]); renderControls(); render(); }
function toggleFacet(k, v) { S.f[k].has(v) ? S.f[k].delete(v) : S.f[k].add(v); render(); }
function clearFacets(k) { (k === 'all' ? Object.values(S.f) : [S.f[k]]).forEach(s => s.clear()); render(); }

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT';
  if (e.key === 'Escape') {
    if ($('#help').classList.contains('open')) return toggleHelp(false);
    if (S.open) return closeBook();
    if ($('#facets').classList.contains('open')) return $('#facets').classList.remove('open');
    if (inInput) { e.target.blur(); if (e.target.id === 'q' && S.q) { e.target.value = ''; S.q = ''; render(); } }
    return;
  }
  if (inInput) return;
  const k = e.key, lk = k.toLowerCase();
  if (k === '?') return toggleHelp();
  if (S.open) {
    const n = S.visible.indexOf(S.open);
    if (k === 'ArrowRight' && n < S.visible.length - 1) { e.preventDefault(); openBook(S.visible[n + 1]); }
    if (k === 'ArrowLeft' && n > 0) { e.preventDefault(); openBook(S.visible[n - 1]); }
    return;
  }
  if (k === '/') { e.preventDefault(); $('#q').focus(); return; }
  const shelfKey = { '1': 'read', '2': 'to-read', '3': 'currently-reading', '4': 'all' }[k];
  if (shelfKey) return setShelf(shelfKey);
  if (lk === 'g') return cycle(GROUPS, 'group', e.shiftKey ? -1 : 1);
  if (lk === 'o') return cycle(SORTS, 'sort', e.shiftKey ? -1 : 1);
  if (lk === 'v') { S.view = S.view === 'covers' ? 'list' : 'covers'; store.set('view', S.view); renderControls(); render(); return; }
  if (lk === 'c') return clearFacets('all');
  if (lk === 'f') return $('#facets').classList.toggle('open');
  if (lk === 'h') { location.href = '/'; return; }
  if (k === 'ArrowRight') { e.preventDefault(); setCur(S.cur + 1); }
  else if (k === 'ArrowLeft') { e.preventDefault(); setCur(S.cur - 1); }
  else if (k === 'ArrowDown') { e.preventDefault(); moveVertical(1); }
  else if (k === 'ArrowUp') { e.preventDefault(); moveVertical(-1); }
  else if (k === 'Enter' && S.cur >= 0) { e.preventDefault(); openBook(S.visible[S.cur]); }
}

function onClick(e) {
  const t = e.target.closest('button, [data-act]'); if (!t) return;
  if (e.detail > 0 && t.tagName === 'BUTTON') t.blur();
  if (t.dataset.shelf) return setShelf(t.dataset.shelf);
  if (t.dataset.view) { S.view = t.dataset.view; store.set('view', S.view); renderControls(); render(); return; }
  if (t.dataset.clear) return clearFacets(t.dataset.clear);
  if (t.dataset.facet) { if (t.dataset.close) closeBook(); return toggleFacet(t.dataset.facet, t.dataset.val); }
  if (t.dataset.id) return openBook(t.dataset.id);
  if (t.dataset.act === 'close') return closeBook();
  if (t.id === 'filtersBtn') return $('#facets').classList.add('open');
  if (t.id === 'closeFilters') return $('#facets').classList.remove('open');
  if (t.id === 'helpBtn') return toggleHelp(true);
}

async function boot() {
  try { S.books = await (await fetch('data/books.json')).json(); }
  catch { $('#results').innerHTML = '<div class="empty">Couldn\'t load the library. Refresh to try again.</div>'; return; }
  renderStats(); renderControls(); render();
  let t;
  $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); render(); }, 120); });
  $('#group').addEventListener('change', e => { S.group = e.target.value; store.set('group', S.group); render(); });
  $('#sort').addEventListener('change', e => { S.sort = e.target.value; store.set('sort', S.sort); render(); });
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onClick);
  $('#scrim').addEventListener('click', closeBook);
  $('#help').addEventListener('click', e => { if (e.target.id === 'help') toggleHelp(false); });
}
boot();
})();
