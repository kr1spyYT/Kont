type SoundName = 'click' | 'win' | 'error' | 'spin';

interface AudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

let audioContext: AudioContext | undefined;
let soundEnabled = true;
let spinTicker = 0;
let ambientMaster: GainNode | undefined;
let ambientStarting = false;
let ambientRequest = 0;
let ambientNoteTimer: number | undefined;
let ambientNoteIndex = 0;
const ambientNotes = [659.25, 880, 1108.73, 880, 659.25, 554.37, 659.25, 880];
const ambientBassNotes = [110, 110, 92.5, 92.5, 73.42, 73.42, 82.41, 82.41];

const getAudioContext = (): AudioContext | undefined => {
  if (typeof window === 'undefined') return undefined;
  if (audioContext && audioContext.state !== 'closed') return audioContext;

  const AudioContextConstructor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) return undefined;

  audioContext = new AudioContextConstructor();
  return audioContext;
};

const tone = (
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
  waveform: OscillatorType = 'sine',
): void => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.015);
};

const play = (name: SoundName): void => {
  if (!soundEnabled) return;
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    void context.resume();
  }

  const now = context.currentTime;
  if (name === 'click') {
    tone(context, 740, now, 0.045, 0.035, 'triangle');
    return;
  }
  if (name === 'spin') {
    spinTicker += 1;
    tone(context, 650 + (spinTicker % 5) * 48, now, 0.025, 0.018, 'square');
    return;
  }
  if (name === 'error') {
    tone(context, 155, now, 0.18, 0.07, 'sine');
    tone(context, 116, now + 0.055, 0.2, 0.045, 'triangle');
    return;
  }

  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    tone(context, frequency, now + index * 0.055, 0.34, 0.055, 'sine');
  });
};

export const setSoundEnabled = (enabled: boolean): void => {
  soundEnabled = enabled;
};

export const playClick = (): void => play('click');
export const playWin = (): void => play('win');
export const playError = (): void => play('error');
export const playSpin = (): void => play('spin');

export const playMetalHit = (level: 1 | 2 | 3): void => {
  if (!soundEnabled) return;

  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === 'suspended') void context.resume().catch(() => undefined);

    const now = context.currentTime;
    const intensity = level === 1 ? 0.75 : level === 2 ? 1 : 1.25;
    const bass = level === 1 ? 172 : level === 2 ? 138 : 108;
    tone(context, bass, now, 0.2, 0.065 * intensity, 'triangle');
    tone(context, 520 + level * 85, now, 0.11, 0.032 * intensity, 'square');
    tone(context, 1_620 + level * 120, now, 0.055, 0.014 * intensity, 'sine');
  } catch {
    // Sound is optional and must not interrupt opening the awarded item.
  }
};

const playAmbientTone = (
  context: AudioContext,
  frequency: number,
  now: number,
  duration: number,
  volume: number,
  waveform: OscillatorType,
): void => {
  if (!ambientMaster) return;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, now);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(volume, now + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(envelope);
  envelope.connect(ambientMaster);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.015);
};

const playAmbientNoise = (
  context: AudioContext,
  now: number,
  duration: number,
  volume: number,
  highpassFrequency: number,
): void => {
  if (!ambientMaster) return;
  const frameCount = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = highpassFrequency;
  envelope.gain.setValueAtTime(volume, now);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(ambientMaster);
  source.start(now);
  source.stop(now + duration);
};

const playAmbientBeat = (context: AudioContext): void => {
  if (!ambientMaster || context.state === 'closed') return;
  const now = context.currentTime;
  const beat = ambientNoteIndex % 8;
  playAmbientNoise(context, now, 0.045, 0.035, 6_500);
  if (beat % 2 === 0) {
    playAmbientTone(context, ambientNotes[beat], now, 0.19, 0.11, 'triangle');
    playAmbientTone(context, ambientBassNotes[beat], now, 0.24, 0.075, 'sawtooth');
  }
  if (beat === 0 || beat === 4) {
    const kick = context.createOscillator();
    const envelope = context.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(135, now);
    kick.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    envelope.gain.setValueAtTime(0.14, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    kick.connect(envelope);
    envelope.connect(ambientMaster);
    kick.start(now);
    kick.stop(now + 0.17);
  } else if (beat === 2 || beat === 6) {
    playAmbientNoise(context, now, 0.12, 0.07, 900);
    playAmbientTone(context, 190, now, 0.09, 0.045, 'triangle');
  }
  ambientNoteIndex += 1;
  ambientNoteTimer = window.setTimeout(() => playAmbientBeat(context), 250);
};

export const startBackgroundMusic = async (): Promise<void> => {
  const context = getAudioContext();
  if (!context || ambientMaster || ambientStarting) return;
  const request = ++ambientRequest;
  ambientStarting = true;
  try {
    if (context.state === 'suspended') await context.resume();
  } catch (error) {
    if (request === ambientRequest) ambientStarting = false;
    throw error;
  }
  if (request !== ambientRequest) return;

  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.8);
  master.connect(context.destination);
  ambientMaster = master;
  ambientStarting = false;

  ambientNoteIndex = 0;
  playAmbientBeat(context);
};

export const stopBackgroundMusic = (): void => {
  ambientRequest += 1;
  ambientStarting = false;
  const master = ambientMaster;
  if (!master) return;
  ambientMaster = undefined;
  if (ambientNoteTimer !== undefined) window.clearTimeout(ambientNoteTimer);
  ambientNoteTimer = undefined;
  const context = audioContext;
  if (context && context.state !== 'closed') {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0.0001, context.currentTime, 0.08);
    window.setTimeout(() => {
      master.disconnect();
    }, 450);
  }
};
