import { drawBackground, isMapReady, SCENE_ENTITIES, getDebugPanelRects } from './map/mapScene.js';
import { getSectionAt, getConceptPosition, PANEL_SIZE } from './core/config.js';
import { updateGoat, drawGoat, isGoatReady, goat, getContainmentRects, NODE_BLOCK_HALF_SIZE, setGoatTarget, drawMoveTarget, resetGoatPosition } from './map/goat.js';
import { getCamera, ZOOM, setZoom } from './map/camera.js';
import { findNearestNodeInRange, PROXIMITY_RADIUS } from './map/nodes.js';
import { openPopup, isPopupOpen } from './popup/popupController.js';
import { initAudio, setVolume, updateProximityTone } from './core/audioEngine.js';
import { CONCEPTS } from './data/concepts.js';
import './core/touchControls.js';

let lastCameraX = 0;
let lastCameraY = 0;

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

const interactPrompt = document.getElementById('interact-prompt');
const NODE_PROMPT_OFFSET = 160;
let currentNearbyNode = null;

const startGate = document.getElementById('start-gate');
let gameStarted = false;

const moveHint = document.getElementById('move-hint');
let hasClickedToMove = false;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let lastTimestamp = null;
const SECTION_DIALOGUE = {
  foundations: 'The goat wanders through the Foundations meadow...',
  melody: 'The goat steps into the golden fields of Melody...',
  harmony: 'The goat climbs into the misty hills of Harmony...',
  playground: 'The goat bounds into the snowy Playground!',
};
const HUB_DIALOGUE = 'The goat returns to the village square...';
let lastSection; 

let debugEnabled = false;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyD') {
    debugEnabled = !debugEnabled;
  }
});

function drawDebugWorldOverlay(cameraX, cameraY) {
  ctx.save();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(80, 220, 255, 0.7)';
  for (const panel of getDebugPanelRects()) {
    const screenX = panel.centreX - PANEL_SIZE / 2 - cameraX;
    const screenY = panel.centreY - PANEL_SIZE / 2 - cameraY;
    ctx.strokeRect(screenX, screenY, PANEL_SIZE, PANEL_SIZE);
  }

  ctx.strokeStyle = 'rgba(255, 90, 255, 0.9)';
  for (const rect of getContainmentRects()) {
    ctx.strokeRect(
      rect.left - cameraX, rect.top - cameraY,
      rect.right - rect.left, rect.bottom - rect.top
    );
  }

  for (const concept of CONCEPTS) {
    const { x, y } = getConceptPosition(concept);
    const screenX = x - cameraX;
    const screenY = y - cameraY;

    ctx.strokeStyle = 'rgba(255, 90, 90, 0.85)';
    ctx.strokeRect(
      screenX - NODE_BLOCK_HALF_SIZE, screenY - NODE_BLOCK_HALF_SIZE,
      NODE_BLOCK_HALF_SIZE * 2, NODE_BLOCK_HALF_SIZE * 2
    );

    ctx.fillStyle = 'rgba(255, 230, 90, 0.95)';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawDebugCoordsReadout(viewHeight) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`x: ${Math.round(goat.x)}  y: ${Math.round(goat.y)}`, 12, viewHeight - 12);
  ctx.restore();
}

