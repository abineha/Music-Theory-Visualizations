import { playDrumHit } from '../../core/audioEngine.js';

export function renderTapToy(container, config = {}) {
  const { label = 'Tap the pad to keep the beat!' } = config;
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'toy-tap-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'toy-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const bpmEl = document.createElement('p');
  bpmEl.className = 'toy-bpm-readout';
  bpmEl.textContent = 'Tap to start!';
  wrapper.appendChild(bpmEl);

  const tapButton = document.createElement('button');
  tapButton.type = 'button';
  tapButton.className = 'toy-tap-button';
  tapButton.textContent = '! Tap';
  wrapper.appendChild(tapButton);

  let lastTapTime = null;

  tapButton.addEventListener('click', () => {
    playDrumHit('low');
    const now = performance.now();
    if (lastTapTime !== null) {
      const bpm = Math.round(60000 / (now - lastTapTime));
      bpmEl.textContent = `${bpm} BPM`;
    }
    lastTapTime = now;
  });

  container.appendChild(wrapper);
}
