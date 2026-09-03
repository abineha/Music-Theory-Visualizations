const BACKTRACK_VOLUME = -2;          
const BACKTRACK_DUCKED_VOLUME = -28;  
const EFFECT_VOLUME = -10;          

const BAA_INTERVAL_MS = 30000; 

const BEAT_LOOKAHEAD = 0.1;
const BEAT_SCHEDULER_TICK_MS = 25;
const BEATS_PER_BAR = 4;
const DEFAULT_BEAT_BPM = 96;

const RHYTHM_STEPS = 16; 
const DEFAULT_RHYTHM_BPM = 76;
const RHYTHM_DEFAULT_ACTIVE = { whole: false, half: false, quarter: true, eighth: false, six: false };
const HERD_LAYERS = [
  { key: 'whole',   note: 'D3',  everySteps: 16, dur: 1.8 },
  { key: 'half',    note: 'G3',  everySteps: 8,  dur: 0.5 },
  { key: 'quarter', note: 'D4',  everySteps: 4,  dur: 0.28 },
  { key: 'eighth',  note: 'A4',  everySteps: 2,  dur: 0.14 },
  { key: 'six',     note: 'F#5', everySteps: 1,  dur: 0.07 },
];

const ambientBus = new Tone.Volume(0).toDestination();
const interactiveBus = new Tone.Volume(0).toDestination();

const backtrack = new Tone.Player({ url: 'assets/sounds/backtrack.mp3', loop: true }).connect(ambientBus);
backtrack.volume.value = BACKTRACK_VOLUME;

const baaPlayer = new Tone.Player('assets/sounds/goat_baa.mp3').connect(ambientBus);
baaPlayer.volume.value = -20;

const stepPlayer = new Tone.Player({ url: 'assets/sounds/goat_step.mp3', loop: true }).connect(ambientBus);
stepPlayer.volume.value = EFFECT_VOLUME;

const proximityOsc = new Tone.Oscillator({ type: 'sine', frequency: 220 }).connect(ambientBus);
proximityOsc.volume.value = -100;

const keyboardSynth = new Tone.PolySynth(Tone.Synth).connect(interactiveBus);
keyboardSynth.volume.value = -6;

const drumLow = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 6,
  envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.4 },
}).connect(interactiveBus);
drumLow.volume.value = -4;

const drumHigh = new Tone.MetalSynth({
  frequency: 250,
  envelope: { attack: 0.001, decay: 0.6, release: 0.3 },
  harmonicity: 5.1,
  modulationIndex: 32,
  resonance: 4000,
  octaves: 1.5,
}).connect(interactiveBus);
drumHigh.volume.value = -16;

const cymbalShimmer = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
}).connect(interactiveBus);
cymbalShimmer.volume.value = -26;

const beatClopSynth = new Tone.MembraneSynth({
  pitchDecay: 0.02,
  octaves: 4,
  envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
}).connect(interactiveBus);
beatClopSynth.volume.value = -10;

const herdSynths = {
  whole: new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.5, release: 0.8 },
  }).connect(interactiveBus),
  half: new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.2, release: 0.3 },
  }).connect(interactiveBus),
  quarter: new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.05, release: 0.15 },
  }).connect(interactiveBus),
  eighth: new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.08 },
  }).connect(interactiveBus),
  six: new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
  }).connect(interactiveBus),
};
herdSynths.whole.volume.value = 6;
herdSynths.half.volume.value = -10;
herdSynths.quarter.volume.value = -12;
herdSynths.eighth.volume.value = -13;
herdSynths.six.volume.value = -15;

let audioReady = false;
let proximityPlaying = false;
let baaPaused = false;

let beatBpm = DEFAULT_BEAT_BPM;
let beatIndex = 0;
let nextBeatTime = 0;
let lastBeatTime = 0;
let beatAudible = false;
let beatSchedulerTimer = null;

let rhythmBpm = DEFAULT_RHYTHM_BPM;
let rhythmStepIndex = 0;
let nextRhythmStepTime = 0;
let lastRhythmStepTime = 0;
let rhythmSchedulerTimer = null;
let rhythmActiveLayers = { ...RHYTHM_DEFAULT_ACTIVE };

