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

// Filming roles record clips with sound (and stealth games run the noise snitch), so they
// need the camera and the microphone.
export async function prepareRound({ films, zone }) {
  if (films) {
    const cam = await Camera.getCameraPermissionsAsync();
    if (!cam.granted && cam.canAskAgain) await prompt(Camera.requestCameraPermissionsAsync);
    const mic = await Camera.getMicrophonePermissionsAsync();
    if (!mic.granted && mic.canAskAgain) await prompt(Camera.requestMicrophonePermissionsAsync);
  }
  if (zone && !zone.sim) {
    const loc = await Location.getForegroundPermissionsAsync();
    if (!loc.granted && loc.canAskAgain) await prompt(Location.requestForegroundPermissionsAsync);
  }
}
