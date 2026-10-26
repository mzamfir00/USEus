// Clips recorded during this session. CameraView.recordAsync writes each clip to the
// app's cache; players save it to the photo library (expo-media-library) or share it
// through the system share sheet (expo-sharing).
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

let clips = [];
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());

export function addClip({ uri, roundKey, game, title, location, durationMs }) {
  const clip = {
    id: Math.random().toString(36).slice(2, 10),
    uri,
    mime: 'video/mp4',
    roundKey,
    game,
    title,
    location,
    durationMs,
    at: Date.now(),
  };
  const dropped = [clip, ...clips].slice(20);
  clips = [clip, ...clips].slice(0, 20);
  dropped.forEach((c) => FileSystem.deleteAsync(c.uri, { idempotent: true }).catch(() => {}));
  emit();
  return clip;
}

export function useClips(roundKey) {
  const all = useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => clips
  );
  return roundKey ? all.filter((c) => c.roundKey === roundKey) : all;
}

export const canShareClip = () => true;

// One tap to TikTok, Instagram Reels, WhatsApp… through the system share sheet.
export async function shareClip(clip) {
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(clip.uri, { mimeType: 'video/mp4', dialogTitle: 'Share your clip', UTI: 'public.mpeg-4' }).catch(() => {});
}

// Saves the clip to the photo library. Returns a line for the UI.
export async function downloadClip(clip) {
  try {
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return 'Allow photo library access in Settings to save clips.';
    await MediaLibrary.saveToLibraryAsync(clip.uri);
    return Platform.OS === 'ios' ? 'Saved to Photos' : 'Saved to your gallery';
  } catch (e) {
    console.warn('[clips] save failed', e);
    await shareClip(clip);
    return null;
  }
}

// Plain-text share (invite codes, results) through the system share sheet.
export { Share as TextShare } from 'react-native';
