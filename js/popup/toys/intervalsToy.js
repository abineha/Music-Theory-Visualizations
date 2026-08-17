const LETTERS = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B'];
const SPOTS = [
  { x: 1 / 6, pieces: 6, col: '#7C6BAF', dim: '#C9BEE6', semis: 3 },
  { x: 1 / 5, pieces: 5, col: '#3C87B5', dim: '#BCDCEC', semis: 4 },
  { x: 1 / 4, pieces: 4, col: '#3E7A34', dim: '#BFE0AE', semis: 5 },
  { x: 1 / 3, pieces: 3, col: '#E09A1E', dim: '#FBDFA4', semis: 7 },
  { x: 1 / 2, pieces: 2, col: '#D8524B', dim: '#F6C8C3', semis: 12 },
];
const ROOTS = Array.from({ length: 12 }, (_, i) => 48 + i);
const NAT = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
const W = 1040, H = 400, L = 132, R = 908, RY = 214;
const px = (v) => L + (R - L) * v;
const SULLY_SIZE = 180;
const WALK_FRAME_MS = 180;
const T2 = 0.78, T3 = 1.56, END = 3.0;

let rootIx = 0;
let x = 0.42, marks = true, lit = new Set(), phase = 0, wobble = 0;
let seq = null, busy = false, cue = [];
let ctx = null, master = null;
let walkFrame = 1, facing = 'right';
let cuesRafId = null, loopRafId = null, progRAF = null;
let timers = [];
let keydownListener = null;
let drag = false;

const rootMidi = () => ROOTS[rootIx];
const rootName = () => LETTERS[rootMidi() % 12];
const noteOf = (sp) => LETTERS[(rootMidi() + sp.semis) % 12];
const BASEHZ = () => 440 * Math.pow(2, (rootMidi() - 69) / 12);
const nearest = () => SPOTS.reduce((b, s) => Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b, SPOTS[0]);
const onSpot = () => Math.abs(nearest().x - x) < 0.008;
const soundHz = () => BASEHZ() / (1 - x);

