import { CONCEPTS } from '../data/concepts.js';
import { isVisited } from '../core/progress.js';
import { PANEL_SIZE, getPanelList, getConceptPosition } from '../core/config.js';
import { goat } from './goat.js';
import { PROXIMITY_RADIUS, findNearestNodeInRange } from './nodes.js';
import { getBeatPhase, getBarPhase, isAudioReady, playDrumHit, playInstrumentNote } from '../core/audioEngine.js';

const TEXTURE_PX = 1800;  
const NODE_MARKER_SIZE = 180;

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const nodeMarkerImage = loadImage('assets/images/node-marker.svg');

const GLOBAL_ORDER = new Map(CONCEPTS.map((concept, i) => [concept.id, i + 1]));

const NODE1_CONCEPT_ID = 'beat-tempo';
const NODE1_FRAMES = {
  undone: [
    loadImage('assets/images/node1/goat-a.png'),
    loadImage('assets/images/node1/goat-b.png'),
  ],
  done: [
    loadImage('assets/images/node1/goat-a-done.png'),
    loadImage('assets/images/node1/goat-b-done.png'),
  ],
};
const NODE1_BEAT_HIT_PHASE = 0.18;
const NODE1_BOB_AMPLITUDE = 6;
const NODE1_BOB_PERIOD_MS = 260;
const NODE1_HIT_MIN_VELOCITY = 0.12; // quietest audible hit, at the edge of proximity range
let node1WasDownPose = false;

const NODE2_CONCEPT_ID = 'rhythm-patterns';
const NODE2_IMAGE = loadImage('assets/images/node2/Tambourine.gif');
const NODE2_BOB_AMPLITUDE = 6;
const NODE2_BOB_PERIOD_MS = 260;
const NODE2_HIT_MIN_VELOCITY = 0.12;
// The tresillo: a 3-3-2 syncopated grouping across 8 eighth-notes (kick on
// steps 0, 3, 6). It's the rhythmic cell behind reggaeton's dembow, the Bo
// Diddley beat, and a lot of "why can't I stop nodding to this" mechanical
// loops (washing machines included) - one accented kick per group, hats
// filling the rest, repeating every bar.
const NODE2_RHYTHM_PATTERN = [
  { type: 'low',  volume: 1.0 },
  { type: 'high', volume: 0.35 },
  { type: 'high', volume: 0.35 },
  { type: 'low',  volume: 1.0 },
  { type: 'high', volume: 0.35 },
  { type: 'high', volume: 0.35 },
  { type: 'low',  volume: 1.0 },
  { type: 'high', volume: 0.45 },
];
let node2LastStepIndex = -1;

const NODE3_CONCEPT_ID = 'pitch-high-low';
const NODE3_FRAMES = {
  undone: [
    loadImage('assets/images/node3/goat-a.png'),
    loadImage('assets/images/node3/goat-b.png'),
  ],
  done: [
    loadImage('assets/images/node3/goat-a-done.png'),
    loadImage('assets/images/node3/goat-b-done.png'),
  ],
};
const NODE3_BEAT_HIT_PHASE = 0.18;
const NODE3_BOB_AMPLITUDE = 6;
const NODE3_BOB_PERIOD_MS = 260;
// Do Re Mi Fa So La Ti Do, climbed then mirrored back down - same scale
// pattern as the mountain toy itself (semitone offsets from the tonic).
const NODE3_SCALE_SEMIS = [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0];
const NODE3_CHROMATIC_NOTES = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'];
const NODE3_HIT_MIN_VELOCITY = 0.12; // quietest audible note, at the edge of proximity range
let node3ScaleIndex = 0;
let node3LastBeatPhase = 0;

const NODE4_CONCEPT_ID = 'loud-soft';
const NODE4_FRAMES = {
  undone: [
    loadImage('assets/images/node4/goat-a.png'),
    loadImage('assets/images/node4/goat-b.png'),
  ],
  done: [
    loadImage('assets/images/node4/goat-a-done.png'),
    loadImage('assets/images/node4/goat-b-done.png'),
  ],
};
const NODE4_BEAT_HIT_PHASE = 0.18;
const NODE4_BOB_AMPLITUDE = 6;
const NODE4_BOB_PERIOD_MS = 260;
const NODE4_MELODY = ['E4', 'G4', 'E4', 'C4'];
const NODE4_SOFT_VELOCITY = 0.15;
const NODE4_LOUD_VELOCITY = 0.95;
const NODE4_PROXIMITY_MIN_SCALE = 0.15; // even the "loud" pass fades near the edge of range
let node4MelodyIndex = 0;
let node4IsLoudPass = false;
let node4LastBeatPhase = 0;

