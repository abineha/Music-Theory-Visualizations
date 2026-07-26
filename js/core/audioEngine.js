const BACKTRACK_VOLUME = -2;          
const BACKTRACK_DUCKED_VOLUME = -16;  
const EFFECT_VOLUME = -14;          

const BAA_INTERVAL_MS = 30000; 

const backtrack = new Tone.Player({ url: 'assets/sounds/backtrack.mp3', loop: true }).toDestination();
backtrack.volume.value = BACKTRACK_VOLUME;

const baaPlayer = new Tone.Player('assets/sounds/goat_baa.mp3').toDestination();
baaPlayer.volume.value = EFFECT_VOLUME;

const stepPlayer = new Tone.Player({ url: 'assets/sounds/goat_step.mp3', loop: true }).toDestination();
stepPlayer.volume.value = EFFECT_VOLUME;

const proximityOsc = new Tone.Oscillator({ type: 'sine', frequency: 220 }).toDestination();
proximityOsc.volume.value = -100;  

const keyboardSynth = new Tone.PolySynth(Tone.Synth).toDestination();
keyboardSynth.volume.value = -6;

const drumLow = new Tone.MembraneSynth().toDestination();
drumLow.volume.value = -6;

const drumHigh = new Tone.MetalSynth().toDestination();
drumHigh.volume.value = -12;

let audioReady = false;
let proximityPlaying = false;
let stepPlaying = false;
let baaPaused = false;

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

export function isAudioReady() {
  return audioReady;
}

export async function initAudio() {
  if (audioReady) return;
  await Tone.start();
  audioReady = true;
  safeStart(backtrack);
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

export function restoreBacktrack() {
  backtrack.volume.rampTo(BACKTRACK_VOLUME, 0.3);
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

  proximityOsc.frequency.value = 220 + proximityRatio * 220;
  proximityOsc.volume.value = -30 + proximityRatio * 20;
}

export function playInstrumentNote(note, velocity = 1) {
  if (!audioReady) return;
  keyboardSynth.triggerAttackRelease(note, '8n', undefined, velocity);
}


export function playDrumHit(padId) {
  if (!audioReady) return;
  if (padId === 'low') {
    drumLow.triggerAttackRelease('C2', '8n');
  } else {
    drumHigh.triggerAttackRelease('16n');
  }
}
