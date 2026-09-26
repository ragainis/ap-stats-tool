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

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('mz-health:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mz-health:' + k, JSON.stringify(v)); } catch {} },
};
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const blankDay = () => ({ stretch: [], strength: false, protein: 0 });
function getDay(k = dkey()) { const log = store.get('log', {}); return Object.assign(blankDay(), log[k]); }
function setDay(d, k = dkey()) { const log = store.get('log', {}); log[k] = d; store.set('log', log); renderToday(); }

/* ---------- state ---------- */
const S = {
  data: null, section: 'stretch', stretchIdx: 0, meal: 'morning',
  mode: store.get('dietMode', 'home'), peak: store.get('peak', false),
};

/* ---------- small helpers ---------- */
const rng = v => v == null ? '' : typeof v === 'object' ? `${v.min}–${v.max}` : String(v);
const hi = v => v == null ? 0 : typeof v === 'object' ? v.max : v;
const lo = v => v == null ? 0 : typeof v === 'object' ? v.min : v;
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
    targets: dots,
    translateX: () => A.random(-110, 110), translateY: () => A.random(-110, 60),
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

/* ================= TODAY ================= */
function renderToday() {
  if (!S.data) return;
  const d = getDay(), n = S.data.stretch.exercises.length;
  const sDone = d.stretch.length >= n;
  const meals = S.data.home.protein_floor.meals_per_day;
  const chips = [
    { k: 'stretch', go: 'stretch', done: sDone, dot: sDone ? '✓' : `${d.stretch.length}/${n}`, t: 'Stretch', s: sDone ? 'Done today' : `${n - d.stretch.length} left · foot & ankle` },
    { k: 'strength', go: 'strength', done: d.strength, dot: d.strength ? '✓' : '10′', t: 'Kettlebell', s: d.strength ? 'Session logged' : '10-minute EMOM' },
    { k: 'protein', go: 'diet', done: d.protein >= meals.min, dot: `${d.protein}`, t: 'Protein floor', s: `${d.protein}/${meals.min}–${meals.max} meals at 35–40 g` },
  ];
  $('#today').innerHTML = chips.map(c =>
    `<button class="chip${c.done ? ' done' : ''}" data-k="${c.k}" data-go="${c.go}"><span class="dot">${c.dot}</span><span><b>${c.t}</b><span>${c.s}</span></span></button>`).join('');
}

/* ================= STRETCH ================= */
const ST = { running: false, phase: 'ready', rep: 1, set: 1, remain: 0 };

function stretchEx() { return S.data.stretch.exercises[S.stretchIdx]; }
const isHold = ex => !!ex.dosage.hold_sec;

function resetStretch() {
  const ex = stretchEx();
  Object.assign(ST, { running: false, phase: 'ready', rep: isHold(ex) ? 1 : 0, set: 1, remain: (ex.dosage.hold_sec || 0) * 1000 });
  paintStretchTimer();
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
        </div>
      </div>
    </div>`;
  resetStretch();
  enter('#stDetail > *');
}

function paintStretchTimer() {
  if (S.section !== 'stretch' || !$('#stBig')) return;
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
    ST.phase = 'count'; ST.rep++; beep(740, 0.06, 0.1);
    pulse('#stBig');
    if (ST.rep >= D.repeat) {
      if (ST.set >= D.sets) { finishStretch(); return; }
      ST.set++; ST.rep = 0; beep(988, 0.2); toast(`Set ${ST.set - 1} done. Rest, then set ${ST.set}.`);
    }
    paintStretchTimer(); return;
  }
  if (ST.phase === 'ready') { ST.phase = 'hold'; ST.remain = D.hold_sec * 1000; beep(988, 0.15); }
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
    if (ST.phase === 'hold') { ST.phase = 'rest'; ST.remain = D.rest_sec * 1000; beep(440, 0.25); }
    else {
      ST.rep++;
      if (ST.rep > D.repeat) {
        if (ST.set >= D.sets) { finishStretch(); return; }
        ST.set++; ST.rep = 1; toast(`Set ${ST.set - 1} done. Starting set ${ST.set}.`);
      }
      ST.phase = 'hold'; ST.remain = D.hold_sec * 1000; beep(988, 0.15); pulse('#stBig');
    }
  }
  paintStretchTimer();
}

function finishStretch() {
  ST.running = false; ST.phase = 'done';
  beep(784, 0.15); setTimeout(() => beep(1046, 0.3), 160);
  markStretch(true);
  paintStretchTimer();
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
const EM = { running: false, elapsed: 0 };

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

function renderStrength() {
  const K = S.data.kb;
  $('#p-strength').innerHTML = `
    <p class="lede"><b>${esc(K.title)}</b>: ${esc(K.subtitle)}, ${K.equipment.kettlebell_lb} lb bell.
      At the start of each minute do the reps, then rest until the next beep. Two rounds of five.</p>
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
          <button class="btn" data-act="em-reset"><kbd>R</kbd> Reset</button>
          <button class="btn${S.peak ? ' on' : ''}" data-act="peak" id="peakBtn"><kbd>P</kbd> Peak week${S.peak ? ' on' : ''}</button>
          <button class="btn" data-act="em-done" id="emDone"></button>
        </div>
        <div class="total" id="emTotal" style="margin-top:10px"></div>
      </div>
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
  renderPlan(); renderTracker(); paintEmom();
}

