const L = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B'];
const NAT = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
const SC = [0, 2, 4, 5, 7, 9, 11];
const DEGCOL = ['#E2A32B', '#3E9A8F', '#3C87B5', '#4E9B57', '#C7563F', '#6C5EA6', '#8C8577'];
const KIND = { '4,7': { w: 'bright', mark: 'sun' }, '3,7': { w: 'soft', mark: 'moon' }, '3,6': { w: 'foggy', mark: 'fog' } };
const MAXC = 4;
const DW = 54, DH = 132, GY = 348, X0 = 96, INNER = 22;
const GAPS = [100, 72, 48, 40];
const groupW = DW * 3 + INNER * 2;
const BPM = 104, BEAT = 60 / BPM, BAR = BEAT * 4, ROLL = 0.085;
const SULLY_SIZE = 150;
const WALK_FRAME_MS = 180;

let key = 0, line = [], fall = [], busy = false, playing = -1, phase = 0;
let ctx = null, master = null, cue = [], progRAF = null, voices = [];
let facing = 'right', walkFrame = 1, lastSx = 40;
let cuesRafId = null, loopRafId = null;
let timers = [];
let keydownListener = null;

function triad(d) {
  const idx = [d, (d + 2) % 7, (d + 4) % 7]; let oct = 0, last = -1; const out = [];
  idx.forEach((i) => { let v = SC[i]; if (v < last) oct += 12; out.push(v + oct); last = SC[i]; });
  return out;
}
const pcsOf = (d) => triad(d).map((v) => (key + v) % 12);
const kindOf = (d) => { const t = triad(d); return KIND[`${t[1] - t[0]},${t[2] - t[0]}`]; };
const nameOf = (d) => L[(key + SC[d]) % 12];
const shared = (a, b) => pcsOf(a).filter((p) => pcsOf(b).includes(p));

function voicings(pcs, lo = 55, hi = 79) {
  const o = pcs.map((p) => { const a = []; for (let m = lo; m <= hi; m++) if (m % 12 === p) a.push(m); return a; });
  const out = [];
  o[0].forEach((a) => o[1].forEach((b) => o[2].forEach((c) => {
    const v = [a, b, c]; if (new Set(v).size === 3) out.push(v.slice().sort((x, y) => x - y));
  })));
  return out;
}
function planVoices() {
  let prev = [60, 64, 67]; const out = [];
  line.forEach((d) => {
    const best = voicings(pcsOf(d)).reduce((b, v) => {
      const c = v.reduce((s, n, i) => s + Math.abs(n - prev[i]), 0);
      return c < b.c ? { v, c } : b;
    }, { v: null, c: 1e9 }).v;
    out.push(best); prev = best;
  });
  return out;
}
const gapFor = (a, b) => GAPS[shared(a, b).length] ?? 72;

