import { duckBacktrack, restoreBacktrack, setWalking } from '../core/audioEngine.js';

const overlay = document.getElementById('popup-overlay');
const titleEl = document.getElementById('popup-title');
const closeButton = document.getElementById('popup-close');

let open = false;

export function isPopupOpen() {
  return open;
}

export function openPopup(concept) {
  titleEl.textContent = concept.title;
  overlay.classList.remove('hidden');
  open = true;
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
