import { CONCEPTS } from '../data/concepts.js';

export const PANEL_SIZE = 900;
export const NODES_PER_PANEL = 2;

export const SECTION_DIRECTION = {
  foundations: 'left',
  melody: 'up',
  harmony: 'right',
  playground: 'down',
};

const PAD_OFFSETS = {
  left:  [{ x: 260,  y: 90 },   { x: -260, y: -75 }],
  right: [{ x: -260, y: -75 },  { x: 260,  y: 90 }],
  up:    [{ x: 90,   y: 260 },  { x: -75,  y: -260 }],
  down:  [{ x: -75,  y: -260 }, { x: 90,   y: 260 }],
};

function getPanelCentre(direction, index) {
  const distance = (index + 1) * PANEL_SIZE;
  switch (direction) {
    case 'left':  return { x: -distance, y: 0 };
    case 'right': return { x: distance,  y: 0 };
    case 'up':    return { x: 0, y: -distance };
    case 'down':  return { x: 0, y: distance };
    default:      return { x: 0, y: 0 };
  }
}

export function getPanelList(sectionNodeCounts) {
  const panels = [];
  for (const [section, direction] of Object.entries(SECTION_DIRECTION)) {
    const nodeCount = sectionNodeCounts[section] || 0;
    const panelCount = Math.ceil(nodeCount / NODES_PER_PANEL);
    for (let index = 0; index < panelCount; index++) {
      const { x: centreX, y: centreY } = getPanelCentre(direction, index);
      panels.push({ section, direction, index, centreX, centreY });
    }
  }
  return panels;
}

export function getSectionAt(x, y) {
  const halfHub = PANEL_SIZE / 2;
  if (x < -halfHub) return 'foundations';
  if (x > halfHub) return 'harmony';
  if (y < -halfHub) return 'melody';
  if (y > halfHub) return 'playground';
  return null;
}

const SECTION_NODE_COUNTS = CONCEPTS.reduce((counts, concept) => {
  counts[concept.section] = (counts[concept.section] || 0) + 1;
  return counts;
}, {});

export function getNodePosition(section, order) {
  const direction = SECTION_DIRECTION[section];
  const nodeIndexInSection = order - 1;
  const panelIndex = Math.floor(nodeIndexInSection / NODES_PER_PANEL);
  const padIndex = nodeIndexInSection % NODES_PER_PANEL;
  const centre = getPanelCentre(direction, panelIndex);

  const nodesInPanel = Math.min(NODES_PER_PANEL, (SECTION_NODE_COUNTS[section] || 0) - panelIndex * NODES_PER_PANEL);
  if (nodesInPanel === 1) {
    return centre;
  }

  const offset = PAD_OFFSETS[direction][padIndex];
  return { x: centre.x + offset.x, y: centre.y + offset.y };
}

export function getConceptPosition(concept) {
  return getNodePosition(concept.section, concept.order);
}
