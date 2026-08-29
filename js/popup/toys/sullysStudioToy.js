/* engine (data model + pure playback)*/
const SONG_V = 2;
const SCALES = { sunny: [0, 2, 4, 5, 7, 9, 11], misty: [0, 2, 3, 5, 7, 8, 10], open: [0, 2, 4, 7, 9] };
const VEL = [0.35, 0.65, 0.95];
const BUSH = [0, 2, 4];

function blank() {
  return {
    v: SONG_V,
    name: 'My song',
    seed: (Math.random() * 2 ** 32) >>> 0,
    room: 1,
    key: 0,
    weather: 'sunny',
    tempo: 104,
    steps: 16,
    subdiv: 4,
    terrain: 'grass',
    melody: [],
    drums: [],
    presetsApplied: [],
  };
}
const scaleOf = (s) => SCALES[s.weather];
const midiOf = (s, deg) => {
  const sc = scaleOf(s), n = sc.length;
  return 48 + s.key + sc[((deg % n) + n) % n] + 12 * Math.floor(deg / n);
};
const stepSecs = (s) => 60 / s.tempo / s.subdiv;
const songSecs = (s) => s.steps * stepSecs(s);

function rows(lowSteps, highSteps) {
  return [...lowSteps.map((step) => ({ step, row: 0 })), ...highSteps.map((step) => ({ step, row: 1 }))];
}
function notesFrom(pairs) {
  return pairs.map(([step, deg]) => ({ step, deg, len: 1, vel: 1 }));
}
const PRESETS = {
  1: { drums: rows([0, 4, 8, 12], [4, 12]) },
  2: { melody: notesFrom([[0, 4], [3, 2], [6, 4], [8, 5], [12, 4]]) },
  3: { bushes: [0, 8] },
  4: { double: true },
};

function addNote(song, step, deg, len = 1, vel = 1) {
  song.melody = song.melody.filter((n) => !(n.step === step && n.deg === deg));
  song.melody.push({ step, deg, len, vel });
}
function addBush(song, step, rootDeg) {
  BUSH.forEach((k) => addNote(song, step, rootDeg + k));
}

function applyPreset(song, n) {
  if (song.presetsApplied.includes(n)) return;
  song.presetsApplied.push(n);
  const p = PRESETS[n];
  if (!p) return;
  if (p.drums) p.drums.forEach((d) => {
    if (!song.drums.some((e) => e.step === d.step && e.row === d.row)) song.drums.push({ ...d });
  });
  if (p.melody) p.melody.forEach((m) => {
    if (!song.melody.some((e) => e.step === m.step && e.deg === m.deg)) song.melody.push({ ...m });
  });
  if (p.bushes) p.bushes.forEach((step) => addBush(song, step, 0));
  if (p.double) {
    song.steps = 32;
    const shift = (arr) => arr.filter((e) => e.step < 16).map((e) => ({ ...e, step: e.step + 16 }));
    song.melody.push(...shift(song.melody));
    song.drums.push(...shift(song.drums));
  }
}

