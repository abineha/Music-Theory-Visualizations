import { playInstrumentNote } from '../../core/audioEngine.js';
import { noteToMidi, midiToNote, transposeNote } from '../../core/noteUtils.js';

export function renderSliderToy(container, config = {}) {
  const { mode = 'pitch', label = 'Drag the slider' } = config;
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'toy-slider-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'toy-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = '50';
  slider.className = 'toy-slider';
  wrapper.appendChild(slider);

  slider.addEventListener('change', () => {
    const value = Number(slider.value);

    if (mode === 'volume') {
      playInstrumentNote(config.note || 'C4', value / 100);
    } else if (mode === 'interval') {
      const semitoneOffset = Math.round((value / 100) * (config.maxSemitones ?? 12));
      const baseNote = config.baseNote || 'C4';
      playInstrumentNote(baseNote);
      playInstrumentNote(transposeNote(baseNote, semitoneOffset));
    } else {
      const lowMidi = noteToMidi(config.lowNote || 'C3');
      const highMidi = noteToMidi(config.highNote || 'C6');
      const midi = Math.round(lowMidi + (value / 100) * (highMidi - lowMidi));
      playInstrumentNote(midiToNote(midi));
    }
  });

  container.appendChild(wrapper);
}