const NODE12_CONCEPT_ID = 'make-your-song';
const NODE12_IMAGE = loadImage('assets/images/node12/ukulele__1.png');
const NODE12_MARKER_SIZE = NODE_MARKER_SIZE * 1.8; // sole node in its panel, so it can run larger without crowding

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const PANEL_TEXTURES = {
  hub:   { src: 'assets/images/world/hub.png', filter: 'saturate(0.5) brightness(0.92)' },
  grass: { src: 'assets/images/world/grass.png', filter: 'saturate(0.5) brightness(0.92)' },
  mud:   { src: 'assets/images/world/mud.png', filter: 'saturate(0.5) brightness(0.92)' },
  sand:  { src: 'assets/images/world/sand.png', filter: 'saturate(0.5) brightness(0.92)' },
  snow:  { src: 'assets/images/world/tile.png', filter: 'saturate(0.5) brightness(0.92)' },
};

const TERRAIN_BY_SECTION = {
  foundations: 'grass',
  melody: 'mud',
  harmony: 'sand',
  playground: 'snow',
};

const rawTextureImages = {};
for (const key of Object.keys(PANEL_TEXTURES)) {
  rawTextureImages[key] = loadImage(PANEL_TEXTURES[key].src);
}

const tintedCanvases = {};

function buildTintedCanvas(key) {
  const img = rawTextureImages[key];
  if (!img.complete || img.naturalWidth === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const offCtx = canvas.getContext('2d');

  const { filter } = PANEL_TEXTURES[key];
  if (filter && filter !== 'none' && 'filter' in offCtx) {
    offCtx.filter = filter;
    offCtx.drawImage(img, 0, 0);
    offCtx.filter = 'none';
  } else {
    offCtx.drawImage(img, 0, 0);
  }
  return canvas;
}

function ensureTintedCanvases() {
  for (const key of Object.keys(PANEL_TEXTURES)) {
    if (!tintedCanvases[key]) {
      const canvas = buildTintedCanvas(key);
      if (canvas) tintedCanvases[key] = canvas;
    }
  }
}

export function isMapReady() {
  ensureTintedCanvases();
  return nodeMarkerImage.complete && Object.keys(PANEL_TEXTURES).every((key) => tintedCanvases[key]);
}

const SECTION_NODE_COUNTS = CONCEPTS.reduce((counts, concept) => {
  counts[concept.section] = (counts[concept.section] || 0) + 1;
  return counts;
}, {});
const TERRAIN_PANELS = getPanelList(SECTION_NODE_COUNTS);

export function getDebugPanelRects() {
  return [{ section: 'hub', centreX: 0, centreY: 0 }, ...TERRAIN_PANELS];
}

function drawPanel(ctx, canvas, centreX, centreY, cameraX, cameraY, viewWidth, viewHeight) {

  const screenX = Math.round(centreX - PANEL_SIZE / 2 - cameraX);
  const screenY = Math.round(centreY - PANEL_SIZE / 2 - cameraY);

  if (screenX + PANEL_SIZE < 0 || screenX > viewWidth ||
      screenY + PANEL_SIZE < 0 || screenY > viewHeight) {
    return;  
  }

  ctx.drawImage(canvas, 0, 0, TEXTURE_PX, TEXTURE_PX, screenX, screenY, PANEL_SIZE, PANEL_SIZE);
}

export function drawBackground(ctx, cameraX, cameraY, viewWidth, viewHeight) {

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  if (tintedCanvases.hub) {
    drawPanel(ctx, tintedCanvases.hub, 0, 0, cameraX, cameraY, viewWidth, viewHeight);
  }
  for (const panel of TERRAIN_PANELS) {
    const terrainKey = TERRAIN_BY_SECTION[panel.section];
    const canvas = tintedCanvases[terrainKey];
    if (!canvas) continue;
    drawPanel(ctx, canvas, panel.centreX, panel.centreY, cameraX, cameraY, viewWidth, viewHeight);
  }
}

const SIGN_IMAGES = {
  melody: loadImage('assets/images/world/sign-melody.png'),
  playground: loadImage('assets/images/world/sign-playground.png'),
  foundations: loadImage('assets/images/world/sign-foundations.png'),
  harmony: loadImage('assets/images/world/sign-harmony.png'),
};
const SIGN_POS = {
  melody: { x: 0, y: -190 },
  playground: { x: 0, y: 370 },
  foundations: { x: -320, y: 40 },
  harmony: { x: 320, y: 40 },
};
const SIGN_SIZE = { w: 330, h: 360 };

function drawFeetAnchored(ctx, image, worldX, worldY, w, h, cameraX, cameraY, viewWidth, viewHeight, label) {
  const screenX = worldX - cameraX;
  const screenY = worldY - cameraY;

  if (screenX + w < 0 || screenX - w > viewWidth || screenY < -h || screenY - h > viewHeight) {
    return;  
  }

  if (image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, screenX - w / 2, screenY - h, w, h);
  } else {
    ctx.save();
    ctx.fillStyle = 'rgba(80, 60, 40, 0.55)';
    ctx.strokeStyle = '#f4c95d';
    ctx.lineWidth = 2;
    ctx.fillRect(screenX - w / 2, screenY - h, w, h);
    ctx.strokeRect(screenX - w / 2, screenY - h, w, h);
    ctx.fillStyle = '#fdf6e3';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, screenX, screenY - h / 2);
    ctx.restore();
  }
}

