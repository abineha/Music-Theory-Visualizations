import {
  startRhythmClock, stopRhythmClock, resetRhythmState, setRhythmBpm,
  setRhythmLayerActive, isRhythmLayerActive, getRhythmStepIndex,
} from '../../core/audioEngine.js';

const RHYTHM_STEPS = 16;
const SVG_NS = 'http://www.w3.org/2000/svg';

const HERD = [
  { key: 'whole',   name: 'Grandpa goat', label: 'whole note',      frac: '1',    hits: 1,  size: 74, color: '#a89ee0', img: 'assets/images/node2/1.png' },
  { key: 'half',    name: 'Father goat',  label: 'half notes',      frac: '1/2',  hits: 2,  size: 63, color: '#b7c9ea', img: 'assets/images/node2/2.png' },
  { key: 'quarter', name: 'Mama goat',    label: 'quarter notes',   frac: '1/4',  hits: 4,  size: 53, color: '#8fbb86', img: 'assets/images/node2/3.png' },
  { key: 'eighth',  name: 'Kid goat',     label: 'eighth notes',    frac: '1/8',  hits: 8,  size: 43, color: '#8fcbb5', img: 'assets/images/node2/4.png' },
  { key: 'six',     name: 'Baby goat',    label: 'sixteenth notes', frac: '1/16', hits: 16, size: 33, color: '#e8c98f', img: 'assets/images/node2/5.png' },
];

const WALL_WIDTH = 640;
const WALL_X0 = 130;
const WALL_X1 = 610;
const WALL_ROW_H = 46;
const WALL_GAP = 10;
const WALL_Y0 = 16;

const PROMPT_NOT_STARTED = 'Press Start to wake the herd!';
const PROMPT_PLAYING = 'Tap a goat to add its rhythm!';
const PROMPT_STACKED = 'Listen, all those rhythms fit inside the very same bar!';

let rafId = null;
let running = false;
let bpm = 76;

export function stopRhythmStackToy() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  running = false;
  stopRhythmClock();
  resetRhythmState();
}

