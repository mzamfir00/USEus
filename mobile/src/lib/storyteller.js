// The Mafia Storyteller's voice: the phone's text-to-speech (expo-speech) through the main
// speaker, in Romanian or English.
import * as Speech from 'expo-speech';
import { MAFIA_LANGS } from '../core';

const voiceCache = {};

export function narrate(text, lang) {
  if (!text) return;
  try {
    Speech.stop();
    Speech.speak(text, { language: MAFIA_LANGS[lang]?.speech || 'ro-RO', rate: 0.95, pitch: 1, volume: 1 });
  } catch (e) {
    /* speech unavailable */
  }
}

export function stopNarration() {
  try {
    Speech.stop();
  } catch (e) {
    /* nothing playing */
  }
}

// Whether this phone has a voice for the language: true, false, or null when it can't tell.
export async function hasVoice(lang) {
  if (lang in voiceCache) return voiceCache[lang];
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const prefix = (MAFIA_LANGS[lang]?.speech || '').slice(0, 2).toLowerCase();
    voiceCache[lang] = voices.length ? voices.some((v) => (v.language || '').toLowerCase().startsWith(prefix)) : null;
  } catch (e) {
    voiceCache[lang] = null;
  }
  return voiceCache[lang];
}
