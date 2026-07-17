import { playInstrumentNote } from '../../core/audioEngine.js';
import { noteToMidi } from '../../core/noteUtils.js';

export function renderStaircaseToy(container, config = {}) {
  const { notes = ['C4', 'D4', 'E4'], label = 'Climb the stairs!' } = config;
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'toy-staircase-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'toy-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const stairsEl = document.createElement('div');
  stairsEl.className = 'toy-stairs';

  let cumulativeHeight = 0;
  notes.forEach((note, i) => {
    if (i > 0) {
      const semitones = noteToMidi(note) - noteToMidi(notes[i - 1]);
      cumulativeHeight += semitones >= 2 ? 30 : 15; // whole step = taller riser, half step = shorter
    }

    const step = document.createElement('button');
    step.type = 'button';
    step.className = 'toy-stair-step';
    step.style.height = `${40 + cumulativeHeight}px`;
    step.textContent = note.replace(/[0-9]/g, '');
    step.addEventListener('click', () => playInstrumentNote(note));
    stairsEl.appendChild(step);
  });

  wrapper.appendChild(stairsEl);
  container.appendChild(wrapper);
}