export function renderRhythmStackToy(container, config = {}) {
  stopRhythmStackToy();

  const { minBpm = 50, maxBpm = 132, startBpm = 76 } = config;
  bpm = startBpm;
  setRhythmBpm(bpm);

  const activeState = {};
  HERD.forEach((g) => { activeState[g.key] = isRhythmLayerActive(g.key); });

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'rhythm-toy';

  // ---------- Left panel: herd rows + controls ----------
  const herdPanel = document.createElement('div');
  herdPanel.className = 'rhythm-toy__herd-panel';
  wrapper.appendChild(herdPanel);

  const herdBox = document.createElement('div');
  herdBox.className = 'beat-toy__graph-box rhythm-toy__herd-box';
  herdPanel.appendChild(herdBox);

  const cellsOf = {};
  const goatEls = {};
  const paintFns = {};

  HERD.forEach((g) => {
    const row = document.createElement('div');
    row.className = 'rhythm-toy__row';

    const goatButton = document.createElement('button');
    goatButton.type = 'button';
    goatButton.className = 'rhythm-toy__goat';
    goatButton.setAttribute('aria-label', `${g.name}, ${g.label}, ${g.hits} per bar`);

    const goatImg = document.createElement('img');
    goatImg.src = g.img;
    goatImg.alt = '';
    goatImg.style.width = `${g.size}px`;
    goatButton.appendChild(goatImg);
    goatEls[g.key] = goatImg;

    const nameLabel = document.createElement('span');
    nameLabel.className = 'rhythm-toy__goat-name';
    nameLabel.textContent = g.name;
    goatButton.appendChild(nameLabel);

    const hitsLabel = document.createElement('span');
    hitsLabel.className = 'rhythm-toy__goat-hits';
    hitsLabel.textContent = `${g.hits}×`;
    goatButton.appendChild(hitsLabel);

    const track = document.createElement('div');
    track.className = 'rhythm-toy__track';

    const cells = document.createElement('div');
    cells.className = 'rhythm-toy__cells';
    const cellArr = [];
    for (let i = 0; i < g.hits; i++) {
      const cell = document.createElement('div');
      cell.className = 'rhythm-toy__cell';
      cells.appendChild(cell);
      cellArr.push(cell);
    }
    cellsOf[g.key] = cellArr;

    const cellLabel = document.createElement('div');
    cellLabel.className = 'rhythm-toy__cell-label';
    cellLabel.textContent = g.label;

    track.appendChild(cells);
    track.appendChild(cellLabel);
    row.appendChild(goatButton);
    row.appendChild(track);
    herdBox.appendChild(row);

    function paintRow() {
      const active = activeState[g.key];
      goatButton.setAttribute('aria-pressed', String(active));
      goatButton.classList.toggle('is-active', active);
      cellArr.forEach((c) => c.classList.toggle('is-on', active));
    }
    paintFns[g.key] = paintRow;
    paintRow();

    goatButton.addEventListener('click', () => {
      activeState[g.key] = !activeState[g.key];
      setRhythmLayerActive(g.key, activeState[g.key]);
      paintRow();
      drawWall();
      setPrompt(activeCount() >= 2 ? PROMPT_STACKED : PROMPT_PLAYING);
    });
  });

const wallPanel = document.createElement('div');
  wallPanel.className = 'rhythm-toy__wall-panel';
  wrapper.appendChild(wallPanel);

  const wallHeading = document.createElement('p');
  wallHeading.className = 'beat-toy__graph-heading';
  wallHeading.textContent = 'The same bar, cut into pieces';
  wallPanel.appendChild(wallHeading);

  const wallBox = document.createElement('div');
  wallBox.className = 'beat-toy__graph-box rhythm-toy__graph-box';
  wallPanel.appendChild(wallBox);

  const wallSvg = document.createElementNS(SVG_NS, 'svg');
  wallSvg.setAttribute('class', 'rhythm-toy__wall-svg');
  wallBox.appendChild(wallSvg);

  const sumText = document.createElement('p');
  sumText.className = 'rhythm-toy__sum';
  wallPanel.appendChild(sumText);

  const controls = document.createElement('div');
  controls.className = 'beat-toy__controls';
  wallPanel.appendChild(controls);

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

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'toy-clear-button';
  clearButton.textContent = 'Clear';
  controls.appendChild(clearButton);

  const promptStrip = document.createElement('p');
  promptStrip.className = 'rhythm-toy__prompt';
  promptStrip.textContent = PROMPT_NOT_STARTED;
  wallPanel.appendChild(promptStrip);

  const flashEl = document.createElement('p');
  flashEl.className = 'rhythm-toy__flash';
  flashEl.textContent = 'Everyone together!';
  wallPanel.appendChild(flashEl);

  const wallRects = {};

  function drawWall() {
    wallSvg.innerHTML = '';
    HERD.forEach((g) => { wallRects[g.key] = []; });

    let y = WALL_Y0;
    HERD.forEach((g) => {
      const active = activeState[g.key];
      const cellW = (WALL_X1 - WALL_X0) / g.hits;

      const fracLabel = document.createElementNS(SVG_NS, 'text');
      fracLabel.setAttribute('x', String(WALL_X0 - 14));
      fracLabel.setAttribute('y', String(y + WALL_ROW_H / 2 + 5));
      fracLabel.setAttribute('text-anchor', 'end');
      fracLabel.setAttribute('font-size', '15');
      fracLabel.setAttribute('font-weight', 'bold');
      fracLabel.setAttribute('fill', active ? '#6b5d52' : '#b3a89c');
      fracLabel.textContent = g.frac;
      wallSvg.appendChild(fracLabel);

      for (let i = 0; i < g.hits; i++) {
        const x = WALL_X0 + i * cellW;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(x + 1.5));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(cellW - 3));
        rect.setAttribute('height', String(WALL_ROW_H));
        rect.setAttribute('rx', '6');
        rect.setAttribute('fill', active ? g.color : '#e7e4da');
        rect.setAttribute('stroke', '#6b5d52');
        rect.setAttribute('stroke-width', active ? '1.5' : '0.5');
        rect.setAttribute('opacity', active ? '1' : '0.5');
        wallSvg.appendChild(rect);
        wallRects[g.key].push(rect);

        if (g.hits <= 8) {
          const cellLabel = document.createElementNS(SVG_NS, 'text');
          cellLabel.setAttribute('x', String(x + cellW / 2));
          cellLabel.setAttribute('y', String(y + WALL_ROW_H / 2 + 5));
          cellLabel.setAttribute('text-anchor', 'middle');
          cellLabel.setAttribute('font-size', '13');
          cellLabel.setAttribute('font-weight', 'bold');
          cellLabel.setAttribute('fill', active ? '#3f362f' : '#b3a89c');
          cellLabel.setAttribute('pointer-events', 'none');
          cellLabel.textContent = g.frac;
          wallSvg.appendChild(cellLabel);
        }
      }
      y += WALL_ROW_H + WALL_GAP;
    });

    const lineY = y + 6;
    const measureLine = document.createElementNS(SVG_NS, 'line');
    measureLine.setAttribute('x1', String(WALL_X0));
    measureLine.setAttribute('y1', String(lineY));
    measureLine.setAttribute('x2', String(WALL_X1));
    measureLine.setAttribute('y2', String(lineY));
    measureLine.setAttribute('stroke', '#a89a8c');
    measureLine.setAttribute('stroke-width', '2');
    wallSvg.appendChild(measureLine);

    [WALL_X0, WALL_X1].forEach((tickX) => {
      const tick = document.createElementNS(SVG_NS, 'line');
      tick.setAttribute('x1', String(tickX));
      tick.setAttribute('y1', String(lineY - 6));
      tick.setAttribute('x2', String(tickX));
      tick.setAttribute('y2', String(lineY + 6));
      tick.setAttribute('stroke', '#a89a8c');
      tick.setAttribute('stroke-width', '2');
      wallSvg.appendChild(tick);
    });

    const caption = document.createElementNS(SVG_NS, 'text');
    caption.setAttribute('x', String((WALL_X0 + WALL_X1) / 2));
    caption.setAttribute('y', String(lineY + 26));
    caption.setAttribute('text-anchor', 'middle');
    caption.setAttribute('font-size', '13');
    caption.setAttribute('fill', 'rgba(107, 93, 82, 0.75)');
    caption.textContent = 'every row is the same length: one bar';
    wallSvg.appendChild(caption);

    const wallHeight = lineY + 40;
    wallSvg.setAttribute('viewBox', `0 0 ${WALL_WIDTH} ${wallHeight}`);
    wallSvg.setAttribute('width', String(WALL_WIDTH));
    wallSvg.setAttribute('height', String(wallHeight));

    updateSum();
  }

  function activeCount() {
    return HERD.filter((g) => activeState[g.key]).length;
  }

  function updateSum() {
    const parts = HERD.filter((g) => activeState[g.key]);
    if (!parts.length) {
      sumText.textContent = 'No goats awake yet.';
      return;
    }
    const txt = parts.map((g) => `${g.hits} × ${g.frac}`).join('   +   ');
    sumText.textContent = `${txt}   makes 1 whole bar`;
  }

  drawWall();

  container.appendChild(wrapper);

  function setPrompt(text) {
    promptStrip.textContent = text;
  }

  tempoSlider.addEventListener('input', () => {
    bpm = Number(tempoSlider.value);
    setRhythmBpm(bpm);
  });

  clearButton.addEventListener('click', () => {
    HERD.forEach((g) => {
      activeState[g.key] = false;
      setRhythmLayerActive(g.key, false);
      paintFns[g.key]();
    });
    drawWall();
    setPrompt(running ? PROMPT_PLAYING : PROMPT_NOT_STARTED);
  });

  let lastStepIndex = -1;

  function frameLoop() {
    const stepIndex = getRhythmStepIndex();
    if (stepIndex !== lastStepIndex) {
      HERD.forEach((g) => {
        const everySteps = RHYTHM_STEPS / g.hits;
        if (activeState[g.key] && stepIndex % everySteps === 0) {
          const idx = stepIndex / everySteps;

          const cell = cellsOf[g.key][idx];
          if (cell) {
            cell.classList.add('is-hit');
            setTimeout(() => cell.classList.remove('is-hit'), 130);
          }

          const rect = wallRects[g.key][idx];
          if (rect) {
            rect.setAttribute('fill', '#fff3c4');
            setTimeout(() => rect.setAttribute('fill', g.color), 150);
          }

          const img = goatEls[g.key];
          if (img && img.animate) {
            img.animate(
              [{ transform: 'translateY(0)' }, { transform: 'translateY(-9px)' }, { transform: 'translateY(0)' }],
              { duration: 170, easing: 'ease-out' }
            );
          }
        }
      });

      if (stepIndex === 0 && lastStepIndex !== -1 && activeCount() > 0) {
        flashEl.classList.add('is-visible');
        setTimeout(() => flashEl.classList.remove('is-visible'), 1100);
      }

      lastStepIndex = stepIndex;
    }

    rafId = requestAnimationFrame(frameLoop);
  }

  startButton.addEventListener('click', () => {
    if (running) {
      running = false;
      stopRhythmClock();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      startButton.textContent = '▶ Start';
      setPrompt(PROMPT_NOT_STARTED);
    } else {
      running = true;
      startRhythmClock();
      startButton.textContent = '⏸ Stop';
      setPrompt(activeCount() >= 2 ? PROMPT_STACKED : PROMPT_PLAYING);
      lastStepIndex = -1;
      frameLoop();
    }
  });
}