const SIGN_PROGRESS_OFFSET_Y = 60;

function getSectionProgress(section) {
  let total = 0;
  let completed = 0;
  for (const concept of CONCEPTS) {
    if (concept.section !== section) continue;
    total++;
    if (isVisited(concept.id)) completed++;
  }
  return { completed, total };
}

const SIGN_PROGRESS_OFFSET_OVERRIDES = {
  playground: 0, 
};

const LEVITATE_AMPLITUDE = 6; 
const LEVITATE_SPEED = 2;    
const SIGN_PHASE_OFFSETS = {
  foundations: 0,
  melody: Math.PI / 2,
  harmony: Math.PI,
  playground: Math.PI * 1.5,
}; 

function drawSign(ctx, cameraX, cameraY, viewWidth, viewHeight, section) {
  const pos = SIGN_POS[section];
  const size = SIGN_SIZE;
  drawFeetAnchored(
    ctx, SIGN_IMAGES[section], pos.x, pos.y, size.w, size.h,
    cameraX, cameraY, viewWidth, viewHeight, `${section} sign`
  );

  const { completed, total } = getSectionProgress(section);
  const screenX = pos.x - cameraX;
  const topScreenY = pos.y - cameraY - size.h;
  const baseOffsetY = SIGN_PROGRESS_OFFSET_OVERRIDES[section] ?? SIGN_PROGRESS_OFFSET_Y;

  const t = performance.now() / 1000;
  const phase = t * LEVITATE_SPEED + (SIGN_PHASE_OFFSETS[section] || 0);
  const levitateOffset = Math.sin(phase) * LEVITATE_AMPLITUDE;
  const glow = 6 + Math.sin(phase) * 3; 

  const label = `${completed}/${total}`;
  const labelY = topScreenY + baseOffsetY + levitateOffset;

  ctx.save();
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2a1f18';
  ctx.strokeText(label, screenX, labelY);

  ctx.shadowColor = 'rgba(244, 201, 93, 0.9)';
  ctx.shadowBlur = glow;
  ctx.fillStyle = '#fdf6e3';
  ctx.fillText(label, screenX, labelY);
  ctx.restore();
}

// Nodes
function drawDoneBadge(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#6b4a2f';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#f4c95d';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x - 1.5, y + 3);
  ctx.lineTo(x + 4.5, y - 3.5);
  ctx.stroke();
}