function buildGraph(ctx) {
  const master = ctx.createGain(); master.gain.value = 0.3; master.connect(ctx.destination);
  const n = Math.floor(ctx.sampleRate * 1.3);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const a = buf.getChannelData(c);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.7);
  }
  const rev = ctx.createConvolver(); rev.buffer = buf;
  const w = ctx.createGain(); w.gain.value = 0.15; rev.connect(w); w.connect(ctx.destination);
  master.connect(rev);
  return master;
}
const PARTIALS = [[1, 1, 1], [2, .42, .7], [3, .23, .54], [4, .13, .43], [5, .07, .35], [6, .045, .29]];
function playNote(ctx, dest, terrain, midi, when, dur, vel) {
  const f0 = 440 * Math.pow(2, (midi - 69) / 12), br = Math.pow(261.6 / f0, .45);
  const vg = ctx.createGain(); vg.gain.value = .32 * vel; vg.connect(dest);
  PARTIALS.forEach(([h, lv, dk]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0 * h * (1 + .0004 * h * h), when);
    g.gain.setValueAtTime(.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(lv * .5, .0008), when + .005);
    g.gain.exponentialRampToValueAtTime(.0001, when + dur * dk * br + .05);
    o.connect(g); g.connect(vg); o.start(when); o.stop(when + dur + .4);
  });
}
function playDrum(ctx, dest, row, when) {
  if (row === 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    g.gain.setValueAtTime(0.9, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
    o.connect(g); g.connect(dest); o.start(when); o.stop(when + 0.3);
  } else {
    const n = Math.floor(ctx.sampleRate * 0.2), buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1500; filt.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.7, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
    src.connect(filt); filt.connect(g); g.connect(dest); src.start(when);
  }
}
function scheduleSong(ctx, dest, s, t0, from = 0, to = Infinity) {
  const dt = stepSecs(s);
  for (const n of s.melody)
    if (n.step >= from && n.step < to)
      playNote(ctx, dest, s.terrain, midiOf(s, n.deg), t0 + (n.step - from) * dt, Math.max(n.len, 1) * dt * 0.94, VEL[n.vel]);
  for (const d of s.drums)
    if (d.step >= from && d.step < to)
      playDrum(ctx, dest, d.row, t0 + (d.step - from) * dt);
}

/* take it home (WAV export)  */
function encodeWav(buffer) {
  const numCh = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length;
  const blockAlign = numCh * 2, dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data'); view.setUint32(40, dataSize, true);
  const chans = []; for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let v = Math.max(-1, Math.min(1, chans[c][i]));
      v = v < 0 ? v * 0x8000 : v * 0x7fff;
      view.setInt16(off, v, true); off += 2;
    }
  }
  return ab;
}
async function renderWav(s, loopToSecs) {
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const sr = 44100;
  const oneLoopSecs = songSecs(s);
  const totalSecs = loopToSecs || (oneLoopSecs + 2.2);
  const off = new OC(2, Math.ceil(totalSecs * sr), sr);
  const dest = buildGraph(off);
  if (loopToSecs) {
    for (let t0 = 0; t0 < loopToSecs; t0 += oneLoopSecs) {
      scheduleSong(off, dest, s, t0);
    }
  } else {
    scheduleSong(off, dest, s, 0);
  }
  const rendered = await off.startRendering();
  return encodeWav(rendered);
}

/* rooms*/
const ROOMS = {
  1: { title: 'The Drum Hut', pitchRows: 0, buttons: ['play'],
       lines: ['Tap the squares.', 'Sully plays them over and over.'] },
  2: { title: 'The Singing Hut', pitchRows: 7, buttons: ['play'],
       lines: ['Now Sully can sing.', 'Higher up the wall, higher the sound.'] },
  3: { title: 'The Chord Hut', pitchRows: 7, buttons: ['play', 'bush'],
       lines: ['A bush is three notes at once.', 'Tap Bush, then tap the wall to plant one.'] },
  4: { title: 'The Song Hut', pitchRows: 7, buttons: ['play', 'bush', 'weather', 'shelf', 'length', 'home'],
       lines: ['Your song can be twice as long.', 'Keep it, or take it home.'] },
};
const LENGTH_OPTIONS = [15, 30, 45, 60];
const WEATHER_ORDER = ['sunny', 'misty', 'open'];
const WEATHER_LABEL = { sunny: 'Sunny', misty: 'Misty', open: 'Open' };

/*  undo */
const MAX_HIST = 50;
function snapshotContent(s) {
  return {
    key: s.key, weather: s.weather, tempo: s.tempo, steps: s.steps, subdiv: s.subdiv, terrain: s.terrain,
    melody: s.melody.map((n) => ({ ...n })), drums: s.drums.map((d) => ({ ...d })),
  };
}
function applySnapshot(s, snap) {
  s.key = snap.key; s.weather = snap.weather; s.tempo = snap.tempo;
  s.steps = snap.steps; s.subdiv = snap.subdiv; s.terrain = snap.terrain;
  s.melody = snap.melody.map((n) => ({ ...n }));
  s.drums = snap.drums.map((d) => ({ ...d }));
}