function renderPlan() {
  const cur = EM.running || EM.elapsed > 0 ? Math.min(9, Math.floor(EM.elapsed / 60000)) % 5 : -1;
  $('#emPlan').innerHTML = S.data.kb.exercises.map((ex, i) => `
    <div class="slot${i === cur ? ' cur' : ''}">
      <div class="m">MIN ${ex.minutes.join(' & ')}</div>
      <div class="n">${esc(ex.name)}</div>
      <div class="r">${esc(rxText(ex))}</div>
      <div class="b">${esc(ex.trail_benefit)}</div>
    </div>`).join('');
}

function paintEmom() {
  if (!$('#emBig')) return;
  const K = S.data.kb, total = K.protocol.duration_min * 60000;
  const done = EM.elapsed >= total;
  const minute = Math.min(K.protocol.duration_min - 1, Math.floor(EM.elapsed / 60000));
  const ex = exForMinute(minute + 1), nx = exForMinute(minute + 2);
  const secLeft = done ? 0 : 60 - (EM.elapsed % 60000) / 1000;
  const round = minute < 5 ? 1 : 2;
  $('#emBig').textContent = done ? '✓' : Math.ceil(secLeft);
  $('#emPhase').textContent = done ? 'complete' : EM.running ? `minute ${minute + 1}` : EM.elapsed ? 'paused' : 'ready';
  setRing($('#emRing'), done ? 1 : (EM.elapsed % 60000) / 60000);
  $('#emEyebrow').textContent = done ? 'Session complete' : `Round ${round} of ${K.protocol.rounds} · Minute ${minute + 1} of ${K.protocol.duration_min}`;
  $('#emName').textContent = done ? 'Nice work.' : ex.name;
  $('#emRx').textContent = done ? '' : rxText(ex);
  $('#emCues').innerHTML = done ? '' : ex.form_cues.map(c => `<li>${esc(c)}</li>`).join('');
  $('#emNext').textContent = done ? 'Logged in your 30-day tracker.' : nx ? `Next: ${nx.name} (${rxText(nx)})` : 'Last minute, finish strong.';
  $('#emTotal').innerHTML = `<span class="mono">${mmss(Math.max(0, (total - EM.elapsed) / 1000))}</span> left of ${K.protocol.duration_min}:00`;
  $('#emGo').innerHTML = `<kbd>Space</kbd> ${done ? 'Again' : EM.running ? 'Pause' : EM.elapsed ? 'Resume' : 'Start'}`;
  const today = getDay().strength;
  $('#emDone').classList.toggle('on', today);
  $('#emDone').innerHTML = `<kbd>Enter</kbd> ${today ? 'Logged ✓' : 'Log today'}`;
}

