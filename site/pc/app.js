/* PC Setup page. Content lives in content.js (window.PC). */
(() => {
'use strict';
const { COMPS, BOARD, WIRES, STAGES, PARTS, SYMPTOMS, LEDS, SOCKETS, FIT, GLOSSARY } = window.PC;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const A = window.anime || null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem('mz-pc:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mz-pc:' + k, JSON.stringify(v)); } catch {} },
};
const S = { tab: 'boot', stage: 0, fail: false, playing: false, part: 'cpu', sym: 'nodisplay', led: null, prog: store.get('prog', {}) };
const TABS = ['boot', 'map', 'fix', 'compat', 'learn'];

/* ================= diagram ================= */
const LED_NAMES = ['CPU', 'DRAM', 'VGA', 'BOOT'];
function fanIcon(cx, cy, r, id) {
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".25"/>` +
    `<path class="fanblade" data-fan="${id}" d="M${cx} ${cy - r + 3} Q${cx + r * .5} ${cy - r * .2} ${cx} ${cy} Q${cx - r * .5} ${cy + r * .2} ${cx} ${cy + r - 3} M${cx - r + 3} ${cy} Q${cx - r * .2} ${cy - r * .5} ${cx} ${cy} Q${cx + r * .2} ${cy + r * .5} ${cx + r - 3} ${cy}" stroke="currentColor" stroke-width="2.5" fill="none"/></g>`;
}
function diagramSVG(prefix) {
  let s = `<svg viewBox="0 0 900 500" role="img" aria-label="Diagram of a PC: power supply, motherboard parts, graphics card, monitor and keyboard" style="color:var(--muted)">`;
  s += `<rect class="boardbg" x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.w}" height="${BOARD.h}" rx="10"/>`;
  s += `<text class="boardlbl" x="${BOARD.x + 12}" y="${BOARD.y + BOARD.h - 10}">MOTHERBOARD</text>`;
  for (const [id, w] of Object.entries(WIRES)) s += `<path id="${prefix}w-${id}" class="wire k-${w.k}" d="${w.d}"/>`;
  for (const [id, c] of Object.entries(COMPS)) {
    s += `<g class="comp" id="${prefix}c-${id}" data-part="${id}" tabindex="0" role="button" aria-label="${esc(c.label)}">`;
    if (c.r) {
      s += `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/><text x="${c.cx}" y="${c.cy + 4}" text-anchor="middle">${esc(c.label)}</text>`;
    } else {
      s += `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="6"/>`;
      if (c.slots) for (let i = 0; i < 4; i++) s += `<rect class="slot" x="${c.x + 12 + i * 24}" y="${c.y + 22}" width="12" height="${c.h - 34}" rx="2"/>` +
        `<text x="${c.x + 18 + i * 24}" y="${c.y + c.h - 2}" text-anchor="middle" style="font-size:8px">${['A1', 'A2', 'B1', 'B2'][i]}</text>`;
      if (c.leds) LED_NAMES.forEach((n, i) => { s += `<circle class="led" data-led="${n}" cx="${c.x + 12 + i * 20}" cy="${c.y + 30}" r="5"/><text x="${c.x + 12 + i * 20}" y="${c.y + 45}" text-anchor="middle" style="font-size:7px">${n}</text>`; });
      if (c.screen) s += `<rect class="screen" x="${c.x + 8}" y="${c.y + 20}" width="${c.w - 16}" height="${c.h - 28}" rx="3"/>`;
      if (c.fan) s += fanIcon(c.x + c.w - (c.h > 40 ? 30 : 12), c.y + c.h / 2 + (c.h > 40 ? 6 : 0), c.h > 40 ? Math.min(22, c.h / 2 - 6) : 7, id);
      const ty = c.slots || c.leds || c.screen ? c.y + 14 : c.y + c.h / 2 + 4;
      const tx = c.slots || c.leds || c.screen ? c.x + 8 : c.fan ? c.x + (c.h > 40 ? 10 : 5) : c.x + c.w / 2;
      const anchor = c.slots || c.leds || c.screen || c.fan ? 'start' : 'middle';
      if (id === 'atx24') s += `<text x="${c.x + c.w / 2}" y="${c.y + c.h / 2}" text-anchor="middle" transform="rotate(-90 ${c.x + c.w / 2} ${c.y + c.h / 2})">24-pin ATX</text>`;
      else s += `<text x="${tx}" y="${ty}" text-anchor="${anchor}"${c.small ? ' style="font-size:11px"' : ''}>${esc(c.label)}</text>`;
    }
    s += `</g>`;
  }
  return s + `</svg>`;
}
function paintDiagram(prefix, st) {
  const root = document;
  $$(`[id^="${prefix}c-"]`, root).forEach(g => { g.classList.remove('on', 'bad', 'sel'); });
  $$(`[id^="${prefix}w-"]`, root).forEach(w => w.classList.remove('on', 'bad'));
  const box = $(`#${prefix}svg`); if (!box) return;
  $$('.fanblade', box).forEach(f => f.classList.remove('spin'));
  $$('.led', box).forEach(l => l.classList.remove('lit'));
  $$('.screen', box).forEach(l => l.classList.remove('lit'));
  (st.on || []).forEach(id => $(`#${prefix}c-${id}`)?.classList.add('on'));
  (st.wires || []).forEach(id => $(`#${prefix}w-${id}`)?.classList.add('on'));
  (st.fans || []).forEach(id => $(`[data-fan="${id}"]`, box)?.classList.add('spin'));
  if (st.screen) $$('.screen', box).forEach(l => l.classList.add('lit'));
  if (st.led) $(`[data-led="${st.led}"]`, box)?.classList.add('lit');
  (st.bad || []).forEach(id => { const g = $(`#${prefix}c-${id}`); g?.classList.remove('on'); g?.classList.add('bad'); });
  (st.badWires || []).forEach(id => { const w = $(`#${prefix}w-${id}`); w?.classList.remove('on'); w?.classList.add('bad'); });
  (st.sel || []).forEach(id => $(`#${prefix}c-${id}`)?.classList.add('sel'));
}

