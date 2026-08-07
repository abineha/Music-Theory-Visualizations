import { playInstrumentNote } from '../../core/audioEngine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const SEMIS = [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0];
const NAMES = ['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti', 'Do', 'Ti', 'La', 'So', 'Fa', 'Mi', 'Re', 'Do'];
const XS = [60, 133.3, 206.7, 243.3, 316.7, 390, 463.3, 500, 536.7, 610, 683.3, 756.7, 793.3, 866.7, 940];
const YS = [500, 431.7, 363.3, 329.2, 260.8, 192.5, 124.2, 90, 124.2, 192.5, 260.8, 329.2, 363.3, 431.7, 500];
const N = SEMIS.length;
const SCALE_SEMIS = [0, 2, 4, 5, 7, 9, 11, 12];
const CHROMATIC_NOTES = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'];
const BASE_F = 261.63; // C4

const AUTO_CLIMB_STEP_MS = 340;

function noteForSemitone(semi) {
  return CHROMATIC_NOTES[semi];
}
function freq(i) {
  return BASE_F * Math.pow(2, SEMIS[i] / 12);
}
function playNote(i) {
  playInstrumentNote(noteForSemitone(SEMIS[i]), 0.8);
}

function halfWidth(i) {
  const gapL = i > 0 ? Math.abs(SEMIS[i] - SEMIS[i - 1]) : 2;
  const gapR = i < N - 1 ? Math.abs(SEMIS[i + 1] - SEMIS[i]) : 2;
  return { l: gapL === 1 ? 15 : 30, r: gapR === 1 ? 15 : 30 };
}

let idx = 0;
let facing = false; // false = facing right (climbing), true = facing left (descending)
let numbersShown = false;
let pendingTimeouts = [];
let keydownListener = null;