function safeStart(player) {
  if (!player.loaded) return;
  try {
    player.start();
  } catch (err) {
    console.warn('Audio playback failed:', err);
  }
}

function safeStop(player) {
  try {
    player.stop();
  } catch (err) {

  }
}

function beatContextTime() {
  return Tone.getContext().currentTime;
}

function beatScheduler() {
  const spb = 60 / beatBpm;
  while (nextBeatTime < beatContextTime() + BEAT_LOOKAHEAD) {
    const isDownbeat = beatIndex % BEATS_PER_BAR === 0;
    if (beatAudible) {
      beatClopSynth.triggerAttackRelease(isDownbeat ? 'C3' : 'C2', '16n', nextBeatTime);
    }
    lastBeatTime = nextBeatTime;
    beatIndex++;
    nextBeatTime += spb;
  }
  beatSchedulerTimer = setTimeout(beatScheduler, BEAT_SCHEDULER_TICK_MS);
}

function startBeatClock() {
  if (beatSchedulerTimer !== null) return;
  nextBeatTime = beatContextTime();
  lastBeatTime = nextBeatTime;
  beatIndex = 0;
  beatScheduler();
}

function rhythmScheduler() {
  const stepDuration = (60 / rhythmBpm) / 4; // 1/16 note
  while (nextRhythmStepTime < beatContextTime() + BEAT_LOOKAHEAD) {
    for (const layer of HERD_LAYERS) {
      if (rhythmActiveLayers[layer.key] && rhythmStepIndex % layer.everySteps === 0) {
        herdSynths[layer.key].triggerAttackRelease(layer.note, layer.dur, nextRhythmStepTime);
      }
    }
    lastRhythmStepTime = nextRhythmStepTime;
    rhythmStepIndex = (rhythmStepIndex + 1) % RHYTHM_STEPS;
    nextRhythmStepTime += stepDuration;
  }
  rhythmSchedulerTimer = setTimeout(rhythmScheduler, BEAT_SCHEDULER_TICK_MS);
}

export function startRhythmClock() {
  if (rhythmSchedulerTimer !== null) return; // already running
  nextRhythmStepTime = beatContextTime();
  lastRhythmStepTime = nextRhythmStepTime;
  rhythmStepIndex = 0;
  rhythmScheduler();
}

export function stopRhythmClock() {
  if (rhythmSchedulerTimer !== null) {
    clearTimeout(rhythmSchedulerTimer);
    rhythmSchedulerTimer = null;
  }
}

export function resetRhythmState() {
  rhythmActiveLayers = { ...RHYTHM_DEFAULT_ACTIVE };
  rhythmBpm = DEFAULT_RHYTHM_BPM;
  rhythmStepIndex = 0;
}

export function setRhythmBpm(bpm) {
  rhythmBpm = bpm;
}

export function setRhythmLayerActive(key, active) {
  if (key in rhythmActiveLayers) rhythmActiveLayers[key] = active;
}

export function isRhythmLayerActive(key) {
  return !!rhythmActiveLayers[key];
}

export function getRhythmStepIndex() {
  return rhythmStepIndex;
}

export function isAudioReady() {
  return audioReady;
}

export async function initAudio() {
  if (audioReady) return;
  await Tone.start();
  audioReady = true;
  // Players start loading their MP3s as soon as this module is imported, but
  // on a slower connection (mobile networks especially) they may not have
  // finished decoding by the moment the tap-to-start gesture unlocks audio.
  // Wait for every registered buffer to actually be ready before the first
  // playback attempt, rather than firing safeStart() into a still-empty
  // buffer with no retry - that left backtrack silent for the whole session
  // on slower loads.
  await Tone.loaded();
  safeStart(backtrack);
  startBeatClock();
  setInterval(playBaa, BAA_INTERVAL_MS);
}

function setBusVolume(bus, linearVolume) {
  bus.mute = linearVolume <= 0;
  if (linearVolume > 0) {
    bus.volume.value = Tone.gainToDb(linearVolume);
  }
}

