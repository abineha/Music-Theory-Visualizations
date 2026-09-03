import { duckBacktrack, pauseBacktrack, resumeBacktrack, setWalking, pauseBaa, resumeBaa } from '../core/audioEngine.js';
import { markVisited, markUnvisited, isVisited } from '../core/progress.js';
import { renderIntervalsToy, stopIntervalsToy } from './toys/intervalsToy.js';
import { renderNoteWheelToy, stopNoteWheelToy } from './toys/noteWheelToy.js';
import { renderHopTrailToy, stopHopTrailToy } from './toys/hopTrailToy.js';
import { renderMajorScaleToy, stopMajorScaleToy } from './toys/majorScaleToy.js';
import { renderMinorScaleToy, stopMinorScaleToy } from './toys/minorScaleToy.js';
import { renderBuildingChordsToy, stopBuildingChordsToy } from './toys/buildingChordsToy.js';
import { renderChordProgressionsToy, stopChordProgressionsToy } from './toys/chordProgressionsToy.js';
import { renderSullysStudioToy, stopSullysStudioToy } from './toys/sullysStudioToy.js';
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
const toyInner = document.getElementById('toy-inner');
const notationContainer = document.getElementById('notation-canvas');
const instrumentContainer = document.getElementById('instrument-container');
const quizContainer = document.getElementById('quiz-container');
const completeButton = document.getElementById('popup-complete');

// Definition, Notation, Instrument, and Quiz are future scope 
definitionEl.textContent = 'Coming Soon!';
notationContainer.textContent = 'Coming Soon!';
instrumentContainer.textContent = 'Coming Soon!';
quizContainer.textContent = 'Coming Soon!';

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

function renderToy(concept) {
  if (!concept.toy) {
    toyInner.innerHTML = 'No toy for this concept yet.';
    return;
  }
  const { type, config } = concept.toy;
  if (type === 'beat-arc-toy') {
    renderBeatArcToy(toyInner, config);
  } else if (type === 'herd-stack-toy') {
    renderRhythmStackToy(toyInner, config);
  } else if (type === 'mountain-toy') {
    renderMountainToy(toyInner, config);
  } else if (type === 'voice-toy') {
    renderVoiceToy(toyInner, config);
  } else if (type === 'note-wheel-toy') {
    renderNoteWheelToy(toyInner, config);
  } else if (type === 'hop-trail-toy') {
    renderHopTrailToy(toyInner, config);
  } else if (type === 'major-scale-toy') {
    renderMajorScaleToy(toyInner, config);
  } else if (type === 'minor-scale-toy') {
    renderMinorScaleToy(toyInner, config);
  } else if (type === 'intervals-toy') {
    renderIntervalsToy(toyInner, config);
  } else if (type === 'building-chords-toy') {
    renderBuildingChordsToy(toyInner, config);
  } else if (type === 'chord-progressions-toy') {
    renderChordProgressionsToy(toyInner, config);
  } else if (type === 'sullys-studio-toy') {
    renderSullysStudioToy(toyInner, config);
  } else {
    toyInner.innerHTML = 'No toy for this concept yet.';
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

let fitResizeObserver = null;
function fitToyToViewport() {
  toyInner.style.transform = 'none';
  toyContainer.style.height = 'auto';
  const parent = toyContainer.parentElement;
  const parentRect = parent.getBoundingClientRect();
  const parentStyle = getComputedStyle(parent);
  const padX = parseFloat(parentStyle.paddingLeft) + parseFloat(parentStyle.paddingRight);
  const padY = parseFloat(parentStyle.paddingTop) + parseFloat(parentStyle.paddingBottom);
  const availW = parentRect.width - padX;
  const availH = parentRect.height - padY;
  const naturalW = toyInner.scrollWidth;
  const naturalH = toyInner.scrollHeight;
  if (!availW || !availH || !naturalW || !naturalH) return;
  const scale = Math.min(1, availW / naturalW, availH / naturalH);
  if (scale < 0.999) {
    const offsetX = Math.max(0, (availW - naturalW * scale) / 2);
    toyInner.style.transformOrigin = 'top left';
    toyInner.style.transform = `translateX(${offsetX}px) scale(${scale})`;
    toyContainer.style.height = `${naturalH * scale}px`;
  }
}

export function openPopup(concept) {
  currentConcept = concept;
  titleEl.textContent = concept.title;
  renderToy(concept);
  refreshCompleteButton(concept);
  overlay.classList.remove('hidden');
  open = true;
  setActiveSection('toy'); // start on the interactive toy
  fitToyToViewport();
  if (!fitResizeObserver) {
    fitResizeObserver = new ResizeObserver(() => fitToyToViewport());
    fitResizeObserver.observe(toyContainer.parentElement);
  }
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
