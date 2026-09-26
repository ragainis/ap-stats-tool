/* Daily Habits: Stretch, Strength, Diet.
   Data lives in ./data/*.json. Progress is stored per browser in localStorage. */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const A = window.anime || null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SECTIONS = ['stretch', 'strength', 'diet'];
const MEALS = ['morning', 'midday', 'dinner'];
const MEAL_LABEL = { morning: 'Morning', midday: 'Midday', dinner: 'Dinner' };
const PORTIONS = [170, 200, 230];

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('mz-health:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mz-health:' + k, JSON.stringify(v)); } catch {} },
};
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const blankDay = () => ({ stretch: [], strength: false, meals: { morning: [], midday: [], dinner: [] }, portion: 170 });
function getDay(k = dkey()) {
  const log = store.get('log', {}), d = Object.assign(blankDay(), log[k]);
  d.meals = Object.assign({ morning: [], midday: [], dinner: [] }, d.meals);
  return d;
}
function setDay(d, k = dkey()) { const log = store.get('log', {}); log[k] = d; store.set('log', log); renderToday(); }

/* ---------- state ---------- */
const S = {
  data: null, section: 'stretch', stretchIdx: 0, meal: 'morning', cursor: -1,
  mode: store.get('dietMode', 'home'), peak: store.get('peak', false), showFig: store.get('showFig', true),
};

/* ---------- helpers ---------- */
const R = v => v == null ? { min: 0, max: 0 } : typeof v === 'object' ? { min: v.min, max: v.max } : { min: v, max: v };
const rtxt = r => r.min === r.max ? `${Math.round(r.min)}` : `${Math.round(r.min)}–${Math.round(r.max)}`;
const rng = v => v == null ? '' : typeof v === 'object' ? `${v.min}–${v.max}` : String(v);
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let actx;
function beep(freq = 880, dur = 0.12, vol = 0.15) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  } catch {}
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  if (A && !reduced) {
    A.remove(t);
    A.timeline({ targets: t }).add({ opacity: [0, 1], translateY: [-8, 0], duration: 220, easing: 'easeOutQuad' })
      .add({ opacity: 0, duration: 300, delay: 1400, easing: 'easeInQuad' });
  } else { t.style.opacity = 1; setTimeout(() => { t.style.opacity = 0; }, 1600); }
}

function burst(el) {
  if (!A || reduced || !el) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const color = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#c2521f';
  const dots = Array.from({ length: 16 }, () => {
    const d = document.createElement('i');
    Object.assign(d.style, { position: 'fixed', left: cx + 'px', top: cy + 'px', width: '8px', height: '8px', borderRadius: '50%', background: color, zIndex: 40, pointerEvents: 'none' });
    document.body.appendChild(d); return d;
  });
  A({
    targets: dots, translateX: () => A.random(-110, 110), translateY: () => A.random(-110, 60),
    scale: [1, 0], opacity: [1, 0], duration: () => A.random(600, 1000), easing: 'easeOutExpo',
    complete: () => dots.forEach(d => d.remove()),
  });
}

function ringSVG(r = 70) {
  const c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 ${2 * r + 16} ${2 * r + 16}"><circle class="track" cx="${r + 8}" cy="${r + 8}" r="${r}" fill="none" stroke-width="10"/>` +
    `<circle class="bar" cx="${r + 8}" cy="${r + 8}" r="${r}" fill="none" stroke-width="10" stroke-dasharray="${c}" stroke-dashoffset="${c}"/></svg>`;
}
function setRing(root, frac) {
  const bar = root && root.querySelector('.bar'); if (!bar) return;
  const c = parseFloat(bar.getAttribute('stroke-dasharray'));
  bar.setAttribute('stroke-dashoffset', String(c * (1 - Math.max(0, Math.min(1, frac)))));
}

/* ================= EXERCISE FIGURES =================
   A side-view figure facing right, drawn in a 200×200 box (floor at y=186).
   Each exercise has key poses; the figure eases between them. */