function gameLoop(timestamp) {
  const deltaSeconds = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (gameStarted && !isPopupOpen()) {
    updateGoat(deltaSeconds);
    currentNearbyNode = findNearestNodeInRange(goat.x, goat.y);
    const currentSection = getSectionAt(goat.x, goat.y);
    if (currentSection !== lastSection) {
      if (lastSection !== undefined) {
        typeDialogue(currentSection === null ? HUB_DIALOGUE : SECTION_DIALOGUE[currentSection]);
      }
      lastSection = currentSection;
    }

  } else {
    currentNearbyNode = null;
  }

  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  const effectiveViewWidth = viewWidth / ZOOM;
  const effectiveViewHeight = viewHeight / ZOOM;
  const { cameraX, cameraY } = getCamera(goat.x, goat.y, effectiveViewWidth, effectiveViewHeight, deltaSeconds);

  lastCameraX = cameraX;
  lastCameraY = cameraY;

  if (currentNearbyNode) {
    const { x: nodeX, y: nodeY } = getConceptPosition(currentNearbyNode);
    const screenX = (nodeX - cameraX) * ZOOM;
    const screenY = (nodeY - cameraY - NODE_PROMPT_OFFSET) * ZOOM;
    interactPrompt.style.left = `${screenX}px`;
    interactPrompt.style.top = `${screenY}px`;
    interactPrompt.classList.remove('hidden');

    const dx = nodeX - goat.x;
    const dy = nodeY - goat.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    updateProximityTone(1 - Math.min(distance / PROXIMITY_RADIUS, 1));
  } else {
    interactPrompt.classList.add('hidden');
    updateProximityTone(0);
  }

  if (isMapReady()) {
    ctx.save();
    ctx.scale(ZOOM, ZOOM);

    drawBackground(ctx, cameraX, cameraY, effectiveViewWidth, effectiveViewHeight);

    const drawList = [...SCENE_ENTITIES];
    if (isGoatReady()) {
      drawList.push({
        y: goat.y,
        draw: (drawCtx, camX, camY) => drawGoat(drawCtx, camX, camY),
      });
    }
    drawList.sort((a, b) => a.y - b.y);
    for (const entity of drawList) {
      entity.draw(ctx, cameraX, cameraY, effectiveViewWidth, effectiveViewHeight);
    }

    drawMoveTarget(ctx, cameraX, cameraY);

    if (debugEnabled) {
      drawDebugWorldOverlay(cameraX, cameraY);
    }

    ctx.restore();
  }

  if (debugEnabled) {
    drawDebugCoordsReadout(viewHeight);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

async function handleStart() {
  await initAudio();
  setVolume(getEffectiveVolume());
  startGate.classList.add('hidden');
  gameStarted = true;
  typeDialogue('The goat wakes up and looks out across the village square...');
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

canvas.addEventListener('mousemove', (e) => {
  if (!gameStarted || isPopupOpen() || hasClickedToMove) {
    moveHint.classList.add('hidden');
    return;
  }
  const rect = canvas.getBoundingClientRect();
  moveHint.style.left = `${e.clientX - rect.left}px`;
  moveHint.style.top = `${e.clientY - rect.top}px`;
  moveHint.classList.remove('hidden');
});

canvas.addEventListener('mouseleave', () => {
  moveHint.classList.add('hidden');
});

canvas.addEventListener('click', (e) => {
  if (!gameStarted || isPopupOpen()) return;
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  const worldX = clickX / ZOOM + lastCameraX;
  const worldY = clickY / ZOOM + lastCameraY;
  setGoatTarget(worldX, worldY);
});

const zoomSlider = document.getElementById('zoom-slider');
zoomSlider.value = ZOOM;
updateSliderFill(zoomSlider);

zoomSlider.addEventListener('input', () => {
  const value = Number(zoomSlider.value);
  setZoom(value);
  updateSliderFill(zoomSlider);
});

const homeButton = document.getElementById('home-button');
homeButton.addEventListener('click', () => {
  resetGoatPosition();
});

// HUD
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
  volumeSlider.value = effectivelyMuted ? 0 : volume;
  updateSliderFill(volumeSlider);
  muteButton.classList.toggle('muted', effectivelyMuted);
  muteIcon.src = effectivelyMuted
    ? 'assets/images/icons/mute.svg'
    : 'assets/images/icons/unmute.svg';
  muteButton.setAttribute('aria-label', effectivelyMuted ? 'Unmute' : 'Mute');
  setVolume(getEffectiveVolume());
}

function updateSliderFill(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const percent = ((Number(slider.value) - min) / (max - min)) * 100;
  const fillColor = '#f4c95d';
  const trackColor = '#ead8ca';
  slider.style.background = `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${percent}%, ${trackColor} ${percent}%, ${trackColor} 100%)`;
}

export function getEffectiveVolume() {
  return (isMuted ? 0 : volume) / 100;
}

const dialogueBox = document.getElementById('dialogue-box');
let dialogueTimeouts = [];

function typeDialogue(text, wordDelayMs = 220) {
  dialogueTimeouts.forEach((id) => clearTimeout(id));
  dialogueTimeouts = [];

  const words = text.split(' ');
  dialogueBox.textContent = '';
  words.forEach((word, i) => {
    const id = setTimeout(() => {
      dialogueBox.textContent += (i === 0 ? '' : ' ') + word;
    }, i * wordDelayMs);
    dialogueTimeouts.push(id);
  });
}