export function stopChordProgressionsToy() {
  if (cuesRafId !== null) { cancelAnimationFrame(cuesRafId); cuesRafId = null; }
  if (loopRafId !== null) { cancelAnimationFrame(loopRafId); loopRafId = null; }
  cancelAnimationFrame(progRAF);
  timers.forEach(clearTimeout);
  timers = [];
  voices.forEach((o) => { try { o.stop(); } catch (e) {} });
  voices = [];
  if (keydownListener) {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
  key = 0; line = []; fall = []; busy = false; playing = -1; phase = 0;
  cue = []; facing = 'right'; walkFrame = 1; lastSx = 40;
}

export function renderChordProgressionsToy(container, config = {}) {
  stopChordProgressionsToy();

  container.innerHTML = `
<div id="cpApp">
  <div id="head">
    <h1>Sully's Dominoes</h1>
    <p>Tap a stone. Take it, skip one, take the next, skip one, take the next.
       Three dominoes grow, and that is a chord.</p>
  </div>

  <div id="stage">
    <svg id="board" viewBox="0 0 1240 440" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#D6E9F4"/><stop offset="1" stop-color="#EEF5E5"/></linearGradient></defs>
      <rect width="1240" height="440" fill="url(#sky)"/>
      <rect y="348" width="1240" height="92" fill="#8FBE68"/>
      <rect y="348" width="1240" height="7" fill="#A4CE7C"/>
      <g id="gScale"></g><g id="gGaps"></g>
      <g id="gDom"></g><g id="gSully"></g>
    </svg>
  </div>

  <div id="keys"><span class="klbl">Key</span><span id="kchips"></span></div>

  <div id="status"><div id="big"></div><div id="sub"></div></div>

  <div id="bar">
    <button class="big" id="bPush">Push!</button>
    <button class="big" id="bUndo">Take one off</button>
    <button class="big" id="bClear">Clear the line</button>
    <button class="big" id="bSong">Familiar tune</button>
  </div>
</div>`;

  const $ = (i) => document.getElementById(i);
  const gScale = $('gScale'), gGaps = $('gGaps'), gDom = $('gDom'), gSully = $('gSully');

  function positions() {
    const out = []; let x = X0;
    line.forEach((d, i) => { out.push(x); x += groupW + (i < line.length - 1 ? gapFor(d, line[i + 1]) : 0); });
    return out;
  }

  function sullySVG(x, y, face, k, frame) {
    const src = `assets/images/goat/goat_${face < 0 ? 'l' : 'r'}_${frame}.png`;
    return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k})">
      <ellipse cx="0" cy="10" rx="42" ry="7" fill="rgba(20,20,20,.2)"/>
      <image href="${src}" width="${SULLY_SIZE}" height="${SULLY_SIZE}" x="${-SULLY_SIZE / 2}" y="${-SULLY_SIZE}"/>
    </g>`;
  }
  function walkBounce() {
    walkFrame = 2;
    timers.push(setTimeout(() => { walkFrame = 1; render(); }, WALK_FRAME_MS));
  }

  function render() {
    const xs = positions(), V = planVoices();

    const canAdd = !busy && line.length < MAXC;
    gScale.innerHTML = SC.map((v, d) => {
      const X = 178 + d * 132, col = DEGCOL[d], k = kindOf(d);
      return `<g opacity="${canAdd ? 1 : .4}">
        ${canAdd ? `<circle class="sc" data-d="${d}" cx="${X}" cy="82" r="54" fill="transparent"
          style="cursor:pointer"/>` : ''}
        <circle ${canAdd ? `class="sc" data-d="${d}" style="cursor:pointer"` : ''}
          cx="${X}" cy="82" r="44" fill="${col}" stroke="#2B241D" stroke-width="5"/>
        <text x="${X}" y="92" text-anchor="middle" font-size="32" font-weight="bold" fill="#fff"
          font-family="Trebuchet MS,sans-serif" pointer-events="none">${nameOf(d)}</text>
        <text x="${X}" y="146" text-anchor="middle" font-size="22" font-weight="bold" opacity=".72"
          pointer-events="none">${k.w}</text></g>`;
    }).join('')
    + `<text x="40" y="74" font-size="21" font-weight="bold" opacity=".6">${canAdd ? 'tap a' : 'line is'}</text>
       <text x="40" y="102" font-size="21" font-weight="bold" opacity=".6">${canAdd ? 'stone' : 'full'}</text>`;

    gGaps.innerHTML = line.slice(0, -1).map((d, i) => {
      const sh = shared(d, line[i + 1]), mid = xs[i] + groupW + (xs[i + 1] - xs[i] - groupW) / 2;
      return `<text x="${mid.toFixed(0)}" y="${GY - DH - 20}" text-anchor="middle" font-size="19"
        opacity=".6">${sh.length ? sh.map((p) => L[p]).join(' ') + ' stay' : 'big jump'}</text>`;
    }).join('');

    gDom.innerHTML = line.map((d, i) => {
      const col = DEGCOL[d], v = V[i] || [], k = kindOf(d);
      return v.map((m, j) => {
        const idx = i * 3 + j, f = fall[idx] || 0, x = xs[i] + j * (DW + INNER);
        return `<g transform="translate(${x},${GY}) rotate(${(f * 84).toFixed(1)} ${DW} 0)">
          <rect x="0" y="${-DH}" width="${DW}" height="${DH}" rx="7" fill="${col}"
            stroke="#2B241D" stroke-width="3.5"/>
          <rect x="6" y="${-DH + 6}" width="${DW - 12}" height="14" rx="6" fill="#fff" opacity=".3"/>
          <text x="${DW / 2}" y="${-DH / 2 + 9}" text-anchor="middle" font-size="24" font-weight="bold"
            fill="#fff" font-family="Trebuchet MS,sans-serif">${L[m % 12]}</text>
        </g>`;
      }).join('')
      + `<text x="${(xs[i] + groupW / 2).toFixed(0)}" y="${GY + 34}" text-anchor="middle" font-size="21"
          font-weight="bold" fill="${col}">${nameOf(d)} ${k.w}</text>`;
    }).join('');

    const sx = playing >= 0 ? (xs[playing] || X0) - 56 : 40;
    if (Math.abs(sx - lastSx) > 0.5) {
      facing = sx > lastSx ? 'right' : 'left';
      walkBounce();
    }
    lastSx = sx;
    gSully.innerHTML = sullySVG(sx, GY - 4, facing === 'left' ? -1 : 1, .54, walkFrame);

    refreshEnabled();
  }
  function words() {
    const n = line.length;
    if (!n) {
      $('big').textContent = 'Tap a stone to grow three dominoes.';
      $('sub').textContent = 'Every chord is made the same way: take, skip, take, skip, take.';
      return;
    }
    $('big').textContent = n >= MAXC
      ? `Line is full: ${n * 3} dominoes in ${n} colours.`
      : `${n * 3} dominoes standing, in ${n} colour${n > 1 ? 's' : ''}.`;
    $('sub').textContent = line.map((d) => `${nameOf(d)} ${kindOf(d).w}`).join('   ')
      + (n >= MAXC ? '     \u00B7     push, or take one off' : '');
  }

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .23; master.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 1.5), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const a = b.getChannelData(c);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.7);
    }
    const rv = ctx.createConvolver(); rv.buffer = b;
    const w = ctx.createGain(); w.gain.value = .2; rv.connect(w); w.connect(ctx.destination);
    master.connect(rv);
  }
  const P = [[1, 1, 1], [2, .44, .7], [3, .24, .54], [4, .14, .43], [5, .08, .35], [6, .05, .29]];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function tone(m, t, dur, vol) {
    const f0 = hz(m), br = Math.pow(261.6 / f0, .45);
    const vg = ctx.createGain(); vg.gain.value = .3 * vol; vg.connect(master);
    P.forEach(([h, lv, dk]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0 * h * (1 + .0004 * h * h), t);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(lv * .5, .0008), t + .005);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur * dk * br + .05);
      o.connect(g); g.connect(vg); o.start(t); o.stop(t + dur + .4);
      voices.push(o);
      o.onended = () => { const k = voices.indexOf(o); if (k >= 0) voices.splice(k, 1); };
    });
  }
  function stopAll() {
    voices.forEach((o) => { try { o.stop(); } catch (e) {} });
    voices = []; cue = [];
    cancelAnimationFrame(progRAF);
    document.querySelectorAll('#cpApp .loading').forEach((b) => {
      b.classList.remove('loading'); b.style.removeProperty('--prog');
    });
    busy = false; playing = -1;
    refreshEnabled();
  }
  function playBar(d, v, t, last) {
    const bass = 36 + key + SC[d];
    tone(bass, t, last ? 3.2 : 2.0, .85);
    tone(bass + 7, t + BEAT * 2, 1.0, .35);
    v.forEach((m, j) => tone(m, t + j * ROLL, last ? 3.2 : 1.6, .62));
    if (!last) { tone(v[2], t + BEAT * 2, 1.1, .4); tone(v[1], t + BEAT * 3, 1.1, .35); }
  }
  function refreshEnabled() {
    document.querySelectorAll('#cpApp #bar button').forEach((b) => b.disabled = busy);
    document.querySelectorAll('#cpApp .kc').forEach((c) => {
      c.disabled = busy; c.classList.toggle('sel', +c.dataset.i === key);
    });
  }
  function lockFor(secs, btn) {
    busy = true; refreshEnabled();
    const t0 = performance.now();
    if (btn) btn.classList.add('loading');
    cancelAnimationFrame(progRAF);
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
      if (btn) btn.style.setProperty('--prog', k.toFixed(3));
      if (k < 1) progRAF = requestAnimationFrame(step);
      else {
        if (btn) { btn.classList.remove('loading'); btn.style.removeProperty('--prog'); }
        busy = false; refreshEnabled();
      }
    })();
  }
  function push(btn) {
    if (busy || !line.length) return;
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    stopAll();
    const t0 = ctx.currentTime + .15, V = planVoices();
    fall = line.flatMap(() => [0, 0, 0]); cue = [];
    line.forEach((d, i) => {
      playBar(d, V[i], t0 + i * BAR, i === line.length - 1);
      for (let j = 0; j < 3; j++) cue.push({ t: t0 + i * BAR + j * ROLL, dom: i * 3 + j, ch: i });
    });
    cue.push({ t: t0 + line.length * BAR, dom: -1, ch: -1 });
    lockFor(line.length * BAR + 1.1, btn);
  }
  function cuesLoop() {
    if (ctx && cue.length) {
      const now = ctx.currentTime;
      while (cue.length && cue[0].t <= now) {
        const e = cue.shift();
        if (e.dom >= 0) { fall[e.dom] = 0.001; playing = e.ch; } else playing = -1;
      }
    }
    cuesRafId = requestAnimationFrame(cuesLoop);
  }
  cuesRafId = requestAnimationFrame(cuesLoop);

  $('kchips').innerHTML = L.map((n, i) =>
    `<button class="kc ${NAT[i] ? '' : 'acc'}" data-i="${i}">${n}</button>`).join('');
  document.querySelectorAll('#cpApp .kc').forEach((c) => c.onclick = () => {
    if (busy) return; stopAll(); key = +c.dataset.i; render(); words();
  });

  function addChord(d) {
    if (busy || line.length >= MAXC) return;
    stopAll();
    line.push(d);
    fall = line.flatMap(() => [0, 0, 0]);
    playing = -1; render(); words();
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const V = planVoices();
    playBar(d, V[line.length - 1], ctx.currentTime + .04, false);
    lockFor(0.38);
  }
  $('board').addEventListener('pointerdown', (e) => {
    const d = e.target?.dataset?.d;
    if (d === undefined) return;
    e.preventDefault();
    addChord(+d);
  });
  $('bPush').onclick = (e) => push(e.currentTarget);
  $('bUndo').onclick = () => {
    if (busy) return; stopAll(); line.pop(); fall = line.flatMap(() => [0, 0, 0]);
    playing = -1; render(); words();
  };
  $('bClear').onclick = () => { if (busy) return; stopAll(); line = []; fall = []; render(); words(); };
  $('bSong').onclick = (e) => {
    if (busy) return; stopAll();
    line = [0, 4, 5, 3]; fall = line.flatMap(() => [0, 0, 0]); playing = -1; render(); words();
    $('sub').textContent = 'You have heard this one in lots of songs.';
    push(e.currentTarget);
  };

  keydownListener = (e) => {
    if (busy) return;
    if (e.key === ' ') { e.preventDefault(); push($('bPush')); }
    if (e.key === 'Backspace') { e.preventDefault(); $('bUndo').click(); }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 7) { e.preventDefault(); addChord(n - 1); }
  };
  window.addEventListener('keydown', keydownListener);

  function mainLoop() {
    phase += .05;
    fall = fall.map((v) => v > 0 ? Math.min(1, v + 0.06) : v);
    render();
    loopRafId = requestAnimationFrame(mainLoop);
  }
  loopRafId = requestAnimationFrame(mainLoop);

  words();
  render();
}