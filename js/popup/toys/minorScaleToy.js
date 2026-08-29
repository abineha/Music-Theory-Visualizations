const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NATURAL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
const MAJ_DEG = [0, 2, 4, 5, 7, 9, 11, 12];
const MOVABLE = [2, 5, 6];
const mod = (a, n) => ((a % n) + n) % n, nameOf = (n) => NAMES[mod(n, 12)];
const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

const UX = 54, UY = 30, PADX = 126, PADR = 54, PADTOP = 48, PADBOT = 64, W = 1000, H = 460, KMAX = 1.25;
const AXIS_X = 84;
const WALK_FRAME_MS = 150;
const SULLY_SIZE = 190;

let start = 60, low = { 2: false, 5: false, 6: false }, rotated = false;
let ctx = null, master = null, voices = [], timers = [], hlQ = [], busy = false, progRAF = null, hlRafId = null;
let walkFrame = 1, lastWalkFrameTime = 0;
let PT = { mine: [], maj: [], rot: [] };

const degs = () => MAJ_DEG.map((d, i) => d - (low[i] ? 1 : 0));
const pitches = () => degs().map((d) => start + d);
const majorPitches = () => MAJ_DEG.map((d) => start + d);
const stepsOf = (ps) => ps.slice(1).map((p, i) => p - ps[i]);
const allLow = () => MOVABLE.every((i) => low[i]);
const noneLow = () => MOVABLE.every((i) => !low[i]);

function rotatedPitches() {
  const base = majorPitches().slice(0, 7);
  const from = base[5];
  const out = [from];
  const st = stepsOf(MAJ_DEG.map((d) => start + d));
  const rot = st.slice(5).concat(st.slice(0, 5));
  let p = from; rot.forEach((s) => { p += s; out.push(p); });
  return out;
}

function frameFor() {
  const all = pitches().concat(majorPitches(), rotated ? rotatedPitches() : []);
  const lo = Math.min(...all) - 1, hi = Math.max(...all) + 1;
  const span = stepsOf(majorPitches()).reduce((a, b) => a + b, 0);
  return {
    kx: Math.min(KMAX, (W - PADX - PADR) / (span * UX)),
    ky: Math.min(KMAX, (H - PADTOP - PADBOT) / ((hi - lo) * UY)),
    pMid: (hi + lo) / 2, pLo: lo, pHi: hi, midY: PADTOP + (H - PADTOP - PADBOT) / 2,
  };
}
const stoneR = (f) => Math.max(11, Math.min(23, UX * f.kx * 0.34));

export function stopMinorScaleToy() {
  if (ctx) { ctx.close(); ctx = null; master = null; }
  if (hlRafId !== null) { cancelAnimationFrame(hlRafId); hlRafId = null; }
  cancelAnimationFrame(progRAF);
  voices.forEach((o) => { try { o.stop(); } catch (e) {} });
  voices = [];
  timers.forEach(clearTimeout);
  timers = [];
  hlQ = [];
  start = 60; low = { 2: false, 5: false, 6: false }; rotated = false;
  busy = false; walkFrame = 1;
  PT = { mine: [], maj: [], rot: [] };
}

