import { PANEL_SIZE, getPanelList, getConceptPosition } from '../core/config.js';
import { isKeyDown } from '../core/input.js';
import { CONCEPTS } from '../data/concepts.js';
import { setWalking } from '../core/audioEngine.js';

export const NODE_BLOCK_HALF_SIZE = 50;  
const EDGE_INSET = 70; 
function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}
const FRAMES_RIGHT = [
  loadImage('assets/images/goat/goat_r_1.png'),
  loadImage('assets/images/goat/goat_r_2.png'),
];
const IMAGE_BLINK = loadImage('assets/images/goat/goat_blink.png');

export const GOAT_WIDTH = 95;
export const GOAT_HEIGHT = 95;
const SPEED = 340;              
const FRAME_INTERVAL_MS = 180;   
const IDLE_FRAME_INTERVAL_MS = 1500;  
const BOB_AMPLITUDE = 4;  
const BOB_SPEED = 10;    
const SHADOW_RADIUS_X = 38;
const SHADOW_RADIUS_Y = 10;
const SHADOW_OPACITY = 0.28;
const SHADOW_OFFSET_X = -8;    

const CLICK_TARGET_ARRIVE_DISTANCE = 8;
const CLICK_TARGET_TIMEOUT = 4;
const TARGET_MARKER_COLOR = '176, 224, 158';
const TARGET_PULSE_SPEED = 3;

const SPAWN_X = 0;
const SPAWN_Y = -50;

export const goat = {
  x: SPAWN_X,
  y: SPAWN_Y,
  facing: 'right',
  moving: false,
  frameIndex: 0,
  frameTimer: 0,
  idleFrameIndex: 0,
  idleTimer: 0,
  bobPhase: 0,
  target: null,     // ( x, y ) click-to-move dest
  targetElapsed: 0,
};



function buildContainmentRects() {
  const sectionNodeCounts = {};
  for (const concept of CONCEPTS) {
    sectionNodeCounts[concept.section] = (sectionNodeCounts[concept.section] || 0) + 1;
  }
  const terrainPanels = getPanelList(sectionNodeCounts);
  const allCentres = [{ centreX: 0, centreY: 0 }, ...terrainPanels];

  const hasNeighbor = (cx, cy, dx, dy) =>
    allCentres.some((p) => p.centreX === cx + dx && p.centreY === cy + dy);

  const half = PANEL_SIZE / 2;
  return allCentres.map(({ centreX, centreY }) => {
    const insetTop = hasNeighbor(centreX, centreY, 0, -PANEL_SIZE) ? 0 : EDGE_INSET;
    const insetBottom = hasNeighbor(centreX, centreY, 0, PANEL_SIZE) ? 0 : EDGE_INSET;
    const insetLeft = hasNeighbor(centreX, centreY, -PANEL_SIZE, 0) ? 0 : EDGE_INSET;
    const insetRight = hasNeighbor(centreX, centreY, PANEL_SIZE, 0) ? 0 : EDGE_INSET;
    return {
      left: centreX - half + insetLeft,
      right: centreX + half - insetRight,
      top: centreY - half + insetTop,
      bottom: centreY + half - insetBottom,
    };
  });
}

const CONTAINMENT_RECTS = buildContainmentRects();

export function setGoatTarget(x, y) {
  goat.target = { x, y };
  goat.targetElapsed = 0;
}

export function resetGoatPosition() {
  goat.x = SPAWN_X;
  goat.y = SPAWN_Y;
  goat.target = null;
  goat.targetElapsed = 0;
  goat.facing = 'right';
  goat.moving = false;
  goat.frameIndex = 0;
  goat.frameTimer = 0;
  goat.idleFrameIndex = 0;
  goat.idleTimer = 0;
  goat.bobPhase = 0;
}

export function getContainmentRects() {
  return CONTAINMENT_RECTS;
}

function isInsideWorld(x, y) {
  return CONTAINMENT_RECTS.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}

function collidesWithNode(x, y) {
  for (const concept of CONCEPTS) {
    const { x: nx, y: ny } = getConceptPosition(concept);
    if (Math.abs(x - nx) < NODE_BLOCK_HALF_SIZE + GOAT_WIDTH / 2 &&
        Math.abs(y - ny) < NODE_BLOCK_HALF_SIZE + GOAT_HEIGHT / 2) {
      return true;
    }
  }
  return false;
}

