import { playInstrumentNote } from '../../core/audioEngine.js';

export function renderComposerToy(container, config = {}) {
  const { scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], slotCount = 8, label = 'Build your own melody!' } = config;
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'toy-composer-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'toy-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const melody = new Array(slotCount).fill(null);
  const slotEls = [];

  const slotsEl = document.createElement('div');
  slotsEl.className = 'toy-composer-slots';
  for (let i = 0; i < slotCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'toy-composer-slot';
    slot.textContent = '·';
    slot.addEventListener('click', () => {
      melody[i] = null;
      slot.textContent = '·';
    });
    slotsEl.appendChild(slot);
    slotEls.push(slot);
  }
  wrapper.appendChild(slotsEl);

  const paletteEl = document.createElement('div');
  paletteEl.className = 'toy-composer-palette';
  scale.forEach((note) => {
    const noteButton = document.createElement('button');
    noteButton.type = 'button';
    noteButton.className = 'toy-composer-note';
    noteButton.textContent = note.replace(/\d/, '');
    noteButton.addEventListener('click', () => {
      const nextEmpty = melody.findIndex((n) => n === null);
      if (nextEmpty === -1) return;
      melody[nextEmpty] = note;
      slotEls[nextEmpty].textContent = note.replace(/\d/, '');
      playInstrumentNote(note);
    });
    paletteEl.appendChild(noteButton);
  });
  wrapper.appendChild(paletteEl);

  const controlsEl = document.createElement('div');
  controlsEl.className = 'toy-composer-controls';

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'toy-play-button';
  playButton.textContent = '▶ Play my melody';
  playButton.addEventListener('click', () => {
    melody.forEach((note, i) => {
      if (note) setTimeout(() => playInstrumentNote(note), i * 400);
    });
  });
  controlsEl.appendChild(playButton);

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'toy-clear-button';
  clearButton.textContent = 'Clear';
  clearButton.addEventListener('click', () => {
    melody.fill(null);
    slotEls.forEach((slot) => { slot.textContent = '·'; });
  });
  controlsEl.appendChild(clearButton);

  wrapper.appendChild(controlsEl);
  container.appendChild(wrapper);
}
