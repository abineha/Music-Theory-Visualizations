import { playInstrumentNote, playDrumHit } from '../../core/audioEngine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SAY_NOTE = 'E4'; // always the same pitch: loud/soft is about size, not pitch

const VOICES = [
  { key: 'whisper', name: 'whisper', velocity: 0.12, barHeight: 16, amp: 14, blob: 8,  say: 'shhh...',    bubbleSize: 12, bubbleCount: 1, ringSize: 40,  travel: 55,  msg: 'A tiny little sound.' },
  { key: 'quiet',   name: 'quiet',   velocity: 0.28, barHeight: 34, amp: 28, blob: 13, say: 'baa',        bubbleSize: 15, bubbleCount: 1, ringSize: 66,  travel: 95,  msg: 'Soft and gentle.' },
  { key: 'middle',  name: 'middle',  velocity: 0.5,  barHeight: 55, amp: 45, blob: 18, say: 'Baaa!',      bubbleSize: 19, bubbleCount: 2, ringSize: 92,  travel: 140, msg: 'A good middle voice.' },
  { key: 'loud',    name: 'loud',    velocity: 0.75, barHeight: 78, amp: 64, blob: 23, say: 'BAAAA!',     bubbleSize: 24, bubbleCount: 3, ringSize: 124, travel: 195, msg: 'That one carried all the way across the field!' },
  { key: 'shout',   name: 'shout',   velocity: 1.0,  barHeight: 100,amp: 84, blob: 28, say: 'BAAAAAH!!',  bubbleSize: 30, bubbleCount: 4, ringSize: 160, travel: 255, msg: 'WHOA! The whole meadow heard that one!' },
];

const WAVE_W = 600, WAVE_H = 210, WAVE_MID = WAVE_H / 2, WAVE_CYCLES = 6;
const WAVE_LEN = WAVE_W / WAVE_CYCLES;

const TALK_BPM = 88;
const TALK_LOOKAHEAD = 0.1;
const TALK_TICK_MS = 25;

let sel = 2;
let talking = false;
let talkTimer = null;
let nextTalkTime = 0;
let talkQueue = [];
let rafId = null;
let keydownListener = null;
let fxTimeouts = [];

