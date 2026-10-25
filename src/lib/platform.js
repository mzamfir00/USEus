// Native shell (Capacitor) vs. browser differences, kept in one place.
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

// Public web address of the app: invite links and QR codes must open for friends who
// don't have the app, so the native shell (served from https://localhost) uses this.
export const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || 'https://mzamfir00.github.io/USEus/';
export const appUrl = () => (isNative() ? PUBLIC_URL : `${window.location.origin}${import.meta.env.BASE_URL}`);

/* --------------------------- Android back button --------------------------- */
// Open sheets register a close handler; back closes the newest one. With nothing open,
// back sends the app to the background instead of killing a live room.
const backStack = [];
export function onBack(fn) {
  backStack.push(fn);
  return () => {
    const i = backStack.lastIndexOf(fn);
    if (i >= 0) backStack.splice(i, 1);
  };
}

export async function installNativeShell() {
  if (!isNative()) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', () => {
    const top = backStack[backStack.length - 1];
    if (top) top();
    else App.minimizeApp();
  });
}