function drawSingleNode(ctx, concept, cameraX, cameraY, viewWidth, viewHeight) {
  const { x, y } = getConceptPosition(concept);
  const screenX = x - cameraX;
  const screenY = y - cameraY;

  if (screenX < -NODE_MARKER_SIZE || screenX > viewWidth + NODE_MARKER_SIZE ||
      screenY < -NODE_MARKER_SIZE || screenY > viewHeight + NODE_MARKER_SIZE) {
    return;
  }

  if (concept.id === NODE1_CONCEPT_ID) {
    drawNode1(ctx, concept, x, y, screenX, screenY);
  } else if (concept.id === NODE2_CONCEPT_ID) {
    drawNode2(ctx, concept, x, y, screenX, screenY);
  } else if (concept.id === NODE3_CONCEPT_ID) {
    drawNode3(ctx, concept, x, y, screenX, screenY);
  } else if (concept.id === NODE4_CONCEPT_ID) {
    drawNode4(ctx, concept, x, y, screenX, screenY);
  } else if (concept.id === NODE12_CONCEPT_ID) {
    drawNode12(ctx, concept, screenX, screenY);
  } else {
    drawGenericNode(ctx, concept, screenX, screenY);
  }
}

function drawNode12(ctx, concept, screenX, screenY) {
  const frame = NODE12_IMAGE;
  let drawWidth = NODE_MARKER_SIZE;
  let drawHeight = NODE_MARKER_SIZE;

  if (frame.complete && frame.naturalWidth > 0) {
    const scale = Math.min(NODE12_MARKER_SIZE / frame.naturalWidth, NODE12_MARKER_SIZE / frame.naturalHeight);
    drawWidth = frame.naturalWidth * scale;
    drawHeight = frame.naturalHeight * scale;
    ctx.drawImage(
      frame,
      screenX - drawWidth / 2,
      screenY - drawHeight,
      drawWidth,
      drawHeight
    );
  }

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';

  if (isVisited(concept.id)) {
    drawDoneBadge(ctx, screenX + drawWidth / 2 - 10, screenY - drawHeight - 15);
  }

  ctx.fillText(`${GLOBAL_ORDER.get(concept.id)}: ${concept.title}`, screenX, screenY + 40);
}

function drawGenericNode(ctx, concept, screenX, screenY) {
  ctx.drawImage(
    nodeMarkerImage,
    screenX - NODE_MARKER_SIZE / 2,
    screenY - NODE_MARKER_SIZE,
    NODE_MARKER_SIZE,
    NODE_MARKER_SIZE
  );

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';

  if (isVisited(concept.id)) {
    drawDoneBadge(ctx, screenX + 40, screenY - NODE_MARKER_SIZE - 15);
  }

  ctx.fillText(`${GLOBAL_ORDER.get(concept.id)}: ${concept.title}`, screenX, screenY + 40);
}