const FIG = (() => {
  const STAND = {
    head: [100, 38], neck: [100, 56], hip: [100, 106], elbow: [104, 82], hand: [108, 106],
    kneeF: [103, 144], ankleF: [103, 182], toeF: [115, 185], kneeB: [97, 144], ankleB: [95, 182], toeB: [107, 185],
  };
  const P = o => Object.assign({}, STAND, o);
  const up = (pose, dy, keep = []) => Object.fromEntries(Object.entries(pose).map(([k, v]) => [k, keep.includes(k) ? v : [v[0], v[1] - dy]]));

  const wallA = P({ head: [124, 44], neck: [120, 60], hip: [104, 108], elbow: [138, 66], hand: [154, 64], kneeF: [128, 143], ankleF: [128, 182], toeF: [140, 185], kneeB: [86, 145], ankleB: [68, 182], toeB: [80, 185] });
  const wallB = P({ head: [132, 46], neck: [127, 62], hip: [114, 110], elbow: [142, 68], hand: [154, 64], kneeF: [137, 145], ankleF: [128, 182], toeF: [140, 185], kneeB: [91, 146], ankleB: [68, 182], toeB: [80, 185] });
  const calfA = P({ elbow: [114, 84], hand: [130, 102], kneeF: [102, 144], ankleF: [102, 181], toeF: [114, 185], kneeB: [97, 143], ankleB: [80, 157], toeB: [73, 166] });
  const calfB = up(calfA, 13, ['toeF']);
  calfB.hand = [130, 96];
  const towel = { head: [74, 106], neck: [70, 124], hip: [62, 176], elbow: [88, 146], hand: [104, 154], kneeF: [102, 178], ankleF: [140, 178], toeF: [148, 167], kneeB: [100, 181], ankleB: [138, 181], toeB: [146, 172] };
  const towelB = Object.assign({}, towel, { head: [68, 107], neck: [65, 125], elbow: [82, 148], hand: [96, 152], toeF: [143, 162] });

  const swingA = P({ head: [128, 70], neck: [117, 82], hip: [84, 110], elbow: [104, 110], hand: [92, 134], kneeF: [97, 145], ankleF: [95, 182], toeF: [107, 185], kneeB: [93, 146], ankleB: [91, 182], toeB: [103, 185] });
  const swingB = P({ head: [99, 38], neck: [98, 56], hip: [96, 106], elbow: [121, 61], hand: [145, 60], kneeF: [98, 144], ankleF: [96, 182], toeF: [108, 185], kneeB: [94, 145], ankleB: [92, 182], toeB: [104, 185] });
  const sldA = P({ hand: [106, 110], elbow: [104, 84], kneeF: [101, 144], ankleF: [100, 182], toeF: [112, 185], kneeB: [95, 145], ankleB: [92, 176], toeB: [102, 180] });
  const sldB = P({ head: [158, 96], neck: [140, 100], hip: [100, 108], elbow: [138, 126], hand: [134, 152], kneeF: [104, 145], ankleF: [100, 182], toeF: [112, 185], kneeB: [66, 106], ankleB: [32, 104], toeB: [29, 94] });
  const gobA = P({ elbow: [110, 90], hand: [118, 76] });
  const gobB = P({ head: [103, 66], neck: [102, 84], hip: [100, 134], elbow: [110, 116], hand: [120, 104], kneeF: [136, 138], ankleF: [136, 182], toeF: [148, 185], kneeB: [84, 178], ankleB: [52, 176], toeB: [44, 185] });
  const marchStand = P({ elbow: [103, 88], hand: [105, 124] });
  const marchF = Object.assign({}, marchStand, { kneeF: [128, 112], ankleF: [124, 147], toeF: [136, 150] });
  const marchB = Object.assign({}, marchStand, { kneeB: [126, 114], ankleB: [122, 149], toeB: [134, 152] });
  const halo = [[122, 70, 118, 88], [106, 22, 120, 40], [80, 46, 88, 34], [90, 64, 80, 76]]
    .map(([hx, hy, ex, ey]) => P({ hand: [hx, hy], elbow: [ex, ey] }));

  const DEFS = {
    'heel-cord-stretch': { poses: [wallA, wallB], hl: 'B', props: ['wall'], label: 'affected' },
    'heel-cord-stretch-bent-knee': {
      poses: [Object.assign({}, wallA, { kneeB: [84, 150], ankleB: [72, 182], toeB: [84, 185] }),
              Object.assign({}, wallB, { hip: [112, 112], kneeB: [93, 154], ankleB: [72, 182], toeB: [84, 185] })],
      hl: 'B', props: ['wall'], label: 'affected' },
    'calf-raises': { poses: [calfA, calfB], hl: 'F', props: ['chair'], label: 'affected' },
    'towel-stretch': { poses: [towel, towelB], hl: 'F', props: ['towel'], label: 'affected' },
    'kb-swing': { poses: [swingA, swingB], kb: [0, 10], per: 750 },
    'sl-deadlift': { poses: [sldA, sldB], kb: [0, 10], per: 1500, hl: 'F', label: 'standing' },
    'goblet-reverse-lunge': { poses: [gobA, gobB], kb: [2, 2], per: 1400 },
    'suitcase-march': { poses: [marchF, marchStand, marchB, marchStand], kb: [0, 11], per: 550 },
    'kb-halo': { poses: halo, kb: [0, 0], per: 650 },
  };

  const lerp = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t]]));
  const L = (p, a, b, cls = '') => `<line class="${cls}" x1="${p[a][0].toFixed(1)}" y1="${p[a][1].toFixed(1)}" x2="${p[b][0].toFixed(1)}" y2="${p[b][1].toFixed(1)}"/>`;

  function svg(p, d) {
    let s = '<line class="floor" x1="6" y1="187" x2="194" y2="187"/>';
    if (d.props?.includes('wall')) {
      s += '<line class="prop" x1="157" y1="18" x2="157" y2="187"/>';
      for (let y = 26; y < 186; y += 14) s += `<line class="prop thin" x1="157" y1="${y}" x2="165" y2="${y - 8}"/>`;
    }
    if (d.props?.includes('chair')) s += '<path class="prop" fill="none" d="M132 96 V187 M132 140 H162 V187 M132 96 q-2 22 0 44"/>';
    const legB = d.hl === 'B' ? 'hl' : 'far';
    s += L(p, 'hip', 'kneeB', legB) + L(p, 'kneeB', 'ankleB', legB) + L(p, 'ankleB', 'toeB', legB + ' foot');
    s += L(p, 'neck', 'hip', 'torso');
    const legF = d.hl === 'F' ? 'hl' : '';
    s += L(p, 'hip', 'kneeF', legF) + L(p, 'kneeF', 'ankleF', legF) + L(p, 'ankleF', 'toeF', legF + ' foot');
    if (d.props?.includes('towel')) s += `<path class="towel" fill="none" d="M${p.hand[0]} ${p.hand[1]} L${p.toeF[0] + 3} ${p.toeF[1] - 3} L${p.hand[0] + 2} ${p.hand[1] + 5}"/>`;
    s += L(p, 'neck', 'elbow') + L(p, 'elbow', 'hand');
    s += `<circle class="head" cx="${p.head[0].toFixed(1)}" cy="${p.head[1].toFixed(1)}" r="11"/>`;
    if (d.kb) {
      const x = p.hand[0] + d.kb[0], y = p.hand[1] + d.kb[1];
      s += `<path class="kb-h" fill="none" d="M${(x - 5).toFixed(1)} ${(y - 6).toFixed(1)} q5 -8 10 0"/><circle class="kb" cx="${x.toFixed(1)}" cy="${(y + 2).toFixed(1)}" r="9"/>`;
    }
    if (d.label && d.hl) {
      const k = d.hl === 'B' ? p.kneeB : p.kneeF;
      s += `<text class="lbl" x="${(k[0] - 4).toFixed(1)}" y="${(k[1] - 12).toFixed(1)}" text-anchor="end">${d.label}</text>`;
    }
    return `<svg viewBox="0 0 200 200" role="img" aria-label="Exercise demonstration">${s}</svg>`;
  }

  function make(el) {
    const st = { def: null, v: 0, anim: null };
    const stop = () => { if (st.anim) { st.anim.pause(); st.anim = null; } };
    function draw() {
      const d = st.def; if (!d || !el.isConnected) return;
      const n = d.poses.length, i = Math.floor(st.v) % n, j = (i + 1) % n, f = st.v - Math.floor(st.v);
      el.innerHTML = svg(n === 1 ? d.poses[0] : lerp(d.poses[i], d.poses[j], 0.5 - 0.5 * Math.cos(Math.PI * f)), d);
    }
    return {
      set(id) { stop(); st.def = DEFS[id] || null; st.v = 0; draw(); return this; },
      loop() {
        stop(); if (!st.def) return;
        const n = st.def.poses.length;
        if (reduced || !A) { st.v = n > 1 ? 1 : 0; draw(); return; }
        st.v = 0; st.anim = A({ targets: st, v: [0, n], duration: n * (st.def.per || 1600), easing: 'linear', loop: true, update: draw });
      },
      to(v, dur = 1100) {
        stop(); if (!st.def) return;
        if (reduced || !A) { st.v = v; draw(); return; }
        st.anim = A({ targets: st, v, duration: dur, easing: 'linear', update: draw });
      },
      stop,
    };
  }
  return { make };
})();

let stFig = null, emFig = null;

function applyFigVisibility() {
  $$('.figbox').forEach(b => b.hidden = !S.showFig);
  $$('[data-act="fig"]').forEach(b => { b.classList.toggle('on', S.showFig); b.innerHTML = `<kbd>V</kbd> ${S.showFig ? 'Hide' : 'Show'} demo`; });
}
function toggleFig() {
  S.showFig = !S.showFig; store.set('showFig', S.showFig); applyFigVisibility();
  if (S.showFig) { syncStretchFig(true); emFig && emFig.loop(); } else { stFig && stFig.stop(); emFig && emFig.stop(); }
}

/* ================= TODAY ================= */
function renderToday() {
  if (!S.data) return;
  const d = getDay(), n = S.data.stretch.exercises.length;
  const sDone = d.stretch.length >= n;
  const cleared = MEALS.filter(m => mealStatus(m, d).state === 'ok').length;
  const need = S.data.home.protein_floor.meals_per_day.min;
  const chips = [
    { k: 'stretch', go: 'stretch', done: sDone, dot: sDone ? '✓' : `${d.stretch.length}/${n}`, t: 'Stretch', s: sDone ? 'Done today' : `${n - d.stretch.length} left · foot & ankle` },
    { k: 'strength', go: 'strength', done: d.strength, dot: d.strength ? '✓' : '10′', t: 'Kettlebell', s: d.strength ? 'Session logged' : '10-minute EMOM' },
    { k: 'protein', go: 'diet', done: cleared >= need, dot: `${cleared}`, t: 'Protein floor', s: `${cleared}/${need} meals at 35–40 g` },
  ];
  $('#today').innerHTML = chips.map(c =>
    `<button class="chip${c.done ? ' done' : ''}" data-k="${c.k}" data-go="${c.go}"><span class="dot">${c.dot}</span><span><b>${c.t}</b><span>${c.s}</span></span></button>`).join('');
}

/* ================= STRETCH ================= */
const ST = { running: false, phase: 'ready', rep: 1, set: 1, remain: 0 };
const stretchEx = () => S.data.stretch.exercises[S.stretchIdx];
const isHold = ex => !!ex.dosage.hold_sec;

function resetStretch() {
  const ex = stretchEx();
  Object.assign(ST, { running: false, phase: 'ready', rep: isHold(ex) ? 1 : 0, set: 1, remain: (ex.dosage.hold_sec || 0) * 1000 });
  paintStretchTimer(); syncStretchFig(true);
}

// Hold stretches: the figure follows the timer (lean in on HOLD, ease back on RELAX); otherwise it loops as a demo.
function syncStretchFig(restart) {
  if (!stFig || !S.showFig) return;
  const ex = stretchEx();
  if (isHold(ex) && ST.phase === 'hold') stFig.to(1);
  else if (isHold(ex) && ST.phase === 'rest') stFig.to(0);
  else if (restart) stFig.loop();
}

function renderStretch() {
  const P = S.data.stretch, d = getDay();
  const days = P.exercises[0].dosage.days_per_week;
  $('#p-stretch').innerHTML = `
    <p class="lede"><b>${esc(P.title)}</b>: ${P.exercises.length} exercises, ${days.min}–${days.max} days a week.
      “Affected” means the leg you're rehabbing. Press <kbd>Space</kbd> and the timer counts every hold, rep and set for you.</p>
    <div class="grid-2">
      <div class="card list" id="stList">${P.exercises.map((ex, i) => `
        <button class="item${i === S.stretchIdx ? ' sel' : ''}${d.stretch.includes(ex.id) ? ' did' : ''}" data-i="${i}">
          <span class="num">${i + 1}</span>
          <span><span class="t">${esc(ex.name)}</span><br><span class="s">${esc(ex.feel_it)}</span></span>
          <span class="check" aria-label="done today">✓</span>
        </button>`).join('')}
      </div>
      <div class="card detail" id="stDetail"></div>
    </div>`;
  renderStretchDetail();
}

