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

// iOS records QuickTime (.mov), Android MP4.
const isMov = (uri) => /\.mov$/i.test(uri || '');
const removeFile = (uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

// Temporary camera output (videos, photos, resized proof shots) lives in these cache folders.
const CACHE_DIRS = ['Camera', 'ImageManipulator'];

const baseName = (uri) => String(uri).split('/').pop();

// Clears every temporary camera file except the clips still listed (`keep`, by file name).
async function sweepCache(keep = new Set()) {
  const root = FileSystem.cacheDirectory;
  if (!root) return;
  await Promise.all(
    CACHE_DIRS.map(async (dir) => {
      const path = `${root}${dir}/`;
      try {
        const names = await FileSystem.readDirectoryAsync(path);
        await Promise.all(names.filter((n) => !keep.has(n)).map((n) => removeFile(`${path}${n}`)));
      } catch (e) {
        /* folder doesn't exist yet */
      }
    })
  );
}

// App start: nothing from a previous session is reachable any more.
export const purgeCameraCache = () => sweepCache();

// A new round is starting: the results screen only offers this round's clips, so earlier
// clips (and stray photos) are deleted to keep the phone's storage clean.
export function purgeOldClips(roundKey) {
  const gone = clips.filter((c) => c.roundKey !== roundKey);
  clips = clips.filter((c) => c.roundKey === roundKey);
  if (gone.length) emit();
  return sweepCache(new Set(clips.map((c) => baseName(c.uri))));
}

export function addClip({ uri, roundKey, game, title, location, durationMs }) {
  const clip = {
    id: Math.random().toString(36).slice(2, 10),
    uri,
    mime: isMov(uri) ? 'video/quicktime' : 'video/mp4',
    roundKey,
    game,
    title,
    location,
    durationMs,
    at: Date.now(),
  };
  const dropped = [clip, ...clips].slice(20);
  clips = [clip, ...clips].slice(0, 20);
  dropped.forEach((c) => removeFile(c.uri));
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
  await Sharing.shareAsync(clip.uri, {
    mimeType: clip.mime,
    dialogTitle: 'Share your clip',
    UTI: isMov(clip.uri) ? 'com.apple.quicktime-movie' : 'public.mpeg-4',
  }).catch(() => {});
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
