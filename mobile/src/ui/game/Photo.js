import React from 'react';
import { Image, Platform } from 'react-native';

// Game photo (base64 JPEG data URI), shown in black & white where the platform can filter it.
const MONO = Platform.OS === 'android' ? { filter: [{ grayscale: 1 }] } : null;

export default function Photo({ uri, style, accessibilityLabel }) {
  if (!uri) return null;
  return <Image source={{ uri }} resizeMode="cover" accessibilityLabel={accessibilityLabel} style={[{ width: '100%', height: '100%' }, MONO, style]} />;
}
