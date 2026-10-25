// Clips recorded during this session (kept in memory; players save or share them).
import { useSyncExternalStore } from 'react';
import { isNative, platform } from './platform';

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

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

// Native shell: write the clip to a real file (cache for sharing, Documents for saving).
async function writeNative(clip, keep) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const file = fileFor(clip);
  const res = await Filesystem.writeFile({
    path: keep ? `USEus/${file.name}` : file.name,
    data: await toBase64(clip.blob),
    directory: keep ? Directory.Documents : Directory.Cache,
    recursive: true,
  });
  return res.uri;
}

export const canShareClip = (clip) => {
  if (isNative()) return true;
  try {
    return !!navigator.canShare?.({ files: [fileFor(clip)] });
  } catch (e) {
    return false;
  }
};

// One tap to TikTok, Instagram Reels, WhatsApp… through the system share sheet.
export async function shareClip(clip) {
  if (isNative()) {
    const { Share } = await import('@capacitor/share');
    const uri = await writeNative(clip, false);
    await Share.share({ title: SHARE_TITLE, text: clip.title, files: [uri], dialogTitle: 'Share your clip' }).catch(() => {});
    return;
  }
  await navigator.share({ files: [fileFor(clip)], title: SHARE_TITLE, text: clip.title }).catch(() => {});
}

// Saves the file. Returns where it went so the UI can say so.
export async function downloadClip(clip) {
  if (isNative()) {
    try {
      await writeNative(clip, true);
      return platform() === 'ios' ? 'Saved to Files › On My iPhone › USEus' : 'Saved to Documents › USEus';
    } catch (e) {
      await shareClip(clip); // no storage access: let the share sheet save it
      return null;
    }
  }
  const file = fileFor(clip);
  const a = document.createElement('a');
  a.href = clip.url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return null;
}
