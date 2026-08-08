import { playInstrumentNote } from '../../core/audioEngine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const SEMIS = [0, 2, 4, 5, 7, 9, 11, 12];
const NAMES = ['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti', 'Do'];
const XS = [60, 133.3, 206.7, 243.3, 316.7, 390, 463.3, 500];
const YS = [480, 416.7, 353.3, 321.7, 258.3, 195, 131.7, 100];
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

function ledgeColor(i) {
  if (i === 0) return '#d9b57e';
  const gap = Math.abs(SEMIS[i] - SEMIS[i - 1]);
  return gap === 1 ? '#d8d2c5' : '#736b5e';
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
  mtnSvg.setAttribute('viewBox', '0 0 580 520');
  mtnSvg.setAttribute('class', 'mountain-toy__mountain-svg');
  mtnSvg.setAttribute('role', 'img');
  mtnSvg.setAttribute('aria-label', "Sully's climb up the mountain, made of musical notes");
 mtnSvg.innerHTML = `
    <defs>
      <linearGradient id="mtnSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#CFE7F5"/><stop offset="1" stop-color="#E8F3E2"/>
      </linearGradient>
      <linearGradient id="mtnRock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#B8BFC4"/><stop offset="1" stop-color="#8C989F"/>
      </linearGradient>
      <clipPath id="mtnPeakClip">
        <polygon points="60,480 133.3,416.7 206.7,353.3 243.3,321.7 316.7,258.3 390,195 463.3,131.7 500,100 600,380 60,380"/>
      </clipPath>
    </defs>
    <rect width="580" height="520" fill="url(#mtnSky)"/>
    <ellipse cx="150" cy="50" rx="48" ry="20" fill="#fff" opacity=".7"/>
    <ellipse cx="190" cy="42" rx="32" ry="16" fill="#fff" opacity=".7"/>
    <ellipse cx="500" cy="35" rx="42" ry="17" fill="#fff" opacity=".6"/>
    <polygon fill="url(#mtnRock)" stroke="#6b5d52" stroke-width="6" stroke-linejoin="round"
      points="20,520 60,480 133.3,416.7 206.7,353.3 243.3,321.7 316.7,258.3 390,195 463.3,131.7 500,100 600,520"/>
    <g clip-path="url(#mtnPeakClip)">
      <polygon fill="#F6FAFB" opacity=".95"
        points="420,176 463.3,131.7 500,100 513,162 528,225 508,205 490,215 470,200 450,210"/>
    </g>
    <g id="mtnSteps"></g>
    <g id="mtnLedges"></g>
    <g id="mtnFlag"></g>
    <g id="mtnSully"></g>
    <g id="mtnLabels"></g>
  `;
  mountainBox.appendChild(mtnSvg);

  const stepG = mtnSvg.querySelector('#mtnSteps');
  const ledgeG = mtnSvg.querySelector('#mtnLedges');
  const labelG = mtnSvg.querySelector('#mtnLabels');
  const flagG = mtnSvg.querySelector('#mtnFlag');
  const sullyG = mtnSvg.querySelector('#mtnSully');

  // The climbing path itself, colored per segment: a dark-grey trail for a
  // whole step, light grey for a half step - same colors as the ledges, so
  // the whole/half pattern reads along the path you actually walk, not just
  // at each stop.
  for (let i = 0; i < N - 1; i++) {
    const outline = document.createElementNS(SVG_NS, 'line');
    outline.setAttribute('x1', String(XS[i]));
    outline.setAttribute('y1', String(YS[i]));
    outline.setAttribute('x2', String(XS[i + 1]));
    outline.setAttribute('y2', String(YS[i + 1]));
    outline.setAttribute('stroke', '#6b5d52');
    outline.setAttribute('stroke-width', '13');
    outline.setAttribute('stroke-linecap', 'round');
    stepG.appendChild(outline);

    const step = document.createElementNS(SVG_NS, 'line');
    step.setAttribute('x1', String(XS[i]));
    step.setAttribute('y1', String(YS[i]));
    step.setAttribute('x2', String(XS[i + 1]));
    step.setAttribute('y2', String(YS[i + 1]));
    step.setAttribute('stroke', ledgeColor(i + 1));
    step.setAttribute('stroke-width', '8');
    step.setAttribute('stroke-linecap', 'round');
    stepG.appendChild(step);
  }

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
    rect.setAttribute('fill', ledgeColor(i));
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
  controls.className = 'beat-toy__controls mountain-toy__controls';
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
  autoButton.textContent = '▶ Up & down';
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
    const where = idx === 7 ? 'at the very top!' : facing ? 'heading back down' : 'climbing up';
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

    const sequence = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0];
    sequence.forEach((i, step) => {
      const id = setTimeout(() => {
        facing = step > 7;
        idx = i;
        render();
        playNote(i);
      }, step * AUTO_CLIMB_STEP_MS);
      pendingTimeouts.push(id);
    });
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