function renderStretchDetail() {
  const ex = stretchEx(), D = ex.dosage, n = S.data.stretch.exercises.length;
  const mins = isHold(ex) ? Math.round(D.repeat * (D.hold_sec + D.rest_sec) * D.sets / 60) : null;
  const done = getDay().stretch.includes(ex.id);
  $('#stDetail').innerHTML = `
    <div class="eyebrow">Exercise ${S.stretchIdx + 1} of ${n}</div>
    <h2>${esc(ex.name)}</h2>
    <div class="meta">
      ${isHold(ex) ? `<span class="pill acc">Hold ${D.hold_sec}s · relax ${D.rest_sec}s</span>` : ''}
      <span class="pill acc">${D.repeat} reps × ${D.sets} sets</span>
      ${mins ? `<span class="pill">≈ ${mins} min</span>` : ''}
      <span class="pill">Feel it: ${esc(ex.feel_it)}</span>
      <span class="pill">${ex.equipment.length ? esc(ex.equipment.join(', ')) : 'No equipment'}</span>
      <span class="pill">${esc(ex.main_muscles.join(', '))}</span>
    </div>
    <ol class="steps">${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="tip"><b>Tip:</b> ${esc(ex.tip)}</div>
    <div class="timer">
      <div class="ring" id="stRing">${ringSVG()}<div class="center"><div><div class="big" id="stBig">0</div><div class="phase" id="stPhase"></div></div></div></div>
      <div>
        <div class="status" id="stStatus"></div>
        <div class="sub" id="stSub"></div>
        <div class="ctrls">
          <button class="btn primary" data-act="st-go" id="stGo"></button>
          <button class="btn" data-act="st-reset"><kbd>R</kbd> Reset</button>
          <button class="btn${done ? ' on' : ''}" data-act="st-done" id="stDone"><kbd>Enter</kbd> ${done ? 'Done ✓' : 'Mark done'}</button>
          <button class="btn" data-act="st-next"><kbd>→</kbd> Next</button>
          <button class="btn" data-act="fig"></button>
        </div>
      </div>
      <div class="figbox" id="stFig"></div>
    </div>`;
  stFig = FIG.make($('#stFig')).set(ex.id);
  applyFigVisibility();
  resetStretch();
  enter('#stDetail > *');
}

function paintStretchTimer() {
  if (!$('#stBig')) return;
  const ex = stretchEx(), D = ex.dosage;
  const big = $('#stBig'), ph = $('#stPhase'), st = $('#stStatus'), sub = $('#stSub'), go = $('#stGo');
  if (isHold(ex)) {
    const total = (ST.phase === 'rest' ? D.rest_sec : D.hold_sec) * 1000;
    big.textContent = ST.phase === 'done' ? '✓' : Math.ceil(ST.remain / 1000);
    ph.textContent = { ready: 'ready', hold: 'hold', rest: 'relax', done: 'complete' }[ST.phase];
    setRing($('#stRing'), ST.phase === 'done' ? 1 : ST.phase === 'ready' ? 0 : 1 - ST.remain / total);
    st.textContent = ST.phase === 'done' ? 'All sets complete' : ST.phase === 'ready' ? 'Get into position' : ST.phase === 'hold' ? 'Hold the stretch' : 'Relax';
    sub.textContent = ST.phase === 'done' ? `${D.sets} sets × ${D.repeat} reps` : `Rep ${ST.rep} of ${D.repeat} · Set ${ST.set} of ${D.sets}`;
    go.innerHTML = `<kbd>Space</kbd> ${ST.phase === 'done' ? 'Again' : ST.running ? 'Pause' : ST.phase === 'ready' ? 'Start' : 'Resume'}`;
  } else {
    big.textContent = ST.phase === 'done' ? '✓' : ST.rep;
    ph.textContent = ST.phase === 'done' ? 'complete' : `of ${D.repeat}`;
    setRing($('#stRing'), ST.phase === 'done' ? 1 : ST.rep / D.repeat);
    st.textContent = ST.phase === 'done' ? 'All sets complete' : 'Tap Space once per rep';
    sub.textContent = ST.phase === 'done' ? `${D.sets} sets × ${D.repeat} reps` : `Set ${ST.set} of ${D.sets} · slow up, slow down`;
    go.innerHTML = `<kbd>Space</kbd> ${ST.phase === 'done' ? 'Again' : 'Count rep'}`;
  }
}

function stretchGo() {
  const ex = stretchEx(), D = ex.dosage;
  if (ST.phase === 'done') { resetStretch(); return; }
  if (!isHold(ex)) {
    ST.phase = 'count'; ST.rep++; beep(740, 0.06, 0.1); pulse('#stBig');
    if (ST.rep >= D.repeat) {
      if (ST.set >= D.sets) { finishStretch(); return; }
      ST.set++; ST.rep = 0; beep(988, 0.2); toast(`Set ${ST.set - 1} done. Rest, then set ${ST.set}.`);
    }
    paintStretchTimer(); return;
  }
  if (ST.phase === 'ready') { ST.phase = 'hold'; ST.remain = D.hold_sec * 1000; beep(988, 0.15); syncStretchFig(); }
  ST.running = !ST.running;
  paintStretchTimer();
}

function stretchTick(dt) {
  if (!ST.running) return;
  const D = stretchEx().dosage;
  const before = Math.ceil(ST.remain / 1000);
  ST.remain -= dt;
  const after = Math.ceil(ST.remain / 1000);
  if (after !== before && after <= 3 && after > 0) beep(520, 0.05, 0.08);
  if (ST.remain <= 0) {
    if (ST.phase === 'hold') { ST.phase = 'rest'; ST.remain = D.rest_sec * 1000; beep(440, 0.25); syncStretchFig(); }
    else {
      ST.rep++;
      if (ST.rep > D.repeat) {
        if (ST.set >= D.sets) { finishStretch(); return; }
        ST.set++; ST.rep = 1; toast(`Set ${ST.set - 1} done. Starting set ${ST.set}.`);
      }
      ST.phase = 'hold'; ST.remain = D.hold_sec * 1000; beep(988, 0.15); pulse('#stBig'); syncStretchFig();
    }
  }
  paintStretchTimer();
}

function finishStretch() {
  ST.running = false; ST.phase = 'done';
  beep(784, 0.15); setTimeout(() => beep(1046, 0.3), 160);
  markStretch(true); paintStretchTimer(); syncStretchFig(true);
}

function markStretch(force) {
  const ex = stretchEx(), d = getDay(), has = d.stretch.includes(ex.id);
  const on = force === true ? true : !has;
  d.stretch = on ? [...new Set([...d.stretch, ex.id])] : d.stretch.filter(x => x !== ex.id);
  setDay(d);
  $$('#stList .item')[S.stretchIdx]?.classList.toggle('did', on);
  const b = $('#stDone'); if (b) { b.classList.toggle('on', on); b.innerHTML = `<kbd>Enter</kbd> ${on ? 'Done ✓' : 'Mark done'}`; }
  if (on && !has) {
    burst(b);
    const left = S.data.stretch.exercises.length - d.stretch.length;
    toast(left ? `${ex.name} done. ${left} to go.` : 'Stretching done for today 🎉');
    if (left && force === true) setTimeout(() => selectStretch(S.stretchIdx + 1), 900);
  }
}

function selectStretch(i) {
  const n = S.data.stretch.exercises.length;
  S.stretchIdx = (i + n) % n;
  $$('#stList .item').forEach((el, j) => el.classList.toggle('sel', j === S.stretchIdx));
  renderStretchDetail();
}

/* ================= STRENGTH ================= */
const EM = { running: false, started: false, elapsed: 0 };
let lastMinute = -1;

function rxText(ex) {
  let p = ex.prescription;
  if (S.peak) {
    const rule = S.data.kb.rules.find(r => r.overrides);
    const o = rule && rule.overrides[ex.id];
    if (o) p = Object.assign({ note: p.note }, o);
  }
  const note = p.note ? ` (${p.note})` : '';
  if (p.type === 'reps') return (p.value != null ? `${p.value} reps` : `${p.min}–${p.max} reps`) + note;
  if (p.type === 'reps_per_side') return `${p.value} / side${note}`;
  if (p.type === 'seconds_per_side') return `${p.value}s / side${note}`;
  return '';
}
const exForMinute = m => S.data.kb.exercises.find(e => e.minutes.includes(m));
const totalMs = () => S.data.kb.protocol.duration_min * 60000;
const curMinute = () => Math.min(S.data.kb.protocol.duration_min - 1, Math.floor(EM.elapsed / 60000));

