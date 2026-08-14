const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NATURAL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
const MAJOR = [2, 2, 1, 2, 2, 2, 1], OCTAVE = 12, TOTAL_VALID = 21;
const mod = (a, n) => ((a % n) + n) % n, nameOf = (n) => NAMES[mod(n, 12)];
const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

const UX = 54, UY = 30, PADX = 126, PADR = 54, PADTOP = 48, PADBOT = 54, W = 1000, H = 460, KMAX = 1.25;
const AXIS_X = 84;
const WALK_FRAME_MS = 150;

let steps = MAJOR.slice(), start = 60, found = new Set([MAJOR.join('')]);
let ctx = null, master = null, voices = [], timers = [], hlQ = [], busy = false, progRAF = null, hlRafId = null;
let walkFrame = 1, lastWalkFrameTime = 0;

const pitches = () => {
  const o = [start]; let p = start;
  for (const s of steps) { p += s; o.push(p); }
  return o;
};
const total = () => steps.reduce((a, b) => a + b, 0);
const home = () => total() === OCTAVE;
const isMajor = () => steps.join('') === MAJOR.join('');
const rotations = (p) => {
  const r = new Set();
  for (let i = 0; i < p.length; i++) r.add(p.slice(i).concat(p.slice(0, i)).join(''));
  return r;
};
const MAJ_ROTS = rotations(MAJOR);

function frameFor(ps) {
  const lo = Math.min(...ps) - 1, hi = Math.max(...ps) + 1;
  const kx = Math.min(KMAX, (W - PADX - PADR) / (total() * UX));
  const ky = Math.min(KMAX, (H - PADTOP - PADBOT) / ((hi - lo) * UY));
  return { kx, ky, pMid: (hi + lo) / 2, pLo: lo, pHi: hi, midY: PADTOP + (H - PADTOP - PADBOT) / 2 };
}
const stoneR = (f) => Math.max(11, Math.min(23, UX * f.kx * 0.34));

export function stopMajorScaleToy() {
  if (hlRafId !== null) { cancelAnimationFrame(hlRafId); hlRafId = null; }
  cancelAnimationFrame(progRAF);
  voices.forEach((o) => { try { o.stop(); } catch (e) {} });
  voices = [];
  timers.forEach(clearTimeout);
  timers = [];
  hlQ = [];
  steps = MAJOR.slice(); start = 60; found = new Set([MAJOR.join('')]);
  busy = false; walkFrame = 1;
}

