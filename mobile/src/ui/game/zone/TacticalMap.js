// Monochrome tactical map drawn with native views: CARTO Dark Matter raster tiles
// (OpenStreetMap data, no API key) laid out with Web Mercator maths, and the zone, trails
// and pins drawn on top with react-native-svg. Drag to pan, pinch or use +/− to zoom.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Minus, Plus, Zap } from 'lucide-react-native';

const TILE = 256;
const SUBDOMAINS = 'abcd';
const tileUrl = (z, x, y) => `https://${SUBDOMAINS[(x + y) % 4]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}@2x.png`;
const MAX_Z = 19;
const MIN_Z = 3;

const world = (z) => TILE * 2 ** z;
function project(lat, lng, z) {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  const w = world(z);
  return { x: ((lng + 180) / 360) * w, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * w };
}
const metresPerPx = (lat, z) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

function Ping({ size }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1000, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: '#fff',
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) }],
      }}
    />
  );
}

function Blink({ children }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 400);
    return () => clearInterval(id);
  }, []);
  return <View style={{ opacity: on ? 1 : 0.25 }}>{children}</View>;
}

const label = (t, size = 10.5, color = '#000') => <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: size, color }}>{t}</Text>;

function Pin({ kind, text, heading }) {
  switch (kind) {
    case 'me':
      return (
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          {heading != null && (
            <View style={{ position: 'absolute', width: 44, height: 44, transform: [{ rotate: `${Math.round(heading)}deg` }], alignItems: 'center' }}>
              <View style={{ width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 20, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'rgba(255,255,255,0.45)' }} />
            </View>
          )}
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />
            </View>
          </View>
        </View>
      );
    case 'blip':
      return (
        <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
          <Ping size={34} />
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>{label(text)}</View>
        </View>
      );
    case 'reveal':
      return (
        <Blink>
          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' }}>{label(text)}</View>
        </Blink>
      );
    case 'drop':
      return (
        <View style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: '#000', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] }}>
          <View style={{ transform: [{ rotate: '-45deg' }] }}>
            <Zap size={15} color="#fff" fill="#fff" />
          </View>
        </View>
      );
    case 'radar':
      return (
        <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
        </View>
      );
    case 'out':
      return (
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#000', borderWidth: 2, borderStyle: 'dashed', borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          {label('×', 15, '#fff')}
        </View>
      );
    default:
      return (
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#000', borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>{label(text, 9, '#fff')}</View>
      );
  }
}

const PIN_SIZE = { me: 44, blip: 34, reveal: 30, drop: 30, radar: 26, out: 22, tag: 22 };