export function stopMountainToy() {
  pendingTimeouts.forEach((id) => clearTimeout(id));
  pendingTimeouts = [];
  if (keydownListener) {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
  idx = 0;
  facing = false;
  numbersShown = false;
}

export function renderMountainToy(container, config = {}) {
  stopMountainToy();

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'mountain-toy';

  const climbPanel = document.createElement('div');
  climbPanel.className = 'mountain-toy__climb-panel';
  wrapper.appendChild(climbPanel);

  const mountainBox = document.createElement('div');
  mountainBox.className = 'beat-toy__graph-box mountain-toy__mountain-box';
  climbPanel.appendChild(mountainBox);

  const mtnSvg = document.createElementNS(SVG_NS, 'svg');
  mtnSvg.setAttribute('viewBox', '0 0 1000 760');
  mtnSvg.setAttribute('class', 'mountain-toy__mountain-svg');
  mtnSvg.setAttribute('role', 'img');
  mtnSvg.setAttribute('aria-label', 'A mountain made of musical notes');
 mtnSvg.innerHTML = `
    <defs>
      <linearGradient id="mtnSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#CFE7F5"/><stop offset="1" stop-color="#E8F3E2"/>
      </linearGradient>
      <linearGradient id="mtnRock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#B8BFC4"/><stop offset="1" stop-color="#8C989F"/>
      </linearGradient>
      <clipPath id="mtnPeakClip">
        <polygon points="60,500 133.3,431.7 206.7,363.3 243.3,329.2 316.7,260.8 390,192.5 463.3,124.2 500,90 536.7,124.2 610,192.5 683.3,260.8 756.7,329.2 793.3,363.3 866.7,431.7 940,500 940,600 60,600"/>
      </clipPath>
    </defs>
    <rect width="1000" height="760" fill="url(#mtnSky)"/>
    <ellipse cx="175" cy="86" rx="56" ry="23" fill="#fff" opacity=".7"/>
    <ellipse cx="216" cy="76" rx="38" ry="19" fill="#fff" opacity=".7"/>
    <ellipse cx="828" cy="126" rx="50" ry="20" fill="#fff" opacity=".6"/>
    <polygon fill="url(#mtnRock)" stroke="#6b5d52" stroke-width="6" stroke-linejoin="round"
      points="20,760 60,500 133.3,431.7 206.7,363.3 243.3,329.2 316.7,260.8 390,192.5 463.3,124.2 500,90 536.7,124.2 610,192.5 683.3,260.8 756.7,329.2 793.3,363.3 866.7,431.7 940,500 980,760"/>
    <g clip-path="url(#mtnPeakClip)">
      <polygon fill="#F6FAFB" opacity=".95"
        points="408,190 463.3,124.2 500,90 536.7,124.2 592,190 556,182 530,196 500,176 470,196 444,182"/>
    </g>
    <polygon fill="#000" opacity=".08"
      points="500,90 536.7,124.2 610,192.5 683.3,260.8 756.7,329.2 793.3,363.3 866.7,431.7 940,500 980,760 500,760"/>
    <g id="mtnLedges"></g>
    <g id="mtnLabels"></g>
    <g id="mtnFlag"></g>
    <g id="mtnSully"></g>
  `;
  mountainBox.appendChild(mtnSvg);

  const ledgeG = mtnSvg.querySelector('#mtnLedges');
  const labelG = mtnSvg.querySelector('#mtnLabels');
  const flagG = mtnSvg.querySelector('#mtnFlag');
  const sullyG = mtnSvg.querySelector('#mtnSully');

  const noteLabels = [];
  NAMES.forEach((nm, i) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'mountain-toy__ledge');
    const hw = halfWidth(i);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(XS[i] - hw.l));
    rect.setAttribute('y', String(YS[i] - 8));
    rect.setAttribute('width', String(hw.l + hw.r));
    rect.setAttribute('height', '15');
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', i % 2 ? '#857D6F' : '#A8A194');
    rect.setAttribute('stroke', '#6b5d52');
    rect.setAttribute('stroke-width', '3.5');
    g.appendChild(rect);
    g.addEventListener('click', () => go(i));
    ledgeG.appendChild(g);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', 'mountain-toy__note-label');
    text.setAttribute('x', String(XS[i]));
    text.setAttribute('y', String(YS[i] - 26));
    text.textContent = nm;
    labelG.appendChild(text);
    noteLabels.push(text);
  });

  flagG.innerHTML = `<g transform="translate(${XS[7] + 6},${YS[7] - 96})">
    <rect x="0" y="0" width="6" height="88" rx="3" fill="#8F6C4D" stroke="#6b5d52" stroke-width="2.5"/>
    <path d="M6 4 L58 20 L6 34 Z" fill="#d99c8a" stroke="#6b5d52" stroke-width="4" stroke-linejoin="round"/>
  </g>`;

  const SULLY_SIZE = 74;
  function drawSully() {
    const f = facing ? -1 : 1;
    sullyG.innerHTML = '';
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${XS[idx]},${YS[idx] - 8}) scale(${f},1)`);
    const img = document.createElementNS(SVG_NS, 'image');
    img.setAttribute('href', 'assets/images/goat/goat_r_1.png');
    img.setAttribute('width', String(SULLY_SIZE));
    img.setAttribute('height', String(SULLY_SIZE));
    img.setAttribute('x', String(-SULLY_SIZE / 2));
    img.setAttribute('y', String(-SULLY_SIZE));
    g.appendChild(img);
    sullyG.appendChild(g);

    const baseX = XS[idx], baseY = YS[idx] - 8;
    g.animate(
      [
        { transform: `translate(${baseX}px, ${baseY - 14}px) scale(${f},1)` },
        { transform: `translate(${baseX}px, ${baseY}px) scale(${f},1)` },
      ],
      { duration: 220, easing: 'ease-out' }
    );
  }

  const controls = document.createElement('div');
  controls.className = 'beat-toy__controls';
  climbPanel.appendChild(controls);

  const downButton = document.createElement('button');
  downButton.type = 'button';
  downButton.className = 'beat-toy__start-button';
  downButton.textContent = '← down';
  controls.appendChild(downButton);

  const upButton = document.createElement('button');
  upButton.type = 'button';
  upButton.className = 'beat-toy__start-button';
  upButton.textContent = 'climb →';
  controls.appendChild(upButton);

  const autoButton = document.createElement('button');
  autoButton.type = 'button';
  autoButton.className = 'beat-toy__start-button';
  autoButton.textContent = '▶ Climb it all';
  controls.appendChild(autoButton);

  const octaveButton = document.createElement('button');
  octaveButton.type = 'button';
  octaveButton.className = 'beat-toy__start-button';
  octaveButton.textContent = 'Low Do + High Do';
  controls.appendChild(octaveButton);

  const readout = document.createElement('p');
  readout.className = 'rhythm-toy__prompt mountain-toy__readout';
  climbPanel.appendChild(readout);

  // ---------- Right panel: the staircase theory ----------
  const theoryPanel = document.createElement('div');
  theoryPanel.className = 'rhythm-toy__wall-panel mountain-toy__theory-panel';
  wrapper.appendChild(theoryPanel);

  const theoryHeading = document.createElement('p');
  theoryHeading.className = 'beat-toy__graph-heading';
  theoryHeading.textContent = "Sully's Mountain";
  theoryPanel.appendChild(theoryHeading);

  const theoryBox = document.createElement('div');
  theoryBox.className = 'beat-toy__graph-box mountain-toy__theory-box';
  theoryPanel.appendChild(theoryBox);

  const ruler = document.createElement('div');
  ruler.className = 'mountain-toy__ruler';
  theoryBox.appendChild(ruler);

  const rulerSlots = [];
  for (let s = 0; s <= 12; s++) {
    const slot = document.createElement('div');
    const inScale = SCALE_SEMIS.includes(s);
    slot.className = 'mountain-toy__ruler-slot' + (inScale ? ' in-scale' : '');
    if (inScale) {
      slot.textContent = NAMES[SCALE_SEMIS.indexOf(s)];
    } else {
      const dot = document.createElement('span');
      dot.className = 'mountain-toy__ruler-dot';
      slot.appendChild(dot);
    }
    ruler.appendChild(slot);
    rulerSlots.push(slot);
  }

  const stepRow = document.createElement('div');
  stepRow.className = 'mountain-toy__step-row';
  theoryBox.appendChild(stepRow);

  for (let k = 0; k < SCALE_SEMIS.length - 1; k++) {
    const gap = SCALE_SEMIS[k + 1] - SCALE_SEMIS[k];
    const step = document.createElement('div');
    step.className = 'mountain-toy__step-gap ' + (gap === 2 ? 'whole' : 'half');
    step.style.flex = String(gap);
    step.textContent = gap === 2 ? 'big step' : 'little step';
    stepRow.appendChild(step);
  }

  const barsHeading = document.createElement('p');
  barsHeading.className = 'mountain-toy__bars-heading';
  barsHeading.textContent = 'How fast the sound shivers';
  theoryBox.appendChild(barsHeading);

  const bars = document.createElement('div');
  bars.className = 'mountain-toy__bars';
  theoryBox.appendChild(bars);

  const barEls = [];
  SCALE_SEMIS.forEach((s, k) => {
    const f = BASE_F * Math.pow(2, s / 12);
    const bar = document.createElement('div');
    bar.className = 'mountain-toy__bar';
    bar.style.height = (f / (BASE_F * 2) * 100) + '%';
    const label = document.createElement('span');
    label.className = 'mountain-toy__bar-label';
    label.textContent = Math.round(f);
    bar.appendChild(label);
    bars.appendChild(bar);
    barEls.push(bar);
  });

  const ratioText = document.createElement('p');
  ratioText.className = 'mountain-toy__ratio';
  theoryBox.appendChild(ratioText);

  const numbersButton = document.createElement('button');
  numbersButton.type = 'button';
  numbersButton.className = 'toy-clear-button mountain-toy__numbers-button';
  numbersButton.textContent = 'Show the numbers';
  theoryPanel.appendChild(numbersButton);

  container.appendChild(wrapper);

  function updateTheory() {
    const s = SEMIS[idx];
    rulerSlots.forEach((slot, s2) => slot.classList.toggle('here', s2 === s));
    const k = SCALE_SEMIS.indexOf(s);
    barEls.forEach((bar, k2) => bar.classList.toggle('here', k2 === k));

    const f = Math.round(freq(idx));
    const r = freq(idx) / BASE_F;
    let msg;
    if (s === 0) {
      msg = 'Sully is at the bottom on <strong>Do</strong>.';
    } else if (s === 12) {
      msg = "Top <strong>Do</strong>! The sound shivers <strong>twice as fast</strong> as the bottom Do. That's why it sounds like the same note, but high.";
    } else {
      msg = `<strong>${NAMES[idx]}</strong> is <strong>${s}</strong> little stair${s > 1 ? 's' : ''} up from the bottom Do.`;
    }
    if (numbersShown) {
      msg += ` <span class="mountain-toy__ratio-nums">(${f} wiggles per second, times ${r.toFixed(2)})</span>`;
    }
    ratioText.innerHTML = msg;
  }

  function render() {
    drawSully();
    noteLabels.forEach((label, i) => label.classList.toggle('lit', i === idx));
    const where = idx < 7 ? 'climbing up' : idx > 7 ? 'heading back down' : 'at the very top!';
    readout.textContent = `${NAMES[idx]}: ${where}`;
    updateTheory();
  }

  function go(i) {
    const n = Math.max(0, Math.min(N - 1, i));
    if (n !== idx) facing = n < idx;
    idx = n;
    render();
    playNote(idx);
  }

  render();

  keydownListener = (e) => {
    if (e.code === 'ArrowRight' || e.code === 'ArrowUp') { e.preventDefault(); go(idx + 1); }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowDown') { e.preventDefault(); go(idx - 1); }
  };
  window.addEventListener('keydown', keydownListener);

  downButton.addEventListener('click', () => go(idx - 1));
  upButton.addEventListener('click', () => go(idx + 1));

  autoButton.addEventListener('click', () => {
    pendingTimeouts.forEach((id) => clearTimeout(id));
    pendingTimeouts = [];
    for (let i = 0; i < N; i++) {
      const id = setTimeout(() => {
        facing = i > 7;
        idx = i;
        render();
        playNote(i);
      }, i * AUTO_CLIMB_STEP_MS);
      pendingTimeouts.push(id);
    }
  });

  octaveButton.addEventListener('click', () => {
    pendingTimeouts.forEach((id) => clearTimeout(id));
    pendingTimeouts = [];
    facing = false;
    idx = 0;
    render();
    readout.textContent = 'Low Do...';
    playNote(0);
    pendingTimeouts.push(setTimeout(() => {
      idx = 7;
      render();
      readout.textContent = 'High Do...';
      playNote(7);
    }, 700));
    pendingTimeouts.push(setTimeout(() => {
      readout.textContent = 'Together, they sing as one!';
      playNote(0);
      playNote(7);
    }, 1700));
    pendingTimeouts.push(setTimeout(() => {
      render();
    }, 2700));
  });

  numbersButton.addEventListener('click', () => {
    numbersShown = !numbersShown;
    numbersButton.textContent = numbersShown ? 'Hide the numbers' : 'Show the numbers';
    updateTheory();
  });
}