function renderStrength() {
  const K = S.data.kb;
  $('#p-strength').innerHTML = `
    <p class="lede"><b>${esc(K.title)}</b>: ${esc(K.subtitle)}, ${K.equipment.kettlebell_lb} lb bell.
      At the start of each minute do the reps, then rest until the next beep. Two rounds of five. <kbd>←</kbd><kbd>→</kbd> jump between exercises any time.</p>
    <div class="card emom">
      <div class="ring" id="emRing">${ringSVG(90)}<div class="center"><div><div class="big" id="emBig">60</div><div class="phase" id="emPhase">ready</div></div></div></div>
      <div class="now">
        <div class="eyebrow" id="emEyebrow"></div>
        <h2 id="emName"></h2>
        <div class="rx" id="emRx"></div>
        <ul class="cues" id="emCues"></ul>
        <div class="next" id="emNext"></div>
        <div class="ctrls">
          <button class="btn primary" data-act="em-go" id="emGo"></button>
          <button class="btn" data-act="em-prev" aria-label="Previous exercise"><kbd>←</kbd> Prev</button>
          <button class="btn" data-act="em-next" aria-label="Next exercise"><kbd>→</kbd> Next</button>
          <button class="btn" data-act="em-reset"><kbd>R</kbd> Reset</button>
          <button class="btn${S.peak ? ' on' : ''}" data-act="peak" id="peakBtn"><kbd>P</kbd> Peak week${S.peak ? ' on' : ''}</button>
          <button class="btn" data-act="em-done" id="emDone"></button>
          <button class="btn" data-act="fig"></button>
        </div>
        <div class="total" id="emTotal" style="margin-top:10px"></div>
      </div>
      <div class="figbox big" id="emFig"></div>
    </div>
    <div class="plan" id="emPlan"></div>
    <div class="row-2">
      <div class="card tracker">
        <div class="h3">30-day consistency</div>
        <div class="total" id="trkSum"></div>
        <div class="days" id="trkDays"></div>
        <div class="total">Tap a day to fix a missed log. A finished session logs itself.</div>
      </div>
      <div class="card rules">
        <div class="h3">Rules</div>
        ${K.rules.map(r => `<p><b>${esc(r.name)}.</b> ${esc(r.text)}</p>`).join('')}
      </div>
    </div>`;
  emFig = FIG.make($('#emFig'));
  lastFigEx = null;
  applyFigVisibility();
  renderPlan(); renderTracker(); paintEmom();
}

function renderPlan() {
  const cur = (curMinute()) % 5;
  $('#emPlan').innerHTML = S.data.kb.exercises.map((ex, i) => `
    <button class="slot${i === cur ? ' cur' : ''}" data-slot="${i}">
      <div class="m">MIN ${ex.minutes.join(' & ')}</div>
      <div class="n">${esc(ex.name)}</div>
      <div class="r">${esc(rxText(ex))}</div>
      <div class="b">${esc(ex.trail_benefit)}</div>
    </button>`).join('');
}

let lastFigEx = null;
function paintEmom() {
  if (!$('#emBig')) return;
  const K = S.data.kb, total = totalMs();
  const done = EM.elapsed >= total;
  const minute = curMinute();
  const ex = exForMinute(minute + 1), nx = exForMinute(minute + 2);
  const secLeft = done ? 0 : 60 - (EM.elapsed % 60000) / 1000;
  const round = minute < 5 ? 1 : 2;
  $('#emBig').textContent = done ? '✓' : Math.ceil(secLeft);
  $('#emPhase').textContent = done ? 'complete' : EM.running ? `minute ${minute + 1}` : EM.started ? 'paused' : 'ready';
  setRing($('#emRing'), done ? 1 : (EM.elapsed % 60000) / 60000);
  $('#emEyebrow').textContent = done ? 'Session complete' : `Round ${round} of ${K.protocol.rounds} · Minute ${minute + 1} of ${K.protocol.duration_min}`;
  $('#emName').textContent = done ? 'Nice work.' : ex.name;
  $('#emRx').textContent = done ? '' : rxText(ex);
  $('#emCues').innerHTML = done ? '' : ex.form_cues.map(c => `<li>${esc(c)}</li>`).join('');
  $('#emNext').textContent = done ? 'Logged in your 30-day tracker.' : nx ? `Next: ${nx.name} (${rxText(nx)})` : 'Last minute, finish strong.';
  $('#emTotal').innerHTML = `<span class="mono">${mmss(Math.max(0, (total - EM.elapsed) / 1000))}</span> left of ${K.protocol.duration_min}:00`;
  $('#emGo').innerHTML = `<kbd>Space</kbd> ${done ? 'Again' : EM.running ? 'Pause' : EM.started ? 'Resume' : 'Start'}`;
  const today = getDay().strength;
  $('#emDone').classList.toggle('on', today);
  $('#emDone').innerHTML = `<kbd>Enter</kbd> ${today ? 'Logged ✓' : 'Log today'}`;
  if (emFig && ex.id !== lastFigEx) { lastFigEx = ex.id; emFig.set(ex.id); if (S.showFig) emFig.loop(); }
}

function emomGo() {
  if (EM.elapsed >= totalMs()) { EM.elapsed = 0; lastMinute = -1; EM.started = false; }
  EM.running = !EM.running;
  if (EM.running && !EM.started) { EM.started = true; beep(1046, 0.3); lastMinute = curMinute(); pulse('#emName'); }
  paintEmom(); renderPlan();
}
function emomTick(dt) {
  if (!EM.running) return;
  const total = totalMs();
  const beforeSec = Math.ceil(60 - (EM.elapsed % 60000) / 1000);
  EM.elapsed = Math.min(total, EM.elapsed + dt);
  const afterSec = Math.ceil(60 - (EM.elapsed % 60000) / 1000);
  if (afterSec !== beforeSec && afterSec <= 3 && afterSec > 0 && EM.elapsed < total) beep(520, 0.05, 0.08);
  if (EM.elapsed >= total) {
    EM.running = false; beep(784, 0.15); setTimeout(() => beep(1046, 0.4), 160);
    const d = getDay(); if (!d.strength) { d.strength = true; setDay(d); }
    renderTracker(); paintEmom(); renderPlan(); burst($('#emRing')); toast('Session complete, logged ✓');
    return;
  }
  const m = Math.floor(EM.elapsed / 60000);
  if (m !== lastMinute) {
    lastMinute = m; beep(1046, 0.3); renderPlan(); pulse('#emName');
    if (m === 5) toast('Round 2');
  }
  paintEmom();
}
function emomReset() { EM.running = false; EM.started = false; EM.elapsed = 0; lastMinute = -1; paintEmom(); renderPlan(); }

// Manual navigation: jump to the start of another minute (keeps running if it was running).
function emomJumpTo(minute) {
  const max = S.data.kb.protocol.duration_min - 1;
  const m = Math.max(0, Math.min(max, minute));
  if (EM.elapsed >= totalMs()) EM.started = false;
  EM.elapsed = m * 60000; lastMinute = m;
  beep(880, 0.06, 0.08);
  paintEmom(); renderPlan(); pulse('#emName');
}
const emomStep = delta => emomJumpTo(curMinute() + delta);

function toggleStrengthDay(k = dkey()) {
  const d = getDay(k); d.strength = !d.strength; setDay(d, k);
  renderTracker(); paintEmom();
  if (d.strength && k === dkey()) { burst($('#emDone')); toast('Kettlebell logged for today'); }
}

function renderTracker() {
  if (!$('#trkDays')) return;
  const log = store.get('log', {}), today = new Date(), N = S.data.kb.tracker.days;
  const days = Array.from({ length: N }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - (N - 1 - i)); return d; });
  let count = 0;
  $('#trkDays').innerHTML = days.map(d => {
    const k = dkey(d), on = !!(log[k] && log[k].strength); if (on) count++;
    return `<button class="day${on ? ' on' : ''}${k === dkey() ? ' today' : ''}" data-day="${k}" title="${d.toDateString()}">${d.getDate()}</button>`;
  }).join('');
  let streak = 0; const c = new Date(today);
  if (!(log[dkey(c)] && log[dkey(c)].strength)) c.setDate(c.getDate() - 1);
  while (log[dkey(c)] && log[dkey(c)].strength) { streak++; c.setDate(c.getDate() - 1); }
  $('#trkSum').innerHTML = `<b class="mono">${count}/${N}</b> sessions in the last 30 days · streak <b class="mono">${streak}</b>`;
}

