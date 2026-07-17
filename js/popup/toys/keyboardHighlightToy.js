import { playInstrumentNote } from '../../core/audioEngine.js';

export function renderKeyboardHighlightToy(container, config = {}) {
  const { notes = ['C4', 'E4', 'G4'], label = 'Watch and listen!' } = config;
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'toy-demo-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'toy-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'toy-play-button';
  playButton.textContent = '▶ Play the notes';
  wrapper.appendChild(playButton);

  playButton.addEventListener('click', () => {
    notes.forEach((note, i) => {
      setTimeout(() => playInstrumentNote(note), i * 450);
    });
  });

  container.appendChild(wrapper);
}
