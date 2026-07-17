import { duckBacktrack, restoreBacktrack, setWalking } from '../core/audioEngine.js';
import { renderNotation } from './notation.js';

const overlay = document.getElementById('popup-overlay');
const titleEl = document.getElementById('popup-title');
const definitionEl = document.getElementById('popup-definition');
const closeButton = document.getElementById('popup-close');
const tabs = document.querySelectorAll('.popup-tab');
const panels = document.querySelectorAll('.popup-panel-body');

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

export function openPopup(concept) {
  titleEl.textContent = concept.title;
  definitionEl.textContent = concept.definition;
  renderNotation(concept);
  overlay.classList.remove('hidden');
  open = true;
  setActiveSection('toy'); // kids always start on the interactive toy
  setWalking(false);
  duckBacktrack();
}

export function closePopup() {
  overlay.classList.add('hidden');
  open = false;
  restoreBacktrack();
}

closeButton.addEventListener('click', closePopup);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && open) {
    closePopup();
  }
});
