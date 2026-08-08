import { getBeatPhase, getBarPhase, setBeatBpm, setBeatAudible, resetBeatBpm, playInstrumentNote } from '../../core/audioEngine.js';

const GAIT_TABLE = [
  { max: 72, name: 'Amble', bob: 5 },
  { max: 104, name: 'Walk', bob: 9 },
  { max: 140, name: 'Trot', bob: 15 },
  { max: Infinity, name: 'Gallop', bob: 23 },
];

const BEATS_PER_BAR = 4;
const ZONE_VISUAL_RADIUS_FRACTION = 0.15 / 4; 
const ZONE_HIT_HALF_WIDTH_FRACTION = 0.25 / 4; // +/- 30% of one beat
const ZONE_NEAR_HALF_WIDTH_FRACTION = ZONE_HIT_HALF_WIDTH_FRACTION * 1.3; // "near" band beyond the exact hit window
const ARC_WIDTH = 380;
const ARC_HEIGHT = 130;
const SVG_NS = 'http://www.w3.org/2000/svg';

const GRAPH_WIDTH = 440;
const GRAPH_HEIGHT = 230;
const GRAPH_MARGIN_X = 24;
const BEAT_DOT_Y = 56;
const TICK_LINE_Y = 84;
const GAP_LABEL_Y = 108;
const TAP_DOT_Y = 148;
const BUBBLE_Y = 166;
const BUBBLE_HEIGHT = 50;
const BEAT_DOT_BASE_RADIUS = 10;
const BEAT_DOT_PULSE_RADIUS = 6;
const TAP_DOT_RADIUS = 7;
const TAP_DOT_MAX_STORED = 8;

const PROMPT_NOT_STARTED = 'Press Start to wake Sully up!';
const PROMPT_PLAYING = 'Click the gold patches as the light goes past!';
const PROMPT_GOOD_TAPS = "You've got it! That steady thump is the BEAT.";
const PROMPT_TEMPO_UP = 'Sully is trotting now. The beat is FASTER but still steady.';
const PROMPT_TEMPO_DOWN = 'Sully is ambling. The beat is SLOWER as the gaps got wider.';
const PROMPT_BAR_COMPLETE = "Four in a row! That's one bar.";

const GRAPH_HEADING = 'The beat as a number line';
const GRAPH_CORNER_LABEL = 'all gaps are equal: that is the beat';
const BUBBLE_LINE_1 = 'The beat is each hoofstep.';
const BUBBLE_LINE_2 = 'The tempo is how far apart they are.';

const GRASS_SCROLL_PX_PER_MS = 0.03; // baseline scroll speed; scaled by tempo so the ground "runs" faster with Sully

const INPUT_LATENCY_MS = 90;

function getGait(bpm) {
  return GAIT_TABLE.find((g) => bpm <= g.max);
}

let rafId = null;
let running = false;
let bpm = 96;
let spaceListener = null;

export function stopBeatArcToy() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (spaceListener) {
    window.removeEventListener('keydown', spaceListener);
    spaceListener = null;
  }
  running = false;
  setBeatAudible(false);
  resetBeatBpm();
}