export function stopVoiceToy() {
  if (talkTimer !== null) { clearTimeout(talkTimer); talkTimer = null; }
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  fxTimeouts.forEach((id) => clearTimeout(id));
  fxTimeouts = [];
  talkQueue = [];
  talking = false;
  if (keydownListener) {
    window.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
  sel = 2;
}

export function renderVoiceToy(container, config = {}) {
  stopVoiceToy();

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'voice-toy';

  const voicePanel = document.createElement('div');
  voicePanel.className = 'voice-toy__voice-panel';
  wrapper.appendChild(voicePanel);

  const scene = document.createElement('div');
  scene.className = 'beat-toy__scene voice-toy__scene';
  voicePanel.appendChild(scene);

  const sullyImg = document.createElement('img');
  sullyImg.className = 'beat-toy__sully';
  sullyImg.src = 'assets/images/goat/goat_r_1.png';
  sullyImg.alt = '';
  scene.appendChild(sullyImg);

  const fxLayer = document.createElement('div');
  fxLayer.className = 'voice-toy__fx-layer';
  scene.appendChild(fxLayer);

  const picker = document.createElement('div');
  picker.className = 'voice-toy__picker';
  voicePanel.appendChild(picker);

  const voiceButtons = [];
  VOICES.forEach((v, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'voice-toy__voice-btn';
    btn.setAttribute('aria-label', `${v.name} voice`);
    btn.setAttribute('aria-pressed', String(i === sel));

    const blob = document.createElement('span');
    blob.className = 'voice-toy__voice-blob';
    blob.style.width = `${v.blob}px`;
    blob.style.height = `${v.blob}px`;
    btn.appendChild(blob);

    const label = document.createElement('span');
    label.className = 'voice-toy__voice-name';
    label.textContent = v.name;
    btn.appendChild(label);

    btn.addEventListener('click', () => selectVoice(i));
    picker.appendChild(btn);
    voiceButtons.push(btn);
  });

  function paintButtons() {
    voiceButtons.forEach((btn, i) => {
      btn.classList.toggle('is-selected', i === sel);
      btn.setAttribute('aria-pressed', String(i === sel));
    });
  }

  const controls = document.createElement('div');
  controls.className = 'beat-toy__controls';
  voicePanel.appendChild(controls);

  const sayButton = document.createElement('button');
  sayButton.type = 'button';
  sayButton.className = 'beat-toy__start-button';
  sayButton.textContent = 'Say it!';
  controls.appendChild(sayButton);

  const talkButton = document.createElement('button');
  talkButton.type = 'button';
  talkButton.className = 'beat-toy__start-button';
  talkButton.textContent = '▶ Talk along';
  controls.appendChild(talkButton);

  const readout = document.createElement('p');
  readout.className = 'rhythm-toy__prompt voice-toy__readout';
  readout.textContent = 'Pick a voice and let Sully speak!';
  voicePanel.appendChild(readout);

  const theoryPanel = document.createElement('div');
  theoryPanel.className = 'rhythm-toy__wall-panel voice-toy__theory-panel';
  wrapper.appendChild(theoryPanel);

  const theoryHeading = document.createElement('p');
  theoryHeading.className = 'beat-toy__graph-heading';
  theoryHeading.textContent = "Sully's Voice";
  theoryPanel.appendChild(theoryHeading);

  const theoryBox = document.createElement('div');
  theoryBox.className = 'beat-toy__graph-box voice-toy__theory-box';
  theoryPanel.appendChild(theoryBox);

  const barsHeading = document.createElement('p');
  barsHeading.className = 'mountain-toy__bars-heading voice-toy__section-heading';
  barsHeading.textContent = 'How big is the sound?';
  theoryBox.appendChild(barsHeading);

  const bars = document.createElement('div');
  bars.className = 'voice-toy__bars';
  theoryBox.appendChild(bars);

  const barEls = [];
  VOICES.forEach((v, i) => {
    const bar = document.createElement('div');
    bar.className = 'voice-toy__bar';
    bar.style.height = `${v.barHeight}%`;
    bar.title = v.name;
    bars.appendChild(bar);
    barEls.push(bar);
  });

  const waveHeading = document.createElement('p');
  waveHeading.className = 'mountain-toy__bars-heading voice-toy__section-heading';
  waveHeading.textContent = 'A picture of the sound';
  theoryBox.appendChild(waveHeading);

  const waveSvg = document.createElementNS(SVG_NS, 'svg');
  waveSvg.setAttribute('viewBox', `0 0 ${WAVE_W} ${WAVE_H}`);
  waveSvg.setAttribute('class', 'voice-toy__wave-svg');
  theoryBox.appendChild(waveSvg);

  const legend = document.createElement('div');
  legend.className = 'voice-toy__legend';
  legend.innerHTML = `
    <span><i class="voice-toy__swatch voice-toy__swatch--tall"></i>taller wiggle: <strong>louder</strong></span>
    <span><i class="voice-toy__swatch voice-toy__swatch--width"></i>always the <strong>same width</strong></span>
  `;
  theoryBox.appendChild(legend);

  container.appendChild(wrapper);

  function drawWave() {
    const v = VOICES[sel];
    const A = v.amp;
    let d = `M0 ${WAVE_MID}`;
    for (let x = 0; x <= WAVE_W; x += 6) {
      const y = WAVE_MID - A * Math.sin((2 * Math.PI * x) / WAVE_LEN);
      d += ` L${x.toFixed(0)} ${y.toFixed(1)}`;
    }
    let ticks = '';
    for (let k = 0; k <= WAVE_CYCLES; k++) {
      const x = k * WAVE_LEN;
      ticks += `<line x1="${x}" y1="14" x2="${x}" y2="${WAVE_H - 14}" stroke="#d6bfa0" stroke-width="3"/>`;
    }
    waveSvg.innerHTML = `
      ${ticks}
      <line x1="0" y1="${WAVE_MID}" x2="${WAVE_W}" y2="${WAVE_MID}" stroke="#6b5d52" stroke-width="2" opacity=".3"/>
      <path d="${d}" fill="none" stroke="#6b5d52" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  function paintBars() {
    barEls.forEach((bar, i) => bar.classList.toggle('here', i === sel));
  }

  function say() {
    const v = VOICES[sel];
    playInstrumentNote(SAY_NOTE, v.velocity);
    ripple(v);
    bubble(v);
    sullyImg.animate(
      [
        { transform: 'translateX(-50%) scale(1)' },
        { transform: `translateX(-50%) scale(${1 + v.velocity * 0.12})` },
        { transform: 'translateX(-50%) scale(1)' },
      ],
      { duration: 260, easing: 'ease-out' }
    );
    readout.textContent = v.msg;
  }

  function ripple(v) {
    const ring = document.createElement('div');
    ring.className = 'voice-toy__ring';
    ring.style.width = `${v.ringSize}px`;
    ring.style.height = `${v.ringSize * 0.42}px`;
    fxLayer.appendChild(ring);
    const anim = ring.animate(
      [
        { transform: 'translateX(-50%) scale(.3)', opacity: 0.9 },
        { transform: 'translateX(-50%) scale(1.7)', opacity: 0 },
      ],
      { duration: 520, easing: 'ease-out' }
    );
    anim.onfinish = () => ring.remove();
  }

  function bubble(v) {
    for (let i = 0; i < v.bubbleCount; i++) {
      const b = document.createElement('div');
      b.className = 'voice-toy__bubble';
      b.textContent = v.say;
      b.style.fontSize = `${v.bubbleSize}px`;
      fxLayer.appendChild(b);
      const up = 16 + Math.random() * 24 + v.travel * 0.18;
      const away = v.travel * (0.7 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1);
      const anim = b.animate(
        [
          { transform: 'translate(-50%, 0) scale(.5)', opacity: 0 },
          { transform: `translate(calc(-50% + ${away * 0.5}px), ${-up * 0.5}px) scale(1)`, opacity: 1, offset: 0.3 },
          { transform: `translate(calc(-50% + ${away}px), ${-up}px) scale(1)`, opacity: 0 },
        ],
        { duration: 650 + v.travel * 1.6, easing: 'cubic-bezier(.2,.7,.3,1)', delay: i * 90 }
      );
      anim.onfinish = () => b.remove();
    }
  }

  function selectVoice(i) {
    sel = i;
    paintButtons();
    paintBars();
    drawWave();
  }

  paintButtons();
  paintBars();
  drawWave();

  sayButton.addEventListener('click', say);

  function talkContextTimeNow() {
    return performance.now() / 1000;
  }

  function talkScheduler() {
    const spb = 60 / TALK_BPM;
    while (nextTalkTime < talkContextTimeNow() + TALK_LOOKAHEAD) {
      talkQueue.push(nextTalkTime);
      nextTalkTime += spb;
    }
    talkTimer = setTimeout(talkScheduler, TALK_TICK_MS);
  }

  function talkFrame() {
    const now = talkContextTimeNow();
    while (talkQueue.length && talkQueue[0] <= now) {
      talkQueue.shift();
      const v = VOICES[sel];
      playDrumHit('low', v.velocity);
      sullyImg.animate(
        [
          { transform: 'translateX(-50%) scaleY(1)' },
          { transform: `translateX(-50%) scaleY(${1 - 0.05 * (v.velocity + 0.3)}) translateY(${3 * (v.velocity + 0.3)}px)` },
          { transform: 'translateX(-50%) scaleY(1)' },
        ],
        { duration: 230, easing: 'ease-out' }
      );
      ripple(v);
    }
    rafId = requestAnimationFrame(talkFrame);
  }

  talkButton.addEventListener('click', () => {
    if (talking) {
      talking = false;
      if (talkTimer !== null) { clearTimeout(talkTimer); talkTimer = null; }
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      talkQueue = [];
      talkButton.textContent = '▶ Talk along';
    } else {
      talking = true;
      nextTalkTime = talkContextTimeNow() + 0.1;
      talkScheduler();
      rafId = requestAnimationFrame(talkFrame);
      talkButton.textContent = '⏸ Stop';
    }
  });

  keydownListener = (e) => {
    if (e.code === 'Space') { e.preventDefault(); say(); }
    if (e.key === 'ArrowRight') { selectVoice(Math.min(VOICES.length - 1, sel + 1)); }
    if (e.key === 'ArrowLeft') { selectVoice(Math.max(0, sel - 1)); }
  };
  window.addEventListener('keydown', keydownListener);
}
