import { CONCEPTS } from '../data/concepts.js';
import { getConceptPosition } from '../core/config.js';

export const PROXIMITY_RADIUS = 260; 

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