let lastMinute = -1;
function emomGo() {
  const total = S.data.kb.protocol.duration_min * 60000;
  if (EM.elapsed >= total) { EM.elapsed = 0; lastMinute = -1; }
  EM.running = !EM.running;
  if (EM.running && EM.elapsed === 0) { beep(1046, 0.3); lastMinute = 0; pulse('#emName'); }
  paintEmom(); renderPlan();
}
function emomTick(dt) {
  if (!EM.running) return;
  const total = S.data.kb.protocol.duration_min * 60000;
  const beforeSec = Math.ceil(60 - (EM.elapsed % 60000) / 1000);
  EM.elapsed = Math.min(total, EM.elapsed + dt);
  const afterSec = Math.ceil(60 - (EM.elapsed % 60000) / 1000);
  if (afterSec !== beforeSec && afterSec <= 3 && afterSec > 0 && EM.elapsed < total) beep(520, 0.05, 0.08);
  const m = Math.floor(EM.elapsed / 60000);
  if (EM.elapsed >= total) {
    EM.running = false; beep(784, 0.15); setTimeout(() => beep(1046, 0.4), 160);
    const d = getDay(); if (!d.strength) { d.strength = true; setDay(d); }
    renderTracker(); paintEmom(); renderPlan(); burst($('#emRing')); toast('Session complete, logged ✓');
    return;
  }
  if (m !== lastMinute) {
    lastMinute = m; beep(1046, 0.3); renderPlan(); pulse('#emName');
    if (m === 5) toast('Round 2');
  }
  paintEmom();
}
function emomReset() { EM.running = false; EM.elapsed = 0; lastMinute = -1; paintEmom(); renderPlan(); }

function toggleStrengthDay(k = dkey()) {
  const d = getDay(k); d.strength = !d.strength; setDay(d, k);
  renderTracker(); paintEmom();
  if (d.strength && k === dkey()) { burst($('#emDone')); toast('Kettlebell logged for today'); }
}

function renderTracker() {
  if (!$('#trkDays')) return;
  const log = store.get('log', {}), today = new Date();
  const days = Array.from({ length: S.data.kb.tracker.days }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (S.data.kb.tracker.days - 1 - i)); return d;
  });
  let count = 0;
  $('#trkDays').innerHTML = days.map(d => {
    const k = dkey(d), on = !!(log[k] && log[k].strength); if (on) count++;
    return `<button class="day${on ? ' on' : ''}${k === dkey() ? ' today' : ''}" data-day="${k}" title="${d.toDateString()}">${d.getDate()}</button>`;
  }).join('');
  let streak = 0; const c = new Date(today);
  if (!(log[dkey(c)] && log[dkey(c)].strength)) c.setDate(c.getDate() - 1);
  while (log[dkey(c)] && log[dkey(c)].strength) { streak++; c.setDate(c.getDate() - 1); }
  $('#trkSum').innerHTML = `<b class="mono">${count}/${S.data.kb.tracker.days}</b> sessions in the last 30 days · streak <b class="mono">${streak}</b>`;
}

/* ================= DIET ================= */
function floorFor(meal) {
  const H = S.data.home, T = S.data.travel;
  const bm = H.protein_floor.by_meal.find(m => m.meal === meal);
  if (S.mode === 'home') return { min: bm.as_built_g.min, max: bm.as_built_g.max, how: bm.closes_gap, note: bm.as_built_g.note };
  if (meal === 'morning') {
    const eggs = T.morning.hotel_breakfast.protein[0].protein_g, lounge = T.morning.airport_lounge.picks_protein_g;
    return { min: eggs, max: eggs + lounge.max, how: 'Hotel eggs, plus lounge protein on travel days', note: 'eggs alone, up to eggs + lounge' };
  }
  if (meal === 'midday') { const p = T.midday.fast_casual_order.protein_g; return { min: p.min, max: p.max, how: 'Double-protein bowl clears it alone', note: 'double-protein bowl' }; }
  return { min: bm.as_built_g.min, max: bm.as_built_g.max, how: 'Order Tier 1 with the ordering script', note: 'same Tier 1 as home' };
}