/* ================= boot journey ================= */
const stageLed = st => st.led || (st.id === 'vrm' || st.id === 'firmware' ? 'CPU' : null);
function renderBoot() {
  $('#p-boot').innerHTML = `
    <div class="stagebar" id="stagebar">${STAGES.map((st, i) => `<button data-stage="${i}"><b>${i + 1}</b>${esc(st.short)}</button>`).join('')}</div>
    <div class="ctrl">
      <button class="btn" data-act="prev"><kbd>←</kbd> Back</button>
      <button class="btn primary" data-act="next">Next stage <kbd>→</kbd></button>
      <button class="btn" data-act="play" id="playBtn"></button>
      <button class="btn danger" data-act="fail" id="failBtn"></button>
      <span class="clock" id="clock"></span>
    </div>
    <div class="journey">
      <div class="card diagram"><div id="b-svg">${diagramSVG('b-')}</div>
        <div class="legend">
          <span><i style="background:var(--w-ac)"></i>AC mains</span><span><i style="background:var(--w-sb)"></i>5 V standby</span>
          <span><i style="background:var(--w-on)"></i>Power-on signal</span><span><i style="background:var(--w-ok)"></i>Power good</span>
          <span><i style="background:var(--w-12)"></i>+12 V</span><span><i style="background:var(--w-rails)"></i>Rails / Vcore</span>
          <span><i style="background:var(--w-data)"></i>Data bus</span><span><i style="background:var(--w-video)"></i>Video</span>
        </div>
        <div class="legend">Tap any part to learn about it (Board map).</div>
      </div>
      <div class="card info" id="stageInfo"></div>
    </div>`;
  paintStage(false);
}
function paintStage(animate = true) {
  const st = STAGES[S.stage];
  $$('#stagebar button').forEach((b, i) => { b.classList.toggle('on', i === S.stage); b.classList.toggle('done', i < S.stage); });
  $('#clock').textContent = st.time;
  $('#playBtn').innerHTML = `<kbd>Space</kbd> ${S.playing ? 'Pause' : 'Play boot'}`;
  $('#failBtn').classList.toggle('on', S.fail);
  $('#failBtn').innerHTML = `<kbd>E</kbd> ${S.fail ? 'Showing failure' : 'What if it fails here?'}`;
  const d = { on: st.on, wires: st.wires, fans: st.fans, screen: st.screen, led: stageLed(st) };
  if (S.fail) Object.assign(d, { bad: st.fail.comps, badWires: st.fail.wires, screen: false, fans: st.id === 'standby' || st.id === 'button' ? [] : st.fans });
  paintDiagram('b-', d);
  $('#stageInfo').innerHTML = `
    <div class="eyebrow">Stage ${S.stage + 1} of ${STAGES.length} · ${esc(st.time)}</div>
    <h2>${esc(st.title)}</h2>
    <p>${esc(st.what)}</p>
    <div class="chips">${st.on.map(id => `<button class="chip" data-part="${id}">${esc(PARTS[id]?.name || id)}</button>`).join('')}</div>
    <div class="io">
      <div class="in"><h4>Waiting for (inputs)</h4><ul>${st.inputs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="out"><h4>Produces (outputs)</h4><ul>${st.outputs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    <p><b style="color:var(--ok)">✓ Success looks like:</b> ${esc(st.success)}</p>
    <div class="fail"${S.fail ? ' style="outline:2px solid var(--bad)"' : ''}><h4>✗ If it fails here</h4><p style="margin:0 0 6px"><b>${esc(st.fail.symptom)}</b></p><ul>${st.fail.causes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="deep"><b>Go deeper:</b> ${esc(st.deep)}</div>`;
  if (animate && A && !reduced) {
    A({ targets: '#stageInfo > *', opacity: [0, 1], translateY: [8, 0], delay: A.stagger(30), duration: 320, easing: 'easeOutQuad' });
    A({ targets: $$('#b-svg .comp.on, #b-svg .comp.bad'), scale: [1.04, 1], duration: 500, easing: 'easeOutElastic(1,.6)' });
  }
}
function goStage(i) { S.stage = Math.max(0, Math.min(STAGES.length - 1, i)); history.replaceState(null, '', '#boot/' + (S.stage + 1)); paintStage(); }
let playTimer = null;
function togglePlay() {
  S.playing = !S.playing;
  clearInterval(playTimer);
  if (S.playing) {
    S.fail = false;
    if (S.stage === STAGES.length - 1) S.stage = 0;
    paintStage();
    playTimer = setInterval(() => { if (S.stage >= STAGES.length - 1) { S.playing = false; clearInterval(playTimer); paintStage(false); return; } goStage(S.stage + 1); }, 6000);
  } else paintStage(false);
}