// center/radius: the live zone · rings: [{ r, dashed, faint }] · me: { lat, lng, heading }
// pins: [{ key, kind: blip|reveal|drop|radar|out, lat, lng, label }] · trails: [{ key, pts, hunter, label }]
function TacticalMap({ center, radius, fitRadius, rings = [], me, pins = [], trails = [], interactive = true, style }) {
  const [size, setSize] = useState(null);
  const [zoom, setZoom] = useState(null); // fractional zoom
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // pan, in screen px
  const fr = fitRadius || radius;
  const fitKey = `${center.lat},${center.lng},${fr}`;
  const fitted = useRef('');
  const gesture = useRef(null);

  // Frame the whole zone once (and again only if the zone itself moves).
  useEffect(() => {
    if (!size || fitted.current === fitKey) return;
    fitted.current = fitKey;
    const span = Math.min(size.w, size.h);
    const z = Math.log2((156543.03392 * Math.cos((center.lat * Math.PI) / 180) * span) / (fr * 2.25));
    setZoom(Math.max(MIN_Z, Math.min(MAX_Z, z)));
    setOffset({ x: 0, y: 0 });
  }, [size, fitKey, center.lat, fr]);

  const state = useRef({ zoom, offset });
  state.current = { zoom, offset };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: () => interactive,
        onPanResponderGrant: () => {
          gesture.current = { offset: state.current.offset, zoom: state.current.zoom, dist: null };
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;
          const start = gesture.current;
          if (!start) return;
          if (touches.length >= 2) {
            const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
            if (!start.dist) start.dist = d;
            const z = Math.max(MIN_Z, Math.min(MAX_Z, start.zoom + Math.log2(d / start.dist)));
            const k = 2 ** (z - start.zoom);
            setZoom(z);
            setOffset({ x: start.offset.x * k, y: start.offset.y * k });
          } else if (!start.dist) {
            setOffset({ x: start.offset.x + g.dx, y: start.offset.y + g.dy });
          }
        },
        onPanResponderRelease: () => {
          gesture.current = null;
        },
        onPanResponderTerminate: () => {
          gesture.current = null;
        },
      }),
    [interactive]
  );

  const zoomBy = (d) => {
    const z = Math.max(MIN_Z, Math.min(MAX_Z, zoom + d));
    const k = 2 ** (z - zoom);
    setZoom(z);
    setOffset((o) => ({ x: o.x * k, y: o.y * k }));
  };

  let body = null;
  if (size && zoom != null) {
    const zi = Math.min(MAX_Z, Math.max(MIN_Z, Math.floor(zoom)));
    const k = 2 ** (zoom - zi); // tile scale
    const c = project(center.lat, center.lng, zi);
    // World px (at zi) shown at the middle of the view.
    const mid = { x: c.x - offset.x / k, y: c.y - offset.y / k };
    const toScreen = (lat, lng) => {
      const p = project(lat, lng, zi);
      return { x: (p.x - mid.x) * k + size.w / 2, y: (p.y - mid.y) * k + size.h / 2 };
    };
    const mpp = metresPerPx(center.lat, zoom);
    const n = 2 ** zi;
    const x0 = Math.floor((mid.x - size.w / 2 / k) / TILE);
    const x1 = Math.floor((mid.x + size.w / 2 / k) / TILE);
    const y0 = Math.max(0, Math.floor((mid.y - size.h / 2 / k) / TILE));
    const y1 = Math.min(n - 1, Math.floor((mid.y + size.h / 2 / k) / TILE));
    const tiles = [];
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        const wx = ((tx % n) + n) % n;
        tiles.push(
          <Image
            key={`${zi}/${tx}/${ty}`}
            source={{ uri: tileUrl(zi, wx, ty) }}
            fadeDuration={0}
            style={{ position: 'absolute', left: (tx * TILE - mid.x) * k + size.w / 2, top: (ty * TILE - mid.y) * k + size.h / 2, width: TILE * k + 0.5, height: TILE * k + 0.5 }}
          />
        );
      }
    }
    const cs = toScreen(center.lat, center.lng);
    body = (
      <>
        {tiles}
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          {rings.map((ring, i) => (
            <Circle key={`r${i}`} cx={cs.x} cy={cs.y} r={ring.r / mpp} stroke="#fff" strokeWidth={1.5} strokeOpacity={ring.faint ? 0.35 : 0.9} strokeDasharray={ring.dashed ? '6 8' : undefined} fill="none" />
          ))}
          <Circle cx={cs.x} cy={cs.y} r={radius / mpp} stroke="#fff" strokeWidth={2.5} fill="#fff" fillOpacity={0.05} />
          <Circle cx={cs.x} cy={cs.y} r={3} fill="#fff" />
          {trails.map((tr) =>
            tr.pts?.length ? (
              <Polyline
                key={tr.key}
                points={tr.pts.map(([la, ln]) => {
                  const p = toScreen(la, ln);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                }).join(' ')}
                stroke="#fff"
                strokeWidth={tr.hunter ? 3 : 2}
                strokeOpacity={tr.hunter ? 1 : 0.7}
                strokeDasharray={tr.hunter ? undefined : '2 7'}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : null
          )}
        </Svg>
        {trails.map((tr) => {
          if (!tr.pts?.length) return null;
          const [la, ln] = tr.pts[tr.pts.length - 1];
          const p = toScreen(la, ln);
          return (
            <View key={`tag-${tr.key}`} pointerEvents="none" style={{ position: 'absolute', left: p.x - 11, top: p.y - 11 }}>
              <Pin kind="tag" text={tr.label} />
            </View>
          );
        })}
        {[...pins].sort((a, b) => (a.kind === 'blip') - (b.kind === 'blip')).map((pin) => {
          const p = toScreen(pin.lat, pin.lng);
          const s = PIN_SIZE[pin.kind] || 22;
          return (
            <View key={pin.key} pointerEvents="none" style={{ position: 'absolute', left: p.x - s / 2, top: p.y - s / 2 }}>
              <Pin kind={pin.kind} text={pin.label} />
            </View>
          );
        })}
        {me ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: toScreen(me.lat, me.lng).x - 22, top: toScreen(me.lat, me.lng).y - 22 }}>
            <Pin kind="me" heading={me.heading} />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View
      style={[{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      testID="tactical-map"
      accessibilityLabel={`map with ${pins.length} pins`}
    >
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers}>
        {body}
      </View>
      {interactive && zoom != null ? (
        <View style={{ position: 'absolute', left: 10, top: 10, gap: 6 }}>
          {[
            [Plus, 1, 'Zoom in'],
            [Minus, -1, 'Zoom out'],
          ].map(([Icon, d, lbl]) => (
            <TouchableOpacity key={lbl} accessibilityLabel={lbl} onPress={() => zoomBy(d)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} color="#fff" />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 6, paddingVertical: 1 }}>
        <Text style={{ color: '#8a8a8a', fontSize: 9.5, fontFamily: 'Inter_400Regular' }}>© OpenStreetMap contributors © CARTO</Text>
      </View>
    </View>
  );
}

// The HUD around the map re-renders 4×/s; the tiles and overlays only redraw when what they
// show actually changes (heading to the nearest 4°).
const signature = (p) =>
  JSON.stringify([p.center, Math.round((p.radius || 0) * 10), p.fitRadius, p.rings, p.me && [p.me.lat, p.me.lng, p.me.heading == null ? null : Math.round(p.me.heading / 4)], p.pins, p.trails, p.interactive]);

export default React.memo(TacticalMap, (a, b) => a.style === b.style && signature(a) === signature(b));
