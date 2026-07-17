import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/config.js';
import { isKeyDown } from '../core/input.js';
import { CONCEPTS } from '../data/concepts.js';
import { setWalking } from '../core/audioEngine.js';

const NODE_BLOCK_HALF_SIZE = 50; // blocks a 100x100 square centered on each node's ground point
const goatImage = new Image();
goatImage.src = 'assets/images/goat.svg';

const GOAT_WIDTH = 90;   // matches the "goat = ~90 units tall" sizing ruler from planning
const GOAT_HEIGHT = 99;  // goat.svg is 100x110 — keep that aspect ratio
const SPEED = 400;       // world units per second

export const goat = {
  x: WORLD_WIDTH * 0.15,  // spawns inside the Foundations biome
  y: WORLD_HEIGHT / 2,
  facing: 'right',
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
  setWalking(moving);


  if (moving) {
    const length = Math.sqrt(dx * dx + dy * dy);
    dx /= length; // normalize so diagonal movement isn't faster than straight movement
    dy /= length;

    const nextX = clamp(goat.x + dx * SPEED * deltaSeconds, GOAT_WIDTH / 2, WORLD_WIDTH - GOAT_WIDTH / 2);
    const nextY = clamp(goat.y + dy * SPEED * deltaSeconds, GOAT_HEIGHT / 2, WORLD_HEIGHT - GOAT_HEIGHT / 2);

    // resolve X and Y separately so the goat slides along a blocked node instead of getting stuck
    if (!collidesWithNode(nextX, goat.y)) {
      goat.x = nextX;
    }
    if (!collidesWithNode(goat.x, nextY)) {
      goat.y = nextY;
    }
    
    if (dx < 0) goat.facing = 'left';
    else if (dx > 0) goat.facing = 'right';
  }

  return moving;
}

export function drawGoat(ctx, cameraX, cameraY) {
  const screenX = goat.x - cameraX;
  const screenY = goat.y - cameraY;

  ctx.save();
  if (goat.facing === 'left') {
    // mirror the single placeholder sprite around the goat's own center
    ctx.translate(screenX, screenY);
    ctx.scale(-1, 1);
    ctx.drawImage(goatImage, -GOAT_WIDTH / 2, -GOAT_HEIGHT / 2, GOAT_WIDTH, GOAT_HEIGHT);
  } else {
    ctx.drawImage(goatImage, screenX - GOAT_WIDTH / 2, screenY - GOAT_HEIGHT / 2, GOAT_WIDTH, GOAT_HEIGHT);
  }
  ctx.restore();
}

export function isGoatReady() {
  return goatImage.complete;
}
