const L = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B'];
const NAT = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
const SHAPES = {
  '4,7': { key: 'major', word: 'major', sky: 'sun', line: 'Bright as morning.', tidy: 15 },
  '3,7': { key: 'minor', word: 'minor', sky: 'moon', line: 'Soft as night.', tidy: 37 },
  '3,6': { key: 'dim', word: 'diminished', sky: 'fog', line: 'Foggy and unsettled.', tidy: 91 },
  '4,8': { key: 'aug', word: 'augmented', sky: 'dream', line: 'Floating, like a dream.', tidy: 61 },
};
const ALL = ['major', 'minor', 'dim', 'aug'];
const W = 1040, H = 440, X0 = 64, X1 = 976, SY = 252;
const px = (i) => X0 + (X1 - X0) * i / 12;
const SULLY_SIZE = 170;
const G1 = .52, G2 = 1.04, G3 = 1.6, END = 3.3;
const COAT = { root: '#F7F4ED', mid: '#F6C8C3', top: '#D9D0EC' };
const NAMES = { root: 'Sully', mid: 'Sis Sully', top: 'Baby Sully' };
const nameTag = (key) => `<span style="background:${COAT[key]};padding:1px 7px;border-radius:7px;border:1.5px solid #2B241D;font-weight:bold;white-space:nowrap;">${NAMES[key]}</span>`;

const SKY = {
  sun: { a: '#CFE7F5', b: '#F7E6BC', ground: '#8FBE68', paper: '#F7F1DF', up: '#B03A34', dn: '#4A3C86', ink: '#2B241D' },
  moon: { a: '#2B3C63', b: '#54689A', ground: '#334A3B', paper: '#E9E9F1', up: '#FFA79E', dn: '#CFC0F5', ink: '#F1EFE6' },
  fog: { a: '#B9BDBA', b: '#D9DCD8', ground: '#9BAE92', paper: '#EFEFEC', up: '#8C2F2A', dn: '#453874', ink: '#2B241D' },
  dream: { a: '#6B5B9A', b: '#B9A7DE', ground: '#6E6B98', paper: '#EFEAF6', up: '#FFCBC5', dn: '#F0E8FF', ink: '#F4F1FA' },
  none: { a: '#C5C7C2', b: '#DCDDD9', ground: '#A9B79E', paper: '#F1F0EB', up: '#B03A34', dn: '#4A3C86', ink: '#2B241D' },
};

let root = 0, mid = 4, hiG = 7, found = new Set(), busy = false, seq = -1, phase = 0;
let bop = [0, 0, 0], skiesSig = '';
let ctx = null, master = null, cue = [], progRAF = null;
let cuesRafId = null, loopRafId = null;
let timers = [];
let keydownListener = null;
let dragging = null;

const shape = () => SHAPES[`${mid},${hiG}`] || null;
const midi = (i) => 48 + root + i;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const nameAt = (i) => L[(root + i) % 12];
const sky = () => SKY[shape() ? shape().sky : 'none'];

