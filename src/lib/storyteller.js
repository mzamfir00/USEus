// The Mafia Storyteller's voice in the browser: speech synthesis in Romanian or English.
import { MAFIA_LANGS } from '../game/mafia';

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
const langOf = (lang) => MAFIA_LANGS[lang]?.speech || 'ro-RO';
const voiceFor = (lang) => {
  const prefix = langOf(lang).slice(0, 2).toLowerCase();
  return (synth()?.getVoices() || []).find((v) => (v.lang || '').toLowerCase().startsWith(prefix)) || null;
};

export function narrate(text, lang) {
  const s = synth();
  if (!s || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langOf(lang);
    const voice = voiceFor(lang);
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.volume = 1;
    s.cancel();
    s.speak(u);
  } catch (e) {
    /* speech unavailable */
  }
}

export function stopNarration() {
  try {
    synth()?.cancel();
  } catch (e) {
    /* nothing playing */
  }
}

// Whether this browser has a voice for the language: true, false, or null when it can't tell.
export async function hasVoice(lang) {
  const s = synth();
  if (!s) return false;
  if (!s.getVoices().length) await new Promise((r) => setTimeout(r, 400)); // voices load lazily
  return s.getVoices().length ? !!voiceFor(lang) : null;
}
