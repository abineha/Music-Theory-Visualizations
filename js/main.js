import { drawBackground, isMapReady, SCENE_ENTITIES, getDebugPanelRects } from './map/mapScene.js';
import { getSectionAt, getConceptPosition, PANEL_SIZE } from './core/config.js';
import { updateGoat, drawGoat, isGoatReady, goat, getContainmentRects, NODE_BLOCK_HALF_SIZE, setGoatTarget, drawMoveTarget, resetGoatPosition } from './map/goat.js';
import { getCamera, ZOOM, setZoom, screenToWorld } from './map/camera.js';
import { findNearestNodeInRange, PROXIMITY_RADIUS, findNodeAtWorldPoint } from './map/nodes.js';
import { openPopup, isPopupOpen } from './popup/popupController.js';
import { initAudio, setAmbientVolume, setInteractiveVolume, updateProximityTone } from './core/audioEngine.js';
import { CONCEPTS } from './data/concepts.js';
import './core/touchControls.js';

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

const interactPrompt = document.getElementById('interact-prompt');
const NODE_PROMPT_OFFSET = 195;
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
  foundations: 'Sully trots through the soft green grass of Foundations Meadow, ready for a new adventure!',
  melody: 'Sully climbs upward through the muddy paths of Melody Marsh, determined to keep going!',
  harmony: 'Sully chases the gentle wind across the golden sands of Harmony Dunes, discovering new paths ahead!',
  playground: 'Sully races into the snowy Playground, ready to jump, play, and have fun!',
};
const HUB_DIALOGUE = "Sully returns to the village square, wondering where to explore next!";
let lastSection;

const IDLE_DIALOGUE = [
  "Sully is getting a little curious... where are we going?",
  "Sully is ready for a new adventure. Guide him onward!",
  "Sully blinks and looks around, ready to explore!",
  "Sully wonders what awaits beyond the path ahead...",
];
const IDLE_PROMPT_DELAY = 10;
let idleTimer = 0;
let idlePromptActive = false;

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
      idleTimer = 0;
      idlePromptActive = false;
    }

    if (goat.moving) {
      if (idlePromptActive) {
        typeDialogue(currentSection === null ? HUB_DIALOGUE : SECTION_DIALOGUE[currentSection]);
        idlePromptActive = false;
      }
      idleTimer = 0;
    } else {
      idleTimer += deltaSeconds;
      if (idleTimer >= IDLE_PROMPT_DELAY) {
        const line = IDLE_DIALOGUE[Math.floor(Math.random() * IDLE_DIALOGUE.length)];
        typeDialogue(line);
        idlePromptActive = true;
        idleTimer = 0;
      }
    }

  } else {
    currentNearbyNode = null;
  }

  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  const effectiveViewWidth = viewWidth / ZOOM;
  const effectiveViewHeight = viewHeight / ZOOM;
  const { cameraX, cameraY } = getCamera(goat.x, goat.y, effectiveViewWidth, effectiveViewHeight, deltaSeconds);

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
    if (currentNearbyNode.id === 'beat-tempo' || currentNearbyNode.id === 'rhythm-patterns' || currentNearbyNode.id === 'pitch-high-low' || currentNearbyNode.id === 'loud-soft') {
      updateProximityTone(0); 
    } else {
      updateProximityTone(1 - Math.min(distance / PROXIMITY_RADIUS, 1));
    }
  } else {
    interactPrompt.classList.add('hidden');
    updateProximityTone(0);
  }

  if (isMapReady() && !isPopupOpen()) {
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
  setAmbientVolume(getEffectiveVolume());
  setInteractiveVolume(getEffectivePopupVolume());
  startGate.classList.add('hidden');
  gameStarted = true;
  typeDialogue("Sully the goat stretches, smiles, and looks across the village square. There's so much to explore today!");
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
  if (!gameStarted || isPopupOpen()) {
    canvas.style.cursor = '';
    moveHint.classList.add('hidden');
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  const world = screenToWorld(screenX, screenY);
  const hoveredNode = findNodeAtWorldPoint(world.x, world.y);
  canvas.style.cursor = hoveredNode ? 'pointer' : '';

  if (hasClickedToMove) {
    moveHint.classList.add('hidden');
    return;
  }
  moveHint.style.left = `${screenX}px`;
  moveHint.style.top = `${screenY}px`;
  moveHint.classList.remove('hidden');
});

