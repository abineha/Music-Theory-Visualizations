import { playInstrumentNote } from '../core/audioEngine.js';

export function renderQuiz(container, concept) {
  container.innerHTML = '';

  if (!concept.quiz) {
    container.textContent = 'No quiz for this concept yet.';
    return;
  }

  const { type, config } = concept.quiz;

  if (type === 'multiple-choice-text' || type === 'ear-training') {
    renderChoiceQuiz(container, config, type === 'ear-training');
  } else {
    container.textContent = 'No quiz for this concept yet.';
  }
}

function renderChoiceQuiz(container, config, playable) {
  const { question, options = [], correctIndex, playNotes, playVelocity = 1 } = config;

  const wrapper = document.createElement('div');
  wrapper.className = 'quiz-wrapper';

  const questionEl = document.createElement('p');
  questionEl.className = 'quiz-question';
  questionEl.textContent = question;
  wrapper.appendChild(questionEl);

  if (playable && playNotes) {
    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'toy-play-button';
    playButton.textContent = '▶ Play Sound';
    playButton.addEventListener('click', () => {
      playNotes.forEach((note, i) => {
        setTimeout(() => playInstrumentNote(note, playVelocity), i * 400);
      });
    });
    wrapper.appendChild(playButton);
  }

  const optionsEl = document.createElement('div');
  optionsEl.className = 'quiz-options';

  const feedbackEl = document.createElement('p');
  feedbackEl.className = 'quiz-feedback';

  options.forEach((optionText, i) => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'quiz-option';
    optionButton.textContent = optionText;
    optionButton.addEventListener('click', () => {
      const correct = i === correctIndex;
      feedbackEl.textContent = correct ? 'Great job!' : 'Not quite — try again!';
      feedbackEl.className = 'quiz-feedback ' + (correct ? 'correct' : 'incorrect');
      optionButton.classList.add(correct ? 'correct' : 'incorrect');
    });
    optionsEl.appendChild(optionButton);
  });

  wrapper.appendChild(optionsEl);
  wrapper.appendChild(feedbackEl);
  container.appendChild(wrapper);
}
