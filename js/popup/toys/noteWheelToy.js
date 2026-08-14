const SHARP = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B'];
const FLAT = ['C', 'D\u266D', 'D', 'E\u266D', 'E', 'F', 'G\u266D', 'G', 'A\u266D', 'A', 'B\u266D', 'B'];
const NATURAL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
const MIN = 48, MAX = 84;
const mod = (a, n) => ((a % n) + n) % n, pc = (n) => mod(n, 12);
const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);
const black = (n) => !NATURAL[pc(n)];

const L = 131, CX = 500, AY = 520, BIGR = 1e7;
const radius = (b) => (b > 1e-6 ? (12 * L) / (2 * Math.PI * b) : BIGR);
function place(s, b) {
  const R = radius(b), phi = s / R;
  if (Math.abs(phi) > Math.PI * 0.999) return null;
  return { x: CX + R * Math.sin(phi), y: AY - R * (1 - Math.cos(phi)), phi };
}

const NS = 'http://www.w3.org/2000/svg';
const POOL = 41;
const WALK_FRAME_MS = 150;

let pos = 60, shown = 60, bend = 1, bendTarget = 1, quest = null, facing = 'right';
let ctx = null, master = null;
let rafId = null;
let walkFrameOn = false, lastWalkFrameTime = 0;
let keydownListener = null;

export function stopNoteWheelToy() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (keydownListener) {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
  pos = 60; shown = 60; bend = 1; bendTarget = 1; quest = null; facing = 'right';
  walkFrameOn = false;
}

