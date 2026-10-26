// Microphone level meter (expo-av Audio.Recording with metering). Only one recording can be
// prepared at a time, so meters are serialised: a new one waits for the previous to unload.
import { Audio } from 'expo-av';
import { configureAudio } from './sound';

let chain = Promise.resolve();

// onLevel(dbfs) every `interval` ms. Returns stop(), safe to call at any time.
export function startMeter(onLevel, { interval = 100, onError } = {}) {
  let stopped = false;
  let ready = false; // setup finished (or failed)
  let rec = null;
  let release;
  const turn = new Promise((resolve) => {
    release = resolve;
  });
  const previous = chain;
  chain = previous.then(() => turn);

  previous
    .then(async () => {
      if (stopped) return;
      await configureAudio();
      rec = new Audio.Recording();
      await rec.prepareToRecordAsync({ ...Audio.RecordingOptionsPresets.LOW_QUALITY, isMeteringEnabled: true });
      if (stopped) return;
      rec.setProgressUpdateInterval(interval);
      rec.setOnRecordingStatusUpdate((st) => {
        if (!stopped && st.metering != null) onLevel(st.metering);
      });
      await rec.startAsync();
    })
    .catch((e) => {
      if (!stopped) onError?.(e);
    })
    .finally(async () => {
      ready = true;
      // Stopped while still setting up: unload here, then let the next meter in.
      if (stopped) {
        await unload();
        release();
      }
    });

  async function unload() {
    const r = rec;
    rec = null;
    if (!r) return;
    r.setOnRecordingStatusUpdate(null);
    await r.stopAndUnloadAsync().catch(() => {});
  }

  return () => {
    if (stopped) return;
    stopped = true;
    if (ready) unload().finally(release);
  };
}
