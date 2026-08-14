const NAMES = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B'];
const MIN = 52, MAX = 84, LIMIT = 12;
const mod = (a, n) => ((a % n) + n) % n, nameOf = (n) => NAMES[mod(n, 12)];
const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);
const NATURAL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];

const UX = 52, UY = 34, PADX = 132, PADR = 54, PADTOP = 58, PADBOT = 116, W = 1000, H = 520, KMAX = 1.30;
const AXIS_X = 86;

function layout(st, sts) {
  const pts = [{ u: 0, p: st }]; let u = 0, p = st;
  for (const s of sts) { u += s.size; p += s.size * s.dir; pts.push({ u, p }); }
  return pts;
}
function frameFor(all) {
  const us = all.map((q) => q.u), ps = all.map((q) => q.p);
  const pLo = Math.min(...ps) - 1, pHi = Math.max(...ps) + 1;
  const uS = Math.max(1, Math.max(...us) - Math.min(...us));
  const pS = Math.max(1, pHi - pLo);
  const kx = Math.min(KMAX, (W - PADX - PADR) / (uS * UX));
  const ky = Math.min(KMAX, (H - PADTOP - PADBOT) / (pS * UY));
  return { kx, ky, u0: Math.min(...us), pMid: (pHi + pLo) / 2, pLo, pHi, midY: PADTOP + (H - PADTOP - PADBOT) / 2 };
}
const toXY = (q, f) => ({ x: PADX + (q.u - f.u0) * UX * f.kx, y: f.midY - (q.p - f.pMid) * UY * f.ky });
const stoneR = (f) => Math.max(9, Math.min(20, UX * f.kx * 0.36));

let start = 60, steps = [], dir = 1, ghost = null;
let walkFrame = 1;
let ctx = null, master = null;
let voices = [], timers = [], busy = false, progRAF = null, hlRafId = null, hlQueue = [];
let seed = Date.now() >>> 0;
let keydownListener = null;

const pitches = () => {
  const o = [start]; let p = start;
  for (const s of steps) { p += s.size * s.dir; o.push(p); }
  return o;
};

