const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteToMidi(note) {
  const [, name, octaveStr] = note.match(/^([A-G]#?)(-?\d+)$/);
  const octave = Number(octaveStr);
  return (octave + 1) * 12 + NOTE_NAMES.indexOf(name);
}

export function midiToNote(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

export function transposeNote(note, semitones) {
  return midiToNote(noteToMidi(note) + semitones);
}
