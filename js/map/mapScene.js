import { CONCEPTS } from '../data/concepts.js';

const backgroundImage = new Image();
backgroundImage.src = 'assets/images/world-background.svg';

const nodeMarkerImage = new Image();
nodeMarkerImage.src = 'assets/images/node-marker.svg';

const NODE_MARKER_SIZE = 140; // world units — ~1.5-2x goat height, per the art sizing plan

export function isMapReady() {
  return backgroundImage.complete && nodeMarkerImage.complete;
}

export function drawMap(ctx, cameraX, cameraY, viewWidth, viewHeight) {
  ctx.drawImage(
    backgroundImage,
    cameraX, cameraY, viewWidth, viewHeight,
    0, 0, viewWidth, viewHeight
  );

  for (const concept of CONCEPTS) {
    const { x, y } = concept.mapNode;
    const screenX = x - cameraX;
    const screenY = y - cameraY;

    if (screenX < -NODE_MARKER_SIZE || screenX > viewWidth + NODE_MARKER_SIZE ||
        screenY < -NODE_MARKER_SIZE || screenY > viewHeight + NODE_MARKER_SIZE) {
      continue; // cheap off-screen culling
    }

    ctx.drawImage(
      nodeMarkerImage,
      screenX - NODE_MARKER_SIZE / 2,
      screenY - NODE_MARKER_SIZE,
      NODE_MARKER_SIZE,
      NODE_MARKER_SIZE
    );

    ctx.fillStyle = '#2a1f18';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(concept.title, screenX, screenY + 20);
  }
}