export function stopHopTrailToy() {
  if (hlRafId !== null) { cancelAnimationFrame(hlRafId); hlRafId = null; }
  cancelAnimationFrame(progRAF);
  voices.forEach((o) => { try { o.stop(); } catch (e) {} });
  voices = [];
  timers.forEach(clearTimeout);
  timers = [];
  hlQueue = [];
  if (keydownListener) {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
  start = 60; steps = []; dir = 1; ghost = null; busy = false; walkFrame = 1;
}

export function renderHopTrailToy(container, config = {}) {
  stopHopTrailToy();

  container.innerHTML = `
<div id="htApp">
  <div id="head">
    <h1>Sully's Hop Trail</h1>
    <p>Two hops. One small, one big. Make a tune of up to twelve.</p>
  </div>

  <div id="stage">
    <svg id="board" viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="gLight" cx="34%" cy="28%" r="72%">
          <stop offset="0" stop-color="#D6D1C4"/><stop offset="55%" stop-color="#ABA598"/>
          <stop offset="100%" stop-color="#7E7669"/>
        </radialGradient>
        <radialGradient id="gOn" cx="34%" cy="28%" r="72%">
          <stop offset="0" stop-color="#FFEBB0"/><stop offset="55%" stop-color="#EFC03F"/>
          <stop offset="100%" stop-color="#B9861B"/>
        </radialGradient>
      </defs>
      <g id="gAxis"></g><g id="gGhost"></g><g id="gTrail"></g><g id="gHL"></g><g id="gStones"></g>
      <g id="gCode"></g><g id="gSully"></g><g id="gTip"></g>
    </svg>
  </div>

  <div id="bar">
    <button id="bSmall">&middot; small hop</button>
    <button id="bBig">&mdash; big hop</button>
    <button id="bTurn">Turn around</button>
    <button id="bUndo">Undo</button>
    <button id="bTune">Hear my tune</button>
    <button id="bAgain">Start at a different stone!</button>
    <button id="bClear">Start again</button>
  </div>

  <div id="side">
    <div class="box">
      <div class="lbl"><span>your pattern</span><span id="count">0 / 12</span></div>
      <div id="code">&nbsp;</div>
    </div>
    <div class="box"><div class="lbl"><span>notes you landed on</span></div><div id="notes">C</div></div>
    <div id="echo">Hop about. Then press <b>Start at a different stone!</b></div>
  </div>
</div>`;

  const $ = (i) => document.getElementById(i);
  const gAxis = $('gAxis'), gGhost = $('gGhost'), gTrail = $('gTrail'), gHL = $('gHL'),
        gStones = $('gStones'), gCode = $('gCode'), gSully = $('gSully'), gTip = $('gTip');

  function sullySVG(x, y, face, k, frame) {
    const size = 190;
    const src = `assets/images/goat/goat_${face < 0 ? 'l' : 'r'}_${frame}.png`;
    return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(3)})">
      <ellipse cx="0" cy="6" rx="42" ry="7" fill="rgba(43,36,29,.22)"/>
      <image href="${src}" width="${size}" height="${size}" x="${-size / 2}" y="${-size}"/>
    </g>`;
  }

  const hopPath = (a, b, size, f) => {
    const mx = (a.x + b.x) / 2, lift = size * UX * f.kx * 0.48;
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${(Math.min(a.y, b.y) - lift).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };

  function morseMark(mid, y, s, f) {
    const col = s.size === 1 ? 'var(--rose)' : 'var(--green)';
    const u = Math.max(7, Math.min(17, UX * f.kx * 0.30));
    const body = s.size === 1
      ? `<circle cx="${mid.toFixed(1)}" cy="${(y + u / 2).toFixed(1)}" r="${(u / 2).toFixed(1)}" fill="${col}" stroke="#2B241D" stroke-width="3"/>`
      : `<rect x="${(mid - u).toFixed(1)}" y="${y.toFixed(1)}" width="${(u * 2).toFixed(1)}" height="${u.toFixed(1)}" rx="${(u / 2).toFixed(1)}" fill="${col}" stroke="#2B241D" stroke-width="3"/>`;
    return body + `<text x="${mid.toFixed(1)}" y="${(y + u + 24).toFixed(1)}" text-anchor="middle" font-size="20" font-weight="bold" fill="${col}">${s.size === 1 ? 'H' : 'W'}</text>`;
  }

  function drawAxis(f) {
    const yOf = (p) => f.midY - (p - f.pMid) * UY * f.ky;
    const spacing = UY * f.ky;
    const lo = Math.ceil(f.pLo), hi = Math.floor(f.pHi);
    const show = (p) => (spacing >= 16 ? true : spacing >= 9 ? !!NATURAL[mod(p, 12)] : mod(p, 12) === 0);
    let out = `<line x1="${AXIS_X}" y1="${yOf(f.pHi).toFixed(1)}" x2="${AXIS_X}" y2="${yOf(f.pLo).toFixed(1)}" stroke="#8C836F" stroke-width="7" stroke-linecap="round"/>`;
    const here = start;
    for (let p = lo; p <= hi; p++) {
      const y = yOf(p), lit = p === here;
      if (!show(p) && !lit) continue;
      out += `<line x1="${AXIS_X - 9}" y1="${y.toFixed(1)}" x2="${AXIS_X + 9}" y2="${y.toFixed(1)}" stroke="#6F6656" stroke-width="${lit ? 5 : 3}" stroke-linecap="round"/>
        <line x1="${AXIS_X + 14}" y1="${y.toFixed(1)}" x2="${W - 30}" y2="${y.toFixed(1)}" stroke="#2B241D" stroke-width="1.5" opacity="${lit ? .22 : .09}" stroke-dasharray="3 9"/>
        <text x="${AXIS_X - 17}" y="${(y + 5).toFixed(1)}" text-anchor="end" font-family="Trebuchet MS,sans-serif" font-weight="bold"
          font-size="${Math.max(11, Math.min(17, spacing * 0.62)).toFixed(0)}" fill="#2B241D" opacity="${lit ? 1 : .6}">${nameOf(p)}</text>`;
    }
    return out;
  }

  function render() {
    const mine = layout(start, steps);
    const all = ghost ? mine.concat(layout(ghost.start, ghost.steps)) : mine;
    const f = frameFor(all), R = stoneR(f);
    gAxis.innerHTML = drawAxis(f);

    if (ghost) {
      const gp = layout(ghost.start, ghost.steps).map((q) => toXY(q, f));
      gGhost.innerHTML = ghost.steps.map((st, i) =>
        `<path class="ghop" data-i="${i}" d="${hopPath(gp[i], gp[i + 1], st.size, f)}" fill="none"
           stroke="#2B241D" stroke-width="4.5" stroke-linecap="round" opacity=".2" stroke-dasharray="2 11"/>`).join('') + `
        ${gp.map((q) => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${(R * .8).toFixed(1)}" fill="#B7AE9F" opacity=".35"/>`).join('')}`;
    } else gGhost.innerHTML = '';

    const pts = mine.map((q) => toXY(q, f));
    gTrail.innerHTML = steps.map((s, i) =>
      `<path class="hop" data-i="${i}" d="${hopPath(pts[i], pts[i + 1], s.size, f)}" fill="none"
         stroke="${s.size === 1 ? 'var(--rose)' : 'var(--green)'}" stroke-width="${s.size === 1 ? 6 : 8}" stroke-linecap="round"/>`).join('');

    gStones.innerHTML = pts.map((q, i) => {
      const last = i === pts.length - 1, r = last ? R * 1.25 : R;
      const nm = nameOf(mine[i].p), fs = (r * (nm.length > 1 ? 0.84 : 1.02));
      return `<ellipse cx="${(q.x + 1.5).toFixed(1)}" cy="${(q.y + r * .42).toFixed(1)}" rx="${(r * .92).toFixed(1)}" ry="${(r * .32).toFixed(1)}" fill="rgba(43,36,29,.2)"/>
        <circle class="stone" data-i="${i}" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${r.toFixed(1)}"
          fill="${last ? 'url(#gOn)' : 'url(#gLight)'}" stroke="#2B241D" stroke-width="${last ? 4 : 3}"/>
        <ellipse cx="${(q.x - r * .30).toFixed(1)}" cy="${(q.y - r * .46).toFixed(1)}" rx="${(r * .40).toFixed(1)}" ry="${(r * .22).toFixed(1)}"
          fill="#fff" opacity=".30" transform="rotate(-24 ${q.x.toFixed(1)} ${q.y.toFixed(1)})"/>
        <text x="${q.x.toFixed(1)}" y="${(q.y + fs * 0.35).toFixed(1)}" text-anchor="middle" font-family="Trebuchet MS,sans-serif"
          font-weight="bold" font-size="${fs.toFixed(1)}" fill="#2B241D">${nm}</text>`;
    }).join('');

    const sy = H - 86;
    gCode.innerHTML = steps.map((s, i) => morseMark((pts[i].x + pts[i + 1].x) / 2, sy, s, f)).join('')
      + (steps.length ? `<text x="${PADX}" y="${sy - 12}" font-size="14" opacity=".55">H = half step &nbsp;&nbsp; W = whole step</text>` : '');

    const lp = pts[pts.length - 1];
    gSully.innerHTML = sullySVG(lp.x, lp.y - R * 1.25 - 4, dir, Math.max(.34, Math.min(.52, R / 34)), walkFrame);
    gTip.innerHTML = steps.length ? '' :
      `<text x="${W / 2}" y="${H - 180}" text-anchor="middle" font-size="19" opacity=".55">press a hop button to begin</text>`;

    $('code').innerHTML =
      steps.map((s) => `<span style="color:${s.size === 1 ? 'var(--rose)' : 'var(--green)'}">${s.size === 1 ? '\u00B7' : '\u2014'}</span>`).join(' ')
      + (steps.length ? '<br>' : '')
      + steps.map((s) => `<span style="font-size:.66em;color:${s.size === 1 ? 'var(--rose)' : 'var(--green)'}">${s.size === 1 ? 'H' : 'W'}</span>`).join(' ')
      || '&nbsp;';
    $('notes').textContent = pitches().map(nameOf).join(' ');
    $('count').textContent = `${steps.length} / ${LIMIT}`;
    const full = steps.length >= LIMIT;
    $('bSmall').disabled = full; $('bBig').disabled = full;
    $('bUndo').disabled = !steps.length;
    $('bTune').disabled = !steps.length || busy;
    $('bAgain').disabled = steps.length < 2 || busy;
    $('bTurn').textContent = dir > 0 ? 'Turn around (going up)' : 'Turn around (going down)';
  }

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .28; master.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 1.2), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const a = b.getChannelData(c);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.7);
    }
    const r = ctx.createConvolver(); r.buffer = b;
    const w = ctx.createGain(); w.gain.value = .15; r.connect(w); w.connect(ctx.destination);
    master.connect(r);
  }
  const P = [[1, 1, 1], [2, .42, .7], [3, .23, .54], [4, .13, .43], [5, .07, .35], [6, .045, .29]];

  function queueHL(t, which, i) { hlQueue.push({ t, which, i }); }
  function showHL(which, i) {
    if (which === null) { gHL.innerHTML = ''; return; }
    const host = which === 'ghost' ? gGhost : gTrail;
    const arc = host.querySelector(`.${which === 'ghost' ? 'ghop' : 'hop'}[data-i="${i}"]`);
    let out = '';
    if (arc) {
      const d = arc.getAttribute('d');
      out += `<path d="${d}" fill="none" stroke="#2B241D" stroke-width="13" stroke-linecap="round"/>`;
    }
    const st = gStones.querySelector(`.stone[data-i="${i + 1}"]`);
    if (st && which !== 'ghost') {
      const cx = st.getAttribute('cx'), cy = st.getAttribute('cy'), r = +st.getAttribute('r');
      out += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="#2B241D"/>
        <text x="${cx}" y="${(+cy + r * 0.36).toFixed(1)}" text-anchor="middle" font-family="Trebuchet MS,sans-serif"
          font-weight="bold" font-size="${(r * 0.9).toFixed(1)}" fill="#F7F1DF">${nameOf(pitches()[i + 1])}</text>`;
    }
    gHL.innerHTML = out;
  }
  function hlLoop() {
    if (ctx && hlQueue.length) {
      const now = ctx.currentTime;
      while (hlQueue.length && hlQueue[0].t <= now) { const e = hlQueue.shift(); showHL(e.which, e.i); }
    }
    hlRafId = requestAnimationFrame(hlLoop);
  }
  hlRafId = requestAnimationFrame(hlLoop);

  function runProgress(btn, dur) {
    const t0 = performance.now();
    btn.classList.add('loading');
    cancelAnimationFrame(progRAF);
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / (dur * 1000));
      btn.style.setProperty('--prog', k.toFixed(3));
      if (k < 1) progRAF = requestAnimationFrame(step);
      else { btn.classList.remove('loading'); btn.style.removeProperty('--prog'); }
    })();
  }
  function clearProgress() {
    cancelAnimationFrame(progRAF);
    document.querySelectorAll('.loading').forEach((b) => { b.classList.remove('loading'); b.style.removeProperty('--prog'); });
  }
  function stopAll() {
    clearProgress(); hlQueue = []; gHL.innerHTML = '';
    voices.forEach((o) => { try { o.stop(); } catch (e) {} });
    voices = []; timers.forEach(clearTimeout); timers = []; busy = false;
  }
  function note(n, when, dur = 1.5) {
    ensure(); const t = when ?? ctx.currentTime, f0 = freq(n), br = Math.pow(261.6 / f0, .45);
    const vg = ctx.createGain(); vg.gain.value = .32; vg.connect(master);
    P.forEach(([h, lv, dk]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0 * h * (1 + .0004 * h * h), t);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(lv * .5, .0008), t + .005);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur * dk * br + .05);
      o.connect(g); g.connect(vg); o.start(t); o.stop(t + dur + .4);
      voices.push(o); o.onended = () => { const i = voices.indexOf(o); if (i >= 0) voices.splice(i, 1); };
    });
  }
  function playMelody(st, sts, gap = .40, at = 0, which = 'trail') {
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + .05 + at; let p = st;
    note(p, t0, 1.1);
    sts.forEach((s, i) => {
      p += s.size * s.dir; note(p, t0 + (i + 1) * gap, 1.1);
      queueHL(t0 + i * gap, which, i);
    });
    queueHL(t0 + sts.length * gap + .30, null, 0);
    return (sts.length + 1) * gap;
  }
  function playHops(st, sts, gap = .62) {
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + .05; let p = st;
    sts.forEach((s, i) => {
      const from = p, to = p + s.size * s.dir; p = to;
      note(from, t0 + i * gap, .5);
      note(to, t0 + i * gap + .26, .85);
      queueHL(t0 + i * gap, 'trail', i);
    });
    queueHL(t0 + sts.length * gap, null, 0);
    return sts.length * gap + .4;
  }

  const rnd = () => {
    seed = (seed + 0x6D2B79F5) >>> 0; let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  function walkBounce() {
    walkFrame = 2;
    render();
    const id = setTimeout(() => { walkFrame = 1; render(); }, 180);
    timers.push(id);
  }

  function hop(size) {
    if (steps.length >= LIMIT) return;
    stopAll();
    const from = pitches().pop(), to = from + size * dir;
    if (to < MIN || to > MAX) { dir = -dir; render(); return; }
    steps.push({ size, dir });
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime; note(from, t, .85); note(to, t + .28, 1.4);
    walkBounce();
  }
  $('bSmall').onclick = () => hop(1);
  $('bBig').onclick = () => hop(2);
  $('bTurn').onclick = () => { dir = -dir; render(); };
  $('bUndo').onclick = () => { steps.pop(); render(); };
  $('bTune').onclick = () => {
    if (busy) return;
    stopAll(); busy = true; render();
    const d = playHops(start, steps);
    runProgress($('bTune'), d);
    timers.push(setTimeout(() => { busy = false; render(); }, d * 1000));
  };
  $('bClear').onclick = () => {
    stopAll(); steps = []; ghost = null; dir = 1;
    $('echo').innerHTML = 'Hop about. Then press <b>Start at a different stone!</b>'; render();
  };
  $('bAgain').onclick = () => {
    if (busy) return;
    stopAll(); busy = true;
    ghost = { start, steps: steps.slice() };
    const lo = Math.min(...pitches()), hi = Math.max(...pitches()), room = [];
    for (let t = MIN - lo; t <= MAX - hi; t++) if (Math.abs(t) >= 3) room.push(t);
    const shift = room.length ? room[Math.floor(rnd() * room.length)] : 0;
    start += shift;
    render();
    const d = playMelody(ghost.start, ghost.steps, .40, 0, 'ghost');
    playMelody(start, steps, .40, d + .55, 'trail');
    const total = d * 2 + .55 + .4;
    runProgress($('bAgain'), total);
    timers.push(setTimeout(() => { busy = false; render(); }, total * 1000));
    $('echo').innerHTML = `Same hops, started <b>${Math.abs(shift)} stone${Math.abs(shift) === 1 ? '' : 's'} ${shift > 0 ? 'higher' : 'lower'}</b> &mdash; same tune.`;
  };

  keydownListener = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'z') { e.preventDefault(); hop(1); }
    if (e.key === 'ArrowRight' || e.key === 'x') { e.preventDefault(); hop(2); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); dir = -dir; render(); }
    if (e.key === 'Backspace') { e.preventDefault(); steps.pop(); render(); }
    if (e.key === ' ') { e.preventDefault(); if (steps.length && !busy) $('bTune').click(); }
  };
  window.addEventListener('keydown', keydownListener);

  render();
}