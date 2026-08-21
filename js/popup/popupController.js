import { duckBacktrack, restoreBacktrack, pauseBacktrack, resumeBacktrack, setWalking, pauseBaa, resumeBaa } from '../core/audioEngine.js';
import { markVisited, markUnvisited, isVisited } from '../core/progress.js';
import { renderNotation } from './notation.js';
import { renderKeyboard } from './instruments/keyboard.js';
import { renderDrumPad } from './instruments/drumPad.js';
import { renderSliderToy } from './toys/sliderToy.js';
import { renderKeyboardHighlightToy } from './toys/keyboardHighlightToy.js';
import { renderStackingToy } from './toys/stackingToy.js';
import { renderIntervalsToy, stopIntervalsToy } from './toys/intervalsToy.js';
import { renderNoteWheelToy, stopNoteWheelToy } from './toys/noteWheelToy.js';
import { renderHopTrailToy, stopHopTrailToy } from './toys/hopTrailToy.js';
import { renderMajorScaleToy, stopMajorScaleToy } from './toys/majorScaleToy.js';
import { renderMinorScaleToy, stopMinorScaleToy } from './toys/minorScaleToy.js';
import { renderBuildingChordsToy, stopBuildingChordsToy } from './toys/buildingChordsToy.js';
import { renderChordProgressionsToy, stopChordProgressionsToy } from './toys/chordProgressionsToy.js';
import { renderSullysStudioToy, stopSullysStudioToy } from './toys/sullysStudioToy.js';
import { renderQuiz } from './quiz.js';
import { renderBeatArcToy, stopBeatArcToy } from './toys/beatArcToy.js';
import { renderRhythmStackToy, stopRhythmStackToy } from './toys/rhythmStackToy.js';
import { renderMountainToy, stopMountainToy } from './toys/mountainToy.js';
import { renderVoiceToy, stopVoiceToy } from './toys/voiceToy.js';


const overlay = document.getElementById('popup-overlay');
const titleEl = document.getElementById('popup-title');
const definitionEl = document.getElementById('popup-definition');
const closeButton = document.getElementById('popup-close');
const tabs = document.querySelectorAll('.popup-tab');
const panels = document.querySelectorAll('.popup-panel-body');
const toyContainer = document.getElementById('toy-container');
const quizContainer = document.getElementById('quiz-container');
const completeButton = document.getElementById('popup-complete');

let open = false;

let currentConcept = null;

const SILENCE_BACKTRACK = new Set(['beat-tempo', 'rhythm-patterns']);

export function isPopupOpen() {
  return open;
}

function setActiveSection(sectionName) {
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.section === sectionName);
  });
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.section === sectionName);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setActiveSection(tab.dataset.section);
  });
});

const instrumentContainer = document.getElementById('instrument-container');

function renderInstrument(concept) {
  if (!concept.instrument) {
    instrumentContainer.innerHTML = 'No instrument for this concept yet.';
    return;
  }
  if (concept.instrument.type === 'keyboard') {
    renderKeyboard(instrumentContainer, concept.instrument);
  } else if (concept.instrument.type === 'drumpad') {
    renderDrumPad(instrumentContainer);
  }
}

function renderToy(concept) {
  if (!concept.toy) {
    toyContainer.innerHTML = 'No toy for this concept yet.';
    return;
  }
  const { type, config } = concept.toy;
  if (type === 'slider-toy') {
    renderSliderToy(toyContainer, config);
  } else if (type === 'keyboard-highlight-toy') {
    renderKeyboardHighlightToy(toyContainer, config);
  } else if (type === 'stacking-toy') {
    renderStackingToy(toyContainer, config);
  } else if (type === 'beat-arc-toy') {
    renderBeatArcToy(toyContainer, config);
  } else if (type === 'herd-stack-toy') {
    renderRhythmStackToy(toyContainer, config);
  } else if (type === 'mountain-toy') {
    renderMountainToy(toyContainer, config);
  } else if (type === 'voice-toy') {
    renderVoiceToy(toyContainer, config);
  } else if (type === 'note-wheel-toy') {
    renderNoteWheelToy(toyContainer, config);
  } else if (type === 'hop-trail-toy') {
    renderHopTrailToy(toyContainer, config);
  } else if (type === 'major-scale-toy') {
    renderMajorScaleToy(toyContainer, config);
  } else if (type === 'minor-scale-toy') {
    renderMinorScaleToy(toyContainer, config);
  } else if (type === 'intervals-toy') {
    renderIntervalsToy(toyContainer, config);
  } else if (type === 'building-chords-toy') {
    renderBuildingChordsToy(toyContainer, config);
  } else if (type === 'chord-progressions-toy') {
    renderChordProgressionsToy(toyContainer, config);
  } else if (type === 'sullys-studio-toy') {
    renderSullysStudioToy(toyContainer, config);
  } else {
    toyContainer.innerHTML = 'No toy for this concept yet.';
  }
}

function refreshCompleteButton(concept) {
  const done = isVisited(concept.id);
  completeButton.setAttribute('aria-pressed', String(done));
  completeButton.classList.toggle('is-done', done);
  completeButton.querySelector('.popup-complete__label').textContent =
    done ? 'Done! Tap to undo' : 'Mark as done';
}

completeButton.addEventListener('click', () => {
  if (!currentConcept) return;
  const done = isVisited(currentConcept.id);
  if (done) markUnvisited(currentConcept.id);
  else markVisited(currentConcept.id);
  refreshCompleteButton(currentConcept);
});

export function openPopup(concept) {
  currentConcept = concept;
  titleEl.textContent = concept.title;
  definitionEl.textContent = concept.definition;
  renderNotation(concept);
  renderInstrument(concept);
  renderToy(concept);
  renderQuiz(quizContainer, concept);
  refreshCompleteButton(concept);
  overlay.classList.remove('hidden');
  open = true;
  setActiveSection('toy'); // start on the interactive toy
  setWalking(false);
  pauseBaa();
  if (SILENCE_BACKTRACK.has(concept.id)) {
    pauseBacktrack();
  } else {
    duckBacktrack();
  }
}

export function closePopup() {
  overlay.classList.add('hidden');
  open = false;
  resumeBaa();
  resumeBacktrack();
  stopBeatArcToy();
  stopRhythmStackToy();
  stopMountainToy();
  stopVoiceToy();
  stopNoteWheelToy();
  stopHopTrailToy();
  stopMajorScaleToy();
  stopMinorScaleToy();
  stopIntervalsToy();
  stopBuildingChordsToy();
  stopChordProgressionsToy();
  stopSullysStudioToy();
}

closeButton.addEventListener('click', closePopup);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && open) {
    closePopup();
  }
});