function drawNode1(ctx, concept, worldX, worldY, screenX, screenY) {
  const isDone = isVisited(concept.id);
  const reducedMotion = prefersReducedMotion();
  const animate = !reducedMotion && isAudioReady();
  const pair = isDone ? NODE1_FRAMES.done : NODE1_FRAMES.undone;
  const beatPhase = animate ? getBeatPhase() : 0;
  const isDownPose = animate && beatPhase < NODE1_BEAT_HIT_PHASE;
  const frame = isDownPose ? pair[1] : pair[0];

  let bobOffset = 0;
  let inRange = false;
  let proximityRatio = 0;
  if (!reducedMotion) {
    const dx = worldX - goat.x;
    const dy = worldY - goat.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    inRange = distance <= PROXIMITY_RADIUS;
    if (inRange) {
      bobOffset = Math.sin(performance.now() / NODE1_BOB_PERIOD_MS) * NODE1_BOB_AMPLITUDE;
      proximityRatio = 1 - Math.min(distance / PROXIMITY_RADIUS, 1);
    }
  }

  const poseChanged = isDownPose !== node1WasDownPose;
  node1WasDownPose = isDownPose;

  // Only the single nearest node may trigger sound this frame - proximity
  // zones for adjacent nodes can overlap, and two nodes firing the same
  // shared synth in one frame throws a Tone.js scheduling error.
  const isNearest = inRange && findNearestNodeInRange(goat.x, goat.y)?.id === concept.id;

  if (animate && isNearest && poseChanged) {
    const eased = proximityRatio * proximityRatio;
    const velocity = NODE1_HIT_MIN_VELOCITY + eased * (1 - NODE1_HIT_MIN_VELOCITY);
    if (isDownPose) {
      playDrumHit('low', velocity);  
    } else {
      playDrumHit('high', velocity); 
    }
  }

  const spriteScreenY = screenY + bobOffset;

  if (frame.complete && frame.naturalWidth > 0) {
    ctx.drawImage(
      frame,
      screenX - NODE_MARKER_SIZE / 2,
      spriteScreenY - NODE_MARKER_SIZE,
      NODE_MARKER_SIZE,
      NODE_MARKER_SIZE
    );
  }

  if (isDone) {
    drawDoneBadge(ctx, screenX + 40, screenY - NODE_MARKER_SIZE - 15);
  }

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${GLOBAL_ORDER.get(concept.id)}: ${concept.title}`, screenX, screenY + 40);
}

function drawNode2(ctx, concept, worldX, worldY, screenX, screenY) {
  const isDone = isVisited(concept.id);
  const reducedMotion = prefersReducedMotion();
  const animate = !reducedMotion && isAudioReady();
  const frame = NODE2_IMAGE;

  let bobOffset = 0;
  let inRange = false;
  let proximityRatio = 0;
  if (!reducedMotion) {
    const dx = worldX - goat.x;
    const dy = worldY - goat.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    inRange = distance <= PROXIMITY_RADIUS;
    if (inRange) {
      bobOffset = Math.sin(performance.now() / NODE2_BOB_PERIOD_MS) * NODE2_BOB_AMPLITUDE;
      proximityRatio = 1 - Math.min(distance / PROXIMITY_RADIUS, 1);
    }
  }

  const isNearest = inRange && findNearestNodeInRange(goat.x, goat.y)?.id === concept.id;
  if (animate) {
    const stepIndex = Math.floor(getBarPhase() * NODE2_RHYTHM_PATTERN.length) % NODE2_RHYTHM_PATTERN.length;
    if (stepIndex !== node2LastStepIndex) {
      if (isNearest) {
        const eased = proximityRatio * proximityRatio;
        const proximityScale = NODE2_HIT_MIN_VELOCITY + eased * (1 - NODE2_HIT_MIN_VELOCITY);
        const step = NODE2_RHYTHM_PATTERN[stepIndex];
        playDrumHit(step.type, step.volume * proximityScale);
      }
      node2LastStepIndex = stepIndex;
    }
  }

  const spriteScreenY = screenY + bobOffset;

  if (frame.complete && frame.naturalWidth > 0) {
    ctx.drawImage(
      frame,
      screenX - NODE_MARKER_SIZE / 2,
      spriteScreenY - NODE_MARKER_SIZE,
      NODE_MARKER_SIZE,
      NODE_MARKER_SIZE
    );
  }

  if (isDone) {
    drawDoneBadge(ctx, screenX + 40, screenY - NODE_MARKER_SIZE - 15);
  }

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${GLOBAL_ORDER.get(concept.id)}: ${concept.title}`, screenX, screenY + 40);
}

