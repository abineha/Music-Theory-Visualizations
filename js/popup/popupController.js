import { duckBacktrack, restoreBacktrack, setWalking, pauseBaa, resumeBaa } from '../core/audioEngine.js';
import { renderNotation } from './notation.js';
import { renderKeyboard } from './instruments/keyboard.js';
import { renderDrumPad } from './instruments/drumPad.js';
import { renderSliderToy } from './toys/sliderToy.js';
import { renderTapToy } from './toys/tapToy.js';
import { renderKeyboardHighlightToy } from './toys/keyboardHighlightToy.js';


const overlay = document.getElementById('popup-overlay');
const titleEl = document.getElementById('popup-title');
const definitionEl = document.getElementById('popup-definition');
const closeButton = document.getElementById('popup-close');
const tabs = document.querySelectorAll('.popup-tab');
const panels = document.querySelectorAll('.popup-panel-body');
const toyContainer = document.getElementById('toy-container');

let open = false;

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
  } else if (type === 'tap-toy') {
    renderTapToy(toyContainer, config);
  } else if (type === 'keyboard-highlight-toy') {
    renderKeyboardHighlightToy(toyContainer, config);
  } else {
    toyContainer.innerHTML = 'No toy for this concept yet.';
  }
}

export function openPopup(concept) {
  titleEl.textContent = concept.title;
  definitionEl.textContent = concept.definition;
  renderNotation(concept);
  renderInstrument(concept);
  renderToy(concept);
  overlay.classList.remove('hidden');
  open = true;
  setActiveSection('toy'); // kids always start on the interactive toy
  setWalking(false);
  pauseBaa();
  duckBacktrack();
}

export function closePopup() {
  overlay.classList.add('hidden');
  open = false;
  resumeBaa();
  restoreBacktrack();
}

closeButton.addEventListener('click', closePopup);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && open) {
    closePopup();
  }
});