/* ================= DIET: meal builder ================= */
const EMOJI = [
  [/yogurt.*berr/i, '🫐'], [/tahini/i, '🥒'], [/ricotta/i, '🍋'], [/sardine|octopus/i, '🐟'], [/mackerel|trout/i, '🐟'],
  [/tuna/i, '🥫'], [/prosciutto/i, '🥓'], [/salami/i, '🍖'], [/avocado/i, '🥑'], [/smoked salmon/i, '🐟'], [/salmon/i, '🍣'],
  [/cottage/i, '🥛'], [/tinned fish/i, '🐟'], [/lounge/i, '🥚'], [/3 eggs|omelet/i, '🍳'], [/egg/i, '🥚'],
  [/cod|tilapia|halibut/i, '🐟'], [/shrimp/i, '🍤'], [/chicken/i, '🍗'], [/turkey/i, '🦃'], [/pork/i, '🐖'],
  [/short rib/i, '🍖'], [/sirloin|flank|ribeye|steak/i, '🥩'], [/broccoli|cauliflower/i, '🥦'], [/green bean/i, '🫛'],
  [/asparagus/i, '🌱'], [/zucchini|squash/i, '🥒'], [/pepper/i, '🫑'], [/spinach|chard/i, '🥬'], [/mushroom/i, '🍄'],
  [/brussels/i, '🥬'], [/olive oil/i, '🫒'], [/cheese/i, '🧀'], [/pasta|rice/i, '🍝'], [/cream|butter/i, '🧈'],
  [/fried/i, '🍟'], [/bowl/i, '🥗'], [/veggie|mix/i, '🥕'],
];
const emojiFor = name => (EMOJI.find(([re]) => re.test(name)) || [0, '🍽️'])[1];
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function portion() { return getDay().portion || 170; }

// Build the selectable foods for a meal + mode. Protein/kcal are ranges {min,max}.
function catalog(meal, mode = S.mode) {
  const H = S.data.home, T = S.data.travel, por = portion();
  const it = (name, sub, p, kcal, fiber, emoji) => ({ id: `${meal}:${mode === 'travel' && meal !== 'dinner' ? 't-' : ''}${slug(name)}`, name, sub, p: R(p), kcal: kcal == null ? null : R(kcal), fiber: fiber ?? null, emoji: emoji || emojiFor(name) });
  const scale = (v, g) => { if (v == null) return null; const f = g ? por / g : 1; return typeof v === 'object' ? { min: Math.round(v.min * f), max: Math.round(v.max * f) } : Math.round(v * f); };
  const tb = T.morning.hotel_breakfast.protein, boost = H.midday.boost_ins;
  if (meal === 'dinner') {
    const D = H.dinner, t1 = D.tiers[0], t2 = D.tiers[1], t3 = D.tiers[2];
    return [
      { title: `Protein · ${por} g cooked`, note: por !== 170 ? `Scaled from the 170 g values in your sheet.` : '', items: t1.proteins.map(p => it(p.name, p.note, scale(p.protein_g, p.grams), scale(p.kcal, p.grams))) },
      { title: 'Vegetables · 1 cup, no oil', items: t1.vegetables.items.map(v => it(v.name, v.note, v.protein_g, v.kcal, v.fiber_g)) },
      { title: 'Tier 2 · one deliberate addition', items: t2.items.map(i => it(i.name.replace('Any Tier 1 protein + ', '+ '), i.note, i.protein_g != null ? scale(i.protein_g, i.grams) : i.protein_g_added, i.kcal != null ? scale(i.kcal, i.grams) : i.kcal_added)) },
      { title: 'Tier 3 · occasion', items: t3.items.map(i => it(i.name, i.note, i.protein_g != null ? scale(i.protein_g, i.grams) : null, i.kcal != null ? scale(i.kcal, i.grams) : i.kcal_added, i.fiber_g ? R(i.fiber_g).max : null)) },
    ];
  }
  if (mode === 'travel') {
    if (meal === 'morning') {
      const al = T.morning.airport_lounge;
      return [
        { title: 'Hotel breakfast', items: tb.map(p => it(p.item, p.note || '', p.protein_g)) },
        { title: 'Airport lounge', items: [it(`Lounge protein picks`, al.picks.join(', '), al.picks_protein_g)] },
      ];
    }
    const fc = T.midday.fast_casual_order;
    return [
      { title: 'Fast-casual', items: [it('Double-protein bowl', fc.script, fc.protein_g)] },
      { title: 'Boost-ins', items: boost.map(b => it(`${b.name} (${b.qty})`, '', b.protein_g, b.kcal)) },
    ];
  }
  if (meal === 'morning') {
    const M = H.morning, bm = H.protein_floor.by_meal[0];
    const kcal = M.master_recipe.reduce((a, r) => a + r.kcal, 0), fib = M.master_recipe.reduce((a, r) => a + r.fiber_g, 0);
    const cottage = boost.find(b => b.id === 'cottage-cheese-side');
    return [
      { title: 'Veggie snack mix', items: [it('Veggie snack mix (full batch)', M.master_recipe.map(r => r.name).join(', '), bm.as_built_g, kcal, +fib.toFixed(1), '🥕')] },
      { title: 'Protein anchors', note: 'Suggested from elsewhere in your plan; the handout\'s own anchor list isn\'t in the data yet.', items: [
        it('3 eggs', 'from your travel sheet', tb[0].protein_g),
        it('Smoked salmon, 3 oz', 'from your travel sheet', tb[1].protein_g),
        it(`Cottage cheese (${cottage.qty})`, 'boost-in', cottage.protein_g, cottage.kcal),
        ...boost.filter(b => b.id !== 'cottage-cheese-side').map(b => it(`${b.name} (${b.qty})`, 'boost-in', b.protein_g, b.kcal)),
      ] },
    ];
  }
  const M = H.midday;
  return [
    { title: 'Combos', items: [...M.combos].sort((a, b) => b.protein_g - a.protein_g).map(c => it(c.name, c.portion, c.protein_g, c.kcal, c.fiber_g)) },
    { title: 'Boost-ins', items: M.boost_ins.map(b => it(`${b.name} (${b.qty})`, b.best_for.includes('any') ? 'tops up any combo' : '', b.protein_g, b.kcal)) },
  ];
}
const flat = groups => groups.flatMap(g => g.items);
function itemById(meal, id) { return flat(catalog(meal, 'home')).concat(flat(catalog(meal, 'travel'))).find(i => i.id === id); }

function mealTotals(meal, d = getDay()) {
  const t = { p: { min: 0, max: 0 }, kcal: { min: 0, max: 0 }, fiber: 0, items: [] };
  for (const id of d.meals[meal] || []) {
    const i = itemById(meal, id); if (!i) continue;
    t.items.push(i); t.p.min += i.p.min; t.p.max += i.p.max;
    if (i.kcal) { t.kcal.min += i.kcal.min; t.kcal.max += i.kcal.max; }
    if (i.fiber) t.fiber += i.fiber;
  }
  return t;
}
function mealStatus(meal, d = getDay()) {
  const f = S.data.home.protein_floor.per_meal_g, t = mealTotals(meal, d);
  const state = !t.items.length ? 'none' : t.p.min >= f.min ? 'ok' : t.p.max >= f.min ? 'maybe' : 'short';
  return { ...t, state, gap: Math.max(0, f.min - t.p.min) };
}
const STATE_TXT = { none: 'Nothing picked', ok: 'Clears floor', maybe: 'Borderline', short: 'Short' };

function suggestion(meal) {
  const st = mealStatus(meal); if (st.state === 'ok' || st.state === 'none') return null;
  const sel = new Set(getDay().meals[meal]);
  const cands = flat(catalog(meal)).filter(i => !sel.has(i.id) && i.p.min > 0);
  const closes = cands.filter(i => i.p.min >= st.gap).sort((a, b) => (a.kcal ? a.kcal.max : 999) - (b.kcal ? b.kcal.max : 999));
  return closes[0] || cands.sort((a, b) => b.p.min - a.p.min)[0] || null;
}

