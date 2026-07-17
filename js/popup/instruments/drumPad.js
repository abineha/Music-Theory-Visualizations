import { playDrumHit } from '../../core/audioEngine.js';

const PADS = [
  { id: 'low', label: 'Boom' },
  { id: 'high', label: 'Tick' },
];

export function renderDrumPad(container) {
  container.innerHTML = '';

  const padsEl = document.createElement('div');
  padsEl.className = 'drum-pads';

  for (const pad of PADS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'drum-pad';
    button.textContent = pad.label;
    button.addEventListener('click', () => playDrumHit(pad.id));
    padsEl.appendChild(button);
  }

  container.appendChild(padsEl);
}
