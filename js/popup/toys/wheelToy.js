import { playInstrumentNote } from '../../core/audioEngine.js';

export function renderWheelToy(container, config = {}) {
  const { options = [], label = 'Spin the wheel!' } = config;
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'toy-wheel-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'toy-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const wheelEl = document.createElement('div');
  wheelEl.className = 'toy-wheel';

  const resultEl = document.createElement('p');
  resultEl.className = 'toy-wheel-result';
  resultEl.textContent = 'Pick a spot on the wheel!';

  const radius = 110;
  const centerOffset = 130;

  options.forEach((option) => {
    const angle = (options.indexOf(option) / options.length) * 2 * Math.PI - Math.PI / 2;
    const x = centerOffset + radius * Math.cos(angle);
    const y = centerOffset + radius * Math.sin(angle);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toy-wheel-slot';
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    button.textContent = option.label;
    button.addEventListener('click', () => {
      resultEl.textContent = option.label;
      option.notes.forEach((note, idx) => {
        setTimeout(() => playInstrumentNote(note), idx * 300);
      });
    });
    wheelEl.appendChild(button);
  });

  wrapper.appendChild(wheelEl);
  wrapper.appendChild(resultEl);
  container.appendChild(wrapper);
}