function renderDiet() {
  const F = S.data.home.protein_floor, pf = F.per_meal_g, por = portion();
  $('#p-diet').innerHTML = `
    <p class="lede"><b>The rule:</b> hit <b>${pf.min}–${pf.max} g protein at every meal</b>, ${F.meals_per_day.min}–${F.meals_per_day.max} times a day. Tap what you're eating; each meal starts at 0 and tells you when it clears the floor.</p>
    <div class="dietbar">
      <div class="seg" role="group" aria-label="Where are you eating">
        <button data-mode="home" aria-pressed="${S.mode === 'home'}">Home</button>
        <button data-mode="travel" aria-pressed="${S.mode === 'travel'}">Travel</button>
      </div>
      <div class="seg" role="group" aria-label="Dinner protein portion" title="Dinner protein portion (P)">
        ${PORTIONS.map(g => `<button data-portion="${g}" aria-pressed="${g === por}">${g} g${g === 170 ? '' : g === 230 ? ' · hard training' : ' · training'}</button>`).join('')}
      </div>
    </div>
    <div class="floors" id="floors"></div>
    ${S.mode === 'travel' ? travelScript() : ''}
    <div class="card meal-panel" id="mealPanel"></div>`;
  renderFloors(); renderMeal();
}

function renderFloors() {
  const pf = S.data.home.protein_floor.per_meal_g, SCALE = 60;
  $('#floors').innerHTML = MEALS.map(m => {
    const s = mealStatus(m);
    const cls = s.state === 'ok' ? 'status-ok' : s.state === 'none' ? 'status-none' : 'status-low';
    return `<button class="card floor${m === S.meal ? ' sel' : ''}" data-meal="${m}">
      <div class="meal"><b>${MEAL_LABEL[m]}</b><span class="${cls}">${STATE_TXT[s.state]}${s.state === 'short' ? ` ${s.gap} g` : ''}</span></div>
      <div class="meter">
        <div class="band" style="left:${pf.min / SCALE * 100}%;width:${(pf.max - pf.min) / SCALE * 100}%"></div>
        <div class="fill" style="width:${Math.min(100, s.p.max / SCALE * 100)}%;opacity:.35"></div>
        <div class="fill" style="width:${Math.min(100, s.p.min / SCALE * 100)}%"></div>
      </div>
      <div class="gap"><span class="mono">${rtxt(s.p)} g</span> protein · ${s.items.length ? s.items.map(i => i.emoji).join(' ') : 'tap foods below'}</div>
    </button>`;
  }).join('');
}

function travelScript() {
  const T = S.data.travel;
  return `<div class="card meal-panel" style="margin-bottom:12px">
    <div class="eyebrow">Ordering script · works anywhere</div>
    <p class="tierrule" style="margin-top:6px">${esc(T.strategy)}</p>
    ${T.ordering_script.map(s => `<div class="script"><span>“${esc(s)}”</span><button class="btn copy" data-copy="${esc(s)}">Copy</button></div>`).join('')}
    <div class="total">${T.defaults.map(esc).join(' · ')}</div>
  </div>`;
}

function renderMeal() {
  const el = $('#mealPanel'); if (!el) return;
  const groups = catalog(S.meal), sel = new Set(getDay().meals[S.meal]);
  let n = 0;
  el.innerHTML = `
    <div class="builder-sum" id="bSum"></div>
    ${groups.map(g => `
      <div class="h3 grp">${esc(g.title)}</div>
      ${g.note ? `<div class="total" style="margin:-4px 0 8px">${esc(g.note)}</div>` : ''}
      <div class="picks">${g.items.map(i => `
        <button class="pick${sel.has(i.id) ? ' on' : ''}" data-pick="${esc(i.id)}" data-n="${n++}" aria-pressed="${sel.has(i.id)}">
          <span class="emo" aria-hidden="true">${i.emoji}</span>
          <span class="pn"><b>${esc(i.name)}</b>${i.sub ? `<span>${esc(i.sub)}</span>` : ''}</span>
          <span class="pv"><b>${i.p.max ? rtxt(i.p) + ' g' : '0 g'}</b><span>${i.kcal ? rtxt(i.kcal) + ' kcal' : ''}</span></span>
          <span class="tick" aria-hidden="true">✓</span>
        </button>`).join('')}</div>`).join('')}
    ${referenceFor(S.meal)}`;
  S.cursor = Math.min(S.cursor, n - 1);
  paintCursor(false);
  paintSummary(false);
  enter('#mealPanel > *');
}

function paintSummary(animate = true) {
  const box = $('#bSum'); if (!box) return;
  const pf = S.data.home.protein_floor.per_meal_g, s = mealStatus(S.meal), sug = suggestion(S.meal), SCALE = 60;
  const msg = s.state === 'none' ? `Start at <b>0 g</b>. Tap what you're eating.` :
    s.state === 'ok' ? `<b>Clears the ${pf.min}–${pf.max} g floor.</b>` :
    s.state === 'maybe' ? `Borderline: <b>${rtxt(s.p)} g</b> depending on portions.` : `Short by <b>${s.gap} g</b>.`;
  box.innerHTML = `
    <div class="bs-top">
      <div><div class="eyebrow">${MEAL_LABEL[S.meal]} · ${S.mode === 'travel' && S.meal !== 'dinner' ? 'travel' : 'home'}</div>
        <div class="bs-num"><span class="mono" id="bsP">${rtxt(s.p)}</span><small> g protein</small></div></div>
      <div class="bs-side">
        <span class="${s.state === 'ok' ? 'status-ok' : s.state === 'none' ? 'status-none' : 'status-low'}">${STATE_TXT[s.state]}</span>
        <span class="total">${s.kcal.max ? rtxt(s.kcal) + ' kcal' : '— kcal'}${s.fiber ? ` · ${s.fiber.toFixed(1)} g fiber` : ''}</span>
      </div>
    </div>
    <div class="meter big">
      <div class="band" style="left:${pf.min / SCALE * 100}%;width:${(pf.max - pf.min) / SCALE * 100}%"></div>
      <div class="fill" style="width:${Math.min(100, s.p.max / SCALE * 100)}%;opacity:.35"></div>
      <div class="fill" id="bsFill" style="width:${Math.min(100, s.p.min / SCALE * 100)}%"></div>
    </div>
    <div class="bs-msg">${msg} <span class="bs-emo">${s.items.map(i => i.emoji).join(' ')}</span>
      ${sug ? `<button class="btn sm" data-pick="${esc(sug.id)}">+ ${sug.emoji} ${esc(sug.name)} (+${rtxt(sug.p)} g)</button>` : ''}
      ${s.items.length ? '<button class="btn sm ghost" data-act="meal-clear"><kbd>X</kbd> Clear</button>' : ''}</div>`;
  if (animate) pulse('#bsP');
}

function paintCursor(scroll = true) {
  $$('.pick').forEach(b => b.classList.toggle('cur', +b.dataset.n === S.cursor));
  const c = $(`.pick[data-n="${S.cursor}"]`);
  if (c && scroll) c.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
}

function togglePick(id) {
  const d = getDay(), list = d.meals[S.meal];
  const before = mealStatus(S.meal, d).state;
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  setDay(d);
  $$(`.pick[data-pick="${CSS.escape(id)}"]`).forEach(b => { const on = list.includes(id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); if (on && A && !reduced) A({ targets: b.querySelector('.emo'), scale: [1.5, 1], rotate: [-12, 0], duration: 500, easing: 'easeOutElastic(1, .5)' }); });
  paintSummary(); renderFloors();
  const after = mealStatus(S.meal).state;
  if (after === 'ok' && before !== 'ok') { beep(988, 0.12); burst($('#bsP')); toast(`${MEAL_LABEL[S.meal]} clears the protein floor ✓`); }
}
function clearMeal() { const d = getDay(); d.meals[S.meal] = []; setDay(d); renderMeal(); renderFloors(); }