export function updateGoat(deltaSeconds) {
  let dx = 0;
  let dy = 0;

  const arrowActive =
    isKeyDown('ArrowLeft') || isKeyDown('ArrowRight') ||
    isKeyDown('ArrowUp') || isKeyDown('ArrowDown');

  if (arrowActive) {
    goat.target = null; 
    if (isKeyDown('ArrowLeft'))  dx -= 1;
    if (isKeyDown('ArrowRight')) dx += 1;
    if (isKeyDown('ArrowUp'))    dy -= 1;
    if (isKeyDown('ArrowDown'))  dy += 1;
  } else if (goat.target) {
    const tdx = goat.target.x - goat.x;
    const tdy = goat.target.y - goat.y;
    const dist = Math.sqrt(tdx * tdx + tdy * tdy);

    goat.targetElapsed += deltaSeconds;
    if (dist < CLICK_TARGET_ARRIVE_DISTANCE || goat.targetElapsed > CLICK_TARGET_TIMEOUT) {
      goat.target = null;
    } else {
      dx = tdx;
      dy = tdy;
    }
  }

  const moving = dx !== 0 || dy !== 0;
  goat.moving = moving;
  setWalking(moving);

  if (moving) {
    goat.bobPhase += deltaSeconds * BOB_SPEED;
    goat.frameTimer += deltaSeconds * 1000;
    if (goat.frameTimer >= FRAME_INTERVAL_MS) {
      goat.frameTimer = 0;
      goat.frameIndex = goat.frameIndex === 0 ? 1 : 0;
    }
    goat.idleFrameIndex = 0;
    goat.idleTimer = 0;

    const length = Math.sqrt(dx * dx + dy * dy);
    dx /= length; 
    dy /= length;

    const nextX = goat.x + dx * SPEED * deltaSeconds;
    const nextY = goat.y + dy * SPEED * deltaSeconds;


    if (isInsideWorld(nextX, goat.y) && !collidesWithNode(nextX, goat.y)) {
      goat.x = nextX;
    }
    if (isInsideWorld(goat.x, nextY) && !collidesWithNode(goat.x, nextY)) {
      goat.y = nextY;
    }

    if (dx < 0) goat.facing = 'left';
    else if (dx > 0) goat.facing = 'right';
  } else {
    goat.frameIndex = 0;
    goat.frameTimer = 0;
    goat.bobPhase = 0;

    goat.idleTimer += deltaSeconds * 1000;
    if (goat.idleTimer >= IDLE_FRAME_INTERVAL_MS) {
      goat.idleTimer = 0;
      goat.idleFrameIndex = goat.idleFrameIndex === 0 ? 1 : 0;
    }
  }

  return moving;
}

export function drawGoat(ctx, cameraX, cameraY) {
  const screenX = goat.x - cameraX;
  const bobOffset = Math.sin(goat.bobPhase) * BOB_AMPLITUDE;
 
  const feetScreenY = goat.y - cameraY;
  const spriteScreenY = feetScreenY + bobOffset;

  const shadowX = screenX + (goat.facing === 'left' ? -SHADOW_OFFSET_X : SHADOW_OFFSET_X);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(shadowX, feetScreenY, SHADOW_RADIUS_X, SHADOW_RADIUS_Y, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 0, 0, ${SHADOW_OPACITY})`;
  ctx.fill();
  ctx.restore();

  const image = goat.moving
    ? FRAMES_RIGHT[goat.frameIndex]
    : (goat.idleFrameIndex === 0 ? FRAMES_RIGHT[0] : IMAGE_BLINK);

  ctx.save();
  if (goat.facing === 'left') {
    ctx.translate(screenX, spriteScreenY);
    ctx.scale(-1, 1);
    ctx.drawImage(image, -GOAT_WIDTH / 2, -GOAT_HEIGHT, GOAT_WIDTH, GOAT_HEIGHT);
  } else {
    ctx.drawImage(image, screenX - GOAT_WIDTH / 2, spriteScreenY - GOAT_HEIGHT, GOAT_WIDTH, GOAT_HEIGHT);
  }
  ctx.restore();
}

export function isGoatReady() {
  return FRAMES_RIGHT.every((img) => img.complete) && IMAGE_BLINK.complete;
}

export function drawMoveTarget(ctx, cameraX, cameraY) {
  if (!goat.target) return;

  const screenX = goat.target.x - cameraX;
  const screenY = goat.target.y - cameraY;
  const t = (performance.now() / 1000) * TARGET_PULSE_SPEED;
  const pulse = (Math.sin(t) + 1) / 2; 

  ctx.save();
  ctx.beginPath();
  ctx.arc(screenX, screenY, 10 + pulse * 8, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${TARGET_MARKER_COLOR}, ${0.9 - pulse * 0.6})`;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${TARGET_MARKER_COLOR}, 0.9)`;
  ctx.fill();
  ctx.restore();
}
