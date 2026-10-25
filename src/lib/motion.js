// Shared device motion + orientation feed.
// One listener for the whole app: the Snitch Protocol (is the phone still?), Red Light
// (did it move on red?) and Floor Is Lava (is the camera pointing down?) all read from here.
import { useSyncExternalStore } from 'react';

const hasMotion = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
const needsAsk = hasMotion && typeof window.DeviceMotionEvent.requestPermission === 'function';

let mode = !hasMotion ? 'none' : needsAsk ? 'ask' : 'sensor'; // sensor | ask | none
let lastMoveAt = Date.now();
let lastSampleAt = 0;
let orientation = null; // { beta, gamma, at }
let started = false;
const listeners = new Set(); // raw motion subscribers
const subs = new Set(); // status subscribers
const emit = () => subs.forEach((fn) => fn());

function onMotion(e) {
  const a = e.acceleration;
  const g = e.accelerationIncludingGravity;
  // Some browsers fire events with empty readings on devices without a sensor.
  if (a?.x == null && g?.x == null) return;
  lastSampleAt = Date.now();
  const accel = a?.x != null ? Math.hypot(a.x, a.y, a.z) : 0;
  const r = e.rotationRate;
  const rot = r ? Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0) : 0;
  // Hand-held phones always tremble a little; a phone in a pocket or on a table doesn't.
  if (accel > 0.15 || rot > 2.5) lastMoveAt = lastSampleAt;
  listeners.forEach((fn) => fn(e, { accel, rot }));
}

function onOrientation(e) {
  if (e.beta == null) return;
  orientation = { beta: e.beta, gamma: e.gamma || 0, at: Date.now() };
}

function start() {
  if (started || mode !== 'sensor') return;
  started = true;
  window.addEventListener('devicemotion', onMotion);
  window.addEventListener('deviceorientation', onOrientation);
}

start();

// iOS-style permission prompt; must run inside a tap.
export async function requestMotion() {
  if (mode !== 'ask') return mode;
  try {
    const res = await window.DeviceMotionEvent.requestPermission();
    if (typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
      await window.DeviceOrientationEvent.requestPermission().catch(() => {});
    }
    mode = res === 'granted' ? 'sensor' : 'none';
  } catch (e) {
    mode = 'none';
  }
  start();
  emit();
  return mode;
}

export const motionMode = () => mode;

// True only when real readings have arrived recently.
export const motionLive = () => Date.now() - lastSampleAt < 2500;

// Milliseconds since the phone last moved (null when no sensor data is available).
export const stillFor = () => (motionLive() ? Date.now() - lastMoveAt : null);

export const currentOrientation = () => (orientation && Date.now() - orientation.at < 2000 ? orientation : null);

// Rear camera pointing at the floor = phone held roughly flat, screen up.
export const cameraPointingDown = () => {
  const o = currentOrientation();
  if (!o) return null;
  return Math.abs(o.beta) < 40 && Math.abs(o.gamma) < 40;
};

export function subscribeMotion(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
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