export function renderBeatArcToy(container, config = {}) {
  stopBeatArcToy();

  const {
    minBpm = 50,
    maxBpm = 180,
    startBpm = 96,
  } = config;

  bpm = startBpm;
  setBeatBpm(bpm);

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'beat-toy';

  const gaitPanel = document.createElement('div');
  gaitPanel.className = 'beat-toy__gait';

  const scene = document.createElement('div');
  scene.className = 'beat-toy__scene';

  const gaitReadout = document.createElement('p');
  gaitReadout.className = 'beat-toy__gait-readout';
  scene.appendChild(gaitReadout);

  const sullyImg = document.createElement('img');
  sullyImg.className = 'beat-toy__sully';
  sullyImg.src = 'assets/images/goat/goat_r_1.png';
  sullyImg.alt = '';
  scene.appendChild(sullyImg);

  gaitPanel.appendChild(scene);

  const controls = document.createElement('div');
  controls.className = 'beat-toy__controls';

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'beat-toy__start-button';
  startButton.textContent = '▶ Start';
  controls.appendChild(startButton);

  const tempoLabel = document.createElement('label');
  tempoLabel.className = 'beat-toy__tempo-label';
  tempoLabel.textContent = 'Speed';

  const tempoSlider = document.createElement('input');
  tempoSlider.type = 'range';
  tempoSlider.className = 'beat-toy__tempo-slider';
  tempoSlider.min = String(minBpm);
  tempoSlider.max = String(maxBpm);
  tempoSlider.step = '1';
  tempoSlider.value = String(startBpm);
  tempoSlider.setAttribute('aria-label', 'Tempo');
  tempoLabel.appendChild(tempoSlider);
  controls.appendChild(tempoLabel);

  gaitPanel.appendChild(controls);

  const arcHost = document.createElement('div');
  arcHost.className = 'beat-toy__arc';

  const arcSvg = document.createElementNS(SVG_NS, 'svg');
  arcSvg.setAttribute('viewBox', `0 0 ${ARC_WIDTH} ${ARC_HEIGHT}`);
  arcSvg.setAttribute('width', String(ARC_WIDTH));
  arcSvg.setAttribute('height', String(ARC_HEIGHT));
  arcSvg.setAttribute('class', 'beat-toy__arc-svg');

  const arcPath = document.createElementNS(SVG_NS, 'path');
  arcPath.setAttribute('d', 'M 20 100 Q 190 20 360 100');
  arcPath.setAttribute('fill', 'none');
  arcPath.setAttribute('stroke', '#c9ac83');
  arcPath.setAttribute('stroke-width', '4');
  arcPath.setAttribute('stroke-linecap', 'round');
  arcSvg.appendChild(arcPath);

  const totalLength = arcPath.getTotalLength();

  function pointAtFraction(fraction) {
    return arcPath.getPointAtLength(fraction * totalLength);
  }

  const zoneRadius = ZONE_VISUAL_RADIUS_FRACTION * totalLength;
  const zoneCircles = [];
  for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
    const fraction = (beat + 1) / BEATS_PER_BAR;
    const { x, y } = pointAtFraction(fraction);

    const shadow = document.createElementNS(SVG_NS, 'circle');
    shadow.setAttribute('cx', String(x));
    shadow.setAttribute('cy', String(y + 3));
    shadow.setAttribute('r', String(zoneRadius));
    shadow.setAttribute('fill', '#b89a72');
    arcSvg.appendChild(shadow);

    const zone = document.createElementNS(SVG_NS, 'circle');
    zone.setAttribute('cx', String(x));
    zone.setAttribute('cy', String(y));
    zone.setAttribute('r', String(zoneRadius));
    zone.setAttribute('class', 'beat-toy__zone');
    zone.setAttribute('fill', 'rgba(232, 201, 143, 0.95)');
    zone.style.cursor = 'pointer';
    arcSvg.appendChild(zone);

    zoneCircles.push({ fraction, element: zone });
  }

  const marker = document.createElementNS(SVG_NS, 'circle');
  marker.setAttribute('r', '7');
  marker.setAttribute('fill', '#fffdf9');
  marker.setAttribute('stroke', '#6b5d52');
  marker.setAttribute('stroke-width', '2');
  const startPoint = pointAtFraction(0);
  marker.setAttribute('cx', String(startPoint.x));
  marker.setAttribute('cy', String(startPoint.y));
  arcSvg.appendChild(marker);

  arcHost.appendChild(arcSvg);
  gaitPanel.appendChild(arcHost);

  const drumHost = document.createElement('div');
  drumHost.className = 'beat-toy__drum-host';

  const drumButton = document.createElement('button');
  drumButton.type = 'button';
  drumButton.className = 'beat-toy__drum-button';
  drumButton.setAttribute('aria-label', 'Tap the drum on the beat');
  drumButton.textContent = 'TAP';
  drumHost.appendChild(drumButton);

  const drumFeedback = document.createElement('span');
  drumFeedback.className = 'beat-toy__drum-feedback';
  drumHost.appendChild(drumFeedback);

  gaitPanel.appendChild(drumHost);

  function flashZone(zone) {
    zone.element.setAttribute('fill', '#f7e6c4');
    setTimeout(() => {
      zone.element.setAttribute('fill', 'rgba(232, 201, 143, 0.95)');
    }, 180);
  }

  let drumFeedbackTimeout = null;
  function showFeedback(quality) {
    const text = quality === 'hit' ? 'On beat!' : quality === 'near' ? 'Close!' : 'Missed';
    drumFeedback.textContent = text;
    drumFeedback.className = `beat-toy__drum-feedback beat-toy__drum-feedback--${quality}`;
    void drumFeedback.offsetWidth; // restart the CSS animation even if the same quality fires twice in a row
    drumFeedback.classList.add('is-visible');
    if (drumFeedbackTimeout) clearTimeout(drumFeedbackTimeout);
    drumFeedbackTimeout = setTimeout(() => {
      drumFeedback.classList.remove('is-visible');
    }, 650);
  }

  function attemptHit() {
    if (!running) return;
    const spb = 60 / bpm;
    const latencyFraction = (INPUT_LATENCY_MS / 1000) / spb / BEATS_PER_BAR;
    // Wrap cleanly into [0, 1) instead of clamping: the beat itself is
    // circular in time (it keeps looping) even though the arc is drawn as a
    // line, so a tap just after the bar resets is really just a bit late for
    // the last beat, not "nowhere near" it.
    const barPhase = (((getBarPhase() - latencyFraction) % 1) + 1) % 1;

    let nearest = null;
    let nearestDist = Infinity;
    for (const zone of zoneCircles) {
      // Circular distance: safe for beats 1-3 (wrapping around the far way
      // is always much farther than any reasonable hit window
      const raw = Math.abs(barPhase - zone.fraction);
      const dist = Math.min(raw, 1 - raw);
      if (dist < nearestDist) {
        nearest = zone;
        nearestDist = dist;
      }
    }

    let quality = 'outside';
    if (nearestDist <= ZONE_HIT_HALF_WIDTH_FRACTION) quality = 'hit';
    else if (nearestDist <= ZONE_NEAR_HALF_WIDTH_FRACTION) quality = 'near';

    addTapDot(barPhase, quality);
    showFeedback(quality);

    if (quality === 'hit') {
      flashZone(nearest);
      playInstrumentNote('E6', 0.7);

      goodTapCount++;
      if (goodTapCount === 3) {
        setPrompt(PROMPT_GOOD_TAPS);
      }

      const beatNumber = Math.round(nearest.fraction * BEATS_PER_BAR);
      hitBeatsThisBar.add(beatNumber);
      if (hitBeatsThisBar.size === BEATS_PER_BAR) {
        setPrompt(PROMPT_BAR_COMPLETE);
      }
    }
  }

  
  for (const zone of zoneCircles) {
    zone.element.addEventListener('click', attemptHit);
  }
  arcSvg.addEventListener('click', attemptHit);

  drumButton.addEventListener('click', () => {
    drumButton.classList.add('is-pressed');
    setTimeout(() => drumButton.classList.remove('is-pressed'), 120);
    attemptHit();
  });

  spaceListener = (e) => {
    if (e.code === 'Space' && running) {
      e.preventDefault();
      attemptHit();
    }
  };
  window.addEventListener('keydown', spaceListener);

  wrapper.appendChild(gaitPanel);

  const graphPanel = document.createElement('div');
  graphPanel.className = 'beat-toy__graph';
  wrapper.appendChild(graphPanel);

  const graphHeading = document.createElement('p');
  graphHeading.className = 'beat-toy__graph-heading';
  graphHeading.textContent = GRAPH_HEADING;
  graphPanel.appendChild(graphHeading);

  const graphBox = document.createElement('div');
  graphBox.className = 'beat-toy__graph-box';
  graphPanel.appendChild(graphBox);

  const graphSvg = document.createElementNS(SVG_NS, 'svg');
  graphSvg.setAttribute('viewBox', `0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`);
  graphSvg.setAttribute('width', String(GRAPH_WIDTH));
  graphSvg.setAttribute('height', String(GRAPH_HEIGHT));
  graphSvg.setAttribute('class', 'beat-toy__graph-svg');

  const graphTitle = document.createElementNS(SVG_NS, 'text');
  graphTitle.setAttribute('x', String(GRAPH_MARGIN_X));
  graphTitle.setAttribute('y', '22');
  graphTitle.setAttribute('font-size', '16');
  graphTitle.setAttribute('font-weight', 'bold');
  graphTitle.setAttribute('fill', '#6b5d52');
  graphSvg.appendChild(graphTitle);

  const graphCorner = document.createElementNS(SVG_NS, 'text');
  graphCorner.setAttribute('x', String(GRAPH_WIDTH - GRAPH_MARGIN_X));
  graphCorner.setAttribute('y', '22');
  graphCorner.setAttribute('text-anchor', 'end');
  graphCorner.setAttribute('font-size', '13');
  graphCorner.setAttribute('fill', 'rgba(107, 93, 82, 0.75)');
  graphCorner.textContent = GRAPH_CORNER_LABEL;
  graphSvg.appendChild(graphCorner);

  const graphLine = document.createElementNS(SVG_NS, 'line');
  graphLine.setAttribute('x1', String(GRAPH_MARGIN_X));
  graphLine.setAttribute('y1', String(BEAT_DOT_Y));
  graphLine.setAttribute('x2', String(GRAPH_WIDTH - GRAPH_MARGIN_X));
  graphLine.setAttribute('y2', String(BEAT_DOT_Y));
  graphLine.setAttribute('stroke', 'rgba(107, 93, 82, 0.3)');
  graphLine.setAttribute('stroke-width', '3');
  graphSvg.appendChild(graphLine);

  function graphX(fraction) {
    return GRAPH_MARGIN_X + fraction * (GRAPH_WIDTH - GRAPH_MARGIN_X * 2);
  }

  const beatDots = [];
  for (let i = 0; i < 5; i++) {
    const fraction = i / BEATS_PER_BAR; // 0, 0.25, 0.5, 0.75, 1.0: beats 1-4 plus beat 1 of the next bar
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(graphX(fraction)));
    dot.setAttribute('cy', String(BEAT_DOT_Y));
    dot.setAttribute('r', String(BEAT_DOT_BASE_RADIUS));
    dot.setAttribute('fill', '#e8c98f');
    graphSvg.appendChild(dot);

    const numberLabel = document.createElementNS(SVG_NS, 'text');
    numberLabel.setAttribute('x', String(graphX(fraction)));
    numberLabel.setAttribute('y', String(BEAT_DOT_Y + 5));
    numberLabel.setAttribute('text-anchor', 'middle');
    numberLabel.setAttribute('font-size', '15');
    numberLabel.setAttribute('font-weight', 'bold');
    numberLabel.setAttribute('fill', '#6b5d52');
    numberLabel.setAttribute('pointer-events', 'none');
    numberLabel.textContent = String(i);
    graphSvg.appendChild(numberLabel);

    beatDots.push({ fraction, element: dot, isBeat: i > 0 });
  }

  const gapLabels = [];
  for (let i = 0; i < BEATS_PER_BAR; i++) {
    const aFraction = i / BEATS_PER_BAR;
    const bFraction = (i + 1) / BEATS_PER_BAR;
    const midFraction = (i + 0.5) / BEATS_PER_BAR;

    const tick = document.createElementNS(SVG_NS, 'line');
    tick.setAttribute('x1', String(graphX(aFraction) + 18));
    tick.setAttribute('y1', String(TICK_LINE_Y));
    tick.setAttribute('x2', String(graphX(bFraction) - 18));
    tick.setAttribute('y2', String(TICK_LINE_Y));
    tick.setAttribute('stroke', '#c9ac83');
    tick.setAttribute('stroke-width', '2.5');
    graphSvg.appendChild(tick);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(graphX(midFraction)));
    label.setAttribute('y', String(GAP_LABEL_Y));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '13.5');
    label.setAttribute('font-weight', 'bold');
    label.setAttribute('fill', 'rgba(107, 93, 82, 0.8)');
    graphSvg.appendChild(label);
    gapLabels.push(label);
  }

  function updateGapLabels() {
    const msGap = Math.round(60000 / bpm);
    gapLabels.forEach((label) => {
      label.textContent = `${msGap}ms`;
    });
  }
  updateGapLabels();

  function updateGraphTitle() {
    graphTitle.textContent = `${getGait(bpm).name} · ${bpm} BPM`;
  }
  updateGraphTitle();

  const playhead = document.createElementNS(SVG_NS, 'line');
  playhead.setAttribute('y1', String(BEAT_DOT_Y - 26));
  playhead.setAttribute('y2', String(TICK_LINE_Y + 10));
  playhead.setAttribute('stroke', '#5fa393');
  playhead.setAttribute('stroke-width', '4');
  playhead.setAttribute('stroke-linecap', 'round');
  playhead.setAttribute('opacity', '0');
  const playheadStartX = graphX(0);
  playhead.setAttribute('x1', String(playheadStartX));
  playhead.setAttribute('x2', String(playheadStartX));
  graphSvg.appendChild(playhead);

  const bubbleRect = document.createElementNS(SVG_NS, 'rect');
  bubbleRect.setAttribute('x', String(GRAPH_MARGIN_X));
  bubbleRect.setAttribute('y', String(BUBBLE_Y));
  bubbleRect.setAttribute('width', String(GRAPH_WIDTH - GRAPH_MARGIN_X * 2));
  bubbleRect.setAttribute('height', String(BUBBLE_HEIGHT));
  bubbleRect.setAttribute('rx', '12');
  bubbleRect.setAttribute('fill', '#f2ebe1');
  bubbleRect.setAttribute('stroke', '#d6bfa0');
  bubbleRect.setAttribute('stroke-width', '1.5');
  graphSvg.appendChild(bubbleRect);

  const bubbleLine1 = document.createElementNS(SVG_NS, 'text');
  bubbleLine1.setAttribute('x', String(GRAPH_WIDTH / 2));
  bubbleLine1.setAttribute('y', String(BUBBLE_Y + 21));
  bubbleLine1.setAttribute('text-anchor', 'middle');
  bubbleLine1.setAttribute('font-size', '14.5');
  bubbleLine1.setAttribute('font-weight', 'bold');
  bubbleLine1.setAttribute('fill', '#6b5d52');
  bubbleLine1.textContent = BUBBLE_LINE_1;
  graphSvg.appendChild(bubbleLine1);

  const bubbleLine2 = document.createElementNS(SVG_NS, 'text');
  bubbleLine2.setAttribute('x', String(GRAPH_WIDTH / 2));
  bubbleLine2.setAttribute('y', String(BUBBLE_Y + 39));
  bubbleLine2.setAttribute('text-anchor', 'middle');
  bubbleLine2.setAttribute('font-size', '13.5');
  bubbleLine2.setAttribute('fill', '#6b5d52');
  bubbleLine2.textContent = BUBBLE_LINE_2;
  graphSvg.appendChild(bubbleLine2);

  const tapDots = [];
  function addTapDot(fraction, quality) {
    const color = quality === 'hit' ? '#8fbb86' : quality === 'near' ? '#dba869' : '#b3a89c';
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(graphX(fraction)));
    dot.setAttribute('cy', String(TAP_DOT_Y));
    dot.setAttribute('r', String(TAP_DOT_RADIUS));
    dot.setAttribute('fill', color);
    graphSvg.appendChild(dot);
    tapDots.push(dot);
    if (tapDots.length > TAP_DOT_MAX_STORED) {
      tapDots.shift().remove();
    }
  }

  function clearTapDots() {
    tapDots.forEach((dot) => dot.remove());
    tapDots.length = 0;
  }

  graphBox.appendChild(graphSvg);

  const promptStrip = document.createElement('p');
  promptStrip.className = 'beat-toy__prompt';
  promptStrip.textContent = PROMPT_NOT_STARTED;
  wrapper.appendChild(promptStrip);

  container.appendChild(wrapper);

  function updateGaitReadout() {
    const gait = getGait(bpm);
    gaitReadout.textContent = `${gait.name} · ${bpm} BPM`;
    return gait;
  }
  updateGaitReadout();

  let sullyOnFrameTwo = false;
  let lastBarPhase = 0;
  let goodTapCount = 0;
  let hitBeatsThisBar = new Set();
  let previousBpm = bpm;
  let groundOffset = 0;
  let lastFrameTimestamp = null;

  function setPrompt(text) {
    promptStrip.textContent = text;
  }

  tempoSlider.addEventListener('input', () => {
    const newBpm = Number(tempoSlider.value);
    if (newBpm > previousBpm) setPrompt(PROMPT_TEMPO_UP);
    else if (newBpm < previousBpm) setPrompt(PROMPT_TEMPO_DOWN);
    previousBpm = newBpm;
    bpm = newBpm;
    setBeatBpm(bpm);
    updateGaitReadout();
    updateGapLabels();
    updateGraphTitle();
  });

  function frameLoop(timestamp) {
    const now = timestamp === undefined ? performance.now() : timestamp;
    if (lastFrameTimestamp === null) lastFrameTimestamp = now;
    const dt = now - lastFrameTimestamp;
    lastFrameTimestamp = now;

    const phase = getBeatPhase();
    const barPhaseNow = getBarPhase();
    const gait = getGait(bpm);

    if (phase < 0.5 && !sullyOnFrameTwo) {
      sullyOnFrameTwo = true;
      sullyImg.src = 'assets/images/goat/goat_r_2.png';
    } else if (phase >= 0.5 && sullyOnFrameTwo) {
      sullyOnFrameTwo = false;
      sullyImg.src = 'assets/images/goat/goat_r_1.png';
    }

   
    const bobOffset = Math.abs(Math.sin(phase * Math.PI * 2)) * gait.bob;
    const stepSway = Math.sin(phase * Math.PI * 2) * 4;
    sullyImg.style.transform = `translateX(calc(-50% + ${stepSway}px)) translateY(-${bobOffset}px)`;

    groundOffset = (groundOffset + dt * GRASS_SCROLL_PX_PER_MS * (bpm / 96)) % 1000;
    scene.style.setProperty('--grass-scroll', `${groundOffset}px`);

    const markerPoint = pointAtFraction(barPhaseNow);
    marker.setAttribute('cx', String(markerPoint.x));
    marker.setAttribute('cy', String(markerPoint.y));

    const playheadX = graphX(barPhaseNow);
    playhead.setAttribute('x1', String(playheadX));
    playhead.setAttribute('x2', String(playheadX));
    playhead.setAttribute('opacity', '0.9');

    for (const beatDot of beatDots) {
      if (!beatDot.isBeat) continue;
      const dist = Math.abs(barPhaseNow - beatDot.fraction);
      const closeness = Math.max(0, 1 - dist / ZONE_HIT_HALF_WIDTH_FRACTION);
      beatDot.element.setAttribute('r', String(BEAT_DOT_BASE_RADIUS + closeness * BEAT_DOT_PULSE_RADIUS));
      beatDot.element.setAttribute('fill', closeness > 0 ? '#f7e6c4' : '#e8c98f');
    }

    if (barPhaseNow < lastBarPhase) {
      clearTapDots();
      hitBeatsThisBar.clear();
    }
    lastBarPhase = barPhaseNow;

    rafId = requestAnimationFrame(frameLoop);
  }

  startButton.addEventListener('click', () => {
    if (running) {
      running = false;
      setBeatAudible(false);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      startButton.textContent = '▶ Start';
      setPrompt(PROMPT_NOT_STARTED);
      playhead.setAttribute('opacity', '0');
    } else {
      running = true;
      setBeatAudible(true);
      startButton.textContent = '⏸ Stop';
      setPrompt(PROMPT_PLAYING);
      lastFrameTimestamp = null;
      frameLoop();
    }
  });
}
