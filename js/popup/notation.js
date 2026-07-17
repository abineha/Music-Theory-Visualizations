// Relies on the global `VexFlow` object from the classic <script> tag in index.html.

const container = document.getElementById('notation-canvas');

let renderedForConceptId = null;

export function renderNotation(concept) {
  if (renderedForConceptId === concept.id) return; // already showing this concept's notation
  renderedForConceptId = concept.id;

  container.innerHTML = '';

  if (!concept.notation) {
    container.textContent = 'No notation for this concept yet.';
    return;
  }

  const factory = new VexFlow.Factory({
    renderer: { elementId: 'notation-canvas', width: 500, height: 200 },
  });

  const score = factory.EasyScore();
  const system = factory.System();

  const notes = score.notes(concept.notation.notes);
  const voice = score.voice(notes, { time: concept.notation.time || `${notes.length}/4` });
  voice.setMode(VexFlow.Voice.Mode.SOFT);

  system
    .addStave({ voices: [voice] })
    .addClef(concept.notation.clef || 'treble');

  factory.draw();

}
