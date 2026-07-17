import { playInstrumentNote } from '../../core/audioEngine.js';

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTE_AFTER = { C: 'C#', D: 'D#', F: 'F#', G: 'G#', A: 'A#' }; // no black key after E or B

export function renderKeyboard(container, config = {}) {
  const { startOctave = 4, octaveCount = 1, highlight = [] } = config;
  container.innerHTML = '';

  const keyboardEl = document.createElement('div');
  keyboardEl.className = 'keyboard';

  for (let i = 0; i < octaveCount; i++) {
    const octave = startOctave + i;
    for (const whiteName of WHITE_NOTES) {
      const note = `${whiteName}${octave}`;
      const whiteKey = document.createElement('button');
      whiteKey.type = 'button';
      whiteKey.className = 'key key-white' + (highlight.includes(note) ? ' key-highlight' : '');
      whiteKey.addEventListener('click', () => playInstrumentNote(note));
      keyboardEl.appendChild(whiteKey);

      const blackName = BLACK_NOTE_AFTER[whiteName];
      if (blackName) {
        const blackNote = `${blackName}${octave}`;
        const blackKey = document.createElement('button');
        blackKey.type = 'button';
        blackKey.className = 'key key-black' + (highlight.includes(blackNote) ? ' key-highlight' : '');
        blackKey.addEventListener('click', (e) => {
          e.stopPropagation();
          playInstrumentNote(blackNote);
        });
        whiteKey.appendChild(blackKey);
      }
    }
  }

  container.appendChild(keyboardEl);
}
