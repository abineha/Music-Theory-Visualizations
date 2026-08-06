const BACKTRACK_VOLUME = -2;          
const BACKTRACK_DUCKED_VOLUME = -28;  
const EFFECT_VOLUME = -10;          

const BAA_INTERVAL_MS = 30000; 

const BEAT_LOOKAHEAD = 0.1;        
const BEAT_SCHEDULER_TICK_MS = 25; 
const BEATS_PER_BAR = 4;
const DEFAULT_BEAT_BPM = 96;      

const backtrack = new Tone.Player({ url: 'assets/sounds/backtrack.mp3', loop: true }).toDestination();
backtrack.volume.value = BACKTRACK_VOLUME;

const baaPlayer = new Tone.Player('assets/sounds/goat_baa.mp3').toDestination();
baaPlayer.volume.value = -20;

const stepPlayer = new Tone.Player({ url: 'assets/sounds/goat_step.mp3', loop: true }).toDestination();
stepPlayer.volume.value = EFFECT_VOLUME;

const proximityOsc = new Tone.Oscillator({ type: 'sine', frequency: 220 }).toDestination();
proximityOsc.volume.value = -100;  

const keyboardSynth = new Tone.PolySynth(Tone.Synth).toDestination();
keyboardSynth.volume.value = -6;

const drumLow = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 6,
  envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.4 },
}).toDestination();
drumLow.volume.value = -4;

const drumHigh = new Tone.MetalSynth({
  frequency: 250,
  envelope: { attack: 0.001, decay: 0.6, release: 0.3 },
  harmonicity: 5.1,
  modulationIndex: 32,
  resonance: 4000,
  octaves: 1.5,
}).toDestination();
drumHigh.volume.value = -16;

const cymbalShimmer = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
}).toDestination();
cymbalShimmer.volume.value = -26;

const beatClopSynth = new Tone.MembraneSynth({
  pitchDecay: 0.02,
  octaves: 4,
  envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
}).toDestination();
beatClopSynth.volume.value = -10;

let audioReady = false;
let proximityPlaying = false;
let stepPlaying = false;
let baaPaused = false;

let beatBpm = DEFAULT_BEAT_BPM;
let beatIndex = 0;
let nextBeatTime = 0;
let lastBeatTime = 0;
let beatAudible = false;      
let beatSchedulerTimer = null;

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

export function isAudioReady() {
  return audioReady;
}

export async function initAudio() {
  if (audioReady) return;
  await Tone.start();
  audioReady = true;
  safeStart(backtrack);
  startBeatClock();
  setInterval(playBaa, BAA_INTERVAL_MS);
}

export function setVolume(linearVolume) {
  Tone.getDestination().mute = linearVolume <= 0;
  if (linearVolume > 0) {
    Tone.getDestination().volume.value = Tone.gainToDb(linearVolume);
  }
}

export function duckBacktrack() {
  backtrack.volume.rampTo(BACKTRACK_DUCKED_VOLUME, 0.3);
}

export function getBeatPhase() {
  const spb = 60 / beatBpm;
  const elapsed = beatContextTime() - lastBeatTime;
  return Math.min(1, Math.max(0, elapsed / spb));
}

export function getBarPhase() {
  const beatWithinBar = beatIndex % BEATS_PER_BAR;
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

export function isBacktrackAudible() {
  return audioReady && !Tone.getDestination().mute && backtrack.volume.value > -50;
}

export function restoreBacktrack() {
  backtrack.volume.rampTo(BACKTRACK_VOLUME, 0.3);
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
  if (isWalking && !stepPlaying) {
    safeStart(stepPlayer);
    stepPlaying = true;
  } else if (!isWalking && stepPlaying) {
    safeStop(stepPlayer);
    stepPlaying = false;
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

export function playInstrumentNote(note, velocity = 1) {
  if (!audioReady) return;
  keyboardSynth.triggerAttackRelease(note, '8n', undefined, velocity);
}


export function playDrumHit(padId, velocity = 1) {
  if (!audioReady) return;
  if (padId === 'low') {
    drumLow.triggerAttackRelease('C2', '8n', undefined, velocity);
  } else {
    drumHigh.triggerAttackRelease('16n', undefined, velocity);
    cymbalShimmer.triggerAttackRelease('16n', undefined, velocity * 0.8);
  }
}