function referenceFor(meal) {
  const H = S.data.home, T = S.data.travel;
  if (S.mode === 'travel' && meal !== 'dinner') {
    if (meal === 'morning') {
      const hb = T.morning.hotel_breakfast, al = T.morning.airport_lounge;
      return `<details class="ref" open><summary>How to order</summary>
        <div class="script"><span>“${esc(hb.order)}”</span><button class="btn copy" data-copy="${esc(hb.order)}">Copy</button></div>
        <div class="note">${esc(hb.marriott_note)}</div>
        <div class="cols"><div class="mini"><b>Lounges</b><span>${esc(al.lounges.join(', '))}</span></div>
        <div class="mini"><b>Skip by default</b><span>${esc(al.skip_by_default.join(' · '))}</span></div></div></details>`;
    }
    const fc = T.midday.fast_casual_order, g = T.midday.grocery_deli;
    return `<details class="ref" open><summary>How to order</summary>
      <div class="script"><span>“${esc(fc.script)}”</span><button class="btn copy" data-copy="${esc(fc.script)}">Copy</button></div>
      <div class="cols"><div class="mini"><b>Where</b><span>${esc(fc.availability)}</span></div>
      <div class="mini"><b>Client lunch / room service</b><span>${esc(T.midday.client_lunch_or_room_service)}</span></div>
      <div class="mini"><b>Grocery / deli</b><span>US: ${esc(g.us.join(', '))} · UK: ${esc(g.uk.join(', '))}. ${esc(g.approach)}</span></div></div></details>`;
  }
  if (meal === 'morning') {
    const M = H.morning;
    return `<details class="ref"><summary>Veggie mix recipe, rubs & swaps</summary>
      <div class="cols">${M.master_recipe.map(r => `<div class="mini"><b>${emojiFor(r.name) === '🍽️' ? '🥕' : emojiFor(r.name)} ${esc(r.name)}</b><span>${esc(r.qty)} (${r.grams} g), ${esc(r.prep)} · ${r.kcal} kcal · ${r.fiber_g} g fiber · ${esc(r.note)}</span></div>`).join('')}</div>
      <div class="h3">Zero-calorie dry rubs</div>
      <div class="cols">${M.seasoning_rubs.items.map(r => `<div class="mini"><b>${esc(r.name)}</b><span>${esc(r.ingredients.join(' · '))}. <i>${esc(r.profile)}</i></span></div>`).join('')}</div>
      ${Object.entries(M.substitutes).map(([g, items]) => `<div class="h3" style="text-transform:capitalize">Swaps: ${esc(g.replace(/_/g, ' '))}</div>
        <div class="cols">${items.map(r => `<div class="mini"><b>${esc(r.name)}</b><span>${esc(r.qty)} (${r.grams} g) · ${r.kcal} kcal · ${r.fiber_g} g fiber · ${esc(r.prep)}</span></div>`).join('')}</div>`).join('')}
    </details>`;
  }
  if (meal === 'midday') return `<p class="tierrule" style="margin-top:14px">${esc(H.midday.summary)}</p>`;
  const D = H.dinner;
  return `<details class="ref"><summary>Tier rules & fat budget</summary>
    <p class="tierrule">${esc(D.strategy)}</p>
    ${D.tiers.map(t => `<p class="tierrule"><b>Tier ${t.tier} · ${esc(t.name)}:</b> ${esc(t.rule)}</p>`).join('')}
    <div class="cols">${D.fat_budget.map(f => `<div class="mini"><b>${esc(f.name)} (${esc(f.qty)})</b><span>${rng(f.kcal)} kcal · ${esc(f.note)}</span></div>`).join('')}</div>
    <p class="tierrule">${esc(D.summary)}</p></details>`;
}

function setMeal(m) {
  S.meal = m; S.cursor = -1;
  $$('.floor').forEach(b => b.classList.toggle('sel', b.dataset.meal === m));
  renderMeal();
}
function setMode(mode) {
  S.mode = mode; store.set('dietMode', mode); S.cursor = -1; renderDiet();
  toast(mode === 'travel' ? 'Travel mode: ordering scripts' : 'Home mode: shopping list');
}
function setPortion(g) {
  const d = getDay(); d.portion = g; setDay(d); renderDiet();
  toast(`Dinner protein portion: ${g} g`);
}

/* ================= NAV + ANIMATION ================= */
function enter(sel) {
  if (!A || reduced) return;
  A({ targets: $$(sel), opacity: [0, 1], translateY: [10, 0], delay: A.stagger(35), duration: 380, easing: 'easeOutQuad' });
}
function pulse(sel) {
  const el = $(sel); if (!A || reduced || !el) return;
  A.remove(el); A({ targets: el, scale: [1.12, 1], duration: 420, easing: 'easeOutElastic(1, .6)' });
}
function moveInd(animate = true) {
  const tab = $(`.tab[data-s="${S.section}"]`), ind = $('#tabInd'); if (!tab) return;
  const x = tab.offsetLeft - 5, w = tab.offsetWidth;
  if (A && animate && !reduced) A({ targets: ind, translateX: x, width: w, duration: 420, easing: 'easeOutExpo' });
  else { ind.style.transform = `translateX(${x}px)`; ind.style.width = w + 'px'; }
}

function go(section, animate = true) {
  if (!SECTIONS.includes(section)) return;
  S.section = section;
  document.body.dataset.section = section;
  $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.s === section)));
  $$('section.panel').forEach(p => p.classList.toggle('active', p.id === 'p-' + section));
  history.replaceState(null, '', '#' + section);
  moveInd(animate);
  renderKeys();
  if (section === 'stretch') { paintStretchTimer(); syncStretchFig(true); }
  if (section === 'strength') { renderTracker(); paintEmom(); if (S.showFig && emFig) emFig.loop(); }
  if (section === 'diet') { renderFloors(); paintSummary(false); }
  if (animate) enter(`#p-${section} > *`);
  BG.show(section);
}

function renderKeys() {
  const common = '<span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> sections</span>';
  const per = {
    stretch: '<span><kbd>Space</kbd> timer</span><span><kbd>←</kbd><kbd>→</kbd> exercise</span><span><kbd>V</kbd> demo</span><span><kbd>Enter</kbd> done</span>',
    strength: '<span><kbd>Space</kbd> start / pause</span><span><kbd>←</kbd><kbd>→</kbd> exercise</span><span><kbd>V</kbd> demo</span><span><kbd>P</kbd> peak</span>',
    diet: '<span><kbd>←</kbd><kbd>→</kbd> meal</span><span><kbd>↑</kbd><kbd>↓</kbd> food</span><span><kbd>Space</kbd> pick</span><span><kbd>T</kbd> travel</span>',
  };
  $('#keys').innerHTML = common + per[S.section] + '<span><kbd>?</kbd> all</span>';
}

