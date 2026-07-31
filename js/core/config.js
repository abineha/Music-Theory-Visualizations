
export const PANEL_SIZE = 900;
export const NODES_PER_PANEL = 2;  

export const SECTION_DIRECTION = {
  foundations: 'left',
  melody: 'up',
  harmony: 'right',
  playground: 'down',
};

const PAD_OFFSETS = {
  left:  [{ x: 170,  y: 60 },   { x: -170, y: -50 }],
  right: [{ x: -170, y: -50 },  { x: 170,  y: 60 }],
  up:    [{ x: 60,   y: 170 },  { x: -50,  y: -170 }],
  down:  [{ x: -50,  y: -170 }, { x: 60,   y: 170 }],
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

export function getNodePosition(section, order) {
  const direction = SECTION_DIRECTION[section];
  const nodeIndexInSection = order - 1;
  const panelIndex = Math.floor(nodeIndexInSection / NODES_PER_PANEL);
  const padIndex = nodeIndexInSection % NODES_PER_PANEL;
  const centre = getPanelCentre(direction, panelIndex);
  const offset = PAD_OFFSETS[direction][padIndex];
  return { x: centre.x + offset.x, y: centre.y + offset.y };
}

export function getConceptPosition(concept) {
  return getNodePosition(concept.section, concept.order);
}
