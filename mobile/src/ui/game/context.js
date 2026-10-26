import { createContext, useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Lets the shell send intents (host: end round) without threading props through every game.
export const IntentContext = createContext(() => {});

// GPS Playzone → Camera: strobe the flashlight while this player's position is revealed.
export const ZoneStrobeContext = createContext(false);

// How far the Playzone HUD pushes game banners ({ h }) and top cards ({ top }) down, in px.
export const ZoneOffsetContext = createContext({ h: 0, top: 0 });

// Camera → GameShell: the Snitch Protocol alarm overlay ({ reason, onResume } | null).
export const PenaltyContext = createContext(null);

// Top offsets shared by every game screen (web: max(150px, safe-top + 136px) + zone HUD).
export function useGameTop() {
  const insets = useSafeAreaInsets();
  const zone = useContext(ZoneOffsetContext);
  return {
    banner: Math.max(150, insets.top + 136) + (zone.h || 0),
    pad: Math.max(84, insets.top + 70) + (zone.top || 0),
    bottom: insets.bottom,
  };
}