export function stopBuildingChordsToy() {
  if (ctx) { ctx.close(); ctx = null; master = null; }
  if (cuesRafId !== null) { cancelAnimationFrame(cuesRafId); cuesRafId = null; }
  if (loopRafId !== null) { cancelAnimationFrame(loopRafId); loopRafId = null; }
  cancelAnimationFrame(progRAF);
  timers.forEach(clearTimeout);
  timers = [];
  if (keydownListener) {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
  root = 0; mid = 4; hiG = 7; found = new Set(); busy = false; seq = -1; phase = 0;
  bop = [0, 0, 0]; skiesSig = ''; cue = []; dragging = null;
}

export function renderBuildingChordsToy(container, config = {}) {
  stopBuildingChordsToy();

  container.innerHTML = `
<div id="ccApp">
  <div id="head">
    <h1>Sully's Choir</h1>
    <p>Three goats sing at once. Move ${nameTag('mid')} and watch the sky.</p>
  </div>

  <div id="stage">
    <svg id="board" viewBox="0 0 1040 440" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="gPale" cx="34%" cy="27%" r="72%">
          <stop offset="0" stop-color="#DAD5C8"/><stop offset="55%" stop-color="#ADA79A"/>
          <stop offset="100%" stop-color="#7E7669"/></radialGradient>
        <radialGradient id="gDark" cx="34%" cy="27%" r="72%">
          <stop offset="0" stop-color="#9F968A"/><stop offset="55%" stop-color="#78705F"/>
          <stop offset="100%" stop-color="#4E463A"/></radialGradient>
      </defs>
      <g id="gSky"></g><g id="gGround"></g><g id="gArcs"></g>
      <g id="gStones"></g><g id="gGoats"></g>
    </svg>
  </div>

  <div id="roots"><span class="rlbl">${nameTag('root')} sings</span><span id="rchips"></span></div>

  <div id="status">
    <div id="big"></div>
    <div id="sub"></div>
    <div id="skies"></div>
  </div>

  <div id="bar">
    <button class="big mid" id="mL">Sis Sully &larr;</button>
    <button class="big mid" id="mR">Sis Sully &rarr;</button>
    <button class="big" id="bListen">Listen again</button>
    <button class="big top" id="tL">Baby Sully &larr;</button>
    <button class="big top" id="tR">Baby Sully &rarr;</button>
    <button class="big" id="bNew">Start again</button>
  </div>
</div>`;

  const root_ = document.getElementById('ccApp');
  const $ = (i) => document.getElementById(i);
  const gSky = $('gSky'), gGround = $('gGround'), gArcs = $('gArcs'),
        gStones = $('gStones'), gGoats = $('gGoats');

  function drawSky(kind) {
    const s = SKY[kind];
    gSky.innerHTML = `<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${s.a}"/><stop offset="1" stop-color="${s.b}"/></linearGradient></defs>
      <rect width="${W}" height="200" fill="url(#sg)"/>`
      + (kind === 'sun'
          ? `<circle cx="880" cy="62" r="38" fill="#FFD86B" stroke="#2B241D" stroke-width="5"/>
             ${Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4;
               return `<line x1="${(880 + Math.cos(a) * 48).toFixed(1)}" y1="${(62 + Math.sin(a) * 48).toFixed(1)}"
                 x2="${(880 + Math.cos(a) * 62).toFixed(1)}" y2="${(62 + Math.sin(a) * 62).toFixed(1)}"
                 stroke="#FFD86B" stroke-width="6" stroke-linecap="round"/>`; }).join('')}`
        : kind === 'moon'
          ? `<circle cx="880" cy="60" r="34" fill="#F3EFD9" stroke="#2B241D" stroke-width="5"/>
             <circle cx="866" cy="52" r="30" fill="${s.a}"/>
             ${Array.from({ length: 22 }, (_, k) => { const x = 40 + ((k * 137) % 960), y = 20 + ((k * 79) % 150);
               const tw = (0.55 + 0.45 * Math.sin(phase * .6 + k)).toFixed(2);
               return `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" opacity="${tw}"/>`; }).join('')}`
        : kind === 'fog'
          ? Array.from({ length: 5 }, (_, k) => `<ellipse cx="${((k * 260 + phase * 14) % 1300) - 130}"
               cy="${60 + k * 30}" rx="180" ry="22" fill="#fff" opacity=".38"/>`).join('')
          : kind === 'dream'
          ? Array.from({ length: 14 }, (_, k) => { const x = 60 + ((k * 151) % 920);
              const y = 40 + ((k * 67) % 140) + Math.sin(phase * .5 + k) * 7;
              return `<circle cx="${x}" cy="${y.toFixed(1)}" r="${3 + (k % 3)}" fill="#fff" opacity=".55"/>`; }).join('')
          : '');
    gGround.innerHTML = `<rect y="196" width="${W}" height="${H - 196}" fill="${s.ground}"/>
      <rect y="196" width="${W}" height="7" fill="#fff" opacity=".18"/>`;
    root_.style.background = s.paper;
  }

  function sullySVG(x, y, coat, lift, idx, key) {
    const label = NAMES[key];
    const w = label.length * 7.3 + 16;
    return `<g transform="translate(${x.toFixed(1)},${(y - 84 - lift).toFixed(1)})">
        <rect x="${(-w / 2).toFixed(1)}" y="-19" width="${w.toFixed(1)}" height="27" rx="9" fill="${coat}"
          stroke="#2B241D" stroke-width="3.5"/>
        <text x="0" y="1" text-anchor="middle" font-weight="bold" font-size="13"
          font-family="Trebuchet MS,sans-serif" fill="#2B241D">${label}</text>
      </g>
      <g transform="translate(${x.toFixed(1)},${(y - lift).toFixed(1)}) scale(.42)">
      <ellipse cx="0" cy="10" rx="48" ry="10" fill="${coat}" opacity=".55"/>
      <ellipse cx="0" cy="10" rx="42" ry="7" fill="rgba(20,20,20,.22)"/>
      <image href="assets/images/node10/${idx}.png" width="${SULLY_SIZE}" height="${SULLY_SIZE}"
        x="${-SULLY_SIZE / 2}" y="${-SULLY_SIZE}"/>
    </g>`;
  }

  function render() {
    const sh = shape();
    drawSky(sh ? sh.sky : 'none');

    const SK = sky();
    gStones.innerHTML = Array.from({ length: 13 }, (_, i) => {
      const nat = NAT[(root + i) % 12], here = (i === 0 || i === mid || i === hiG);
      const r = nat ? 22 : 17, nm = nameAt(i);
      return `<ellipse cx="${(px(i) + 2).toFixed(1)}" cy="${SY + r * .45}" rx="${r * .94}" ry="${r * .3}"
          fill="rgba(20,20,20,.2)"/>
        <circle class="st" data-i="${i}" cx="${px(i).toFixed(1)}" cy="${SY}" r="${r}"
          fill="${nat ? 'url(#gPale)' : 'url(#gDark)'}" stroke="#2B241D" stroke-width="${here ? 5 : 3}"/>
        <text x="${px(i).toFixed(1)}" y="${(SY + (nat ? 7 : 5)).toFixed(1)}" text-anchor="middle"
          font-weight="bold" font-family="Trebuchet MS,sans-serif"
          font-size="${nat ? 17 : (nm.length > 1 ? 12 : 14)}"
          fill="${nat ? '#2B241D' : '#F7F1DF'}">${nm}</text>
        <text x="${px(i).toFixed(1)}" y="${SY + r + 17}" text-anchor="middle" font-size="12"
          fill="${SK.ink}" opacity=".65">${i}</text>`;
    }).join('');

    const arc = (i, y, up, col) => {
      const a = px(i), b = px(i + 1), m = (a + b) / 2, h = up ? -16 : 16;
      return `<path d="M${a.toFixed(1)} ${y} Q${m.toFixed(1)} ${(y + h * 1.7).toFixed(1)} ${b.toFixed(1)} ${y}"
          fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>
        <text x="${m.toFixed(1)}" y="${(y + (up ? -24 : 30)).toFixed(1)}" text-anchor="middle"
          font-size="13" font-weight="bold" fill="${col}">${i + 1}</text>`;
    };
    let a = '';
    const S = sky();
    for (let i = 0; i < mid; i++) a += arc(i, SY - 30, true, S.up);
    for (let i = 0; i < hiG; i++) a += arc(i, SY + 44, false, S.dn);
    gArcs.innerHTML = a;

    gGoats.innerHTML =
        sullySVG(px(0), SY - 16, COAT.root, bop[0] * 18, 1, 'root')
      + sullySVG(px(mid), SY - 16, COAT.mid, bop[1] * 18, 2, 'mid')
      + sullySVG(px(hiG), SY - 16, COAT.top, bop[2] * 18, 3, 'top');

    const notes = `${nameAt(0)} ${nameAt(mid)} ${nameAt(hiG)}`;
    $('big').innerHTML = sh
      ? `<b>${nameAt(0)} ${sh.word}</b>. ${sh.line}`
      : 'The Sullys look confused. Try another spot.';
    $('sub').innerHTML = `${notes}   \u00B7   ${nameTag('mid')} is ${mid} steps up, ${nameTag('top')} is ${hiG} steps up`;

    const sig = [...found].sort().join(',') + '|' + (shape() ? shape().key : '-');
    if (sig !== skiesSig) {
      skiesSig = sig;
      $('skies').innerHTML = ALL.map((k) => {
        const on = found.has(k);
        const shk = Object.values(SHAPES).find((v) => v.key === k);
        const hereK = shape() && shape().key === k;
        const col = { major: '#EFC03F', minor: '#54689A', dim: '#B9BDBA', aug: '#A99AD4' }[k];
        return `<span class="skwrap">
          <button class="sk" data-k="${k}" title="${shk.word}" aria-label="${shk.word}">
            <svg viewBox="0 0 40 40" width="100%" height="100%">
              <circle cx="20" cy="20" r="15" fill="${on ? col : '#DED9CC'}"
                stroke="#2B241D" stroke-width="${hereK ? 5 : 3.5}"/>
              ${on ? '' : `<text x="20" y="26" text-anchor="middle" font-size="17" font-weight="bold"
                font-family="Trebuchet MS,sans-serif" fill="#2B241D" opacity=".45">?</text>`}
            </svg></button>
          <span>${on ? shk.word : '\u00A0'}</span></span>`;
      }).join('');
      document.querySelectorAll('#ccApp .sk').forEach((btn) => {
        btn.onclick = () => {
          if (busy) return;
          const key = Object.keys(SHAPES).find((kk) => SHAPES[kk].key === btn.dataset.k).split(',');
          mid = +key[0]; hiG = +key[1];
          render(); listen();
        };
      });
    }
    document.querySelectorAll('#ccApp .sk').forEach((b) => b.disabled = busy);
    document.querySelectorAll('#ccApp .rc').forEach((c) => {
      c.classList.toggle('sel', +c.dataset.i === root); c.disabled = busy;
    });
    $('mL').disabled = busy || mid <= 1; $('mR').disabled = busy || mid >= hiG - 1;
    $('tL').disabled = busy || hiG <= mid + 1; $('tR').disabled = busy || hiG >= 12;
  }

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .26; master.connect(ctx.destination);
    const n = Math.floor(ctx.sampleRate * 1.3), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const a = b.getChannelData(c);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.7);
    }
    const rv = ctx.createConvolver(); rv.buffer = b;
    const w = ctx.createGain(); w.gain.value = .17; rv.connect(w); w.connect(ctx.destination);
    master.connect(rv);
  }
  const P = [[1, 1, 1], [2, .44, .7], [3, .24, .54], [4, .14, .43], [5, .08, .35], [6, .05, .29]];
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
    });
  }
  function lockFor(btn, secs) {
    busy = true; render();
    const t0 = performance.now();
    if (btn) btn.classList.add('loading');
    cancelAnimationFrame(progRAF);
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
      if (btn) btn.style.setProperty('--prog', k.toFixed(3));
      if (k < 1) progRAF = requestAnimationFrame(step);
      else {
        if (btn) { btn.classList.remove('loading'); btn.style.removeProperty('--prog'); }
        busy = false; seq = -1; render();
      }
    })();
  }

  function listen(btn) {
    if (busy) return;
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + .05;
    tone(midi(0), t, 1.2, .85);
    tone(midi(mid), t + G1, 1.2, .85);
    tone(midi(hiG), t + G2, 1.2, .85);
    tone(midi(0), t + G3, 2.1, .75);
    tone(midi(mid), t + G3, 2.1, .75);
    tone(midi(hiG), t + G3, 2.1, .75);
    cue = [{ t: t, s: 0 }, { t: t + G1, s: 1 }, { t: t + G2, s: 2 }, { t: t + G3, s: 3 }, { t: t + END - .3, s: -1 }];
    const sh = shape();
    if (sh && !found.has(sh.key)) timers.push(setTimeout(() => { found.add(sh.key); render(); }, G3 * 1000));
    lockFor(btn || $('bListen'), END);
  }

  function cuesLoop() {
    if (ctx && cue.length) {
      const now = ctx.currentTime;
      while (cue.length && cue[0].t <= now) {
        seq = cue.shift().s;
        if (seq === 0) bop[0] = 1;
        else if (seq === 1) bop[1] = 1;
        else if (seq === 2) bop[2] = 1;
        else if (seq === 3) bop = [1, 1, 1];
      }
    }
    cuesRafId = requestAnimationFrame(cuesLoop);
  }
  cuesRafId = requestAnimationFrame(cuesLoop);

  $('rchips').innerHTML = L.map((n, i) =>
    `<button class="rc ${NAT[i] ? '' : 'acc'}" data-i="${i}">${n}</button>`).join('');
  document.querySelectorAll('#ccApp .rc').forEach((c) => c.onclick = () => {
    if (busy) return; root = +c.dataset.i; render(); listen();
  });

  const setMid = (v) => { if (busy) return; mid = Math.max(1, Math.min(hiG - 1, v)); render(); listen(); };
  const setTop = (v) => { if (busy) return; hiG = Math.max(mid + 1, Math.min(12, v)); render(); listen(); };
  $('mL').onclick = () => setMid(mid - 1); $('mR').onclick = () => setMid(mid + 1);
  $('tL').onclick = () => setTop(hiG - 1); $('tR').onclick = () => setTop(hiG + 1);
  $('bListen').onclick = (e) => listen(e.currentTarget);
  $('bNew').onclick = () => { if (busy) return; root = 0; mid = 4; hiG = 7; found.clear(); render(); };

  const board = $('board');
  function stoneAt(e) {
    const p = board.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const X = p.matrixTransform(board.getScreenCTM().inverse()).x;
    return Math.round((X - X0) / (X1 - X0) * 12);
  }
  board.addEventListener('pointerdown', (e) => {
    if (busy) return;
    const i = stoneAt(e);
    dragging = Math.abs(i - mid) <= Math.abs(i - hiG) ? 'mid' : 'high';
    board.setPointerCapture(e.pointerId);
    if (dragging === 'mid') mid = Math.max(1, Math.min(hiG - 1, i)); else hiG = Math.max(mid + 1, Math.min(12, i));
    render();
  });
  board.addEventListener('pointermove', (e) => {
    if (!dragging || busy) return;
    const i = stoneAt(e);
    if (dragging === 'mid') mid = Math.max(1, Math.min(hiG - 1, i)); else hiG = Math.max(mid + 1, Math.min(12, i));
    render();
  });
  board.addEventListener('pointerup', () => { if (dragging) { dragging = null; if (!busy) listen(); } });

  keydownListener = (e) => {
    if (busy) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setMid(mid - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setMid(mid + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setTop(hiG - 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setTop(hiG + 1); }
    if (e.key === ' ') { e.preventDefault(); listen(); }
  };
  window.addEventListener('keydown', keydownListener);

  function mainLoop() {
    phase += .05;
    bop = bop.map((v) => v * 0.90);
    render();
    loopRafId = requestAnimationFrame(mainLoop);
  }
  loopRafId = requestAnimationFrame(mainLoop);

  render();
}