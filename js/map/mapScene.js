import { CONCEPTS } from '../data/concepts.js';
import { isVisited, isQuizPassed } from '../core/progress.js';

const backgroundImage = new Image();
backgroundImage.src = 'assets/images/world-background.svg';

const nodeMarkerImage = new Image();
nodeMarkerImage.src = 'assets/images/node-marker.svg';

const NODE_MARKER_SIZE = 140; // world units — ~1.5-2x goat height, per the art sizing plan

export function isMapReady() {
  return backgroundImage.complete && nodeMarkerImage.complete;
}

export function drawBackground(ctx, cameraX, cameraY, viewWidth, viewHeight) {
  ctx.drawImage(
    backgroundImage,
    cameraX, cameraY, viewWidth, viewHeight,
    0, 0, viewWidth, viewHeight
  );
}

function drawBadge(ctx, x, y, symbol, color) {
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#2a1f18';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fdf6e3';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x, y);
  ctx.textBaseline = 'alphabetic'; // reset — the title text drawn after this relies on the default baseline
}

export function drawNodes(ctx, cameraX, cameraY, viewWidth, viewHeight) {
  for (const concept of CONCEPTS) {
    const { x, y } = concept.mapNode;
    const screenX = x - cameraX;
    const screenY = y - cameraY;

    if (screenX < -NODE_MARKER_SIZE || screenX > viewWidth + NODE_MARKER_SIZE ||
        screenY < -NODE_MARKER_SIZE || screenY > viewHeight + NODE_MARKER_SIZE) {
      continue;
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

    if (isQuizPassed(concept.id)) {
      drawBadge(ctx, screenX + 40, screenY - NODE_MARKER_SIZE + 15, '\u2605', '#f4c95d');
    } else if (isVisited(concept.id)) {
      drawBadge(ctx, screenX + 40, screenY - NODE_MARKER_SIZE + 15, '\u2713', '#5a8a3f');
    }

    ctx.fillText(concept.title, screenX, screenY + 20);
  }
}

