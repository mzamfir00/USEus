// Permission prompts pause the app on Android, which the Snitch Protocol would otherwise read
// as "left the app". Prompts go through here so the camera can tell the difference, and the
// briefing asks for them before the round's clock and cameras start.
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';

let open = 0;
let closedAt = 0;

export const promptOpen = () => open > 0 || Date.now() - closedAt < 1500;

export async function prompt(request) {
  open += 1;
  try {
    return await request();
  } catch (e) {
    return null;
  } finally {
    open -= 1;
    closedAt = Date.now();
  }
}

// Games whose filming roles use the microphone (noise snitch or recorded dialogue).
const MIC_GAMES = new Set(['hide_seek', 'sardines', 'dead_silence', 'teleprompter', 'undercover']);

export async function prepareRound({ game, films, zone }) {
  if (films) {
    const cam = await Camera.getCameraPermissionsAsync();
    if (!cam.granted && cam.canAskAgain) await prompt(Camera.requestCameraPermissionsAsync);
    if (MIC_GAMES.has(game)) {
      const mic = await Camera.getMicrophonePermissionsAsync();
      if (!mic.granted && mic.canAskAgain) await prompt(Camera.requestMicrophonePermissionsAsync);
    }
  }
  if (zone && !zone.sim) {
    const loc = await Location.getForegroundPermissionsAsync();
    if (!loc.granted && loc.canAskAgain) await prompt(Location.requestForegroundPermissionsAsync);
  }
}
