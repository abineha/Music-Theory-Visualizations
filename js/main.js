import { WORLD_WIDTH, WORLD_HEIGHT } from './core/config.js';

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPlaceholder();
}

function drawPlaceholder() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.fillStyle = '#7fae5c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fdf6e3';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('world map goes here — Layer 2', w / 2, h / 2);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- HUD: volume + mute ---
const muteButton = document.getElementById('mute-button');
const muteIcon = document.getElementById('mute-icon');
const volumeSlider = document.getElementById('volume-slider');

let volume = Number(localStorage.getItem('goatVolume') ?? 80);
let isMuted = localStorage.getItem('goatMuted') === 'true';

volumeSlider.value = volume;
updateVolumeUI();

muteButton.addEventListener('click', () => {
  isMuted = !isMuted;
  localStorage.setItem('goatMuted', isMuted);
  updateVolumeUI();
});

volumeSlider.addEventListener('input', () => {
  volume = Number(volumeSlider.value);
  isMuted = volume === 0;
  localStorage.setItem('goatVolume', volume);
  localStorage.setItem('goatMuted', isMuted);
  updateVolumeUI();
});

function updateVolumeUI() {
  const effectivelyMuted = isMuted || volume === 0;
  muteIcon.src = effectivelyMuted
    ? 'assets/images/icons/mute.svg'
    : 'assets/images/icons/unmute.svg';
  muteButton.setAttribute('aria-label', effectivelyMuted ? 'Unmute' : 'Mute');
}

// Layer 6's AudioEngine will read this to scale all playback volume.
export function getEffectiveVolume() {
  return (isMuted ? 0 : volume) / 100;
}


// --- HUD: dialogue box, word-by-word reveal ---
const dialogueBox = document.getElementById('dialogue-box');

function typeDialogue(text, wordDelayMs = 220) {
  const words = text.split(' ');
  dialogueBox.textContent = '';
  words.forEach((word, i) => {
    setTimeout(() => {
      dialogueBox.textContent += (i === 0 ? '' : ' ') + word;
    }, i * wordDelayMs);
  });
}

typeDialogue('The goat wakes up and looks out across the hills...');
