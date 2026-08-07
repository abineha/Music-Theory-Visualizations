import { CONCEPTS } from '../data/concepts.js';
import { getConceptPosition } from '../core/config.js';

export const PROXIMITY_RADIUS = 260; 

export const CLICK_RADIUS = 115; // generous pointer accuracy, matches the larger node markers

export function findNodeAtWorldPoint(wx, wy) {
  let best = null;
  let bestDist = CLICK_RADIUS;

  for (const concept of CONCEPTS) {
    const { x, y } = getConceptPosition(concept);
    const d = Math.hypot(x - wx, (y - 90) - wy); // 90 = half of NODE_MARKER_SIZE, the marker's visual center
    if (d < bestDist) {
      best = concept;
      bestDist = d;
    }
  }

  return best;
}

export function findNearestNodeInRange(goatX, goatY) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const concept of CONCEPTS) {
    const { x: nx, y: ny } = getConceptPosition(concept);
    const dx = nx - goatX;
    const dy = ny - goatY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= PROXIMITY_RADIUS && distance < nearestDistance) {
      nearest = concept;
      nearestDistance = distance;
    }
  }

  return nearest;
}