export function renderMinorScaleToy(container, config = {}) {
  stopMinorScaleToy();

  container.innerHTML = `
<div id="msApp">
  <div id="head">
    <h1>The Other Path</h1>
    <p>The same hillside. Three stones can be nudged down one.</p>
  </div>

  <div id="stage">
    <svg id="board" viewBox="0 0 1000 460" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="gLight" cx="34%" cy="28%" r="72%">
          <stop offset="0" stop-color="#D6D1C4"/><stop offset="55%" stop-color="#ABA598"/>
          <stop offset="100%" stop-color="#7E7669"/></radialGradient>
        <radialGradient id="gOn" cx="34%" cy="28%" r="72%">
          <stop offset="0" stop-color="#FFEBB0"/><stop offset="55%" stop-color="#EFC03F"/>
          <stop offset="100%" stop-color="#B9861B"/></radialGradient>
        <radialGradient id="gMoved" cx="34%" cy="28%" r="72%">
          <stop offset="0" stop-color="#C9BEE6"/><stop offset="55%" stop-color="#9384C4"/>
          <stop offset="100%" stop-color="#5D4E8C"/></radialGradient>
      </defs>
      <g id="gAxis"></g><g id="gGhost"></g><g id="gRot"></g><g id="gTrail"></g><g id="gHL"></g>
      <g id="gStones"></g><g id="gHandles"></g><g id="gSully"></g>
    </svg>
  </div>

  <div id="bar">
    <button class="big" id="bPlay">Walk my path</button>
    <button class="big" id="bCompare">Compare the two</button>
    <button class="big" id="bAll">Nudge all three down</button>
    <button class="big" id="bReset">Put them all back</button>
    <button class="big" id="bRotate">Same stones, start at 6</button>
  </div>

  <div id="side">
    <div class="box"><div class="lbl">how it feels</div><div id="mood"></div></div>
    <div class="box"><div class="lbl">the hops</div><div id="pattern"></div></div>
    <div class="box"><div class="lbl">stones you land on</div><div id="notes"></div></div>
    <div id="msg">Tap a purple arrow to nudge that stone down one.</div>
  </div>
</div>`;

  const root = document.getElementById('msApp');
  const $ = (i) => document.getElementById(i);
  const gAxis = $('gAxis'), gGhost = $('gGhost'), gRot = $('gRot'), gTrail = $('gTrail'), gHL = $('gHL'),
    gStones = $('gStones'), gHandles = $('gHandles'), gSully = $('gSully');

  function xyFor(ps, f) {
    let u = 0; const out = [];
    ps.forEach((p, i) => {
      out.push({ x: PADX + u * UX * f.kx, y: f.midY - (p - f.pMid) * UY * f.ky, p });
      if (i < ps.length - 1) u += Math.abs(ps[i + 1] - p);
    });
    return out;
  }
  const hopPath = (a, b, size, f) => {
    const mx = (a.x + b.x) / 2, lift = Math.max(size, 1) * UX * f.kx * 0.44;
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${(Math.min(a.y, b.y) - lift).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };

  function sullySVG(x, y, k, frame) {
    const src = `assets/images/goat/goat_r_${frame}.png`;
    return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k})">
      <ellipse cx="0" cy="6" rx="40" ry="7" fill="rgba(43,36,29,.22)"/>
      <image href="${src}" width="${SULLY_SIZE}" height="${SULLY_SIZE}" x="${-SULLY_SIZE / 2}" y="${-SULLY_SIZE}"/>
    </g>`;
  }
  function updateSully(idx) {
    if (!PT.mine.length) return;
    const R = stoneR(frameFor());
    const lastIdx = PT.mine.length - 1;
    const i = (idx != null && PT.mine[idx]) ? idx : 0;
    const q = PT.mine[i], sr = (i === 0 || i === lastIdx) ? R * 1.2 : R;
    gSully.innerHTML = sullySVG(q.x, q.y - sr * 1.2 - 3, Math.max(.3, Math.min(.46, R / 34)), walkFrame);
  }

  function drawAxis(f) {
    const yOf = (p) => f.midY - (p - f.pMid) * UY * f.ky, sp = UY * f.ky;
    const show = (p) => (sp >= 15 ? true : sp >= 9 ? !!NATURAL[mod(p, 12)] : mod(p, 12) === 0);
    let out = `<line x1="${AXIS_X}" y1="${yOf(f.pHi).toFixed(1)}" x2="${AXIS_X}" y2="${yOf(f.pLo).toFixed(1)}"
      stroke="#8C836F" stroke-width="7" stroke-linecap="round"/>`;
    for (let p = Math.ceil(f.pLo); p <= Math.floor(f.pHi); p++) {
      if (!show(p)) continue;
      const y = yOf(p), lit = (p === start || p === start + 12);
      out += `<line x1="${AXIS_X - 9}" y1="${y.toFixed(1)}" x2="${AXIS_X + 9}" y2="${y.toFixed(1)}"
          stroke="#6F6656" stroke-width="${lit ? 5 : 3}" stroke-linecap="round"/>
        <line x1="${AXIS_X + 14}" y1="${y.toFixed(1)}" x2="${W - 30}" y2="${y.toFixed(1)}"
          stroke="#2B241D" stroke-width="1.5" opacity="${lit ? .24 : .08}" stroke-dasharray="3 9"/>
        <text x="${AXIS_X - 16}" y="${(y + 5).toFixed(1)}" text-anchor="end" font-weight="bold"
          font-family="Trebuchet MS,sans-serif" font-size="${Math.max(11, Math.min(16, sp * .6)).toFixed(0)}"
          fill="#2B241D" opacity="${lit ? 1 : .55}">${nameOf(p)}</text>`;
    }
    return out;
  }

  function updateMood() {
    const n = MOVABLE.filter((i) => low[i]).length;
    $('mood').textContent = n === 0 ? 'bright' : n === 3 ? 'soft and misty'
      : low[2] ? 'already softer' : 'a little different';
    const MOOD = [
      { ga: '#90C884', gb: '#85C278', pa: '#F7F1DF' },
      { ga: '#89BFA6', gb: '#7EB69B', pa: '#F4F0E4' },
      { ga: '#82AEBB', gb: '#77A5B1', pa: '#F0EFE9' },
      { ga: '#8E97C6', gb: '#838EBA', pa: '#EDECF0' },
    ][n];
    root.style.setProperty('--ms-ga', MOOD.ga);
    root.style.setProperty('--ms-gb', MOOD.gb);
    root.style.setProperty('--ms-paper', MOOD.pa);
  }

  function render() {
    const f = frameFor(), R = stoneR(f);
    const mine = pitches(), maj = majorPitches();
    const pts = xyFor(mine, f), mpts = xyFor(maj, f);
    gAxis.innerHTML = drawAxis(f);

    const showMaj = !noneLow() || rotated;
    gGhost.innerHTML = !showMaj ? '' : stepsOf(maj).map((s, i) =>
      `<path class="ghop" data-i="${i}" d="${hopPath(mpts[i], mpts[i + 1], s, f)}" fill="none"
         stroke="#2B241D" stroke-width="4" stroke-linecap="round"
         opacity=".18" stroke-dasharray="2 10"/>`).join('')
      + mpts.map((q) => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${(R * .55).toFixed(1)}"
          fill="#B7AE9F" opacity=".3"/>`).join('');

    let rpts = [];
    if (rotated) {
      rpts = xyFor(rotatedPitches(), f);
      gRot.innerHTML = stepsOf(rotatedPitches()).map((s, i) =>
        `<path class="rhop" data-i="${i}" d="${hopPath(rpts[i], rpts[i + 1], s, f)}" fill="none"
           stroke="var(--violet)" stroke-width="6" stroke-linecap="round" opacity=".55"/>`).join('')
        + rpts.map((q) => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${(R * .6).toFixed(1)}"
            fill="#9384C4" stroke="#2B241D" stroke-width="2.5" opacity=".7"/>`).join('');
    } else gRot.innerHTML = '';
    PT = { mine: pts, maj: mpts, rot: rpts };

    const st = stepsOf(mine);
    gTrail.innerHTML = st.map((s, i) =>
      `<path class="hop" data-i="${i}" d="${hopPath(pts[i], pts[i + 1], s, f)}" fill="none"
        stroke="${s === 1 ? 'var(--rose)' : 'var(--green)'}" stroke-width="${s === 1 ? 6 : 8}"
        stroke-linecap="round"/>`).join('');

    gStones.innerHTML = pts.map((q, i) => {
      const ends = (i === 0 || i === pts.length - 1), moved = low[i], r = ends ? R * 1.2 : R;
      const nm = nameOf(q.p), fs = r * (nm.length > 1 ? .82 : 1.0);
      return `<ellipse cx="${(q.x + 1.5).toFixed(1)}" cy="${(q.y + r * .42).toFixed(1)}"
          rx="${(r * .92).toFixed(1)}" ry="${(r * .32).toFixed(1)}" fill="rgba(43,36,29,.2)"/>
        <circle class="stone" data-i="${i}" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${r.toFixed(1)}"
          fill="${moved ? 'url(#gMoved)' : ends ? 'url(#gOn)' : 'url(#gLight)'}"
          stroke="#2B241D" stroke-width="${ends ? 4 : 3}"/>
        <text x="${q.x.toFixed(1)}" y="${(q.y + fs * .35).toFixed(1)}" text-anchor="middle" font-weight="bold"
          font-family="Trebuchet MS,sans-serif" font-size="${fs.toFixed(1)}"
          fill="${moved ? '#F7F1DF' : '#2B241D'}">${nm}</text>
        <text x="${q.x.toFixed(1)}" y="${(q.y + r + 17).toFixed(1)}" text-anchor="middle"
          font-size="13" opacity=".5">${i + 1}</text>`;
    }).join('');

    gHandles.innerHTML = MOVABLE.map((i) => {
      const q = pts[i], up = low[i];
      return `<g class="handle" data-i="${i}">
        <circle cx="${q.x.toFixed(1)}" cy="${(q.y - R - 24).toFixed(1)}" r="15"
          fill="${up ? '#D9D0EC' : '#B7A8DC'}" stroke="#2B241D" stroke-width="3.5"/>
        <path d="${up
          ? `M${(q.x - 6).toFixed(1)} ${(q.y - R - 21).toFixed(1)} L${q.x.toFixed(1)} ${(q.y - R - 29).toFixed(1)} L${(q.x + 6).toFixed(1)} ${(q.y - R - 21).toFixed(1)}`
          : `M${(q.x - 6).toFixed(1)} ${(q.y - R - 28).toFixed(1)} L${q.x.toFixed(1)} ${(q.y - R - 20).toFixed(1)} L${(q.x + 6).toFixed(1)} ${(q.y - R - 28).toFixed(1)}`}"
          fill="none" stroke="#2B241D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        </g>`;
    }).join('');
    document.querySelectorAll('#msApp .handle').forEach((h) => h.onclick = () => {
      if (busy) return; const i = +h.dataset.i; rotated = false; low[i] = !low[i]; afterMove();
    });

    updateSully();

    updateMood();
    $('pattern').innerHTML = stepsOf(mine).map((s) =>
      `<span style="color:${s === 1 ? 'var(--rose)' : 'var(--green)'}">${s === 1 ? 'H' : 'W'}</span>`).join(' ');
    $('notes').textContent = mine.map(nameOf).join(' ');
    $('bReset').disabled = noneLow();
    $('bAll').disabled = allLow();
  }

  function afterMove() {
    render();
    const n = MOVABLE.filter((i) => low[i]).length;
    if (allLow()) $('msg').innerHTML = 'All three down. This is <b>the other path</b> &mdash; the minor scale.';
    else if (low[2] && n === 1) $('msg').innerHTML = 'Just the third stone, and the whole feeling changed.';
    else if (n === 0) $('msg').innerHTML = 'Back to the bright path.';
    else $('msg').innerHTML = 'Hear what that one did.';
    play();
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
    const w = ctx.createGain(); w.gain.value = .15; r.connect(w); w.connect(ctx.destination); master.connect(r);
  }
  const P = [[1, 1, 1], [2, .42, .7], [3, .23, .54], [4, .13, .43], [5, .07, .35], [6, .045, .29]];
  function note(n, t, dur = 1.3) {
    ensure(); const f0 = freq(n), br = Math.pow(261.6 / f0, .45);
    const vg = ctx.createGain(); vg.gain.value = .32; vg.connect(master);
    P.forEach(([h, lv, dk]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0 * h * (1 + .0004 * h * h), t);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(lv * .5, .0008), t + .005);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur * dk * br + .05);
      o.connect(g); g.connect(vg); o.start(t); o.stop(t + dur + .4);
      voices.push(o); o.onended = () => { const k = voices.indexOf(o); if (k >= 0) voices.splice(k, 1); };
    });
  }
  function stopAll() {
    voices.forEach((o) => { try { o.stop(); } catch (e) {} }); voices = [];
    timers.forEach(clearTimeout); timers = []; hlQ = []; gHL.innerHTML = '';
    cancelAnimationFrame(progRAF);
    document.querySelectorAll('#msApp .loading').forEach((b) => {
      b.classList.remove('loading'); b.style.removeProperty('--prog');
    });
    walkFrame = 1; updateSully();
    busy = false;
  }
  function progress(btn, d) {
    const t0 = performance.now(); btn.classList.add('loading');
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / (d * 1000));
      btn.style.setProperty('--prog', k.toFixed(3));
      if (k < 1) progRAF = requestAnimationFrame(step);
      else { btn.classList.remove('loading'); btn.style.removeProperty('--prog'); }
    })();
  }

  function showHL(e) {
    if (!e || e.i === null) {
      gHL.innerHTML = '';
      walkFrame = 1;
      updateSully();
      return;
    }
    const now = performance.now();
    if (now - lastWalkFrameTime > WALK_FRAME_MS) {
      walkFrame = walkFrame === 1 ? 2 : 1;
      lastWalkFrameTime = now;
    }
    const { which, i } = e;
    updateSully(which === 'mine' ? i + 1 : 0);

    const host = which === 'ghost' ? gGhost : which === 'rot' ? gRot : gTrail;
    const cls = which === 'ghost' ? 'ghop' : which === 'rot' ? 'rhop' : 'hop';
    const arc = host.querySelector(`.${cls}[data-i="${i}"]`);
    const pts = which === 'ghost' ? PT.maj : which === 'rot' ? PT.rot : PT.mine;
    let out = '';
    if (arc) out += `<path d="${arc.getAttribute('d')}" fill="none" stroke="#2B241D"
      stroke-width="13" stroke-linecap="round"/>`;
    const q = pts[i + 1];
    if (q) {
      const r = Math.max(11, Math.min(23, UX * frameFor().kx * 0.34));
      out += `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${r.toFixed(1)}" fill="#2B241D"/>
        <text x="${q.x.toFixed(1)}" y="${(q.y + r * .36).toFixed(1)}" text-anchor="middle"
          font-weight="bold" font-family="Trebuchet MS,sans-serif"
          font-size="${(r * .9).toFixed(1)}" fill="#F7F1DF">${nameOf(q.p)}</text>`;
    }
    gHL.innerHTML = out;
  }
  function hlLoop() {
    if (ctx && hlQ.length) {
      const now = ctx.currentTime;
      while (hlQ.length && hlQ[0].t <= now) showHL(hlQ.shift());
    }
    hlRafId = requestAnimationFrame(hlLoop);
  }
  hlRafId = requestAnimationFrame(hlLoop);

  function run(ps, at = 0, gap = .42, which = 'mine') {
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + .05 + at;
    ps.forEach((p, i) => {
      note(p, t0 + i * gap, i === ps.length - 1 ? 2.1 : 1.15);
      if (i < ps.length - 1) hlQ.push({ t: t0 + (i + 1) * gap, which, i });
    });
    hlQ.push({ t: t0 + ps.length * gap, which, i: null });
    return ps.length * gap + .45;
  }
  function play() { return run(pitches(), 0, .42, 'mine'); }

  $('bPlay').onclick = () => {
    if (busy) return; stopAll(); busy = true;
    const d = play(); progress($('bPlay'), d);
    timers.push(setTimeout(() => { busy = false; }, d * 1000));
  };

  $('bCompare').onclick = () => {
    if (busy) return; stopAll(); busy = true;
    rotated = false; render();
    const d1 = run(majorPitches(), 0, .42, 'ghost');
    const d2 = run(pitches(), d1 + .5, .42, 'mine');
    const tot = d1 + .5 + d2; progress($('bCompare'), tot);
    timers.push(setTimeout(() => { busy = false; }, tot * 1000));
    $('msg').innerHTML = 'Bright path first, then yours.';
  };

  $('bAll').onclick = () => { if (busy) return; rotated = false; MOVABLE.forEach((i) => low[i] = true); afterMove(); };
  $('bReset').onclick = () => { MOVABLE.forEach((i) => low[i] = false); rotated = false; afterMove(); };

  $('bRotate').onclick = () => {
    if (busy) return; stopAll(); busy = true;
    rotated = true; render();
    const rp = rotatedPitches();
    const d1 = run(pitches(), 0, .42, 'mine');
    const d2 = run(rp, d1 + .55, .42, 'rot');
    const tot = d1 + .55 + d2; progress($('bRotate'), tot);
    timers.push(setTimeout(() => { busy = false; }, tot * 1000));
    $('msg').innerHTML = allLow()
      ? `Your path, then the bright path's <b>very same seven stones</b> begun at
         number 6 (<b>${nameOf(rp[0])}</b>). Higher up, but the <b>same shape</b>.`
      : `Nudge <b>all three</b> stones down first &mdash; then this will match
         the bright path begun at number 6 (<b>${nameOf(rp[0])}</b>).`;
  };

  render();
}