export function renderMajorScaleToy(container, config = {}) {
  stopMajorScaleToy();

  container.innerHTML = `
<div id="fpApp">
  <div id="head">
    <h1>The Famous Path</h1>
    <p>So many goats have walked this one that it wore a groove in the hill.</p>
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
      </defs>
      <g id="gAxis"></g><g id="gTrail"></g><g id="gHL"></g>
      <g id="gStones"></g><g id="gSully"></g>
    </svg>
  </div>

  <div id="chips"></div>
  <div id="sum"></div>

  <div id="bar">
    <button class="big" id="bPlay">Walk the path</button>
    <button class="big" id="bReset">Back to the famous path</button>
    <button class="big" id="bAgain">Start at a different stone!</button>
  </div>

  <div id="side">
    <div class="box"><div class="lbl">does it get home?</div><div id="home"></div></div>
    <div class="box"><div class="lbl">stones you land on</div><div id="notes"></div></div>
    <div class="box"><div class="lbl">paths that get home</div>
      <div id="found"></div><div id="foundList"></div></div>
    <div id="msg">Tap a hop below to change it. Can you still get home?</div>
  </div>
</div>`;

  const $ = (i) => document.getElementById(i);
  const gAxis = $('gAxis'), gTrail = $('gTrail'), gHL = $('gHL'), gStones = $('gStones'), gSully = $('gSully');

  function xyList(f) {
    const ps = pitches(); let u = 0; const out = [];
    ps.forEach((p, i) => {
      out.push({ x: PADX + u * UX * f.kx, y: f.midY - (p - f.pMid) * UY * f.ky, p });
      if (i < steps.length) u += steps[i];
    });
    return out;
  }
  const hopPath = (a, b, size, f) => {
    const mx = (a.x + b.x) / 2, lift = size * UX * f.kx * 0.46;
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${(Math.min(a.y, b.y) - lift).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };

  const SULLY_SIZE = 190;
  function sullySVG(x, y, k, frame) {
    const src = `assets/images/goat/goat_r_${frame}.png`;
    return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k})">
      <ellipse cx="0" cy="6" rx="40" ry="7" fill="rgba(43,36,29,.22)"/>
      <image href="${src}" width="${SULLY_SIZE}" height="${SULLY_SIZE}" x="${-SULLY_SIZE / 2}" y="${-SULLY_SIZE}"/>
    </g>`;
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

  function render() {
    const f = frameFor(pitches()), pts = xyList(f), R = stoneR(f);
    gAxis.innerHTML = drawAxis(f);
    gTrail.innerHTML = steps.map((s, i) =>
      `<path class="hop" data-i="${i}" d="${hopPath(pts[i], pts[i + 1], s, f)}" fill="none"
        stroke="${s === 1 ? 'var(--rose)' : 'var(--green)'}" stroke-width="${s === 1 ? 6 : 8}"
        stroke-linecap="round"/>`).join('');
    gStones.innerHTML = pts.map((q, i) => {
      const last = i === pts.length - 1, r = (i === 0 || last) ? R * 1.2 : R, nm = nameOf(q.p);
      const fs = r * (nm.length > 1 ? .82 : 1.0);
      return `<ellipse cx="${(q.x + 1.5).toFixed(1)}" cy="${(q.y + r * .42).toFixed(1)}"
          rx="${(r * .92).toFixed(1)}" ry="${(r * .32).toFixed(1)}" fill="rgba(43,36,29,.2)"/>
        <circle class="stone" data-i="${i}" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${r.toFixed(1)}"
          fill="${(i === 0 || last) ? 'url(#gOn)' : 'url(#gLight)'}" stroke="#2B241D" stroke-width="${(i === 0 || last) ? 4 : 3}"/>
        <text x="${q.x.toFixed(1)}" y="${(q.y + fs * .35).toFixed(1)}" text-anchor="middle" font-weight="bold"
          font-family="Trebuchet MS,sans-serif" font-size="${fs.toFixed(1)}" fill="#2B241D">${nm}</text>
        <text x="${q.x.toFixed(1)}" y="${(q.y + r + 17).toFixed(1)}" text-anchor="middle"
          font-size="13" opacity=".5">${i + 1}</text>`;
    }).join('');
    gSully.innerHTML = sullySVG(pts[0].x, pts[0].y - R * 1.2 - 3, Math.max(.3, Math.min(.46, R / 34)), walkFrame);

    $('chips').innerHTML = steps.map((s, i) =>
      `<div class="chip ${s === 1 ? 'h' : 'w'}" data-i="${i}">
         <span class="num">${s}</span><span class="lt">${s === 1 ? 'H' : 'W'}</span>
         <small>${i + 1}&rarr;${i + 2}</small></div>`).join('');
    $('chips').classList.toggle('chips-locked', busy);
    document.querySelectorAll('#fpApp .chip').forEach((c) => c.onclick = () => {
      if (busy) return;
      const i = +c.dataset.i; steps[i] = steps[i] === 1 ? 2 : 1; afterEdit();
    });

    const sumNow = total();
    $('sum').innerHTML = steps.join(' + ') + ' = ' +
      (sumNow === OCTAVE ? `<span class="ok">${sumNow}  &mdash; one whole lap!</span>`
        : `<span class="no">${sumNow}  &mdash; not 12</span>`);

    const t = total(), gap = OCTAVE - t;
    $('home').innerHTML = home()
      ? `Yes. <b>${t}</b> little stones &mdash; exactly one lap.`
      : `Not yet. Your hops add to <b>${t}</b>, and home is <b>12</b>.<br>
         <span style="opacity:.7">${gap > 0 ? `${gap} short` : `${-gap} too many`}</span>`;
    $('notes').textContent = pitches().map(nameOf).join(' ');
    $('found').innerHTML = `<b>${found.size}</b> of ${TOTAL_VALID} found`;
    $('foundList').textContent = [...found].sort().map((s) => s.replace(/1/g, 'H').replace(/2/g, 'W')).join('  ');
    $('bReset').disabled = isMajor();
    $('bAgain').disabled = !home();
  }

  function afterEdit() {
    if (home()) found.add(steps.join(''));
    render();
    if (isMajor()) $('msg').innerHTML = 'That is the famous path. Listen to how it settles at the end.';
    else if (!home()) $('msg').innerHTML = 'Sully ended up somewhere that is not home. Try again.';
    else if (MAJ_ROTS.has(steps.join('')))
      $('msg').innerHTML = 'Home! And this is the famous path <b>begun at a different hop</b>.';
    else $('msg').innerHTML = 'Home &mdash; but it does not sound like the famous one, does it?';
    runLocked();
  }

  function runLocked(btn) {
    stopAll(); busy = true; render();
    const d = play();
    const els = [...document.querySelectorAll('#fpApp .chip')];
    if (btn) els.push(btn);
    progressAll(els, d);
    timers.push(setTimeout(() => { busy = false; render(); }, d * 1000));
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
  function note(n, t, dur = 1.4) {
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
    document.querySelectorAll('#fpApp .loading').forEach((b) => {
      b.classList.remove('loading'); b.style.removeProperty('--prog');
    });
    $('chips').classList.remove('chips-locked'); busy = false;
  }
  function progressAll(els, d) {
    const t0 = performance.now();
    els.forEach((e) => e.classList.add('loading'));
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / (d * 1000));
      els.forEach((e) => e.style.setProperty('--prog', k.toFixed(3)));
      if (k < 1) progRAF = requestAnimationFrame(step);
      else els.forEach((e) => { e.classList.remove('loading'); e.style.removeProperty('--prog'); });
    })();
  }

  function showHL(i) {
    if (i === null) {
      gHL.innerHTML = '';
      walkFrame = 1;
      const f = frameFor(pitches()), pts = xyList(f), R = stoneR(f);
      gSully.innerHTML = sullySVG(pts[0].x, pts[0].y - R * 1.2 - 3, Math.max(.3, Math.min(.46, R / 34)), walkFrame);
      return;
    }
    const now = performance.now();
    if (now - lastWalkFrameTime > WALK_FRAME_MS) {
      walkFrame = walkFrame === 1 ? 2 : 1;
      lastWalkFrameTime = now;
    }
    const f = frameFor(pitches()), pts = xyList(f), R = stoneR(f);
    const idx = i + 1, lastIdx = pts.length - 1, sr = (idx === 0 || idx === lastIdx) ? R * 1.2 : R;
    gSully.innerHTML = sullySVG(pts[idx].x, pts[idx].y - sr * 1.2 - 3, Math.max(.3, Math.min(.46, R / 34)), walkFrame);

    const arc = gTrail.querySelector(`.hop[data-i="${i}"]`);
    const st = gStones.querySelector(`.stone[data-i="${i + 1}"]`);
    let out = '';
    if (arc) out += `<path d="${arc.getAttribute('d')}" fill="none" stroke="#2B241D"
                        stroke-width="13" stroke-linecap="round"/>`;
    if (st) {
      const r = +st.getAttribute('r');
      out += `<circle cx="${st.getAttribute('cx')}" cy="${st.getAttribute('cy')}" r="${r}" fill="#2B241D"/>
        <text x="${st.getAttribute('cx')}" y="${(+st.getAttribute('cy') + r * .36).toFixed(1)}"
          text-anchor="middle" font-weight="bold" font-family="Trebuchet MS,sans-serif"
          font-size="${(r * .9).toFixed(1)}" fill="#F7F1DF">${nameOf(pitches()[i + 1])}</text>`;
    }
    gHL.innerHTML = out;
  }
  function hlLoop() {
    if (ctx && hlQ.length) {
      const now = ctx.currentTime;
      while (hlQ.length && hlQ[0].t <= now) showHL(hlQ.shift().i);
    }
    hlRafId = requestAnimationFrame(hlLoop);
  }
  hlRafId = requestAnimationFrame(hlLoop);

  function play(at = 0, gap = .44) {
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const ps = pitches(), t0 = ctx.currentTime + .05 + at;
    ps.forEach((p, i) => {
      note(p, t0 + i * gap, i === ps.length - 1 ? 2.2 : 1.2);
      if (i < steps.length) hlQ.push({ t: t0 + (i + 1) * gap, i });
    });
    hlQ.push({ t: t0 + ps.length * gap, i: null });
    return ps.length * gap + .5;
  }

  $('bPlay').onclick = () => { if (busy) return; runLocked($('bPlay')); };
  $('bReset').onclick = () => {
    if (busy) return; steps = MAJOR.slice();
    $('msg').innerHTML = 'Back on the famous path.'; runLocked($('bReset'));
  };
  $('bAgain').onclick = () => {
    if (busy || !home()) return; stopAll(); busy = true;
    const room = [];
    for (let t = -9; t <= 9; t++) {
      const s = start + t;
      if (t !== 0 && s >= 50 && s + 12 <= 84) room.push(t);
    }
    start += room[Math.floor(Math.random() * room.length)];
    $('msg').innerHTML = 'Same seven hops from a new stone &mdash; same tune.';
    busy = false; runLocked($('bAgain'));
  };

  render();
}