export function renderNoteWheelToy(container, config = {}) {
  stopNoteWheelToy();

  container.innerHTML = `
<div id="nwApp">
  <div id="head">
    <h1>Sully's Grazing Wheel</h1>
    <p>Twelve stones, then the path starts again.</p>
  </div>

  <div id="stage">
    <svg id="board" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="gLight" cx="34%" cy="28%" r="72%">
          <stop offset="0"  stop-color="#D6D1C4"/>
          <stop offset="55%" stop-color="#ABA598"/>
          <stop offset="100%" stop-color="#7E7669"/>
        </radialGradient>
        <radialGradient id="gDark" cx="34%" cy="28%" r="72%">
          <stop offset="0"  stop-color="#A79E90"/>
          <stop offset="55%" stop-color="#82796B"/>
          <stop offset="100%" stop-color="#584F43"/>
        </radialGradient>
        <radialGradient id="gOn" cx="34%" cy="28%" r="72%">
          <stop offset="0"  stop-color="#FFEBB0"/>
          <stop offset="55%" stop-color="#EFC03F"/>
          <stop offset="100%" stop-color="#B9861B"/>
        </radialGradient>
        <linearGradient id="gTrack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#DCD2B9"/><stop offset="1" stop-color="#B8AC90"/>
        </linearGradient>
      </defs>
      <g id="gTrackUnder"></g><g id="gTrackTop"></g>
      <g id="gCoil"></g><g id="gStones"></g><g id="gPosts"></g><g id="gSully"></g>
    </svg>
  </div>

  <div id="bar">
    <button id="bDown">&#9837; lower &middot; go left</button>
    <button id="bHear" class="hot">Hear it</button>
    <button id="bUp">&#9839; higher &middot; go right</button>
    <button id="bOctDn">Octave down</button>
    <button id="bOctUp">Octave up</button>
    <button id="bUnroll">Unroll the ring</button>
    <button id="bQuest">Start a quest</button>
  </div>

  <div id="side">
    <div id="card">
      <div id="noteBig">C</div>
      <div id="noteAlt">&nbsp;</div>
    </div>
    <div id="quest">Press Start a quest to help Sully find a stone.</div>
  </div>
</div>`;

  const $ = (i) => document.getElementById(i);
  const trackU = $('gTrackUnder'), trackT = $('gTrackTop'),
        coil = $('gCoil'), stones = $('gStones'), posts = $('gPosts'), sully = $('gSully');

  const cells = [];
  for (let i = 0; i < POOL; i++) {
    const g = document.createElementNS(NS, 'g');
    const sh = document.createElementNS(NS, 'ellipse');
    sh.setAttribute('fill', 'rgba(43,36,29,.20)');
    const bd = document.createElementNS(NS, 'circle');
    bd.setAttribute('stroke', '#2B241D');
    const hl = document.createElementNS(NS, 'ellipse');
    hl.setAttribute('fill', '#fff'); hl.setAttribute('opacity', '.34');
    const tx = document.createElementNS(NS, 'text');
    tx.setAttribute('text-anchor', 'middle');
    tx.setAttribute('font-weight', 'bold');
    tx.setAttribute('font-family', 'Trebuchet MS,sans-serif');
    tx.setAttribute('fill', '#2B241D');
    g.append(sh, bd, hl, tx);
    stones.appendChild(g);
    cells.push({ g, sh, bd, hl, tx });
  }

  const SULLY_SIZE = 96;
  sully.innerHTML = `<g transform="translate(${CX},${AY - 38})">
    <ellipse cx="0" cy="4" rx="34" ry="6" fill="rgba(43,36,29,.24)"/>
    <image id="nwSullyImg" href="assets/images/goat/goat_r_1.png"
      width="${SULLY_SIZE}" height="${SULLY_SIZE}"
      x="${-SULLY_SIZE / 2}" y="${-SULLY_SIZE}"/>
  </g>`;
  const sullyImg = sully.querySelector('#nwSullyImg');

  function drawCoil() {
    const cx = CX, cy = 292, c = 13, r = 44, turns = 3;
    const span = c * 2 * Math.PI * turns, x0 = cx - span / 2;
    let back = '', front = '', prevWasBack = null;
    for (let t = 0; t <= Math.PI * 2 * turns; t += 0.05) {
      const x = x0 + c * t + r * Math.sin(t), y = cy + r * Math.cos(t) * 0.60;
      const seg = `${x.toFixed(1)} ${y.toFixed(1)}`;
      const isBack = Math.sin(t) < 0;
      if (isBack) back += (prevWasBack === true ? ' L' : ' M') + seg;
      else front += (prevWasBack === false ? ' L' : ' M') + seg;
      prevWasBack = isBack;
    }
    const t0 = Math.PI * 2 * ((shown - MIN) / 12);
    const mx = x0 + c * t0 + r * Math.sin(t0), my = cy + r * Math.cos(t0) * 0.60;
    coil.innerHTML =
      `<path d="${back}"  fill="none" stroke="#FFFFFF" stroke-width="6"
             stroke-linecap="round" opacity=".55"/>
       <path d="${front}" fill="none" stroke="#8C836F" stroke-width="8"
             stroke-linecap="round"/>
       <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="10"
         fill="url(#gOn)" stroke="#2B241D" stroke-width="3.5"/>
       <text x="${cx}" y="${cy + 74}" text-anchor="middle" font-size="15" opacity=".62">
         one lap round the ring = one octave higher</text>`;
  }

  function draw() {
    const b = bend;
    let d = '', on = false;
    for (let u = -6.4; u <= 6.4; u += 0.06) {
      const p = place(u * L, b);
      if (!p) { on = false; continue; }
      d += (on ? ' L' : ' M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); on = true;
    }
    trackU.innerHTML = `<path d="${d.trim()}" fill="none" stroke="#9E927A"
       stroke-width="44" stroke-linecap="round"/>`;
    trackT.innerHTML = `<path d="${d.trim()}" fill="none" stroke="url(#gTrack)"
       stroke-width="36" stroke-linecap="round"/>`;

    const base = Math.round(shown) - ((POOL - 1) >> 1);
    cells.forEach((cell, i) => {
      const n = base + i, p = place((n - shown) * L, b);
      if (!p || n < MIN - 12 || n > MAX + 12) { cell.g.setAttribute('opacity', '0'); return; }
      const dark = black(n), here = n === pos, r = dark ? 21 : 33;
      const inRange = n >= MIN && n <= MAX;
      const fade = Math.max(0, Math.min(1, 1.25 - Math.abs(p.phi) / Math.PI * 1.3)) * (inRange ? 1 : .22);
      cell.g.setAttribute('opacity', fade.toFixed(2));

      cell.sh.setAttribute('cx', (p.x + 3).toFixed(1));
      cell.sh.setAttribute('cy', (p.y + r * 0.42).toFixed(1));
      cell.sh.setAttribute('rx', (r * 0.94).toFixed(1));
      cell.sh.setAttribute('ry', (r * 0.34).toFixed(1));

      cell.bd.setAttribute('cx', p.x.toFixed(1));
      cell.bd.setAttribute('cy', p.y.toFixed(1));
      cell.bd.setAttribute('r', r);
      cell.bd.setAttribute('fill', here ? 'url(#gOn)' : (dark ? 'url(#gDark)' : 'url(#gLight)'));
      cell.bd.setAttribute('stroke-width', here ? '5' : '3.5');

      cell.hl.setAttribute('cx', (p.x - r * 0.28).toFixed(1));
      cell.hl.setAttribute('cy', (p.y - r * 0.40).toFixed(1));
      cell.hl.setAttribute('rx', (r * 0.42).toFixed(1));
      cell.hl.setAttribute('ry', (r * 0.26).toFixed(1));
      cell.hl.setAttribute('transform', `rotate(-24 ${p.x.toFixed(1)} ${p.y.toFixed(1)})`);

      cell.tx.setAttribute('x', p.x.toFixed(1));
      cell.tx.setAttribute('y', (p.y + 10).toFixed(1));
      cell.tx.setAttribute('font-size', dark ? '0' : '27');
      cell.tx.textContent = dark ? '' : SHARP[pc(n)];
    });

    const topY = 150;
    if (black(pos)) {
      posts.innerHTML = `
        <g transform="translate(${CX - 170},${topY})">
          <rect x="3" y="5" width="152" height="58" rx="14" fill="rgba(43,36,29,.2)"/>
          <rect width="152" height="58" rx="14" fill="var(--cream)" stroke="#2B241D" stroke-width="4"/>
          <text x="76" y="24" text-anchor="middle" font-size="14" opacity=".72">just after ${SHARP[pc(pos - 1)]}</text>
          <text x="76" y="47" text-anchor="middle" font-size="24" font-weight="bold">${SHARP[pc(pos)]}</text>
        </g>
        <g transform="translate(${CX + 18},${topY})">
          <rect x="3" y="5" width="152" height="58" rx="14" fill="rgba(43,36,29,.2)"/>
          <rect width="152" height="58" rx="14" fill="var(--sky)" stroke="#2B241D" stroke-width="4"/>
          <text x="76" y="24" text-anchor="middle" font-size="14" opacity=".72">just before ${FLAT[pc(pos + 1)]}</text>
          <text x="76" y="47" text-anchor="middle" font-size="24" font-weight="bold">${FLAT[pc(pos)]}</text>
        </g>
        <text x="${CX}" y="${topY + 86}" text-anchor="middle" font-size="16" opacity=".7">
          same stone, same sound, two names</text>`;
    } else if ([0, 4, 5, 11].includes(pc(pos))) {
      const pair = [4, 5].includes(pc(pos)) ? 'E and F' : 'B and C';
      posts.innerHTML = `
        <g transform="translate(${CX - 200},${topY + 4})">
          <rect x="3" y="5" width="400" height="66" rx="15" fill="rgba(43,36,29,.2)"/>
          <rect width="400" height="66" rx="15" fill="var(--cream)" stroke="#2B241D" stroke-width="4"/>
          <text x="200" y="29" text-anchor="middle" font-size="19" font-weight="bold">${pair} are close friends!</text>
          <text x="200" y="52" text-anchor="middle" font-size="16" opacity=".78">No room for a stone between them!</text>
        </g>`;
    } else posts.innerHTML = '';
  }

  function drawSully() {
    const walking = Math.abs(shown - pos) > 0.01;
    const now = performance.now();
    if (walking && now - lastWalkFrameTime > WALK_FRAME_MS) {
      walkFrameOn = !walkFrameOn;
      lastWalkFrameTime = now;
    } else if (!walking) {
      walkFrameOn = false;
    }
    const frameNum = walkFrameOn ? 2 : 1;
    sullyImg.setAttribute('href', `assets/images/goat/goat_${facing === 'left' ? 'l' : 'r'}_${frameNum}.png`);
  }

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .3; master.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 1.3), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const a = buf.getChannelData(c);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.7);
    }
    const rev = ctx.createConvolver(); rev.buffer = buf;
    const w = ctx.createGain(); w.gain.value = .17;
    rev.connect(w); w.connect(ctx.destination); master.connect(rev);
  }
  const PARTIALS = [[1, 1, 1], [2, .42, .7], [3, .23, .54], [4, .13, .43], [5, .07, .35], [6, .045, .29], [8, .025, .23]];
  function play(n) {
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime, f0 = freq(n), bright = Math.pow(261.6 / f0, .45);
    const vg = ctx.createGain(); vg.gain.value = .34; vg.connect(master);
    PARTIALS.forEach(([h, lv, dk]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0 * h * (1 + .0004 * h * h), t);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(lv * .5, .0008), t + .004);
      g.gain.exponentialRampToValueAtTime(.0001, t + 2.2 * dk * bright + .05);
      o.connect(g); g.connect(vg); o.start(t); o.stop(t + 2.6);
    });
    const nb = ctx.createBufferSource(), ng = ctx.createGain(), nf = ctx.createBiquadFilter();
    const nl = Math.floor(ctx.sampleRate * .05), b2 = ctx.createBuffer(1, nl, ctx.sampleRate), a = b2.getChannelData(0);
    for (let i = 0; i < nl; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / nl);
    nb.buffer = b2; nf.type = 'bandpass'; nf.frequency.setValueAtTime(f0 * 3.2, t);
    ng.gain.setValueAtTime(.045, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .05);
    nb.connect(nf); nf.connect(ng); ng.connect(vg); nb.start(t);
  }

  function bfs(from, target) {
    const seen = new Set([from]), q = [[from, 0]];
    while (q.length) {
      const [n, d] = q.shift();
      if (pc(n) === target) return d;
      if (d >= 8) continue;
      for (const mv of [1, -1, 12, -12]) {
        const x = n + mv;
        if (x < MIN || x > MAX || seen.has(x)) continue;
        seen.add(x); q.push([x, d + 1]);
      }
    }
    return null;
  }

  function update() {
    const k = pc(pos);
    $('noteBig').textContent = SHARP[k];
    $('noteAlt').innerHTML = black(pos) ? `also called <b>${FLAT[k]}</b>` : '&nbsp;';
    $('bDown').disabled = pos <= MIN;   $('bUp').disabled = pos >= MAX;
    $('bOctDn').disabled = pos - 12 < MIN; $('bOctUp').disabled = pos + 12 > MAX;
    if (quest !== null) {
      if (pc(pos) === quest) {
        $('quest').innerHTML = `Found it. Sully is on <b>${SHARP[quest]}</b>.`;
        quest = null;
      } else {
        const d = bfs(pos, quest);
        const nm = NATURAL[quest] ? SHARP[quest] : `${SHARP[quest]} (or ${FLAT[quest]})`;
        $('quest').innerHTML = `Take Sully to <b style="font-size:1.25em">${nm}</b><br>
          <span style="opacity:.7">${d} move${d === 1 ? '' : 's'} away</span>`;
      }
    }
  }

  function frame() {
    shown += (pos - shown) * 0.22;
    bend += (bendTarget - bend) * 0.11;
    if (Math.abs(shown - pos) < 0.001) shown = pos;
    if (Math.abs(bend - bendTarget) < 0.002) bend = bendTarget;
    draw(); drawCoil(); drawSully();
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  function go(n) {
    const t = Math.max(MIN, Math.min(MAX, n));
    if (t === pos) { play(pos); return; }
    facing = t > pos ? 'right' : 'left';
    pos = t; play(pos); update();
  }
  $('bDown').onclick = () => go(pos - 1);
  $('bUp').onclick = () => go(pos + 1);
  $('bOctDn').onclick = () => go(pos - 12);
  $('bOctUp').onclick = () => go(pos + 12);
  $('bHear').onclick = () => play(pos);
  $('bUnroll').onclick = (e) => {
    bendTarget = bendTarget > .5 ? 0 : 1;
    e.target.textContent = bendTarget > .5 ? 'Unroll the ring' : 'Roll it back up';
    e.target.classList.toggle('on', bendTarget < .5);
  };
  $('bQuest').onclick = () => {
    do { quest = Math.floor(Math.random() * 12); } while (quest === pc(pos));
    update();
  };

  keydownListener = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(pos + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(pos - 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); go(pos + 12); }
    if (e.key === 'ArrowDown') { e.preventDefault(); go(pos - 12); }
    if (e.key === ' ') { e.preventDefault(); play(pos); }
    if (e.key === 'u' || e.key === 'U') $('bUnroll').click();
  };
  window.addEventListener('keydown', keydownListener);

  update();
}