const STOPS = (() => {
  const out = [0.10, 0.133];
  SPOTS.forEach((s, i) => {
    out.push(s.x);
    const nxt = SPOTS[i + 1];
    if (nxt) { const d = nxt.x - s.x; out.push(s.x + d / 3, s.x + 2 * d / 3); }
  });
  return [...new Set(out.map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
})();

export function stopIntervalsToy() {
  if (cuesRafId !== null) { cancelAnimationFrame(cuesRafId); cuesRafId = null; }
  if (loopRafId !== null) { cancelAnimationFrame(loopRafId); loopRafId = null; }
  cancelAnimationFrame(progRAF);
  timers.forEach(clearTimeout);
  timers = [];
  if (keydownListener) {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
  rootIx = 0; x = 0.42; marks = true; lit = new Set(); phase = 0; wobble = 0;
  seq = null; busy = false; cue = []; walkFrame = 1; facing = 'right'; drag = false;
}

export function renderIntervalsToy(container, config = {}) {
  stopIntervalsToy();

  container.innerHTML = `
<div id="sbApp">
  <div id="head">
    <h1>The Singing Bridge</h1>
    <p>Walk Sully along the rope. In some spots it <em>rings</em>. Find all five.</p>
  </div>

  <div id="stage">
    <svg id="board" viewBox="0 0 1040 400" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#CFE7F5"/><stop offset="1" stop-color="#9FC2D6"/></linearGradient>
        <linearGradient id="rope" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#C9A377"/><stop offset="1" stop-color="#8F6C4D"/></linearGradient>
        <radialGradient id="glow"><stop offset="0" stop-color="#FFE9A0" stop-opacity=".9"/>
          <stop offset="1" stop-color="#FFE9A0" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="1040" height="400" fill="url(#sky)"/>
      <g id="gScene"></g><g id="gPieces"></g><g id="gRope"></g>
      <g id="gSpark"></g><g id="gSully"></g>
    </svg>
  </div>

  <div id="slide">
    <input type="range" id="pos" min="0" max="0" step="1" value="0" aria-label="Where Sully stands">
  </div>

  <div id="roots"><span class="rlbl">Start on</span><span id="rchips"></span></div>

  <div id="status">
    <div id="big"></div>
    <div id="lanterns"></div>
  </div>

  <div id="bar">
    <button id="bL">&larr;</button>
    <button id="bListen">Listen again</button>
    <button id="bR">&rarr;</button>
    <button id="bMarks" class="on">Show the spots</button>
    <button id="bNew">Start again</button>
  </div>
</div>`;

  const $ = (i) => document.getElementById(i);
  const gScene = $('gScene'), gPieces = $('gPieces'), gRope = $('gRope'),
        gSpark = $('gSpark'), gSully = $('gSully');

  gScene.innerHTML = `
    <path d="M0 400 L0 176 L132 176 L152 400 Z" fill="#8C7A5E" stroke="#2B241D" stroke-width="5"/>
    <path d="M1040 400 L1040 176 L908 176 L888 400 Z" fill="#8C7A5E" stroke="#2B241D" stroke-width="5"/>
    <rect x="0" y="160" width="142" height="20" rx="6" fill="#7FA85C" stroke="#2B241D" stroke-width="5"/>
    <rect x="898" y="160" width="142" height="20" rx="6" fill="#7FA85C" stroke="#2B241D" stroke-width="5"/>
    <circle cx="${L}" cy="${RY}" r="14" fill="#6B4F35" stroke="#2B241D" stroke-width="5"/>
    <circle cx="${R}" cy="${RY}" r="14" fill="#6B4F35" stroke="#2B241D" stroke-width="5"/>
    <g id="tags"></g>`;

  function sullySVG(sx, sy, face, k, frame) {
    const src = `assets/images/goat/goat_${face < 0 ? 'l' : 'r'}_${frame}.png`;
    return `<g transform="translate(${sx.toFixed(1)},${sy.toFixed(1)}) scale(${k})">
      <ellipse cx="0" cy="10" rx="40" ry="7" fill="rgba(43,36,29,.2)"/>
      <image href="${src}" width="${SULLY_SIZE}" height="${SULLY_SIZE}" x="${-SULLY_SIZE / 2}" y="${-SULLY_SIZE}"/>
    </g>`;
  }

  function ropeD(a, b, amp, ring) {
    let d = '';
    for (let i = 0; i <= 64; i++) {
      const t = i / 64, X = a + (b - a) * t;
      let y = Math.sin(Math.PI * t) * Math.sin(phase * 1.9) * amp;
      if (!ring) {
        y += Math.sin(2.7 * Math.PI * t) * Math.sin(phase * 3.4) * amp * 0.85
           + Math.sin(4.3 * Math.PI * t) * Math.sin(phase * 5.1) * amp * 0.45;
      }
      d += (i ? ' L' : 'M') + X.toFixed(1) + ' ' + (RY + y).toFixed(1);
    }
    return d;
  }

  function render() {
    const pin = px(x), ok = onSpot(), n = nearest();
    const lowHot = seq === 'low' || seq === 'both', highHot = seq === 'high' || seq === 'both';

    gPieces.innerHTML = (ok && marks) ? Array.from({ length: n.pieces }, (_, i) => {
      const a = px(i / n.pieces), b = px((i + 1) / n.pieces);
      return `<rect x="${(a + 3).toFixed(1)}" y="${RY + 40}" width="${(b - a - 6).toFixed(1)}" height="16"
        rx="8" fill="${i % 2 ? n.dim : n.col}" stroke="#2B241D" stroke-width="3"/>`;
    }).join('') : '';

    gRope.innerHTML =
      (seq === 'low'
        ? `<path d="${ropeD(L, R, wobble, true)}" fill="none" stroke="#6E5237" stroke-width="14"
             stroke-linecap="round"/>
           <path d="${ropeD(L, R, wobble, true)}" fill="none" stroke="url(#rope)" stroke-width="10"
             stroke-linecap="round"/>`
        : `<path d="${ropeD(L, pin, 0, true)}" fill="none" stroke="#6E5237" stroke-width="10"
             stroke-linecap="round" opacity="${lowHot ? .85 : .5}"/>
           <path d="${ropeD(pin, R, wobble, ok)}" fill="none" stroke="#6E5237" stroke-width="14"
             stroke-linecap="round"/>
           <path d="${ropeD(pin, R, wobble, ok)}" fill="none" stroke="url(#rope)" stroke-width="10"
             stroke-linecap="round"/>`)
      + `<circle cx="${pin.toFixed(1)}" cy="${RY}" r="8" fill="#2B241D"/>`
      + (marks ? SPOTS.map((s) => {
          const X = px(s.x), near = Math.abs(s.x - x) < 0.008;
          return `<circle cx="${X.toFixed(1)}" cy="${RY - 46}" r="${near ? 12 : 8}"
            fill="${lit.has(s.pieces) ? s.col : s.dim}" stroke="#2B241D" stroke-width="3"/>`;
        }).join('') : '');

    gSully.innerHTML = sullySVG(pin, RY - 4, facing === 'left' ? -1 : 1, 0.46, walkFrame);

    const tag = (cx, txt, fill, fg) => `<rect x="${cx - 31}" y="${RY - 118}" width="62" height="46" rx="13"
        fill="${fill}" stroke="#2B241D" stroke-width="4"/>
      <text x="${cx}" y="${RY - 85}" text-anchor="middle" font-size="27" font-weight="bold"
        font-family="Trebuchet MS,sans-serif" fill="${fg}">${txt}</text>`;
    $('tags').innerHTML =
        tag(L + 34, rootName(), lowHot ? '#FFE9A0' : '#F7F1DF', '#2B241D')
      + tag(R - 34, ok ? noteOf(n) : '?',
            highHot ? (ok ? n.col : '#BBB4A4') : (ok ? n.dim : '#DED9CC'),
            highHot && ok ? '#fff' : '#2B241D');

    $('big').innerHTML = ok
      ? `The rope is steady &mdash; that sounds good! It splits into <b>${n.pieces} equal pieces</b>.`
      : 'Oh, the rope is wobbly. Watch out!';
    $('big').style.color = ok ? n.col : '#8C2F2A';

    $('lanterns').innerHTML = SPOTS.map((s) => {
      const on = lit.has(s.pieces);
      return `<svg class="lan" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="15" fill="${on ? s.col : '#DED9CC'}"
          stroke="#2B241D" stroke-width="3.5"/>
        ${on ? `<text x="20" y="26" text-anchor="middle" font-size="17" font-weight="bold"
          font-family="Trebuchet MS,sans-serif" fill="#fff">${s.pieces}</text>` : ''}
      </svg>`;
    }).join('');

    syncSlider();
    document.querySelectorAll('#sbApp .rc').forEach((c) => {
      c.classList.toggle('sel', +c.dataset.i === rootIx);
      c.disabled = busy;
    });
    $('bMarks').textContent = (marks ? 'Hide' : 'Show') + ' the spots';
    $('bMarks').classList.toggle('on', marks);
  }

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .3; master.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 1.4), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const a = b.getChannelData(c);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
    }
    const r = ctx.createConvolver(); r.buffer = b;
    const w = ctx.createGain(); w.gain.value = .17; r.connect(w); w.connect(ctx.destination);
    master.connect(r);
  }
  const P = [[1, 1, 1], [2, .45, .72], [3, .26, .55], [4, .15, .44], [5, .09, .36], [6, .05, .3]];
  function tone(f0, t, vol, dur) {
    const vg = ctx.createGain(); vg.gain.value = .3 * vol; vg.connect(master);
    const br = Math.pow(130.8 / f0, .4);
    P.forEach(([h, lv, dk]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0 * h * (1 + .0003 * h * h), t);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(lv * .5, .0008), t + .004);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur * dk * br + .05);
      o.connect(g); g.connect(vg); o.start(t); o.stop(t + dur + .4);
    });
  }

  function lockFor(btn, secs) {
    busy = true;
    document.querySelectorAll('#sbApp #bar button').forEach((el) => { el.disabled = true; });
    $('pos').disabled = true;
    document.querySelectorAll('#sbApp .rc').forEach((c) => c.disabled = true);
    const t0 = performance.now();
    if (btn) btn.classList.add('loading');
    cancelAnimationFrame(progRAF);
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
      if (btn) btn.style.setProperty('--prog', k.toFixed(3));
      if (k < 1) progRAF = requestAnimationFrame(step);
      else {
        if (btn) { btn.classList.remove('loading'); btn.style.removeProperty('--prog'); }
        document.querySelectorAll('#sbApp #bar button').forEach((el) => el.disabled = false);
        $('pos').disabled = false;
        document.querySelectorAll('#sbApp .rc').forEach((c) => c.disabled = false);
        busy = false; seq = null; render();
      }
    })();
  }

  function listen(btn) {
    if (busy) return;
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + .05, ok = onSpot(), n = nearest();

    tone(BASEHZ(), t, .85, 1.5);
    tone(soundHz(), t + T2, .85, 1.5);
    tone(BASEHZ(), t + T3, .8, 1.9);
    tone(soundHz(), t + T3, .8, 1.9);

    cue = [{ t: t, s: 'low' },
           { t: t + T2, s: 'high' },
           { t: t + T3, s: 'both' },
           { t: t + END - .2, s: null }];

    if (ok && !lit.has(n.pieces)) {
      lit.add(n.pieces);
      timers.push(setTimeout(() => {
        sparkle(px(x), n.col);
        if (lit.size === SPOTS.length) $('big').innerHTML = 'All five lanterns lit. Well done!';
      }, T3 * 1000));
    }
    lockFor(btn || $('bListen'), END);
  }

  function cuesLoop() {
    if (ctx && cue.length) {
      const now = ctx.currentTime;
      while (cue.length && cue[0].t <= now) {
        const e = cue.shift(); seq = e.s;
        wobble = e.s === null ? wobble : (onSpot() ? 9 : 17);
      }
    }
    cuesRafId = requestAnimationFrame(cuesLoop);
  }
  cuesRafId = requestAnimationFrame(cuesLoop);

  function sparkle(X, col = '#FFE9A0') {
    let s = '';
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.283, r = 30 + Math.random() * 70;
      s += `<circle cx="${X.toFixed(1)}" cy="${RY - 20}" r="${(2 + Math.random() * 4).toFixed(1)}"
        fill="${col}" stroke="#2B241D" stroke-width="1.5">
        <animate attributeName="cx" to="${(X + Math.cos(a) * r).toFixed(1)}" dur="0.8s" fill="freeze"/>
        <animate attributeName="cy" to="${(RY - 20 + Math.sin(a) * r).toFixed(1)}" dur="0.8s" fill="freeze"/>
        <animate attributeName="opacity" from="1" to="0" dur="0.8s" fill="freeze"/></circle>`;
    }
    gSpark.innerHTML = s;
    timers.push(setTimeout(() => { gSpark.innerHTML = ''; }, 900));
  }

  function walkBounce() {
    walkFrame = 2;
    timers.push(setTimeout(() => { walkFrame = 1; render(); }, WALK_FRAME_MS));
  }

  function setX(v, play, snap = true) {
    const prevX = x;
    x = Math.max(0.09, Math.min(0.5, v));
    if (snap) {
      const n = SPOTS.reduce((b, s) => Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b, SPOTS[0]);
      if (Math.abs(n.x - x) < 0.012) x = n.x;
    }
    if (Math.abs(x - prevX) > 0.0005) {
      facing = x > prevX ? 'right' : 'left';
      walkBounce();
    }
    render();
    if (play) listen();
  }
  function walk(dir) {
    facing = dir > 0 ? 'right' : 'left';
    let i = STOPS.findIndex((v) => Math.abs(v - x) < 0.004);
    if (i < 0) {
      i = dir > 0 ? STOPS.findIndex((v) => v > x + 0.002)
        : (() => { for (let k = STOPS.length - 1; k >= 0; k--) if (STOPS[k] < x - 0.002) return k; return 0; })();
      if (i < 0) i = dir > 0 ? STOPS.length - 1 : 0;
    } else i = Math.max(0, Math.min(STOPS.length - 1, i + dir));
    setX(STOPS[i], true, false);
  }

  const board = $('board');
  function bx(e) {
    const p = board.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return (p.matrixTransform(board.getScreenCTM().inverse()).x - L) / (R - L);
  }
  board.addEventListener('pointerdown', (e) => {
    if (busy) return; drag = true;
    board.setPointerCapture(e.pointerId); setX(bx(e), true);
  });
  board.addEventListener('pointermove', (e) => { if (drag) setX(bx(e), false, true); });
  board.addEventListener('pointerup', () => { if (drag) { drag = false; if (!busy) listen(); } });

  const posEl = $('pos');
  posEl.max = STOPS.length - 1;
  function syncSlider() {
    let i = 0, best = 9e9;
    STOPS.forEach((v, k) => { const d = Math.abs(v - x); if (d < best) { best = d; i = k; } });
    posEl.value = i;
    posEl.disabled = busy;
  }
  posEl.oninput = () => { if (busy) { syncSlider(); return; } setX(STOPS[+posEl.value], false, false); };
  posEl.onchange = () => { if (!busy) listen(); };

  $('bL').onclick = () => { if (!busy) walk(-1); };
  $('bR').onclick = () => { if (!busy) walk(1); };
  $('bListen').onclick = (e) => listen(e.currentTarget);
  $('bMarks').onclick = () => {
    if (busy) return; marks = !marks; render();
    $('big').innerHTML = marks ? 'Spots are showing again.' : 'Now find them by <b>ear</b>!';
  };
  $('rchips').innerHTML = ROOTS.map((m, i) =>
    `<button class="rc ${NAT[m % 12] ? '' : 'acc'}" data-i="${i}">${LETTERS[m % 12]}</button>`).join('');
  document.querySelectorAll('#sbApp .rc').forEach((c) => c.onclick = () => {
    if (busy) return;
    rootIx = +c.dataset.i; render(); listen();
  });
  $('bNew').onclick = () => { if (busy) return; lit.clear(); x = 0.42; marks = true; render(); };

  keydownListener = (e) => {
    if (busy) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); walk(1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); walk(-1); }
    if (e.key === ' ') { e.preventDefault(); listen(); }
  };
  window.addEventListener('keydown', keydownListener);

  function mainLoop() {
    phase += 0.3; wobble *= 0.955; render();
    loopRafId = requestAnimationFrame(mainLoop);
  }
  loopRafId = requestAnimationFrame(mainLoop);

  render();
}