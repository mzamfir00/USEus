// USEus monochrome design system for React Native.
// Tokens: #000 background · #FFF foreground · #141414 elevated cards · #262626 hairlines.
// Room DNA / personal aesthetics mutate it in three stages:
//   auteur  — serif titles · film perforations on cards · warm silver palette + grain
//   dossier — monospace eyebrow labels · radar grid · dashed case-file cards + scanline
//   kinetic — hazard line · hard offset shadows · heavy uppercase stamped titles
import { createContext, useContext } from 'react';

export const FONT_FILES = {
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  Inter_800ExtraBold: require('@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf'),
  InstrumentSerif_400Regular: require('@expo-google-fonts/instrument-serif/400Regular/InstrumentSerif_400Regular.ttf'),
  InstrumentSerif_400Regular_Italic: require('@expo-google-fonts/instrument-serif/400Regular_Italic/InstrumentSerif_400Regular_Italic.ttf'),
  JetBrainsMono_400Regular: require('@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf'),
  JetBrainsMono_700Bold: require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
  ArchivoBlack_400Regular: require('@expo-google-fonts/archivo-black/400Regular/ArchivoBlack_400Regular.ttf'),
};

const INTER = { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold', 800: 'Inter_800ExtraBold' };
export const inter = (w = 400) => INTER[w] || INTER[w >= 750 ? 800 : w >= 650 ? 700 : w >= 550 ? 600 : w >= 450 ? 500 : 400];
export const SERIF = 'InstrumentSerif_400Regular';
export const SERIF_ITALIC = 'InstrumentSerif_400Regular_Italic';
export const MONO = 'JetBrainsMono_400Regular';
export const MONO_BOLD = 'JetBrainsMono_700Bold';
export const HEAVY = 'ArchivoBlack_400Regular';

export const BASE = {
  bg: '#000000',
  fg: '#ffffff',
  card: '#141414',
  cardPress: '#1c1c1c',
  border: '#262626',
  muted: '#8a8a8a',
  faint: '#4a4a4a',
};

export const RADIUS = 20;

export function makeTheme(style = 'none', stage = 0) {
  const on = (s, lv) => style === s && stage >= lv;
  const c = { ...BASE };
  if (on('auteur', 3)) Object.assign(c, { fg: '#f6f2ea', card: '#15130f', border: '#2b2822' });
  if (on('dossier', 3)) c.border = '#3a3a3a';
  let title = { fontFamily: inter(700), letterSpacing: -1 };
  if (on('auteur', 1)) title = { fontFamily: SERIF, letterSpacing: -0.3 };
  if (on('kinetic', 3)) title = { fontFamily: HEAVY, letterSpacing: -0.6, textTransform: 'uppercase' };
  const eyebrow = on('dossier', 1)
    ? { fontFamily: MONO, fontSize: 11.5, letterSpacing: 0.9, textTransform: 'uppercase' }
    : { fontFamily: inter(500), fontSize: 13 };
  return {
    style,
    stage,
    c,
    title,
    eyebrow,
    perforations: on('auteur', 2),
    grain: on('auteur', 3),
    radar: on('dossier', 2),
    scanline: on('dossier', 3),
    dashed: on('dossier', 3),
    hazard: on('kinetic', 1),
    hardShadow: on('kinetic', 2),
  };
}

export const ThemeContext = createContext(makeTheme());
export const useTheme = () => useContext(ThemeContext);
