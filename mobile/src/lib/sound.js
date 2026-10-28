// Native sound effects (expo-av), haptics (expo-haptics) and speech (expo-speech).
// The WAVs in assets/sounds are rendered offline from the web app's Web Audio synth
// (scripts/make-sounds.py), so both versions sound the same.
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

const FILES = {
  alarm: require('../../assets/sounds/alarm.wav'),
  alert: require('../../assets/sounds/alert.wav'),
  beep: require('../../assets/sounds/beep.wav'),
  beepUrgent: require('../../assets/sounds/beep_urgent.wav'),
  blip: require('../../assets/sounds/blip.wav'),
  boom: require('../../assets/sounds/boom.wav'),
  chirp: require('../../assets/sounds/chirp.wav'),
  click: require('../../assets/sounds/click.wav'),
  clunk: require('../../assets/sounds/clunk.wav'),
  fail: require('../../assets/sounds/fail.wav'),
  infect: require('../../assets/sounds/infect.wav'),
  lockIn: require('../../assets/sounds/lockin.wav'),
  marco: require('../../assets/sounds/marco.wav'),
  musicBox: require('../../assets/sounds/musicbox.wav'),
  penalty: require('../../assets/sounds/penalty.wav'),
  polo: require('../../assets/sounds/polo.wav'),
  powerDown: require('../../assets/sounds/powerdown.wav'),
  powerUp: require('../../assets/sounds/powerup.wav'),
  radar: require('../../assets/sounds/radar.wav'),
  shriek: require('../../assets/sounds/shriek.wav'),
  shutter: require('../../assets/sounds/shutter.wav'),
  siren: require('../../assets/sounds/siren.wav'),
  sonar: require('../../assets/sounds/sonar.wav'),
  sting: require('../../assets/sounds/sting.wav'),
  success: require('../../assets/sounds/success.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  whisper: require('../../assets/sounds/whisper.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
};

// Enforcement alarms and the Halloween cues are the mechanic itself: they ignore the
// sound-effects toggle.
const FORCED = new Set(['penalty', 'chirp', 'radar', 'polo', 'whisper', 'shriek', 'musicBox', 'clunk', 'powerDown', 'sting']);
// Sounds that can overlap themselves (fast roulette ticks, countdown beeps).
const VOICES = { tick: 4, beep: 2, beepUrgent: 2, click: 2, blip: 2 };

let muted = false;
let loading = null;
const pool = {}; // name -> { voices: Sound[], next }

// One audio mode for the whole app: the mic meter and the camera can record while every
// sonar pulse, siren and whisper plays through the loudspeaker (never the earpiece) at full
// volume, without ducking for other apps.
export async function configureAudio() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.warn('[sound] audio mode', e);
  }
}

function load() {
  if (!loading) {
    loading = (async () => {
      await configureAudio();
      await Promise.all(
        Object.entries(FILES).map(async ([name, file]) => {
          const voices = [];
          for (let i = 0; i < (VOICES[name] || 1); i += 1) {
            try {
              // eslint-disable-next-line no-await-in-loop
              const { sound } = await Audio.Sound.createAsync(file, { shouldPlay: false, volume: 1 });
              voices.push(sound);
            } catch (e) {
              /* a missing voice just stays silent */
            }
          }
          pool[name] = { voices, next: 0 };
        })
      );
    })();
  }
  return loading;
}

function play(name, rate = 1) {
  if (muted && !FORCED.has(name)) return;
  const slot = pool[name];
  if (!slot) {
    load();
    return;
  }
  const sound = slot.voices[slot.next];
  slot.next = (slot.next + 1) % Math.max(1, slot.voices.length);
  if (!sound) return;
  const go = rate !== 1 ? sound.setRateAsync(rate, false).catch(() => {}) : Promise.resolve();
  go.then(() => sound.setPositionAsync(0))
    .then(() => sound.playAsync())
    .catch(() => {});
}

export const Synth = {
  unlock() {
    load();
  },
  setMuted(value) {
    muted = value;
  },
  tick(pitch = 1) {
    play('tick', Math.min(2, Math.max(0.5, pitch)));
  },
  lockIn: () => play('lockIn'),
  beep: (urgent = false) => play(urgent ? 'beepUrgent' : 'beep'),
  alarm: () => play('alarm'),
  success: () => play('success'),
  fail: () => play('fail'),
  click: () => play('click'),
  sonar: () => play('sonar'),
  siren: () => play('siren'),
  boom: () => play('boom'),
  shutter: () => play('shutter'),
  blip: () => play('blip'),
  penalty: () => play('penalty'),
  alert: () => play('alert'),
  chirp: () => play('chirp'),
  radar: () => play('radar'),
  polo: () => play('polo'),
  marco: () => play('marco'),
  infect: () => play('infect'),
  whisper: () => play('whisper'),
  shriek: () => play('shriek'),
  musicBox: () => play('musicBox'),
  clunk: () => play('clunk'),
  powerDown: () => play('powerDown'),
  powerUp: () => play('powerUp'),
  sting: () => play('sting'),
  whoosh: () => play('whoosh'),
};

/* --------------------------------- haptics -------------------------------- */

const timers = new Set();
const later = (ms, fn) => {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, ms);
  timers.add(t);
};

const impact = (ms) => {
  const style = ms >= 250 ? Haptics.ImpactFeedbackStyle.Heavy : ms >= 60 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  Haptics.impactAsync(style).catch(() => {});
};

// Same pattern format as navigator.vibrate ([on, off, on, …] in ms). Each "on" segment
// becomes a haptic impact; long segments repeat it so they feel like a sustained buzz.
export function buzz(pattern) {
  const steps = Array.isArray(pattern) ? pattern : [pattern];
  let at = 0;
  steps.forEach((ms, i) => {
    if (i % 2 === 0 && ms > 0) {
      for (let t = 0; t < ms; t += 90) later(at + t, () => impact(ms - t >= 90 ? ms : ms - t));
    }
    at += ms;
  });
}

// Named feedback used by the game screens.
export const haptic = {
  // Roulette ratchet: one crisp selection click per tick.
  tick: () => Haptics.selectionAsync().catch(() => {}),
  // Heartbeat lub-dub; stronger when the threat is close.
  heartbeat(level = 1) {
    const style = level >= 4 ? Haptics.ImpactFeedbackStyle.Heavy : level >= 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
    Haptics.impactAsync(style).catch(() => {});
    later(140, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}));
  },
  sonar() {
    [0, 500, 1000, 1500].forEach((t) => later(t, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {})));
  },
  // Mafia: a gentle double tap wakes only the role being called.
  wake() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    later(220, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}));
  },
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};

// Speaks a short word (e.g. "Polo!").
export const speak = (text) => {
  try {
    Speech.stop();
    Speech.speak(text, { rate: 1.05, pitch: 1.1, volume: 1 });
  } catch (e) {
    /* speech unavailable */
  }
};