/* ================= board map ================= */
function renderMap() {
  $('#p-map').innerHTML = `
    <div class="parts">${Object.entries(PARTS).map(([id, p]) => `<button class="chip" data-part="${id}">${esc(p.name)}</button>`).join('')}</div>
    <div class="mapgrid">
      <div class="card diagram"><div id="m-svg">${diagramSVG('m-')}</div><div class="legend">Click any part. <kbd>←</kbd><kbd>→</kbd> step through parts.</div></div>
      <div class="card info" id="partInfo"></div>
    </div>`;
  paintPart();
}
function paintPart() {
  const p = PARTS[S.part]; if (!p || !$('#partInfo')) return;
  paintDiagram('m-', { on: [S.part], sel: [S.part] });
  const stages = STAGES.map((st, i) => st.on.includes(S.part) ? i : -1).filter(i => i >= 0);
  $('#partInfo').innerHTML = `
    <div class="eyebrow">Part</div><h2>${esc(p.name)}</h2>
    <p>${esc(p.what)}</p>
    ${p.io ? `<div class="deep"><b>Inputs → outputs:</b> ${esc(p.io)}</div>` : ''}
    ${p.nums.length ? `<h4 style="margin:14px 0 4px">Key numbers</h4><ul>${p.nums.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${p.mistakes.length ? `<div class="fail"><h4>Common build mistakes</h4><ul>${p.mistakes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    ${stages.length ? `<h4 style="margin:14px 0 4px">Active during boot stages</h4><div class="chips">${stages.map(i => `<button class="chip" data-gostage="${i}">${i + 1}. ${esc(STAGES[i].short)}</button>`).join('')}</div>` : ''}`;
  if (A && !reduced) A({ targets: '#partInfo > *', opacity: [0, 1], translateY: [6, 0], delay: A.stagger(25), duration: 280, easing: 'easeOutQuad' });
}
function selectPart(id) { if (!PARTS[id]) return; S.part = id; if (S.tab !== 'map') go('map'); else paintPart(); }

/* ================= troubleshooter ================= */
function renderFix() {
  $('#p-fix').innerHTML = `
    <div class="ts">
      <div>
        <div class="card symlist">${SYMPTOMS.map(s => `<button class="sym" data-sym="${s.id}"><span class="ic">${s.ic}</span><span><b>${esc(s.t)}</b><span class="s">${esc(s.s)}</span></span></button>`).join('')}</div>
        <div class="card" style="padding:14px 16px;margin-top:12px">
          <b>Which debug LED is stuck on?</b>
          <div class="leds">${Object.keys(LEDS).map(n => `<button class="ledbtn" data-led="${n}"><i></i>${n}</button>`).join('')}</div>
          <div style="font-size:.8rem;color:var(--muted)">They light in order CPU → DRAM → VGA → BOOT; the one that stays on is where it stopped.</div>
        </div>
        <div class="safety"><b>Safety first:</b> switch the PSU off at the back and unplug before touching anything inside; press the power button once to drain leftover charge. Touch bare metal on the case to discharge static. Never open a power supply: its capacitors can hold a dangerous charge.</div>
      </div>
      <div class="card steps" id="steps"></div>
    </div>`;
  paintFix();
}
function paintFix() {
  $$('.sym').forEach(b => b.classList.toggle('on', !S.led && b.dataset.sym === S.sym));
  $$('.ledbtn').forEach(b => b.classList.toggle('on', b.dataset.led === S.led));
  let title, intro, steps, key;
  if (S.led) {
    const L = LEDS[S.led]; key = 'led-' + S.led;
    title = `${S.led} light stays on`; intro = L.what; steps = L.steps.map(t => [t, '']);
  } else {
    const sy = SYMPTOMS.find(s => s.id === S.sym); key = sy.id;
    title = `${sy.ic} ${sy.t}`; intro = 'Work down the list: most likely causes first. Mark each check as you go.'; steps = sy.steps;
  }
  const pr = S.prog[key] || { at: 0, fixed: -1 };
  $('#steps').innerHTML = `<h2>${esc(title)}</h2><p style="color:var(--muted);margin:0 0 6px">${esc(intro)}</p>
    ${steps.map(([t, why], i) => {
      const cls = pr.fixed === i ? 'fixed' : pr.fixed >= 0 ? (i < pr.fixed ? 'skip' : '') : i === pr.at ? 'cur' : i < pr.at ? 'skip' : '';
      return `<div class="step ${cls}"><div class="n">${pr.fixed === i ? '✓' : i + 1}</div><div><b>${esc(t)}</b>${why ? `<div class="why">${esc(why)}</div>` : ''}
        ${i === pr.at && pr.fixed < 0 ? `<div class="acts"><button class="btn primary" data-fixed="${i}">That fixed it <kbd>Y</kbd></button><button class="btn" data-next="${i}">Checked, still broken <kbd>N</kbd></button></div>` : ''}</div></div>`;
    }).join('')}
    ${pr.fixed >= 0 ? `<p style="margin-top:12px;color:var(--ok);font-weight:600">Fixed at step ${pr.fixed + 1}. 🎉</p>` : pr.at >= steps.length ? `<p style="margin-top:12px"><b>Still stuck?</b> Strip down to the minimum (CPU, cooler, one RAM stick, PSU; GPU only if the CPU has no graphics) and add parts back one at a time. The part that breaks it is the culprit.</p>` : ''}
    <div class="ctrl" style="margin-top:12px"><button class="btn" data-act="resetfix"><kbd>R</kbd> Start this list over</button></div>`;
  const cur = $('#steps .step.cur'); if (cur && A && !reduced) A({ targets: cur, scale: [.98, 1], duration: 300, easing: 'easeOutQuad' });
  S._fixKey = key; S._fixLen = steps.length;
}
function fixAct(kind) {
  const pr = S.prog[S._fixKey] || { at: 0, fixed: -1 };
  if (kind === 'reset') delete S.prog[S._fixKey];
  else if (kind === 'fixed') S.prog[S._fixKey] = { at: pr.at, fixed: pr.at };
  else if (kind === 'next') S.prog[S._fixKey] = { at: Math.min(S._fixLen, pr.at + 1), fixed: -1 };
  store.set('prog', S.prog); paintFix();
}

/* ================= compatibility ================= */
const CPU_W = [['65', 'Efficient 6–8 core (65 W, e.g. Ryzen 5 7600, Core i5-14400)'], ['125', 'Mid/high (105–125 W, e.g. Ryzen 7 9700X, Core i5-14600K)'], ['170', 'High-end (170 W, e.g. Ryzen 9 9950X)'], ['253', 'Top Intel K (up to 253 W, e.g. Core i9-14900K)']];
const GPU_W = [['0', 'No graphics card'], ['120', 'Entry (≈120 W, e.g. RTX 3050 / RX 6600)'], ['200', 'Mid (≈200 W, e.g. RTX 4060 Ti / RX 7700 XT)'], ['260', 'Upper-mid (≈260 W, e.g. RX 7800 XT / RTX 5070)'], ['320', 'High (≈300–350 W, e.g. RTX 4080 / RX 7900 XT)'], ['450', 'Very high (≈450 W, e.g. RTX 4090)'], ['575', 'Flagship (≈575 W, e.g. RTX 5090)']];
const PSU_SIZES = [450, 550, 650, 750, 850, 1000, 1200, 1300, 1600];
function renderCompat() {
  const sock = store.get('sock', 'AM5');
  const fit = store.get('fit', {});
  $('#p-compat').innerHTML = `<div class="compat">
    <div class="card"><h3>1 · CPU ↔ motherboard ↔ RAM</h3>
      <div class="row"><label>CPU socket</label><select id="sock">${Object.keys(SOCKETS).map(k => `<option${k === sock ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="result" id="sockOut"></div>
      <p style="font-size:.85rem;color:var(--muted);margin:10px 0 0">The golden rule: check the motherboard's <b>CPU support list</b> on the maker's website. It shows the minimum BIOS version for each CPU.</p>
    </div>
    <div class="card"><h3>2 · Power supply size</h3>
      <div class="row"><label>CPU</label><select id="cpuW">${CPU_W.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></div>
      <div class="row"><label>Graphics</label><select id="gpuW">${GPU_W.map(([v, l]) => `<option value="${v}"${v === '260' ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="result" id="psuOut"></div>
      <p style="font-size:.8rem;color:var(--muted);margin:8px 0 0">Estimate = (CPU + GPU + ~100 W for board, RAM, drives, fans) × 1.35 headroom, rounded up to a common PSU size. If the GPU maker recommends more, use their number.</p>
    </div>
    <div class="card"><h3>3 · Will it physically fit?</h3>
      ${FIT.map(([t, s], i) => `<label class="check"><input type="checkbox" data-fit="${i}"${fit[i] ? ' checked' : ''}><span>${esc(t)}<small>${esc(s)}</small></span></label>`).join('')}
      <div class="total" id="fitOut" style="margin-top:8px;font-size:.85rem;color:var(--muted)"></div>
    </div>
    <div class="card"><h3>BIOS Flashback: updating without a CPU</h3>
      <p style="font-size:.9rem">Needed when a board is older than the CPU. Names differ: <b>ASUS BIOS FlashBack</b>, <b>MSI Flash BIOS Button</b>, <b>Gigabyte Q-Flash Plus</b>, <b>ASRock BIOS Flashback</b>.</p>
      <ol style="font-size:.9rem;padding-left:18px;margin:0">
        <li>Download the BIOS for your exact board model from the maker's site.</li>
        <li>USB stick formatted FAT32; copy the file and <b>rename it</b> exactly as the manual says.</li>
        <li>PSU connected (24-pin + 8-pin) and switched on; PC off.</li>
        <li>Stick in the marked Flashback USB port; press the Flashback button.</li>
        <li>An LED flashes for a few minutes. Don't interrupt! When it stops, it's done.</li>
      </ol>
    </div>
  </div>`;
  paintSock(); paintPsu(); paintFit();
}
function paintSock() {
  const k = $('#sock').value, s = SOCKETS[k]; store.set('sock', k);
  $('#sockOut').innerHTML = `<table class="t"><tr><th>CPUs</th><td>${esc(s.cpus)}</td></tr><tr><th>RAM</th><td><b>${esc(s.ram)}</b></td></tr>
    <tr><th>Chipsets</th><td>${esc(s.chipsets)}</td></tr><tr><th>BIOS</th><td>${esc(s.bios)}</td></tr>
    <tr><th>Built-in graphics</th><td>${esc(s.igpu)}</td></tr><tr><th>Cooler</th><td>${esc(s.cooler)}</td></tr></table>`;
}
function paintPsu() {
  const cpu = +$('#cpuW').value, gpu = +$('#gpuW').value, total = cpu + gpu + 100;
  const need = total * 1.35, rec = PSU_SIZES.find(x => x >= need) || 1600;
  $('#psuOut').innerHTML = `<div style="display:flex;gap:18px;align-items:baseline;flex-wrap:wrap"><div><div class="big">${rec} W</div><div style="font-size:.8rem;color:var(--muted)">recommended PSU</div></div>
    <div style="font-size:.88rem">Estimated peak draw ≈ <b>${total} W</b><br>${gpu >= 300 ? 'Look for an ATX 3.x PSU with a native 12V-2x6 cable.' : 'Any quality 80 PLUS Gold unit is a good pick.'}</div></div>`;
}
function paintFit() {
  const boxes = $$('[data-fit]'), n = boxes.filter(b => b.checked).length;
  const fit = {}; boxes.forEach(b => { if (b.checked) fit[b.dataset.fit] = 1; }); store.set('fit', fit);
  $('#fitOut').textContent = n === boxes.length ? 'All checked: ready to order! ✓' : `${n} of ${boxes.length} checked`;
}

/* ================= learn ================= */
function renderLearn() {
  $('#p-learn').innerHTML = `<div class="learn">
    <div class="card"><h3>⚡ Voltage, current, power</h3>
      <p><b>Voltage</b> (V) is electrical "pressure". <b>Current</b> (A, amps) is how much electricity flows. <b>Power</b> (W, watts) is the work done.</p>
      <div class="eq">P = V × I</div>
      <div class="calc">CPU power <input type="range" id="pw" min="20" max="300" value="150"> <b id="pwv" class="mono"></b></div>
      <p id="pwout" style="margin-top:8px"></p>
    </div>
    <div class="card"><h3>🔢 Everything is 0s and 1s</h3>
      <p>Inside chips, a wire at a low voltage means <b>0</b>, a higher voltage means <b>1</b>. Eight of these bits make a <b>byte</b>. Tap the bits:</p>
      <div class="chips" id="bits">${[128, 64, 32, 16, 8, 4, 2, 1].map(v => `<button class="chip mono" data-bit="${v}" style="min-width:38px">0</button>`).join('')}</div>
      <p>Value: <b class="mono" id="bitv">0</b> · hex <b class="mono" id="bith">00</b> · letter <b class="mono" id="bitc">–</b></p>
      <p style="font-size:.85rem;color:var(--muted)">The CPU's first instruction lives at address FFFFFFF0 hex: that's 32 bits, almost all 1s.</p>
    </div>
    <div class="card"><h3>⏱️ The clock</h3>
      <p>A crystal on the board ticks steadily; circuits multiply that up. A <b>5 GHz</b> CPU does 5 billion ticks per second.</p>
      <p>In one tick at 5 GHz, light travels only about <b>6 cm</b>. That's why parts that talk fast sit close together, and why RAM needs "training".</p>
      <div class="calc">Clock <input type="range" id="ghz" min="1" max="6" step="0.1" value="5"> <b id="ghzv" class="mono"></b></div>
      <p id="ghzout"></p>
    </div>
    <div class="card"><h3>🛣️ Buses and lanes</h3>
      <p>Parts talk over <b>buses</b>. PCIe uses <b>lanes</b>: pairs of wires sending data one way and one pair back. More lanes = more parallel roads.</p>
      <table class="t"><tr><th>PCIe</th><th>Per lane</th><th>x4 (SSD)</th><th>x16 (GPU)</th></tr>
        <tr><td>Gen 3</td><td>≈1 GB/s</td><td>≈4 GB/s</td><td>≈16 GB/s</td></tr><tr><td>Gen 4</td><td>≈2 GB/s</td><td>≈8 GB/s</td><td>≈32 GB/s</td></tr><tr><td>Gen 5</td><td>≈4 GB/s</td><td>≈16 GB/s</td><td>≈64 GB/s</td></tr></table>
    </div>
    <div class="card"><h3>🧠 How fast is each kind of memory?</h3>
      <p>The closer to the CPU core, the faster, and the smaller.</p>
      <table class="t"><tr><th>Where</th><th>Size</th><th>Wait time</th></tr>
        <tr><td>Registers</td><td>bytes</td><td>&lt; 1 ns</td></tr><tr><td>L1/L2 cache</td><td>KB–MB</td><td>≈1–5 ns</td></tr><tr><td>L3 cache</td><td>tens of MB</td><td>≈10–20 ns</td></tr>
        <tr><td>RAM</td><td>16–64 GB</td><td>≈60–100 ns</td></tr><tr><td>NVMe SSD</td><td>1–4 TB</td><td>≈20–100 µs</td></tr></table>
      <p style="font-size:.85rem;color:var(--muted);margin-top:6px">If an L1 cache hit took 1 second, reading from the SSD would take somewhere between 6 hours and a whole day.</p>
    </div>
    <div class="card"><h3>🧱 Layers of software</h3>
      <p><b>Firmware</b> (UEFI, plus small firmware inside the SSD, GPU, and keyboard) → <b>boot loader</b> → <b>operating system kernel</b> → <b>drivers</b> (teach the OS each device) → <b>apps</b>. Each layer only works because the one below finished its job. That's the whole boot journey.</p>
    </div>
    <div class="card"><h3>🛡️ Safety rules</h3>
      <ul><li>Switch off at the back and unplug before touching parts; press power once to drain.</li><li>Touch bare metal on the case first (static can kill chips you can't see break).</li>
      <li>Never open a PSU. Its capacitors can store a dangerous charge.</li><li>Never force a connector: if it doesn't go in, it's the wrong one or turned the wrong way.</li>
      <li>Hold boards and cards by the edges.</li></ul>
    </div>
    <div class="card"><h3>📖 Glossary</h3><dl class="gloss">${GLOSSARY.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></div>
  </div>`;
  paintPower(); paintClock(); paintBits();
}
function paintPower() {
  const w = +$('#pw').value; $('#pwv').textContent = w + ' W';
  $('#pwout').innerHTML = `At <b>12 V</b> in the cable: ${(w / 12).toFixed(1)} A.<br>At <b>1.1 V</b> into the CPU: <b>${(w / 1.1).toFixed(0)} A</b>, that's why the VRM sits right next to the socket, with thick copper layers.`;
}
function paintClock() {
  const g = +$('#ghz').value; $('#ghzv').textContent = g.toFixed(1) + ' GHz';
  $('#ghzout').innerHTML = `${(g * 1e9).toLocaleString()} ticks per second · one tick = ${(1 / g).toFixed(2)} ns · light travels ${(30 / g).toFixed(1)} cm per tick.`;
}
let bits = 0;
function paintBits() {
  $$('[data-bit]').forEach(b => { const on = bits & +b.dataset.bit; b.textContent = on ? '1' : '0'; b.style.background = on ? 'var(--accent)' : ''; b.style.color = on ? '#fff' : ''; });
  $('#bitv').textContent = bits; $('#bith').textContent = bits.toString(16).toUpperCase().padStart(2, '0');
  $('#bitc').textContent = bits >= 32 && bits < 127 ? `"${String.fromCharCode(bits)}"` : '–';
}

/* ================= nav, keys ================= */
function go(tab) {
  if (!TABS.includes(tab)) return;
  S.tab = tab;
  $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.t === tab)));
  $$('section.panel').forEach(p => p.classList.toggle('active', p.id === 'p-' + tab));
  history.replaceState(null, '', '#' + tab + (tab === 'boot' ? '/' + (S.stage + 1) : tab === 'map' ? '/' + S.part : ''));
  if (tab === 'map') paintPart();
  if (A && !reduced) A({ targets: `#p-${tab} > *`, opacity: [0, 1], translateY: [8, 0], delay: A.stagger(40), duration: 320, easing: 'easeOutQuad' });
  renderKeys();
}
function renderKeys() {
  const per = {
    boot: '<span><kbd>←</kbd><kbd>→</kbd> stage</span><span><kbd>Space</kbd> play</span><span><kbd>E</kbd> failure</span>',
    map: '<span><kbd>←</kbd><kbd>→</kbd> part</span>',
    fix: '<span><kbd>↑</kbd><kbd>↓</kbd> symptom</span><span><kbd>Y</kbd> fixed</span><span><kbd>N</kbd> next check</span><span><kbd>R</kbd> restart</span>',
    compat: '', learn: '',
  };
  $('#keys').innerHTML = '<span><kbd>1</kbd>–<kbd>5</kbd> sections</span>' + per[S.tab] + '<span><kbd>?</kbd> all</span>';
}
const HELP = [['1 – 5', 'Boot journey · Board map · Troubleshoot · Compatibility · Learn'], ['← →', 'Boot: previous / next stage · Map: previous / next part'], ['Space', 'Play the boot sequence automatically'],
  ['E', 'Show what failure looks like at this stage'], ['↑ ↓', 'Troubleshoot: previous / next symptom'], ['Y / N', 'Troubleshoot: that fixed it / check done, still broken'], ['R', 'Troubleshoot: start the list over'], ['?', 'This list'], ['H', 'Back to mezins.com']];
function toggleHelp(show) {
  const o = $('#help'), on = show ?? !o.classList.contains('open');
  $('#helpSheet').innerHTML = `<h2 style="font-family:'Space Grotesk';margin:0 0 8px">Keyboard shortcuts</h2><table style="width:100%;border-collapse:collapse">${HELP.map(([k, v]) => `<tr><td>${k.split(' ').filter(x => x.length).map(x => x === '–' || x === '·' || x === '/' ? x : `<kbd>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
  o.classList.toggle('open', on);
}
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('comp')) return;
  const k = e.key, lk = k.toLowerCase();
  if (k === '?') return toggleHelp();
  if (k === 'Escape') { toggleHelp(false); return; }
  if ($('#help').classList.contains('open')) return;
  if (/^[1-5]$/.test(k)) return go(TABS[+k - 1]);
  if (lk === 'h') { location.href = '/'; return; }
  const partIds = Object.keys(PARTS);
  if (S.tab === 'boot') {
    if (k === 'ArrowRight') { e.preventDefault(); goStage(S.stage + 1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); goStage(S.stage - 1); }
    else if (k === ' ') { e.preventDefault(); togglePlay(); }
    else if (lk === 'e') { S.fail = !S.fail; paintStage(); }
  } else if (S.tab === 'map') {
    const i = partIds.indexOf(S.part);
    if (k === 'ArrowRight') { e.preventDefault(); S.part = partIds[(i + 1) % partIds.length]; paintPart(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); S.part = partIds[(i - 1 + partIds.length) % partIds.length]; paintPart(); }
  } else if (S.tab === 'fix') {
    const i = SYMPTOMS.findIndex(s => s.id === S.sym);
    if (k === 'ArrowDown') { e.preventDefault(); S.led = null; S.sym = SYMPTOMS[(i + 1) % SYMPTOMS.length].id; paintFix(); }
    else if (k === 'ArrowUp') { e.preventDefault(); S.led = null; S.sym = SYMPTOMS[(i - 1 + SYMPTOMS.length) % SYMPTOMS.length].id; paintFix(); }
    else if (lk === 'y') fixAct('fixed');
    else if (lk === 'n') fixAct('next');
    else if (lk === 'r') fixAct('reset');
  }
}
function onClick(e) {
  const t = e.target.closest('button, .comp, [data-part]'); if (!t) return;
  if (e.detail > 0 && t.blur) t.blur();
  const d = t.dataset;
  if (d.t) return go(d.t);
  if (d.stage != null) return goStage(+d.stage);
  if (d.gostage != null) { S.stage = +d.gostage; go('boot'); return paintStage(); }
  if (d.part) return selectPart(d.part);
  if (d.sym) { S.sym = d.sym; S.led = null; return paintFix(); }
  if (d.led) { S.led = S.led === d.led ? null : d.led; return paintFix(); }
  if (d.fixed != null) return fixAct('fixed');
  if (d.next != null) return fixAct('next');
  if (d.bit) { bits ^= +d.bit; return paintBits(); }
  const act = d.act;
  if (act === 'prev') goStage(S.stage - 1);
  else if (act === 'next') goStage(S.stage + 1);
  else if (act === 'play') togglePlay();
  else if (act === 'fail') { S.fail = !S.fail; paintStage(); }
  else if (act === 'resetfix') fixAct('reset');
  if (t.id === 'helpBtn') toggleHelp(true);
}

function boot() {
  renderBoot(); renderMap(); renderFix(); renderCompat(); renderLearn();
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('comp')) { e.preventDefault(); selectPart(e.target.dataset.part); } });
  $('#help').addEventListener('click', e => { if (e.target.id === 'help') toggleHelp(false); });
  document.addEventListener('change', e => {
    if (e.target.id === 'sock') paintSock();
    if (e.target.id === 'cpuW' || e.target.id === 'gpuW') paintPsu();
    if (e.target.dataset.fit != null) paintFit();
  });
  document.addEventListener('input', e => { if (e.target.id === 'pw') paintPower(); if (e.target.id === 'ghz') paintClock(); });
  // Deep links: #boot/6 opens stage 6, #boot/6/fail shows its failure, #map/gpu opens a part.
  const [tab, arg, extra] = location.hash.slice(1).split('/');
  if (tab === 'boot' && arg) { S.stage = Math.max(0, Math.min(STAGES.length - 1, +arg - 1 || 0)); S.fail = extra === 'fail'; paintStage(false); }
  if (tab === 'map' && PARTS[arg]) S.part = arg;
  go(TABS.includes(tab) ? tab : 'boot');
}
boot();
})();