function renderDiet() {
  const F = S.data.home.protein_floor, d = getDay();
  const pf = F.per_meal_g, SCALE = 60;
  $('#p-diet').innerHTML = `
    <p class="lede"><b>The rule:</b> hit <b>${pf.min}–${pf.max} g protein at every meal</b>, ${F.meals_per_day.min}–${F.meals_per_day.max} times a day. ${esc(F.strategy)}</p>
    <div class="dietbar">
      <div class="seg" role="group" aria-label="Where are you eating">
        <button data-mode="home" aria-pressed="${S.mode === 'home'}">Home</button>
        <button data-mode="travel" aria-pressed="${S.mode === 'travel'}">Travel</button>
      </div>
      <div class="ctrls">
        <button class="btn" data-act="pro-minus" aria-label="Remove a logged meal">−</button>
        <button class="btn primary" data-act="pro-plus"><kbd>Enter</kbd> Meal hit the floor <span class="mono">(${d.protein})</span></button>
      </div>
    </div>
    <div class="floors">${MEALS.map(m => {
      const f = floorFor(m), ok = f.min >= pf.min, maybe = !ok && f.max >= pf.min;
      return `<button class="card floor${m === S.meal ? ' sel' : ''}" data-meal="${m}">
        <div class="meal"><b>${MEAL_LABEL[m]}</b><span class="${ok ? 'status-ok' : 'status-low'}">${ok ? 'Clears floor' : maybe ? 'Depends on pick' : 'Needs protein'}</span></div>
        <div class="meter" title="As built ${f.min}–${f.max} g vs floor ${pf.min}–${pf.max} g">
          <div class="band" style="left:${pf.min / SCALE * 100}%;width:${(pf.max - pf.min) / SCALE * 100}%"></div>
          <div class="fill" style="left:0;width:${Math.min(100, f.max / SCALE * 100)}%;opacity:.35"></div>
          <div class="fill" style="left:0;width:${Math.min(100, f.min / SCALE * 100)}%"></div>
        </div>
        <div class="gap"><span class="mono">${f.min}–${f.max} g</span> as built · <b>${esc(f.how)}</b></div>
      </button>`;
    }).join('')}</div>
    ${S.mode === 'travel' ? travelScript() : ''}
    <div class="card meal-panel" id="mealPanel"></div>`;
  renderMeal();
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

function pRow(name, sub, protein, extra = '', maxG = 60) {
  const floor = S.data.home.protein_floor.per_meal_g.min;
  return `<div class="frow">
    <div><div class="nm">${esc(name)}${extra}</div>${sub ? `<div class="pt">${esc(sub)}</div>` : ''}</div>
    <div class="pbar"><i style="width:${Math.min(100, hi(protein) / maxG * 100)}%"></i><span class="line" style="left:${floor / maxG * 100}%"></span></div>
    <div class="val">${rng(protein)} g<small>protein</small></div>
  </div>`;
}

function renderMeal() {
  const el = $('#mealPanel'); if (!el) return;
  el.innerHTML = S.mode === 'home' ? homeMeal(S.meal) : travelMeal(S.meal);
  enter('#mealPanel > *');
}

function homeMeal(meal) {
  const H = S.data.home;
  if (meal === 'morning') {
    const M = H.morning, rec = M.master_recipe;
    const kcal = rec.reduce((a, r) => a + r.kcal, 0), fib = rec.reduce((a, r) => a + r.fiber_g, 0);
    const bm = H.protein_floor.by_meal[0];
    const T = S.data.travel, boost = H.midday.boost_ins.find(b => b.id === 'cottage-cheese-side');
    return `<div class="eyebrow">${esc(M.tag)}</div><h2>${esc(M.title)}</h2>
      <p class="tierrule">Whole batch: <b class="mono">${kcal} kcal · ${fib.toFixed(1)} g fiber</b>. Protein ~${bm.as_built_g.min}–${bm.as_built_g.max} g, so <b>${esc(bm.closes_gap.toLowerCase())}</b>.</p>
      <div class="cols">${rec.map(r => `<div class="mini"><b>${esc(r.name)}</b><span>${esc(r.qty)} (${r.grams} g), ${esc(r.prep)} · ${r.kcal} kcal · ${r.fiber_g} g fiber</span><br><span>${esc(r.note)}</span></div>`).join('')}</div>
      <div class="note"><b>Protein anchor:</b> your handout's anchor list isn't in the data yet. Options from elsewhere in your plan:
        3 eggs (~${T.morning.hotel_breakfast.protein[0].protein_g} g), smoked salmon 3 oz (~${T.morning.hotel_breakfast.protein[1].protein_g} g), cottage cheese ${esc(boost.qty)} (${boost.protein_g} g).</div>
      <div class="h3" style="margin-top:14px">Zero-calorie dry rubs <span class="total">(~${M.seasoning_rubs.kcal_per_batch.min}–${M.seasoning_rubs.kcal_per_batch.max} kcal a batch)</span></div>
      <div class="cols">${M.seasoning_rubs.items.map(r => `<div class="mini"><b>${esc(r.name)}</b><span>${esc(r.ingredients.join(' · '))}</span><br><span><i>${esc(r.profile)}</i></span></div>`).join('')}</div>
      <details><summary>Swap ingredients</summary>
        ${Object.entries(M.substitutes).map(([g, items]) => `<div class="h3" style="margin-top:12px;text-transform:capitalize">${esc(g.replace(/_/g, ' '))}</div>
        <div class="cols">${items.map(r => `<div class="mini"><b>${esc(r.name)}</b><span>${esc(r.qty)} (${r.grams} g) · ${r.kcal} kcal · ${r.fiber_g} g fiber · ${esc(r.prep)}</span></div>`).join('')}</div>`).join('')}
      </details>`;
  }
  if (meal === 'midday') {
    const M = H.midday, combos = [...M.combos].sort((a, b) => b.protein_g - a.protein_g);
    return `<h2>${esc(M.title)}</h2><p class="tierrule">${esc(M.summary)} The line on each bar marks 35 g.</p>
      <div class="rows">${combos.map(c => pRow(c.name, `${c.portion} · ~${c.kcal} kcal · ${c.fiber_g} g fiber`, c.protein_g,
        c.clears_floor ? '<span class="badge ok">Clears floor</span>' : c.needs_boost ? '<span class="badge low">Add a boost-in</span>' : '', 50)).join('')}</div>
      <div class="h3" style="margin-top:14px">Boost-ins</div>
      <div class="cols">${M.boost_ins.map(b => `<div class="mini"><b>${esc(b.name)} (${esc(b.qty)})</b><span>+${b.protein_g} g protein · ${b.kcal} kcal</span></div>`).join('')}</div>`;
  }
  const D = H.dinner, t1 = D.tiers[0], t2 = D.tiers[1], t3 = D.tiers[2], tp = D.training_day_portion_g;
  return `<h2>${esc(D.title)}</h2><p class="tierrule">${esc(D.strategy)}</p>
    <div class="note"><b>Training day?</b> Raise the protein to <span class="mono">${tp.min}–${tp.max} g</span> (${esc(tp.applies_to.join(', '))}). Don't add a second protein source.</div>
    <div class="tierhead"><span class="tn">TIER 1</span><h3>${esc(t1.name)}</h3></div><p class="tierrule">${esc(t1.rule)} Portion ${D.default_portion_g} g cooked.</p>
    <div class="rows">${t1.proteins.map(p => pRow(p.name, `${p.kcal} kcal · ${p.note}`, p.protein_g)).join('')}</div>
    <div class="h3" style="margin-top:10px">Vegetables <span class="total">(${esc(t1.vegetables.serving)})</span></div>
    <div class="cols">${t1.vegetables.items.map(v => `<div class="mini"><b>${esc(v.name)}</b><span>${v.kcal} kcal · ${v.fiber_g} g fiber · ${v.protein_g} g protein</span><br><span>${esc(v.note)}</span></div>`).join('')}</div>
    <div class="tierhead"><span class="tn">TIER 2</span><h3>${esc(t2.name)}</h3></div><p class="tierrule">${esc(t2.rule)}</p>
    <div class="cols">${t2.items.map(tierItem).join('')}</div>
    <div class="tierhead"><span class="tn">TIER 3</span><h3>${esc(t3.name)}</h3></div><p class="tierrule">${esc(t3.rule)}</p>
    <div class="cols">${t3.items.map(tierItem).join('')}</div>
    <div class="h3" style="margin-top:14px">Fat budget</div>
    <div class="cols">${D.fat_budget.map(f => `<div class="mini"><b>${esc(f.name)} (${esc(f.qty)})</b><span>${rng(f.kcal)} kcal · ${esc(f.note)}</span></div>`).join('')}</div>`;
}

function tierItem(i) {
  const bits = [];
  if (i.grams) bits.push(`${i.grams} g`); if (i.qty) bits.push(i.qty);
  if (i.kcal != null) bits.push(`${rng(i.kcal)} kcal`); if (i.kcal_added != null) bits.push(`+${rng(i.kcal_added)} kcal`);
  if (i.protein_g != null) bits.push(`${rng(i.protein_g)} g protein`); if (i.protein_g_added) bits.push(`+${i.protein_g_added} g protein`);
  return `<div class="mini"><b>${esc(i.name)}</b><span>${esc(bits.join(' · '))}</span><br><span>${esc(i.note)}</span></div>`;
}

function travelMeal(meal) {
  const T = S.data.travel;
  if (meal === 'morning') {
    const hb = T.morning.hotel_breakfast, al = T.morning.airport_lounge;
    return `<h2>Morning: hotel & lounge</h2>
      <div class="script"><span>“${esc(hb.order)}”</span><button class="btn copy" data-copy="${esc(hb.order)}">Copy</button></div>
      <div class="rows">${hb.protein.map(p => pRow(p.item, p.note || '', p.protein_g)).join('')}</div>
      <div class="note">${esc(hb.marriott_note)}</div>
      <div class="cols">
        <div class="mini"><b>Lounge picks (${esc(al.lounges.join(', '))})</b><span>${esc(al.picks.join(' · '))}</span><br><span>${al.picks_protein_g.min}–${al.picks_protein_g.max} g protein ${esc(al.picks_protein_g.note)}</span></div>
        <div class="mini"><b>Skip by default</b><span>${esc(al.skip_by_default.join(' · '))}</span></div>
      </div>
      <p class="tierrule">${esc(T.morning.summary)}</p>`;
  }
  if (meal === 'midday') {
    const fc = T.midday.fast_casual_order, g = T.midday.grocery_deli;
    return `<h2>Midday: between meetings</h2>
      <div class="script"><span>“${esc(fc.script)}”</span><button class="btn copy" data-copy="${esc(fc.script)}">Copy</button></div>
      <div class="rows">${pRow('Double-protein bowl', fc.availability, fc.protein_g, '<span class="badge ok">Clears floor</span>')}</div>
      <div class="cols">
        <div class="mini"><b>Client lunch or room service</b><span>${esc(T.midday.client_lunch_or_room_service)}</span></div>
        <div class="mini"><b>Grocery / deli</b><span>US: ${esc(g.us.join(', '))} · UK: ${esc(g.uk.join(', '))}</span><br><span>${esc(g.approach)}</span></div>
      </div>`;
  }
  const t1 = S.data.home.dinner.tiers[0];
  return `<h2>Dinner on the road</h2>
    <p class="tierrule">Your travel sheet has no separate dinner plan: use the ordering script above to rebuild Tier 1 from any menu. These are the proteins to ask for.</p>
    <div class="rows">${t1.proteins.map(p => pRow(p.name, p.note, p.protein_g)).join('')}</div>`;
}

function setMeal(m) {
  S.meal = m;
  $$('.floor').forEach(b => b.classList.toggle('sel', b.dataset.meal === m));
  renderMeal();
}
function setMode(mode) {
  S.mode = mode; store.set('dietMode', mode); renderDiet();
  toast(mode === 'travel' ? 'Travel mode: ordering scripts' : 'Home mode: shopping list');
}
function logProtein(delta) {
  const d = getDay(), max = S.data.home.protein_floor.meals_per_day.max;
  const n = Math.max(0, Math.min(max, d.protein + delta));
  if (n === d.protein) { if (delta > 0) toast(`That's all ${max} meals logged today`); return; }
  d.protein = n; setDay(d);
  const btn = $('[data-act="pro-plus"]'); if (btn) btn.innerHTML = `<kbd>Enter</kbd> Meal hit the floor <span class="mono">(${n})</span>`;
  if (delta > 0) { burst(btn); toast(`${n} meal${n > 1 ? 's' : ''} at the protein floor today`); }
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
  if (section === 'stretch') paintStretchTimer();
  if (section === 'strength') { renderTracker(); paintEmom(); }
  if (animate) enter(`#p-${section} > *`);
  BG.show(section);
}

function renderKeys() {
  const common = '<span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> sections</span>';
  const per = {
    stretch: '<span><kbd>Space</kbd> timer</span><span><kbd>←</kbd><kbd>→</kbd> exercise</span><span><kbd>Enter</kbd> done</span>',
    strength: '<span><kbd>Space</kbd> start / pause</span><span><kbd>R</kbd> reset</span><span><kbd>P</kbd> peak week</span><span><kbd>Enter</kbd> log</span>',
    diet: '<span><kbd>←</kbd><kbd>→</kbd> meal</span><span><kbd>T</kbd> home / travel</span><span><kbd>Enter</kbd> +1 meal</span>',
  };
  $('#keys').innerHTML = common + per[S.section] + '<span><kbd>?</kbd> all</span>';
}

const HELP = [
  ['Anywhere', [['1  2  3', 'Stretch · Strength · Diet'], ['S  K  D', 'Same, by letter (Stretch, Kettlebell, Diet)'], ['?', 'Show or hide this list'], ['Esc', 'Close / pause the running timer'], ['H', 'Back to mezins.com']]],
  ['Stretch', [['Space', 'Start / pause the hold timer (or count a rep for calf raises)'], ['← →  or  J L', 'Previous / next exercise'], ['R', 'Reset the timer'], ['Enter', 'Mark this exercise done today']]],
  ['Strength', [['Space', 'Start / pause the 10-minute EMOM'], ['R', 'Reset the clock'], ['P', 'Peak-volume week (fewer swings and lunges)'], ['Enter', 'Log / unlog today\'s session']]],
  ['Diet', [['← →  or  J L', 'Morning · Midday · Dinner'], ['T', 'Switch Home / Travel'], ['Enter', 'Log a meal that hit 35–40 g protein'], ['−', 'Undo a logged meal']]],
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
    else if (k === 'Enter') { e.preventDefault(); markStretch(); }
  } else if (S.section === 'strength') {
    if (k === ' ') { e.preventDefault(); emomGo(); }
    else if (lk === 'r') emomReset();
    else if (lk === 'p') togglePeak();
    else if (k === 'Enter') { e.preventDefault(); toggleStrengthDay(); }
  } else {
    const i = MEALS.indexOf(S.meal);
    if (prev) { e.preventDefault(); setMeal(MEALS[(i + 2) % 3]); }
    else if (next) { e.preventDefault(); setMeal(MEALS[(i + 1) % 3]); }
    else if (lk === 't') setMode(S.mode === 'home' ? 'travel' : 'home');
    else if (k === 'Enter') { e.preventDefault(); logProtein(1); }
    else if (k === '-' || k === 'Backspace') { e.preventDefault(); logProtein(-1); }
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
  if (b.dataset.day) return toggleStrengthDay(b.dataset.day);
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
  else if (act === 'em-reset') emomReset();
  else if (act === 'em-done') toggleStrengthDay();
  else if (act === 'peak') togglePeak();
  else if (act === 'pro-plus') logProtein(1);
  else if (act === 'pro-minus') logProtein(-1);
}

/* ================= three.js background ================= */
const BG = (() => {
  let renderer, scene, camera, objs = {}, current = null, raf = 0, mouse = { x: 0, y: 0 };
  const cssColor = n => new (window.THREE.Color)(getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888');
  function init() {
    if (!window.THREE) return;
    const THREE = window.THREE, canvas = $('#bg');
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); camera.position.z = 10;
    const mat = n => new THREE.MeshBasicMaterial({ color: cssColor(n), wireframe: true, transparent: true, opacity: 0 });
    // Stretch: a flowing knot. Strength: a kettlebell. Diet: a faceted bowl-like sphere.
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
    raf = requestAnimationFrame(loop);
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
  // Re-render "today" when the date rolls over while the page is open.
  let day = dkey();
  setInterval(() => { if (dkey() !== day) { day = dkey(); renderToday(); renderTracker(); } }, 60000);
}
boot();
})();