/* the shelf */
const SHELF_KEY = 'sully.songs.v2';
let memoryShelf = [];
function canStoreCheck() {
  try { localStorage.setItem('__ss_t', '1'); localStorage.removeItem('__ss_t'); return true; }
  catch { return false; }
}
function loadShelf() {
  if (!canStoreCheck()) return memoryShelf;
  try { const raw = localStorage.getItem(SHELF_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return memoryShelf; }
}
function saveShelf(list) {
  if (!canStoreCheck()) { memoryShelf = list; return false; }
  try { localStorage.setItem(SHELF_KEY, JSON.stringify(list)); return true; }
  catch { memoryShelf = list; return false; }
}

/* module state */
let song = null;
let ctx = null, master = null;
let tickTimer = null, rafId = null, roId = null;
let nextT = 0, curStep = 0, playing = false, visual = [], curVisualStep = -1;
let bushMode = false;
let CW = 0, CH = 0, cellW = 0, cellH = 0, totalRows = 0;
let hist = [], hp = -1, roomEntryHp = 0;
let dragInfo = null;
const PAD = 6;

export function stopSullysStudioToy() {
  playing = false;
  if (ctx) { ctx.close(); ctx = null; master = null; }
  if (tickTimer !== null) { clearTimeout(tickTimer); tickTimer = null; }
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  if (roId !== null) { roId.disconnect(); roId = null; }
  song = null;
  bushMode = false;
  visual = []; curVisualStep = -1;
  curStep = 0; nextT = 0;
  CW = 0; CH = 0; cellW = 0; cellH = 0; totalRows = 0;
  hist = []; hp = -1; roomEntryHp = 0;
  dragInfo = null;
}

export function renderSullysStudioToy(container, config = {}) {
  stopSullysStudioToy();
  song = blank();
  applyPreset(song, 1);

  container.innerHTML = `
<div id="ssApp">
  <div id="head">
    <h1 id="roomTitle"></h1>
    <span id="roomBadge"></span>
    <p id="roomLines"></p>
  </div>
  <div id="stage">
    <canvas id="grid"></canvas>
    <div id="shelfPanel" class="hidden">
      <div id="shelfHeader">
        <span id="shelfTitle">The Shelf</span>
        <button class="big" id="bShelfSave">Save this song</button>
        <span id="shelfMsg"></span>
      </div>
      <div id="shelfJars"></div>
    </div>
  </div>
  <div id="bar">
    <button class="nav" id="bPrev" aria-label="Previous room">&larr;</button>
    <button class="big" id="bPlay">Off you go, Sully!</button>
    <button class="big" id="bOops">Oops</button>
    <button class="big" id="bBush">Bush</button>
    <button class="big" id="bWeather">Sunny</button>
    <button class="big" id="bShelf">The Shelf</button>
    <label class="big length-label" id="bLengthWrap" for="bLength">Length
      <select id="bLength" aria-label="How long should the download be?">
        ${LENGTH_OPTIONS.map((n) => `<option value="${n}"${n === 30 ? ' selected' : ''}>${n}s</option>`).join('')}
      </select>
    </label>
    <button class="big" id="bHome">Take it home</button>
    <button class="nav" id="bNext" aria-label="Next room">&rarr;</button>
  </div>
</div>`;

  const $ = (i) => document.getElementById(i);
  const canvas = $('grid');
  const gctx = canvas.getContext('2d');
  const stageEl = $('stage');

  function degForRow(row) { return (ROOMS[song.room].pitchRows - 1) - row; }
  function isDrumRow(row) { return row >= ROOMS[song.room].pitchRows; }
  function drumRowIndex(row) { return row - ROOMS[song.room].pitchRows; }

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = buildGraph(ctx);
  }

  function layout() {
    const rect = stageEl.getBoundingClientRect();
    const cs = getComputedStyle(stageEl);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    CW = Math.max(0, Math.floor(rect.width - padX));
    CH = Math.max(0, Math.floor(rect.height - padY));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(CW * dpr);
    canvas.height = Math.round(CH * dpr);
    canvas.style.width = CW + 'px';
    canvas.style.height = CH + 'px';
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    totalRows = ROOMS[song.room].pitchRows + 2;
    cellW = song.steps ? (CW - PAD * 2) / song.steps : 0;
    cellH = totalRows ? (CH - PAD * 2) / totalRows : 0;
  }

  function rr(x, y, w, h, r) {
    w = Math.max(1, w); h = Math.max(1, h);
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    gctx.beginPath();
    gctx.moveTo(x + r, y);
    gctx.arcTo(x + w, y, x + w, y + h, r);
    gctx.arcTo(x + w, y + h, x, y + h, r);
    gctx.arcTo(x, y + h, x, y, r);
    gctx.arcTo(x, y, x + w, y, r);
    gctx.closePath();
  }

  const NOTE_COLORS = ['#BFE0AE', '#EFC03F', '#D8524B'];

  function draw() {
    if (!CW || !CH || cellW <= 0 || cellH <= 0) return;
    gctx.clearRect(0, 0, CW, CH);

    for (let col = 0; col < song.steps; col++) {
      const beatIdx = Math.floor(col / song.subdiv);
      gctx.fillStyle = beatIdx % 2 === 0 ? 'rgba(255,255,255,.4)' : 'rgba(43,36,29,.04)';
      gctx.fillRect(PAD + col * cellW, PAD, cellW, totalRows * cellH);
    }

    gctx.strokeStyle = 'rgba(43,36,29,.14)';
    gctx.lineWidth = 1;
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < song.steps; col++) {
        rr(PAD + col * cellW + 1, PAD + row * cellH + 1, cellW - 2, cellH - 2, 4);
        gctx.stroke();
      }
    }

    const drumStart = ROOMS[song.room].pitchRows;
    song.melody.forEach((n) => {
      const row = (drumStart - 1) - n.deg;
      if (row < 0 || row >= drumStart) return;
      const x = PAD + n.step * cellW, y = PAD + row * cellH;
      const w = cellW * Math.max(n.len, 1) - 3;
      gctx.fillStyle = NOTE_COLORS[n.vel] ?? NOTE_COLORS[1];
      rr(x + 1.5, y + 1.5, w, cellH - 3, 5);
      gctx.fill();
      gctx.strokeStyle = '#2B241D'; gctx.lineWidth = 2; gctx.stroke();
    });
    song.drums.forEach((d) => {
      const row = drumStart + d.row;
      const x = PAD + d.step * cellW, y = PAD + row * cellH;
      gctx.fillStyle = d.row === 0 ? '#8F6C4D' : '#7C6BAF';
      rr(x + 1.5, y + 1.5, cellW - 3, cellH - 3, 5);
      gctx.fill();
      gctx.strokeStyle = '#2B241D'; gctx.lineWidth = 2; gctx.stroke();
    });

    if (playing && curVisualStep >= 0) {
      gctx.fillStyle = 'rgba(239,192,63,.32)';
      gctx.fillRect(PAD + curVisualStep * cellW, PAD, cellW, totalRows * cellH);
    }
  }

  function commit() {
    hist.splice(hp + 1);
    hist.push(snapshotContent(song));
    if (hist.length > MAX_HIST) hist.shift();
    hp = hist.length - 1;
    updateOopsButton();
  }
  function undo() {
    if (hp <= roomEntryHp) return false;
    hp--;
    applySnapshot(song, hist[hp]);
    updateOopsButton();
    return true;
  }
  function updateOopsButton() { $('bOops').disabled = hp <= roomEntryHp; }

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    return { col: Math.floor((x - PAD) / cellW), row: Math.floor((y - PAD) / cellH) };
  }

  function onPointerDown(e) {
    if (!cellW || !cellH) return;
    const { col, row } = cellFromEvent(e);
    if (col < 0 || col >= song.steps || row < 0 || row >= totalRows) return;

    ensure(); if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;

    if (isDrumRow(row)) {
      const dr = drumRowIndex(row);
      const idx = song.drums.findIndex((d) => d.step === col && d.row === dr);
      if (idx >= 0) song.drums.splice(idx, 1);
      else { song.drums.push({ step: col, row: dr }); playDrum(ctx, master, dr, t); }
      commit();
    } else {
      const deg = degForRow(row);
      if (bushMode) {
        addBush(song, col, deg);
        bushMode = false;
        updateBushButton();
        BUSH.forEach((k) => playNote(ctx, master, song.terrain, midiOf(song, deg + k), t, stepSecs(song) * 0.94, VEL[1]));
        commit();
      } else {
        const existing = song.melody.find((n) => n.step === col && n.deg === deg);
        let remaining = null;
        if (!existing) {
          addNote(song, col, deg, 1, 0);
          playNote(ctx, master, song.terrain, midiOf(song, deg), t, stepSecs(song) * 0.94, VEL[0]);
          remaining = song.melody.find((n) => n.step === col && n.deg === deg);
        } else if (existing.vel < 2) {
          existing.vel += 1;
          playNote(ctx, master, song.terrain, midiOf(song, deg), t, stepSecs(song) * 0.94, VEL[existing.vel]);
          remaining = existing;
        } else {
          song.melody = song.melody.filter((n) => n !== existing);
        }
        commit();
        if (remaining) {
          canvas.setPointerCapture(e.pointerId);
          dragInfo = { row, deg, step: col, startLen: remaining.len };
        } else {
          dragInfo = null;
        }
      }
    }
    draw();
  }
  function onPointerMove(e) {
    if (!dragInfo) return;
    const { col, row } = cellFromEvent(e);
    if (row !== dragInfo.row) return;
    const note = song.melody.find((n) => n.step === dragInfo.step && n.deg === dragInfo.deg);
    if (!note) { dragInfo = null; return; }
    const newLen = Math.max(1, Math.min(song.steps - dragInfo.step, col - dragInfo.step + 1));
    if (newLen !== note.len) { note.len = newLen; draw(); }
  }
  function onPointerUp() {
    if (dragInfo) {
      const note = song.melody.find((n) => n.step === dragInfo.step && n.deg === dragInfo.deg);
      if (note && note.len !== dragInfo.startLen) commit();
      dragInfo = null;
    }
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  $('bOops').onclick = () => {
    if (undo()) {
      $('bWeather').textContent = WEATHER_LABEL[song.weather];
      layout(); draw();
    }
  };

  function tick() {
    const dt = stepSecs(song);
    while (nextT < ctx.currentTime + 0.12) {
      scheduleSong(ctx, master, song, nextT, curStep, curStep + 1);
      visual.push({ t: nextT, step: curStep });
      curStep = (curStep + 1) % song.steps;
      nextT += dt;
    }
    tickTimer = setTimeout(tick, 25);
  }
  function drawLoop() {
    const now = ctx ? ctx.currentTime : 0;
    while (visual.length && visual[0].t <= now) curVisualStep = visual.shift().step;
    draw();
    if (playing) rafId = requestAnimationFrame(drawLoop);
  }
  function startTransport() {
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    playing = true; curStep = 0; visual = []; curVisualStep = -1;
    nextT = ctx.currentTime + 0.06;
    tick();
    rafId = requestAnimationFrame(drawLoop);
    $('bPlay').textContent = 'Stop';
  }
  function stopTransport() {
    playing = false;
    if (tickTimer !== null) { clearTimeout(tickTimer); tickTimer = null; }
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    visual = []; curVisualStep = -1;
    $('bPlay').textContent = 'Off you go, Sully!';
    draw();
  }
  $('bPlay').onclick = () => { if (playing) stopTransport(); else startTransport(); };

  function updateBushButton() {
    $('bBush').classList.toggle('on', bushMode);
    $('bBush').textContent = bushMode ? 'Tap the wall…' : 'Bush';
  }
  $('bBush').onclick = () => { bushMode = !bushMode; updateBushButton(); };

  $('bWeather').onclick = () => {
    const i = WEATHER_ORDER.indexOf(song.weather);
    song.weather = WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length];
    $('bWeather').textContent = WEATHER_LABEL[song.weather];
    commit();
    draw();
  };

  function renderShelf() {
    const list = loadShelf();
    $('shelfJars').innerHTML = list.length ? list.map((e) => {
      const col = { sunny: '#EFC03F', misty: '#7C6BAF', open: '#3C87B5' }[e.weather] || '#EFC03F';
      return `<button class="jar" data-seed="${e.seed}" style="--jar-col:${col}">
        <span class="jar-code">${e.seed.toString(36)}</span>
      </button>`;
    }).join('') : '<p id="shelfEmpty">Nothing saved yet.</p>';
    document.querySelectorAll('#ssApp .jar').forEach((btn) => {
      btn.onclick = () => {
        const entry = loadShelf().find((e) => String(e.seed) === btn.dataset.seed);
        if (!entry) return;
        song.weather = entry.weather; song.key = entry.key; song.tempo = entry.tempo;
        song.steps = entry.steps; song.subdiv = entry.subdiv; song.terrain = entry.terrain;
        song.melody = entry.melody.map((n) => ({ ...n }));
        song.drums = entry.drums.map((d) => ({ ...d }));
        song.seed = entry.seed;
        commit();
        $('bWeather').textContent = WEATHER_LABEL[song.weather];
        layout(); draw();
        $('shelfMsg').textContent = 'Loaded!';
      };
    });
  }
  function saveCurrentSong() {
    const list = loadShelf();
    const entry = {
      seed: song.seed, name: song.name, weather: song.weather, key: song.key, tempo: song.tempo,
      steps: song.steps, subdiv: song.subdiv, terrain: song.terrain,
      melody: song.melody.map((n) => ({ ...n })), drums: song.drums.map((d) => ({ ...d })),
      savedAt: Date.now(),
    };
    const idx = list.findIndex((e) => e.seed === song.seed);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    return saveShelf(list);
  }
  $('bShelf').onclick = () => {
    const panel = $('shelfPanel');
    const willShow = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willShow);
    if (willShow) renderShelf();
  };
  $('bShelfSave').onclick = () => {
    const ok = saveCurrentSong();
    $('shelfMsg').textContent = ok
      ? `Saved! Code: ${song.seed.toString(36)}`
      : 'Could not save on this device — take it home instead.';
    renderShelf();
  };

  $('bHome').onclick = async () => {
    const btn = $('bHome');
    if (btn.disabled) return;
    btn.disabled = true;
    const before = btn.textContent;
    btn.textContent = 'Wrapping it up…';
    try {
      const loopToSecs = Number($('bLength').value);
      const wavBuf = await renderWav(song, loopToSecs);
      const blob = new Blob([wavBuf], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sullys-song-${song.seed.toString(36)}-${loopToSecs}s.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      btn.textContent = 'Could not make it — try again';
      setTimeout(() => { btn.textContent = before; btn.disabled = false; }, 1600);
      return;
    }
    btn.textContent = before;
    btn.disabled = false;
  };

  function renderChrome() {
    const room = ROOMS[song.room];
    $('roomTitle').textContent = room.title;
    $('roomBadge').textContent = `room ${song.room} of 4`;
    $('roomLines').innerHTML = room.lines.join('<br>');
    ['bBush', 'bWeather', 'bShelf', 'bLengthWrap', 'bHome'].forEach((id) => {
      const key = { bBush: 'bush', bWeather: 'weather', bShelf: 'shelf', bLengthWrap: 'length', bHome: 'home' }[id];
      $(id).classList.toggle('hidden', !room.buttons.includes(key));
    });
    $('bWeather').textContent = WEATHER_LABEL[song.weather];
    $('bPrev').disabled = song.room <= 1;
    $('bNext').disabled = song.room >= 4;
    bushMode = false;
    updateBushButton();
    updateOopsButton();
    $('shelfPanel').classList.add('hidden');
  }

  function enterRoom(n) {
    n = Math.max(1, Math.min(4, n));
    stopTransport();
    song.room = n;
    applyPreset(song, n);
    commit();
    roomEntryHp = hp;
    layout();
    renderChrome();
    draw();
  }
  $('bPrev').onclick = () => enterRoom(song.room - 1);
  $('bNext').onclick = () => enterRoom(song.room + 1);

  roId = new ResizeObserver(() => { layout(); draw(); });
  roId.observe(stageEl);

  layout();
  renderChrome();
  draw();
  commit();
  roomEntryHp = hp;
}