// Background/map slider - the looping music and map atmosphere.
export function setAmbientVolume(linearVolume) {
  setBusVolume(ambientBus, linearVolume);
}

let interactivePopupVolume = 1;
const interactiveVolumeListeners = new Set();
export function setInteractiveVolume(linearVolume) {
  setBusVolume(interactiveBus, linearVolume);
  interactivePopupVolume = linearVolume;
  interactiveVolumeListeners.forEach((cb) => cb(linearVolume));
}
export function getInteractivePopupVolume() {
  return interactivePopupVolume;
}
export function onInteractiveVolumeChange(cb) {
  interactiveVolumeListeners.add(cb);
  return () => interactiveVolumeListeners.delete(cb);
}

export function duckBacktrack() {
  backtrack.volume.rampTo(BACKTRACK_DUCKED_VOLUME, 0.3);
}

function getBeatElapsed() {
  const spb = 60 / beatBpm;
  let elapsed = beatContextTime() - lastBeatTime;
  if (elapsed < 0) elapsed += spb;
  return { elapsed, spb };
}

export function getBeatPhase() {
  const { elapsed, spb } = getBeatElapsed();
  return Math.min(1, Math.max(0, elapsed / spb));
}

export function getBarPhase() {
  const isAhead = beatContextTime() - lastBeatTime < 0;
  const effectiveIndex = isAhead ? beatIndex - 1 : beatIndex;
  const beatWithinBar = ((effectiveIndex % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
  return (beatWithinBar + getBeatPhase()) / BEATS_PER_BAR;
}

export function setBeatBpm(bpm) {
  beatBpm = bpm;
}

export function resetBeatBpm() {
  beatBpm = DEFAULT_BEAT_BPM;
}

export function setBeatAudible(audible) {
  beatAudible = audible;
}

export function pauseBacktrack() {
  backtrack.volume.rampTo(-60, 0.25);
  setTimeout(() => { if (backtrack.state === 'started') backtrack.stop(); }, 300);
}

export function resumeBacktrack() {
  safeStart(backtrack);
  backtrack.volume.rampTo(BACKTRACK_VOLUME, 0.4);
}

export function playBaa() {
  if (!audioReady || baaPaused) return;
  safeStart(baaPlayer);
}

export function pauseBaa() {
  baaPaused = true;
}

export function resumeBaa() {
  baaPaused = false;
}

export function setWalking(isWalking) {
  if (!audioReady) return;
  if (isWalking) {
    if (stepPlayer.state !== 'started') safeStart(stepPlayer);
  } else if (stepPlayer.state === 'started') {
    safeStop(stepPlayer);
  }
}

export function updateProximityTone(proximityRatio) {
  if (!audioReady) return;

  if (proximityRatio <= 0) {
    if (proximityPlaying) {
      proximityOsc.stop();
      proximityPlaying = false;
    }
    return;
  }

  if (!proximityPlaying) {
    proximityOsc.start();
    proximityPlaying = true;
  }

  const eased = proximityRatio * proximityRatio;
  proximityOsc.frequency.value = 220 + eased * 220;
  proximityOsc.volume.value = -50 + eased * 42; // near-silent at the edge, up to -8dB at the node
}

function safeTrigger(fn) {
  try {
    fn();
  } catch (err) {
    console.warn('Audio trigger failed:', err);
  }
}

export function playInstrumentNote(note, velocity = 1) {
  if (!audioReady) return;
  safeTrigger(() => keyboardSynth.triggerAttackRelease(note, '8n', undefined, velocity));
}


export function playDrumHit(padId, velocity = 1) {
  if (!audioReady) return;
  if (padId === 'low') {
    safeTrigger(() => drumLow.triggerAttackRelease('C2', '8n', undefined, velocity));
  } else {
    safeTrigger(() => drumHigh.triggerAttackRelease('16n', undefined, velocity));
    safeTrigger(() => cymbalShimmer.triggerAttackRelease('16n', undefined, velocity * 0.8));
  }
}
