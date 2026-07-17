import { drawBackground, drawNodes, isMapReady } from './map/mapScene.js';
import { updateGoat, drawGoat, isGoatReady, goat } from './map/goat.js';
import { getCamera } from './map/camera.js';
import { findNearestNodeInRange, PROXIMITY_RADIUS } from './map/nodes.js';
import { openPopup, isPopupOpen } from './popup/popupController.js';
import { initAudio, setVolume, updateProximityTone } from './core/audioEngine.js';

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const hintText = document.getElementById('hint-text');

const interactPrompt = document.getElementById('interact-prompt');
const NODE_PROMPT_OFFSET = 160;
let currentNearbyNode = null;

const startGate = document.getElementById('start-gate');
let gameStarted = false;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let lastTimestamp = null;
let hasMoved = false;

function gameLoop(timestamp) {
  const deltaSeconds = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (gameStarted && !isPopupOpen()) {
    const moved = updateGoat(deltaSeconds);
    if (moved && !hasMoved) {
      hasMoved = true;
      hintText.classList.add('hidden');
    }
    currentNearbyNode = findNearestNodeInRange(goat.x, goat.y);
  } else {
    currentNearbyNode = null;
  }

  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const { cameraX, cameraY } = getCamera(goat.x, goat.y, viewWidth, viewHeight);

  if (currentNearbyNode) {
    const screenX = currentNearbyNode.mapNode.x - cameraX;
    const screenY = currentNearbyNode.mapNode.y - cameraY - NODE_PROMPT_OFFSET;
    interactPrompt.style.left = `${screenX}px`;
    interactPrompt.style.top = `${screenY}px`;
    interactPrompt.classList.remove('hidden');

    const dx = currentNearbyNode.mapNode.x - goat.x;
    const dy = currentNearbyNode.mapNode.y - goat.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    updateProximityTone(1 - Math.min(distance / PROXIMITY_RADIUS, 1));
  } else {
    interactPrompt.classList.add('hidden');
    updateProximityTone(0);
  }

  if (isMapReady()) {
    drawBackground(ctx, cameraX, cameraY, viewWidth, viewHeight);
  }
  if (isGoatReady()) {
    drawGoat(ctx, cameraX, cameraY);
  }
  if (isMapReady()) {
    drawNodes(ctx, cameraX, cameraY, viewWidth, viewHeight);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

async function handleStart() {
  await initAudio();
  setVolume(getEffectiveVolume());
  startGate.classList.add('hidden');
  gameStarted = true;
  typeDialogue('The goat wakes up and looks out across the hills...');
}

startGate.addEventListener('click', handleStart);
window.addEventListener('keydown', handleStart, { once: true });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!isPopupOpen() && currentNearbyNode) {
      openPopup(currentNearbyNode);
    }
  }
});

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
  setVolume(getEffectiveVolume());
}

// Layer 6's AudioEngine reads this to scale all playback volume.
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