canvas.addEventListener('mouseleave', () => {
  canvas.style.cursor = '';
  moveHint.classList.add('hidden');
});

canvas.addEventListener('click', (e) => {
  if (!gameStarted || isPopupOpen()) return;
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  const world = screenToWorld(clickX, clickY);

  const hitNode = findNodeAtWorldPoint(world.x, world.y);
  if (hitNode) {
    openPopup(hitNode);
    return;
  }

  setGoatTarget(world.x, world.y);
  hasClickedToMove = true;
  moveHint.classList.add('hidden');
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

const popupMuteButton = document.getElementById('popup-mute-button');
const popupMuteIcon = document.getElementById('popup-mute-icon');
const popupVolumeSlider = document.getElementById('popup-volume-slider');

let volume = Number(localStorage.getItem('goatVolume') ?? 80);
let isMuted = localStorage.getItem('goatMuted') === 'true';
let popupVolume = Number(localStorage.getItem('goatPopupVolume') ?? 80);
let popupIsMuted = localStorage.getItem('goatPopupMuted') === 'true';

let lastNonZeroVolume = volume > 0 ? volume : 80;
let popupLastNonZeroVolume = popupVolume > 0 ? popupVolume : 80;

volumeSlider.value = volume;
popupVolumeSlider.value = popupVolume;
updateVolumeUI();
updatePopupVolumeUI();

muteButton.addEventListener('click', () => {
  isMuted = !isMuted;
  if (!isMuted && volume === 0) {
    volume = lastNonZeroVolume;
    localStorage.setItem('goatVolume', volume);
  }
  localStorage.setItem('goatMuted', isMuted);
  updateVolumeUI();
});

volumeSlider.addEventListener('input', () => {
  volume = Number(volumeSlider.value);
  if (volume > 0) lastNonZeroVolume = volume;
  isMuted = volume === 0;
  localStorage.setItem('goatVolume', volume);
  localStorage.setItem('goatMuted', isMuted);
  updateVolumeUI();
});

popupMuteButton.addEventListener('click', () => {
  popupIsMuted = !popupIsMuted;
  if (!popupIsMuted && popupVolume === 0) {
    popupVolume = popupLastNonZeroVolume;
    localStorage.setItem('goatPopupVolume', popupVolume);
  }
  localStorage.setItem('goatPopupMuted', popupIsMuted);
  updatePopupVolumeUI();
});

popupVolumeSlider.addEventListener('input', () => {
  popupVolume = Number(popupVolumeSlider.value);
  if (popupVolume > 0) popupLastNonZeroVolume = popupVolume;
  popupIsMuted = popupVolume === 0;
  localStorage.setItem('goatPopupVolume', popupVolume);
  localStorage.setItem('goatPopupMuted', popupIsMuted);
  updatePopupVolumeUI();
});

function applyMuteUI(button, icon, slider, displayValue, effectivelyMuted) {
  slider.value = displayValue;
  updateSliderFill(slider);
  button.classList.toggle('muted', effectivelyMuted);
  icon.src = effectivelyMuted ? 'assets/images/icons/mute.svg' : 'assets/images/icons/unmute.svg';
  button.setAttribute('aria-label', effectivelyMuted ? 'Unmute' : 'Mute');
}

function updateVolumeUI() {
  const effectivelyMuted = isMuted || volume === 0;
  applyMuteUI(muteButton, muteIcon, volumeSlider, effectivelyMuted ? 0 : volume, effectivelyMuted);
  setAmbientVolume(getEffectiveVolume());
}

function updatePopupVolumeUI() {
  const effectivelyMuted = popupIsMuted || popupVolume === 0;
  applyMuteUI(popupMuteButton, popupMuteIcon, popupVolumeSlider, effectivelyMuted ? 0 : popupVolume, effectivelyMuted);
  setInteractiveVolume(getEffectivePopupVolume());
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

export function getEffectivePopupVolume() {
  return (popupIsMuted ? 0 : popupVolume) / 100;
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
