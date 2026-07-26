
export const ZOOM = 1.22; 
const HOLD_RADIUS = 220;
const FOLLOW_RADIUS = 380;
const CAMERA_LAG = 4;

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function getFollowFactor(distanceFromOrigin) {
  if (distanceFromOrigin <= HOLD_RADIUS) return 0;
  if (distanceFromOrigin >= FOLLOW_RADIUS) return 1;
  const t = (distanceFromOrigin - HOLD_RADIUS) / (FOLLOW_RADIUS - HOLD_RADIUS);
  return smoothstep(t);
}

let currentCameraX = null;
let currentCameraY = null;

export function getCamera(targetX, targetY, viewWidth, viewHeight, deltaSeconds = 0) {
  const distanceFromOrigin = Math.sqrt(targetX * targetX + targetY * targetY);
  const followFactor = getFollowFactor(distanceFromOrigin);

  const focusX = targetX * followFactor;
  const focusY = targetY * followFactor;

  const targetCameraX = focusX - viewWidth / 2;
  const targetCameraY = focusY - viewHeight / 2;

  if (currentCameraX === null) {
    currentCameraX = targetCameraX;
    currentCameraY = targetCameraY;
  } else {
    const t = 1 - Math.exp(-CAMERA_LAG * deltaSeconds);
    currentCameraX += (targetCameraX - currentCameraX) * t;
    currentCameraY += (targetCameraY - currentCameraY) * t;
  }

  return { cameraX: currentCameraX, cameraY: currentCameraY };
}
