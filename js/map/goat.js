import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/config.js';
import { isKeyDown } from '../core/input.js';
import { CONCEPTS } from '../data/concepts.js';
import { setWalking } from '../core/audioEngine.js';

const NODE_BLOCK_HALF_SIZE = 50; // blocks a 100x100 square centered on each node's ground point

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

// Two walk-cycle frames per direction — no dedicated up/down art,
// so vertical-only movement just keeps playing whichever side's cycle was last active.
const FRAMES_RIGHT = [
  loadImage('assets/images/goat/goat_r_1.png'),
  loadImage('assets/images/goat/goat_r_2.png'),
];
const IMAGE_BLINK = loadImage('assets/images/goat/goat_blink.png');


const GOAT_WIDTH = 90;    // adjust to match your art's aspect ratio once you see it in-browser
const GOAT_HEIGHT = 99;
const SPEED = 400;              // world units per second
const FRAME_INTERVAL_MS = 180;  // how fast pose1/pose2 alternate while walking
const IDLE_FRAME_INTERVAL_MS = 1500; // delay between idle blink toggles
const BOB_AMPLITUDE = 4; // px of vertical bob while walking
const BOB_SPEED = 10;    // radians per second — how fast the bob cycles
const SHADOW_RADIUS_X = 38;   // was 32 — a bit bigger
const SHADOW_RADIUS_Y = 10;
const SHADOW_OPACITY = 0.28;
const SHADOW_OFFSET_X = -8;   // shifts the shadow left of the goat's center


export const goat = {
  x: WORLD_WIDTH * 0.15,
  y: WORLD_HEIGHT / 2,
  facing: 'right',
  moving: false,
  frameIndex: 0,
  frameTimer: 0,
  idleFrameIndex: 0,
  idleTimer: 0,
  bobPhase: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function collidesWithNode(x, y) {
  for (const concept of CONCEPTS) {
    const nx = concept.mapNode.x;
    const ny = concept.mapNode.y;
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

  if (isKeyDown('ArrowLeft'))  dx -= 1;
  if (isKeyDown('ArrowRight')) dx += 1;
  if (isKeyDown('ArrowUp'))    dy -= 1;
  if (isKeyDown('ArrowDown'))  dy += 1;

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
    dx /= length; // normalize so diagonal movement isn't faster than straight movement
    dy /= length;

    const nextX = clamp(goat.x + dx * SPEED * deltaSeconds, GOAT_WIDTH / 2, WORLD_WIDTH - GOAT_WIDTH / 2);
    const nextY = clamp(goat.y + dy * SPEED * deltaSeconds, GOAT_HEIGHT / 2, WORLD_HEIGHT - GOAT_HEIGHT / 2);

    if (!collidesWithNode(nextX, goat.y)) {
      goat.x = nextX;
    }
    if (!collidesWithNode(goat.x, nextY)) {
      goat.y = nextY;
    }

    // facing only reacts to horizontal input — vertical-only movement keeps
    // whichever side-facing walk cycle was already playing
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
}

export function drawGoat(ctx, cameraX, cameraY) {
  const screenX = goat.x - cameraX;
  const bobOffset = Math.sin(goat.bobPhase) * BOB_AMPLITUDE;
  const screenY = goat.y - cameraY + bobOffset;

  const shadowY = goat.y - cameraY + GOAT_HEIGHT / 2 - 6;
  const shadowX = screenX + (goat.facing === 'left' ? -SHADOW_OFFSET_X : SHADOW_OFFSET_X);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, SHADOW_RADIUS_X, SHADOW_RADIUS_Y, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 0, 0, ${SHADOW_OPACITY})`;
  ctx.fill();
  ctx.restore();

  const image = goat.moving
    ? FRAMES_RIGHT[goat.frameIndex]
    : (goat.idleFrameIndex === 0 ? FRAMES_RIGHT[0] : IMAGE_BLINK);


  ctx.save();
  if (goat.facing === 'left') {
    ctx.translate(screenX, screenY);
    ctx.scale(-1, 1);
    ctx.drawImage(image, -GOAT_WIDTH / 2, -GOAT_HEIGHT / 2, GOAT_WIDTH, GOAT_HEIGHT);
  } else {
    ctx.drawImage(image, screenX - GOAT_WIDTH / 2, screenY - GOAT_HEIGHT / 2, GOAT_WIDTH, GOAT_HEIGHT);
  }
  ctx.restore();
}

export function isGoatReady() {
  return FRAMES_RIGHT.every(img => img.complete) && IMAGE_BLINK.complete;
}
