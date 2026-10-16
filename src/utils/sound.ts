type SoundName = 'click' | 'win' | 'error' | 'spin';

interface AudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

let audioContext: AudioContext | undefined;
let soundEnabled = true;
let spinTicker = 0;

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
