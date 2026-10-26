// Platform bits kept in one place: public invite links and the Android back button.
import { BackHandler, Platform } from 'react-native';

export const platform = () => Platform.OS; // 'android' | 'ios'

// Invite links and QR codes must also open for friends who don't have the app yet, so
// they point at the public web build, which joins the same room.
export const PUBLIC_URL = process.env.EXPO_PUBLIC_PUBLIC_URL || 'https://mzamfir00.github.io/USEus/';
export const inviteUrl = (code) => `${PUBLIC_URL}?room=${code}`;
export const legalUrl = (doc) => `${PUBLIC_URL}?legal=${doc}`;

// Reads a room code from a scanned QR / pasted invite (a link or a bare 4-digit code).
export function codeFromInvite(text) {
  const s = String(text || '').trim();
  if (/^\d{4}$/.test(s)) return s;
  const m = s.match(/[?&]room=(\d{4})\b/);
  return m ? m[1] : null;
}

/* --------------------------- Android back button --------------------------- */
// Open sheets register a close handler; back closes the newest one. With nothing open,
// the screen's own handler (or the OS) decides.
const backStack = [];
export function onBack(fn) {
  backStack.push(fn);
  return () => {
    const i = backStack.lastIndexOf(fn);
    if (i >= 0) backStack.splice(i, 1);
  };
}

BackHandler.addEventListener('hardwareBackPress', () => {
  const top = backStack[backStack.length - 1];
  if (!top) return false;
  top();
  return true;
});
