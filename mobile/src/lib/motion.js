// Shared device motion + orientation feed (expo-sensors DeviceMotion) and compass heading
// (expo-location). One listener for the whole app: the Snitch Protocol (is the phone
// still?), Red Light (did it move on red?), Floor Is Lava (is the camera pointing down?),
// Statue / Peek checks and the GPS Playzone compass all read from here.
import { useEffect, useSyncExternalStore } from 'react';
import { DeviceMotion } from 'expo-sensors';
import * as Location from 'expo-location';

const RAD = 180 / Math.PI;

let mode = 'ask'; // sensor | ask | none
let lastMoveAt = Date.now();
let lastSampleAt = 0;
let orientation = null; // { beta, gamma, at } degrees
let heading = null; // { deg, at } compass heading, 0 = north, clockwise
let motionSub = null;
let consumers = 0; // the sensor only runs while some screen needs it (battery)
let headingSub = null;
let headingStarting = false;
const listeners = new Set(); // raw motion subscribers
const subs = new Set(); // status subscribers
const emit = () => subs.forEach((fn) => fn());

function onMotion(m) {
  const a = m.acceleration;
  const g = m.accelerationIncludingGravity;
  if (a?.x == null && g?.x == null) return;
  lastSampleAt = Date.now();
  const accel = a?.x != null ? Math.hypot(a.x, a.y, a.z) : 0;
  const r = m.rotationRate;
  // rotationRate is degrees per second on both platforms.
  const rot = r ? Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0) : 0;
  // Hand-held phones always tremble a little; a phone in a pocket or on a table doesn't.
  if (accel > 0.15 || rot > 2.5) lastMoveAt = lastSampleAt;
  if (m.rotation) orientation = { beta: (m.rotation.beta || 0) * RAD, gamma: (m.rotation.gamma || 0) * RAD, at: lastSampleAt };
  listeners.forEach((fn) => fn(m, { accel, rot }));
}

function start() {
  if (motionSub || mode !== 'sensor' || consumers === 0) return;
  DeviceMotion.setUpdateInterval(60);
  motionSub = DeviceMotion.addListener(onMotion);
}

function stop() {
  motionSub?.remove();
  motionSub = null;
  lastSampleAt = 0;
  orientation = null;
}

// Keeps the motion sensor running until the returned release() is called.
export function retainMotion() {
  consumers += 1;
  start();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    consumers = Math.max(0, consumers - 1);
    if (consumers === 0) stop();
  };
}

// Component form of retainMotion (Floor Is Lava's camera-down check, the pocket check).
export function useMotionSensor(active = true) {
  useEffect(() => (active ? retainMotion() : undefined), [active]);
}

// Checks (and if needed asks for) the motion permission. Safe to call any time.
export async function requestMotion() {
  try {
    if (!(await DeviceMotion.isAvailableAsync())) {
      mode = 'none';
    } else {
      let perm = await DeviceMotion.getPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) perm = await DeviceMotion.requestPermissionsAsync();
      mode = perm.granted ? 'sensor' : 'none';
    }
  } catch (e) {
    mode = 'none';
  }
  start();
  emit();
  return mode;
}

// Android grants motion sensors without a prompt; start right away where possible.
DeviceMotion.getPermissionsAsync()
  .then((perm) => {
    if (perm.granted) return requestMotion();
    return null;
  })
  .catch(() => {});

// Compass for the GPS Playzone arrow (needs the location permission the zone already has).
export async function startHeading() {
  if (headingSub || headingStarting) return;
  headingStarting = true;
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.granted) {
      headingSub = await Location.watchHeadingAsync((h) => {
        const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (deg != null && deg >= 0) heading = { deg, at: Date.now() };
      });
    }
  } catch (e) {
    /* no magnetometer */
  }
  headingStarting = false;
}

export function stopHeading() {
  headingSub?.remove();
  headingSub = null;
}

export const motionMode = () => mode;

// True only when real readings have arrived recently.
export const motionLive = () => Date.now() - lastSampleAt < 2500;

// Milliseconds since the phone last moved (null when no sensor data is available).
export const stillFor = () => (motionLive() ? Date.now() - lastMoveAt : null);

// Compass heading in degrees (null without a magnetometer reading).
export const currentHeading = () => (heading && Date.now() - heading.at < 3000 ? heading.deg : null);

export const currentOrientation = () => (orientation && Date.now() - orientation.at < 2000 ? orientation : null);

// Rear camera pointing at the floor = phone held roughly flat, screen up.
export const cameraPointingDown = () => {
  const o = currentOrientation();
  if (!o) return null;
  return Math.abs(o.beta) < 40 && Math.abs(o.gamma) < 40;
};

export function subscribeMotion(fn) {
  listeners.add(fn);
  const release = retainMotion();
  return () => {
    listeners.delete(fn);
    release();
  };
}

export function useMotionMode() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => mode
  );
}