const HELP = [
  ['Anywhere', [['1  2  3', 'Stretch · Strength · Diet'], ['S  K  D', 'Same, by letter (Stretch, Kettlebell, Diet)'], ['?', 'Show or hide this list'], ['Esc', 'Close / pause the running timer'], ['H', 'Back to mezins.com']]],
  ['Stretch', [['Space', 'Start / pause the hold timer (or count a rep for calf raises)'], ['← →  or  J L', 'Previous / next exercise'], ['V', 'Show / hide the exercise demo'], ['R', 'Reset the timer'], ['Enter', 'Mark this exercise done today']]],
  ['Strength', [['Space', 'Start / pause the 10-minute EMOM'], ['← →  or  J L', 'Jump to the previous / next exercise (even mid-session)'], ['V', 'Show / hide the exercise demo'], ['R', 'Reset the clock'], ['P', 'Peak-volume week (fewer swings and lunges)'], ['Enter', 'Log / unlog today\'s session']]],
  ['Diet', [['← →  or  J L', 'Morning · Midday · Dinner'], ['↑ ↓', 'Move between foods'], ['Space  Enter', 'Add / remove the highlighted food'], ['X', 'Clear this meal'], ['T', 'Switch Home / Travel'], ['P', 'Dinner portion 170 / 200 / 230 g']]],
];
function renderHelp() {
  $('#helpSheet').innerHTML = `<h2 id="helpTitle">Keyboard shortcuts</h2><div class="total">Everything is one key away. Press <kbd>?</kbd> or <kbd>Esc</kbd> to close.</div>
    <table>${HELP.map(([g, rows]) => `<tr class="grp"><td colspan="2">${g}</td></tr>` +
      rows.map(([k, v]) => `<tr><td>${k.split('  ').map(x => `<kbd>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(v)}</td></tr>`).join('')).join('')}</table>`;
}
function toggleHelp(open) {
  const o = $('#help'), show = open ?? !o.classList.contains('open');
  o.classList.toggle('open', show);
  if (show && A && !reduced) A({ targets: '#helpSheet', opacity: [0, 1], scale: [.96, 1], duration: 260, easing: 'easeOutQuad' });
}

/* ---------- input ---------- */
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const k = e.key, helpOpen = $('#help').classList.contains('open');
  if (k === '?' || (k === '/' && e.shiftKey)) { e.preventDefault(); toggleHelp(); return; }
  if (k === 'Escape') { if (helpOpen) toggleHelp(false); else { ST.running = false; EM.running = false; paintStretchTimer(); paintEmom(); } return; }
  if (helpOpen) return;
  const lk = k.toLowerCase();
  const nav = { '1': 'stretch', '2': 'strength', '3': 'diet', s: 'stretch', k: 'strength', d: 'diet' };
  if (nav[lk] && !e.shiftKey) { e.preventDefault(); go(nav[lk]); return; }
  if (lk === 'h') { location.href = '/'; return; }
  const prev = k === 'ArrowLeft' || lk === 'j', next = k === 'ArrowRight' || lk === 'l';
  if (S.section === 'stretch') {
    if (k === ' ') { e.preventDefault(); stretchGo(); }
    else if (prev) { e.preventDefault(); selectStretch(S.stretchIdx - 1); }
    else if (next) { e.preventDefault(); selectStretch(S.stretchIdx + 1); }
    else if (lk === 'r') resetStretch();
    else if (lk === 'v') toggleFig();
    else if (k === 'Enter') { e.preventDefault(); markStretch(); }
  } else if (S.section === 'strength') {
    if (k === ' ') { e.preventDefault(); emomGo(); }
    else if (prev) { e.preventDefault(); emomStep(-1); }
    else if (next) { e.preventDefault(); emomStep(1); }
    else if (lk === 'r') emomReset();
    else if (lk === 'p') togglePeak();
    else if (lk === 'v') toggleFig();
    else if (k === 'Enter') { e.preventDefault(); toggleStrengthDay(); }
  } else {
    const i = MEALS.indexOf(S.meal), count = $$('.pick[data-n]').length;
    if (prev) { e.preventDefault(); setMeal(MEALS[(i + 2) % 3]); }
    else if (next) { e.preventDefault(); setMeal(MEALS[(i + 1) % 3]); }
    else if (k === 'ArrowDown') { e.preventDefault(); S.cursor = Math.min(count - 1, S.cursor + 1); paintCursor(); }
    else if (k === 'ArrowUp') { e.preventDefault(); S.cursor = Math.max(0, S.cursor - 1); paintCursor(); }
    else if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (S.cursor < 0) { S.cursor = 0; paintCursor(); return; }
      const b = $(`.pick[data-n="${S.cursor}"]`); if (b) togglePick(b.dataset.pick);
    }
    else if (lk === 'x') clearMeal();
    else if (lk === 't') setMode(S.mode === 'home' ? 'travel' : 'home');
    else if (lk === 'p') setPortion(PORTIONS[(PORTIONS.indexOf(portion()) + 1) % PORTIONS.length]);
  }
}

function togglePeak() {
  S.peak = !S.peak; store.set('peak', S.peak);
  const b = $('#peakBtn'); b.classList.toggle('on', S.peak); b.innerHTML = `<kbd>P</kbd> Peak week${S.peak ? ' on' : ''}`;
  renderPlan(); paintEmom();
  toast(S.peak ? 'Peak week: swings 10, lunges 4/side' : 'Normal volume');
}

function onClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (e.detail > 0) b.blur(); // mouse clicks shouldn't leave focus that Space/Enter would re-trigger
  if (b.dataset.s) return go(b.dataset.s);
  if (b.dataset.go) return go(b.dataset.go);
  if (b.dataset.i != null) return selectStretch(+b.dataset.i);
  if (b.dataset.meal) return setMeal(b.dataset.meal);
  if (b.dataset.mode) return b.dataset.mode !== S.mode && setMode(b.dataset.mode);
  if (b.dataset.portion) return setPortion(+b.dataset.portion);
  if (b.dataset.day) return toggleStrengthDay(b.dataset.day);
  if (b.dataset.pick) { if (b.dataset.n != null) S.cursor = +b.dataset.n; paintCursor(false); return togglePick(b.dataset.pick); }
  if (b.dataset.slot != null) {
    const ex = S.data.kb.exercises[+b.dataset.slot], round = curMinute() < 5 ? 0 : 1;
    return emomJumpTo(ex.minutes[round] - 1);
  }
  if (b.dataset.copy) {
    navigator.clipboard?.writeText(b.dataset.copy).then(() => toast('Copied, ready to read out'), () => toast('Copy not available'));
    return;
  }
  const act = b.dataset.act;
  if (act === 'st-go') stretchGo();
  else if (act === 'st-reset') resetStretch();
  else if (act === 'st-done') markStretch();
  else if (act === 'st-next') selectStretch(S.stretchIdx + 1);
  else if (act === 'em-go') emomGo();
  else if (act === 'em-prev') emomStep(-1);
  else if (act === 'em-next') emomStep(1);
  else if (act === 'em-reset') emomReset();
  else if (act === 'em-done') toggleStrengthDay();
  else if (act === 'peak') togglePeak();
  else if (act === 'fig') toggleFig();
  else if (act === 'meal-clear') clearMeal();
}

/* ================= three.js background ================= */
const BG = (() => {
  let renderer, scene, camera, objs = {}, current = null, mouse = { x: 0, y: 0 };
  const cssColor = n => new (window.THREE.Color)(getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888');
  function init() {
    if (!window.THREE) return;
    const THREE = window.THREE, canvas = $('#bg');
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); camera.position.z = 10;
    const mat = n => new THREE.MeshBasicMaterial({ color: cssColor(n), wireframe: true, transparent: true, opacity: 0 });
    // Stretch: a flowing knot. Strength: a kettlebell. Diet: a faceted sphere.
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.7, 0.42, 180, 16, 2, 3), mat('--stretch'));
    const kbMat = mat('--strength'), kb = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 22, 16), kbMat);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.24, 10, 36, Math.PI), kbMat);
    handle.position.y = 1.25; kb.add(body, handle); kb.material = kbMat;
    const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), mat('--diet'));
    objs = { stretch: knot, strength: kb, diet: ico };
    Object.values(objs).forEach(o => { o.scale.setScalar(0.6); scene.add(o); });
    resize(); addEventListener('resize', resize);
    addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      objs.stretch.material.color = cssColor('--stretch'); objs.strength.material.color = cssColor('--strength'); objs.diet.material.color = cssColor('--diet'); draw();
    });
    if (!reduced) loop(); else draw();
  }
  function resize() {
    if (!renderer) return;
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const x = w > 900 ? 3.6 : 0, y = w > 900 ? 0.6 : 2.2;
    Object.values(objs).forEach(o => o.position.set(x, y, 0));
    draw();
  }
  function draw() { if (renderer) renderer.render(scene, camera); }
  function loop() {
    requestAnimationFrame(loop);
    const t = performance.now() / 1000;
    Object.values(objs).forEach((o, i) => { o.rotation.y = t * 0.12 + i + mouse.x * 0.6; o.rotation.x = Math.sin(t * 0.2 + i) * 0.25 + mouse.y * 0.4; });
    draw();
  }
  function show(section) {
    if (!renderer || current === section) return;
    const op = innerWidth > 900 ? 0.22 : 0.12;
    Object.entries(objs).forEach(([k, o]) => {
      const on = k === section, m = o.material;
      if (A && !reduced) {
        A.remove([m, o.scale]);
        A({ targets: m, opacity: on ? op : 0, duration: on ? 900 : 500, easing: 'easeOutQuad', update: draw });
        A({ targets: o.scale, x: on ? 1 : 0.6, y: on ? 1 : 0.6, z: on ? 1 : 0.6, duration: 1100, easing: 'easeOutElastic(1, .7)', update: draw });
      } else { m.opacity = on ? op : 0; o.scale.setScalar(on ? 1 : 0.6); }
    });
    current = section; draw();
  }
  return { init, show };
})();

/* ================= boot ================= */
let lastT = performance.now();
function tick() {
  const now = performance.now(), dt = Math.min(1000, now - lastT); lastT = now;
  stretchTick(dt); emomTick(dt);
}

async function boot() {
  const files = { stretch: 'foot-ankle-program', kb: 'kettlebell-routine', home: 'nutrition-home', travel: 'nutrition-travel' };
  try {
    const entries = await Promise.all(Object.entries(files).map(async ([k, f]) => {
      const r = await fetch(`data/${f}.json`, { cache: 'no-cache' }); if (!r.ok) throw new Error(f);
      return [k, await r.json()];
    }));
    S.data = Object.fromEntries(entries);
  } catch (err) {
    $('#p-stretch').innerHTML = `<div class="card detail"><h2>Couldn't load the plan data</h2><p class="lede">${esc(err.message)}. Refresh to try again.</p></div>`;
    return;
  }
  renderToday(); renderStretch(); renderStrength(); renderDiet(); renderHelp();
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onClick);
  $('#helpBtn').addEventListener('click', () => toggleHelp(true));
  $('#help').addEventListener('click', e => { if (e.target.id === 'help') toggleHelp(false); });
  addEventListener('resize', () => moveInd(false));
  BG.init();
  const start = location.hash.slice(1);
  go(SECTIONS.includes(start) ? start : 'stretch', false);
  enter('.today > *, .tabs, section.panel.active > *');
  setInterval(tick, 100);
  let day = dkey();
  setInterval(() => { if (dkey() !== day) { day = dkey(); renderToday(); renderTracker(); renderFloors(); paintSummary(false); } }, 60000);
}
boot();
})();
