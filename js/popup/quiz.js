import { playInstrumentNote, playDrumHit } from '../core/audioEngine.js';
import { markQuizPassed } from '../core/progress.js';

export function renderQuiz(container, concept) {
  container.innerHTML = '';

  if (!concept.quiz) {
    container.textContent = 'No quiz for this concept yet.';
    return;
  }

  const { type, config } = concept.quiz;

  if (type === 'multiple-choice-text' || type === 'ear-training') {
    renderChoiceQuiz(container, config, type === 'ear-training', concept.id);
  } else if (type === 'tap-the-beat') {
    renderTapTheBeatQuiz(container, config, concept.id);
  } else if (type === 'listen-and-order') {
    renderListenAndOrderQuiz(container, config, concept.id);
  } else {
    container.textContent = 'No quiz for this concept yet.';
  }

}

function renderChoiceQuiz(container, config, playable, conceptId) {
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
      feedbackEl.textContent = correct ? 'Great job!' : 'Not quite! Try again!';
      feedbackEl.className = 'quiz-feedback ' + (correct ? 'correct' : 'incorrect');
      optionButton.classList.add(correct ? 'correct' : 'incorrect');
      if (correct) markQuizPassed(conceptId);
    });
    optionsEl.appendChild(optionButton);
  });

  wrapper.appendChild(optionsEl);
  wrapper.appendChild(feedbackEl);
  container.appendChild(wrapper);
}

function renderTapTheBeatQuiz(container, config, conceptId) {
  const { label = 'Tap along with the beat!', targetBpm = 100, tapsRequired = 4 } = config;

  const wrapper = document.createElement('div');
  wrapper.className = 'quiz-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'quiz-question';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const tapButton = document.createElement('button');
  tapButton.type = 'button';
  tapButton.className = 'toy-tap-button';
  tapButton.textContent = 'Tap';
  wrapper.appendChild(tapButton);

  const feedbackEl = document.createElement('p');
  feedbackEl.className = 'quiz-feedback';
  wrapper.appendChild(feedbackEl);

  const tapTimes = [];
  const targetIntervalMs = 60000 / targetBpm;

  tapButton.addEventListener('click', () => {
    playDrumHit('low');
    tapTimes.push(performance.now());
    if (tapTimes.length >= tapsRequired) {
      const intervals = [];
      for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i] - tapTimes[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const diff = Math.abs(avg - targetIntervalMs);
      const correct = diff < targetIntervalMs * 0.3;
      feedbackEl.textContent = correct ? 'Great timing!' : 'Try to keep a steadier beat! Tap again!';
      feedbackEl.className = 'quiz-feedback ' + (correct ? 'correct' : 'incorrect');
      if (correct) markQuizPassed(conceptId);
      tapTimes.length = 0;
    }
  });

  container.appendChild(wrapper);
}

function renderListenAndOrderQuiz(container, config, conceptId) {
  const { label = 'Listen, then put them back in order!', sequence = [] } = config;

  const wrapper = document.createElement('div');
  wrapper.className = 'quiz-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'quiz-question';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'toy-play-button';
  playButton.textContent = '▶ Play the sequence';
  playButton.addEventListener('click', () => {
    let delay = 0;
    sequence.forEach((item) => {
      item.notes.forEach((note) => setTimeout(() => playInstrumentNote(note), delay));
      delay += 500;
    });
  });
  wrapper.appendChild(playButton);

  const optionsEl = document.createElement('div');
  optionsEl.className = 'quiz-options';

  const answerEl = document.createElement('div');
  answerEl.className = 'quiz-answer-slots';

  const feedbackEl = document.createElement('p');
  feedbackEl.className = 'quiz-feedback';

  const userOrder = [];
  const shuffled = [...sequence].sort(() => Math.random() - 0.5);

  shuffled.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-option';
    button.textContent = item.label;
    button.addEventListener('click', () => {
      if (button.disabled) return;
      button.disabled = true;
      button.classList.add('used');
      userOrder.push(item);
      item.notes.forEach((note) => playInstrumentNote(note));

      const slot = document.createElement('span');
      slot.className = 'quiz-answer-slot';
      slot.textContent = item.label;
      answerEl.appendChild(slot);

      if (userOrder.length === sequence.length) {
        const correct = sequence.every((original, i) => original === userOrder[i]);
        feedbackEl.textContent = correct ? 'Perfect order!' : 'Not quite the right order! Try again!';
        feedbackEl.className = 'quiz-feedback ' + (correct ? 'correct' : 'incorrect');
        if (correct) markQuizPassed(conceptId);
      }
    });
    optionsEl.appendChild(button);
  });

  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'toy-clear-button';
  retryButton.textContent = 'Try Again';
  retryButton.addEventListener('click', () => renderListenAndOrderQuiz(container, config, conceptId));

  wrapper.appendChild(optionsEl);
  wrapper.appendChild(answerEl);
  wrapper.appendChild(feedbackEl);
  wrapper.appendChild(retryButton);
  container.appendChild(wrapper);
}