function drawNode3(ctx, concept, worldX, worldY, screenX, screenY) {
  const isDone = isVisited(concept.id);
  const reducedMotion = prefersReducedMotion();
  const animate = !reducedMotion && isAudioReady();
  const pair = isDone ? NODE3_FRAMES.done : NODE3_FRAMES.undone;
  const beatPhase = animate ? getBeatPhase() : 0;
  const isDownPose = animate && beatPhase < NODE3_BEAT_HIT_PHASE;
  const frame = isDownPose ? pair[1] : pair[0];

  let bobOffset = 0;
  let inRange = false;
  let proximityRatio = 0;
  if (!reducedMotion) {
    const dx = worldX - goat.x;
    const dy = worldY - goat.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    inRange = distance <= PROXIMITY_RADIUS;
    if (inRange) {
      bobOffset = Math.sin(performance.now() / NODE3_BOB_PERIOD_MS) * NODE3_BOB_AMPLITUDE;
      proximityRatio = 1 - Math.min(distance / PROXIMITY_RADIUS, 1);
    }
  }

  const isNearest = inRange && findNearestNodeInRange(goat.x, goat.y)?.id === concept.id;
  if (animate) {
    if (beatPhase < node3LastBeatPhase) {
      if (isNearest) {
        const eased = proximityRatio * proximityRatio;
        const velocity = NODE3_HIT_MIN_VELOCITY + eased * (1 - NODE3_HIT_MIN_VELOCITY);
        const semi = NODE3_SCALE_SEMIS[node3ScaleIndex];
        playInstrumentNote(NODE3_CHROMATIC_NOTES[semi], velocity);
      }
      node3ScaleIndex = (node3ScaleIndex + 1) % NODE3_SCALE_SEMIS.length;
    }
    node3LastBeatPhase = beatPhase;
  }

  const spriteScreenY = screenY + bobOffset;

  if (frame.complete && frame.naturalWidth > 0) {
    ctx.drawImage(
      frame,
      screenX - NODE_MARKER_SIZE / 2,
      spriteScreenY - NODE_MARKER_SIZE,
      NODE_MARKER_SIZE,
      NODE_MARKER_SIZE
    );
  }

  if (isDone) {
    drawDoneBadge(ctx, screenX + 40, screenY - NODE_MARKER_SIZE - 15);
  }

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${GLOBAL_ORDER.get(concept.id)}: ${concept.title}`, screenX, screenY + 40);
}

function drawNode4(ctx, concept, worldX, worldY, screenX, screenY) {
  const isDone = isVisited(concept.id);
  const reducedMotion = prefersReducedMotion();
  const animate = !reducedMotion && isAudioReady();
  const pair = isDone ? NODE4_FRAMES.done : NODE4_FRAMES.undone;
  const beatPhase = animate ? getBeatPhase() : 0;
  const isDownPose = animate && beatPhase < NODE4_BEAT_HIT_PHASE;
  const frame = isDownPose ? pair[1] : pair[0];

  let bobOffset = 0;
  let inRange = false;
  let proximityRatio = 0;
  if (!reducedMotion) {
    const dx = worldX - goat.x;
    const dy = worldY - goat.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    inRange = distance <= PROXIMITY_RADIUS;
    if (inRange) {
      bobOffset = Math.sin(performance.now() / NODE4_BOB_PERIOD_MS) * NODE4_BOB_AMPLITUDE;
      proximityRatio = 1 - Math.min(distance / PROXIMITY_RADIUS, 1);
    }
  }

  const isNearest = inRange && findNearestNodeInRange(goat.x, goat.y)?.id === concept.id;
  if (animate) {
    if (beatPhase < node4LastBeatPhase) {
      if (isNearest) {
        const eased = proximityRatio * proximityRatio;
        const proximityScale = NODE4_PROXIMITY_MIN_SCALE + eased * (1 - NODE4_PROXIMITY_MIN_SCALE);
        const baseVelocity = node4IsLoudPass ? NODE4_LOUD_VELOCITY : NODE4_SOFT_VELOCITY;
        playInstrumentNote(NODE4_MELODY[node4MelodyIndex], baseVelocity * proximityScale);
      }
      node4MelodyIndex++;
      if (node4MelodyIndex >= NODE4_MELODY.length) {
        node4MelodyIndex = 0;
        node4IsLoudPass = !node4IsLoudPass;
      }
    }
    node4LastBeatPhase = beatPhase;
  }

  const spriteScreenY = screenY + bobOffset;

  if (frame.complete && frame.naturalWidth > 0) {
    ctx.drawImage(
      frame,
      screenX - NODE_MARKER_SIZE / 2,
      spriteScreenY - NODE_MARKER_SIZE,
      NODE_MARKER_SIZE,
      NODE_MARKER_SIZE
    );
  }

  if (isDone) {
    drawDoneBadge(ctx, screenX + 40, screenY - NODE_MARKER_SIZE - 15);
  }

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${GLOBAL_ORDER.get(concept.id)}: ${concept.title}`, screenX, screenY + 40);
}

export const SCENE_ENTITIES = [
  ...CONCEPTS.map((concept) => {
    const { y } = getConceptPosition(concept);
    return {
      y,
      draw: (ctx, cameraX, cameraY, viewWidth, viewHeight) =>
        drawSingleNode(ctx, concept, cameraX, cameraY, viewWidth, viewHeight),
    };
  }),
  ...Object.keys(SIGN_POS).map((section) => ({
    y: SIGN_POS[section].y,
    draw: (ctx, cameraX, cameraY, viewWidth, viewHeight) =>
      drawSign(ctx, cameraX, cameraY, viewWidth, viewHeight, section),
  })),
];
