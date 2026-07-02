import { Platform } from 'react-native';

let audioContext = null;
let unlockInstalled = false;
let unlocked = false;

export const ALERT_TONES = Object.freeze({
  ACCOUNT_REQUESTED: {
    frequencies: [988, 1319],
    volume: 0.25,
    duration: 0.12,
    gap: 0.1,
    type: 'sine',
  },
  ORDER_READY: {
    frequencies: [659, 880, 1175],
    volume: 0.23,
    duration: 0.12,
    gap: 0.11,
    type: 'sine',
  },
  ORDER_NEW: {
    frequencies: [740, 988, 1319],
    volume: 0.24,
    duration: 0.12,
    gap: 0.12,
    type: 'sine',
  },
  PICKUP_NEW: {
    frequencies: [523, 659, 784],
    volume: 0.24,
    duration: 0.13,
    gap: 0.12,
    type: 'triangle',
  },
  SYNC_ERROR: {
    frequencies: [330, 247, 196],
    volume: 0.2,
    duration: 0.18,
    gap: 0.16,
    type: 'sawtooth',
  },
  CASH_OPEN: {
    frequencies: [523, 784, 1046],
    volume: 0.22,
    duration: 0.12,
    gap: 0.11,
    type: 'sine',
  },
  CASH_CLOSED: {
    frequencies: [784, 523],
    volume: 0.22,
    duration: 0.16,
    gap: 0.14,
    type: 'triangle',
  },
});

function getAudioContext() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

export async function unlockWebAudio() {
  const context = getAudioContext();
  if (!context) return false;

  try {
    if (context.state === 'suspended') {
      await context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.setValueAtTime(0.0001, now + 0.02);
    oscillator.frequency.value = 20;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.02);

    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function installWebAudioUnlock() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || unlockInstalled) return;
  unlockInstalled = true;

  const unlock = () => {
    unlockWebAudio().catch(() => null);
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock, { passive: true });
}

export function playWebAlertTone({
  frequencies = [880, 1175],
  volume = 0.24,
  duration = 0.15,
  gap = 0.16,
  type = 'sine',
} = {}) {
  const context = getAudioContext();
  if (!context) return false;

  try {
    if (context.state === 'suspended') {
      context.resume().catch(() => null);
      if (!unlocked) return false;
    }

    const now = context.currentTime;
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startsAt = now + index * gap;

      oscillator.frequency.value = frequency;
      oscillator.type = type;
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(volume, startsAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration - 0.01);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + duration);
    });

    return true;
  } catch {
    return false;
  }
}
