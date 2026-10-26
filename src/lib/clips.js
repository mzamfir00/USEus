// Clips recorded during this session (kept in memory; players save or share them).
import { useSyncExternalStore } from 'react';

let clips = [];
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());

export function addClip({ blob, mime, roundKey, game, title, location, durationMs }) {
  const clip = {
    id: Math.random().toString(36).slice(2, 10),
    blob,
    mime,
    url: URL.createObjectURL(blob),
    roundKey,
    game,
    title,
    location,
    durationMs,
    at: Date.now(),
  };
  clips = [clip, ...clips].slice(0, 20);
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

const SHARE_TITLE = 'USEus Round Clip';

const fileFor = (clip) => {
  const ext = clip.mime.includes('mp4') ? 'mp4' : 'webm';
  const stamp = new Date(clip.at).toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return new File([clip.blob], `useus-${clip.game}-${stamp}.${ext}`, { type: clip.mime.split(';')[0] });
};

export const canShareClip = (clip) => {
  try {
    return !!navigator.canShare?.({ files: [fileFor(clip)] });
  } catch (e) {
    return false;
  }
};

// One tap to TikTok, Instagram Reels, WhatsApp… through the system share sheet.
export async function shareClip(clip) {
  await navigator.share({ files: [fileFor(clip)], title: SHARE_TITLE, text: clip.title }).catch(() => {});
}

// Saves the file. Returns where it went so the UI can say so.
export async function downloadClip(clip) {
  const file = fileFor(clip);
  const a = document.createElement('a');
  a.href = clip.url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return null;
}
