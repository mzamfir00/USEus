// Analog-horror overlay for the Halloween pack: VHS scanlines, film grain, a rolling tracking
// band and a heavy vignette. Purely visual — never captures taps.
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SERIF_ITALIC } from '../../theme';

function Loop({ from, to, duration, children, style, prop = 'translateY', steps }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  const value = steps
    ? v.interpolate({ inputRange: steps.map((_, i) => i / (steps.length - 1)), outputRange: steps })
    : v.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  return <Animated.View style={[style, { transform: [{ [prop]: value }] }]}>{children}</Animated.View>;
}

export default function HorrorFx() {
  const { height } = Dimensions.get('window');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 0 }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="hfx-scan" width="4" height="3" patternUnits="userSpaceOnUse">
            <Rect width="4" height="1" fill="rgba(255,255,255,0.04)" />
          </Pattern>
          <RadialGradient id="hfx-vignette" cx="50%" cy="50%" rx="75%" ry="60%">
            <Stop offset="0.4" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.88" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#hfx-scan)" />
      </Svg>
      <Loop duration={500} prop="translateX" steps={[0, 0, -10, -10, 6, 6]} style={{ position: 'absolute', top: -40, left: -40, right: -40, bottom: -40, opacity: 0.13 }}>
        <Image source={require('../../../assets/grain.png')} resizeMode="repeat" style={{ width: '100%', height: '100%' }} />
      </Loop>
      <Loop from={-0.3 * height} to={1.3 * height} duration={7000} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: height * 0.14 }}>
        <LinearGradient colors={['transparent', 'rgba(255,255,255,0.06)', 'transparent']} style={{ flex: 1 }} />
      </Loop>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Rect width="100%" height="100%" fill="url(#hfx-vignette)" />
      </Svg>
    </View>
  );
}

// Flickering italic serif title (.horror-title).
export function HorrorTitle({ children, size = 34, style, color = '#fff', center }) {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(5340),
        Animated.timing(o, { toValue: 0.45, duration: 30, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.delay(180),
        Animated.timing(o, { toValue: 0.75, duration: 30, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return (
    <Animated.Text style={[{ fontFamily: SERIF_ITALIC, fontSize: size, lineHeight: Math.round(size * 1.08), color, letterSpacing: -0.3, opacity: o, textAlign: center ? 'center' : undefined }, style]}>
      {children}
    </Animated.Text>
  );
}

// Slow pulse (.breathe) and a shaky jitter (.tremble) for horror UI.
export function Breathe({ children, style }) {
  const o = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.55, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={[style, { opacity: o }]}>{children}</Animated.View>;
}

export function Tremble({ children, style }) {
  return (
    <Loop duration={120} prop="translateX" steps={[0, -1, 1, -1, 0]} style={style}>
      {children}
    </Loop>
  );
}

// Monospace VHS label (.vhs).
export function Vhs({ children, size = 12, color = 'rgba(255,255,255,0.7)', style }) {
  return <Text style={[{ fontFamily: 'JetBrainsMono_400Regular', fontSize: size, letterSpacing: size * 0.08, textTransform: 'uppercase', color }, style]}>{children}</Text>;
}
