import { playInstrumentNote } from '../../core/audioEngine.js';

export function renderStackingToy(container, config = {}) {
  const { blocks = [], label = 'Stack the blocks!', playMode = 'together' } = config;
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'toy-stack-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'toy-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const stackEl = document.createElement('div');
  stackEl.className = 'toy-stack';

  blocks.forEach((block) => {
    const blockEl = document.createElement('button');
    blockEl.type = 'button';
    blockEl.className = 'toy-stack-block';
    blockEl.textContent = block.label;
    blockEl.addEventListener('click', () => {
      blockEl.classList.add('added');
      block.notes.forEach((note) => playInstrumentNote(note));
    });
    stackEl.appendChild(blockEl);
  });

  wrapper.appendChild(stackEl);

  const playAllButton = document.createElement('button');
  playAllButton.type = 'button';
  playAllButton.className = 'toy-play-button';
  playAllButton.textContent = '▶ Play it all together';
  playAllButton.addEventListener('click', () => {
    let delay = 0;
    blocks.forEach((block) => {
      block.notes.forEach((note) => {
        setTimeout(() => playInstrumentNote(note), delay);
      });
      if (playMode === 'sequence') delay += 500;
    });
  });
  wrapper.appendChild(playAllButton);

  container.appendChild(wrapper);
}
