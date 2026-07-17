import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/config.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getCamera(targetX, targetY, viewWidth, viewHeight) {
  const cameraX = clamp(targetX - viewWidth / 2, 0, Math.max(0, WORLD_WIDTH - viewWidth));
  const cameraY = clamp(targetY - viewHeight / 2, 0, Math.max(0, WORLD_HEIGHT - viewHeight));
  return { cameraX, cameraY };
}
