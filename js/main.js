import { WORLD_WIDTH, WORLD_HEIGHT } from './core/config.js';
import { drawMap, isMapReady } from './map/mapScene.js';
import { updateGoat, drawGoat, isGoatReady } from './map/goat.js';

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const hintText = document.getElementById('hint-text');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

let lastTimestamp = null;
let hasMoved = false;

// Temporary fixed camera, anchored on the Foundations biome.
// Layer 4 replaces this with a camera that follows the goat.
function gameLoop(timestamp) {
  const deltaSeconds = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  const moved = updateGoat(deltaSeconds);
  if (moved && !hasMoved) {
    hasMoved = true;
    hintText.classList.add('hidden');
  }

  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const cameraX = clamp(0, 0, WORLD_WIDTH - viewWidth);
  const cameraY = clamp(WORLD_HEIGHT / 2 - viewHeight / 2, 0, WORLD_HEIGHT - viewHeight);

  if (isMapReady()) {
    drawMap(ctx, cameraX, cameraY, viewWidth, viewHeight);
  }
  if (isGoatReady()) {
    drawGoat(ctx, cameraX, cameraY);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

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
