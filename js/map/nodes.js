import { CONCEPTS } from '../data/concepts.js';

export const PROXIMITY_RADIUS = 260; // world units — larger than a node's collision box, so the prompt appears before the goat is physically blocked

export function findNearestNodeInRange(goatX, goatY) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const concept of CONCEPTS) {
    const dx = concept.mapNode.x - goatX;
    const dy = concept.mapNode.y - goatY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= PROXIMITY_RADIUS && distance < nearestDistance) {
      nearest = concept;
      nearestDistance = distance;
    }
  }

  return nearest;
}
