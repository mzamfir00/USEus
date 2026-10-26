// GPS Playzone layer, drawn over every game screen in an outdoor zone round:
// live boundary + out-of-bounds penalty, hunter radar pings, hider decoys and heartbeat,
// the mid-round supply drop and the tactical map.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crosshair, Ghost, HeartPulse, MapIcon, Radar, Satellite, TriangleAlert, X, Zap } from 'lucide-react-native';
import {
  DROP_RADIUS,
  EMERGENCY_RADAR_MAX,
  XP,
  bearing,
  cardinal,
  destination,
  formatDistance,
  haversine,
  isHunter,
  nextShrinkAt,
  radarAllowance,
  remainingHiders,
  shrinkStep,
  zoneRadius,
} from '../../../core';
import { currentHeading, startHeading, stopHeading } from '../../../lib/motion';
import { prompt } from '../../../lib/permissions';
import { consumeRadarPing, radarLeft as packPings, useMonetization } from '../../../services/monetizationService';
import { buzz, haptic, Synth } from '../../../lib/sound';
import { T } from '../../primitives';
import { formatTime, useLater, useNow } from '../../helpers';
import TacticalMap from './TacticalMap';

const SIM_STEP = 5; // metres per D-pad tap
// GPS: a fix every 2.5 s or 2 m is plenty for a 30–300 m zone and saves battery.
const GPS_INTERVAL_MS = 2500;
const GPS_DISTANCE_M = 2;
const SEND_MIN_M = 2; // resend a GPS fix after moving this far…
const SEND_MIN_MS = 4000; // …or this long
const BEAT_MS = { 20: 1000, 10: 650, 5: 380 }; // heartbeat period by hunter distance
const BEAT_LEVEL = { 20: 1, 10: 2, 5: 4 }; // heartbeat haptic strength

const nameOf = (view, id) => view.players.find((p) => p.id === id)?.name || 'Someone';
const userOf = (view, id) => view.players.find((p) => p.id === id)?.username || 'someone';
const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/* --------------------------------- GPS feed -------------------------------- */

// Real GPS (expo-location, best-for-navigation accuracy), or a D-pad-driven simulated
// position for indoor testing. Every fix that moved (or every few seconds) goes to the host.
function useGeoFeed(zone, intent) {
  const [fix, setFix] = useState(null); // { lat, lng, acc, at }
  const [error, setError] = useState(null); // denied | unavailable
  const [simHeading, setSimHeading] = useState(null);
  const fixRef = useRef(null);
  const sent = useRef(null);

  const send = useCallback(
    (p, force) => {
      const last = sent.current;
      if (!force && last && haversine(last, p) < SEND_MIN_M && Date.now() - last.t < SEND_MIN_MS) return;
      sent.current = { lat: p.lat, lng: p.lng, t: Date.now() };
      intent({ type: 'pos', lat: p.lat, lng: p.lng, acc: p.acc });
    },
    [intent]
  );

  const accept = useCallback(
    (p, force) => {
      fixRef.current = p;
      setFix(p);
      send(p, force);
    },
    [send]
  );

  useEffect(() => {
    if (zone.sim) return undefined;
    let sub = null;
    let cancelled = false;
    (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = (await prompt(Location.requestForegroundPermissionsAsync)) || perm;
        if (cancelled) return;
        if (!perm.granted) {
          setError('denied');
          return;
        }
        startHeading();
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: GPS_INTERVAL_MS, distanceInterval: GPS_DISTANCE_M }, (pos) => {
          setError(null);
          accept({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0), at: Date.now() });
        });
        if (cancelled) sub.remove();
      } catch (e) {
        if (!cancelled) setError('unavailable');
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
      stopHeading();
    };
  }, [zone.sim, accept]);

  // Simulated GPS starts somewhere near the middle of the zone.
  useEffect(() => {
    if (!zone.sim) return;
    const p = destination(zone.center, zone.radius * 0.35 * Math.random(), Math.random() * 360);
    accept({ lat: p.lat, lng: p.lng, acc: 3, at: Date.now() }, true);
  }, [zone.sim, zone.center.lat, zone.center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep-alive so the host's picture survives a dropped message.
  useEffect(() => {
    const id = setInterval(() => fixRef.current && send(fixRef.current, true), SEND_MIN_MS);
    return () => clearInterval(id);
  }, [send]);

  const step = useCallback(
    (brg) => {
      const f = fixRef.current;
      if (!f) return;
      const p = destination(f, SIM_STEP, brg);
      setSimHeading(brg);
      accept({ lat: p.lat, lng: p.lng, acc: 3, at: Date.now() }, true);
    },
    [accept]
  );

  return { fix, error, step, simHeading };
}

/* --------------------------------- widgets -------------------------------- */

// Arrow back to the zone inside a compass rose; the rose turns with the phone when a compass exists.
function Compass({ target, heading, size = 132 }) {
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: '#fff', transform: [{ rotate: `${-(heading || 0)}deg` }] }}>
        <T size={11} w={700} color="#fff" style={{ position: 'absolute', top: 4, alignSelf: 'center' }}>
          N
        </T>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${target}deg` }] }]}>
          <ArrowUp size={size * 0.5} strokeWidth={2.6} color="#fff" />
        </View>
      </View>
    </View>
  );
}

// Scrolling ECG line, faster as the hunter closes in.
function Ecg({ period }) {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!w) return undefined;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: -w, duration: period * 2, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x, w, period]);
  const beat = 'H18 L21 9 L24 12 H27 L29 2 L32 22 L35 12 H39 L43 8 L47 12 H50';
  const d = `M0 12 ${[0, 50, 100, 150].map((o) => beat.replace(/([HL])(\d+)/g, (_, c, v) => `${c}${Number(v) + o}`)).join(' ')}`;
  return (
    <View style={{ height: 24, overflow: 'hidden' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Animated.View style={{ width: w * 2, transform: [{ translateX: x }] }}>
          <Svg viewBox="0 0 200 24" preserveAspectRatio="none" width={w * 2} height={24}>
            <Path d={d} fill="none" stroke="#000" strokeWidth={2} strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Beat({ period, children }) {
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(s, { toValue: 1.3, duration: period * 0.15, useNativeDriver: true }),
        Animated.timing(s, { toValue: 0.95, duration: period * 0.15, useNativeDriver: true }),
        Animated.timing(s, { toValue: 1.15, duration: period * 0.15, useNativeDriver: true }),
        Animated.timing(s, { toValue: 1, duration: period * 0.55, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [s, period]);
  return <Animated.View style={{ transform: [{ scale: s }] }}>{children}</Animated.View>;
}

export function Drain({ ms, id, dark = false }) {
  const v = useRef(new Animated.Value(1)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    v.setValue(1);
    const a = Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.linear, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v, ms, id]);
  return (
    <View style={{ marginTop: 8, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View
        style={{
          height: 4,
          width: w,
          backgroundColor: dark ? '#000' : '#fff',
          transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-w / 2, 0] }) }, { scaleX: v }],
        }}
      />
    </View>
  );
}

// On-screen D-pad for simulated GPS; stays above the out-of-bounds overlay so you can walk back.
function SimPad({ onStep, z = 86 }) {
  const Btn = ({ icon: Icon, brg, label }) => (
    <TouchableOpacity
      accessibilityLabel={label}
      onPress={() => onStep(brg)}
      activeOpacity={0.6}
      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={18} color="#fff" />
    </TouchableOpacity>
  );
  const gap = <View style={{ width: 40, height: 40 }} />;
  return (
    <View style={{ position: 'absolute', right: 8, top: '40%', zIndex: z, elevation: z }} testID="sim-pad">
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {gap}
        <Btn icon={ChevronUp} brg={0} label="Move north" />
        {gap}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        <Btn icon={ChevronLeft} brg={270} label="Move west" />
        <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <T size={9} w={700} color="rgba(255,255,255,0.7)">
            SIM
          </T>
        </View>
        <Btn icon={ChevronRight} brg={90} label="Move east" />
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {gap}
        <Btn icon={ChevronDown} brg={180} label="Move south" />
        {gap}
      </View>
      <T size={9.5} w={500} color="rgba(255,255,255,0.6)" center style={{ marginTop: 4 }}>
        {SIM_STEP} m / tap
      </T>
    </View>
  );
}

function Strobe({ children, style }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 250);
    return () => clearInterval(id);
  }, []);
  return <View style={[style, { backgroundColor: on ? '#fff' : '#000' }]}>{children}</View>;
}

function OobPulse({ children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: 500, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[style, { backgroundColor: 'rgba(0,0,0,0.92)', borderWidth: v.interpolate({ inputRange: [0, 1], outputRange: [4, 14] }), borderColor: '#fff' }]}>{children}</Animated.View>;
}

/* ---------------------------------- layer ---------------------------------- */

export default function ZoneLayer({ view, serverNow, intent, onStrobe, onRows, children }) {
  useNow(250);
  const insets = useSafeAreaInsets();
  const [, force] = useState(0);
  const r = view.round;
  const zone = r.zone;
  const me = view.me;
  const now = serverNow();
  const intel = view.intel || {};
  const { fix, error, step, simHeading } = useGeoFeed(zone, intent);
  const heading = zone.sim ? simHeading : currentHeading();
  const radius = zoneRadius(zone, now);
  const dist = fix ? haversine(zone.center, fix) : null;
  const toEdge = dist == null ? null : radius - dist; // > 0 inside
  const hunter = isHunter(r, me);
  const hiding = remainingHiders(r).includes(me);
  const outDeadline = r.zoneOuts?.[me];
  const revealed = !!r.zoneRevealed?.[me];
  const scan = intel.scan && now < intel.scan.until ? intel.scan : null;
  const drop = r.drop && !r.drop.claimedBy ? r.drop : null;
  const [mapOpen, setMapOpen] = useState(false);
  const [banners, setBanners] = useState([]);
  const [lostSignal, setLostSignal] = useState(false);
  const rowsTop = Math.max(64, insets.top + 52);
  const [rowsBottom, setRowsBottom] = useState(0);

  const later = useLater();
  const pushBanner = useCallback(
    (b) => {
      const id = Math.random().toString(36).slice(2);
      setBanners((list) => [...list.slice(-2), { ...b, id }]);
      later(() => setBanners((list) => list.filter((x) => x.id !== id)), b.ms || 4500);
    },
    [later]
  );

  /* ---- hunters: a radar ping (or a decoy signal) opens the map for exactly 3.0 s ---- */
  const scanSeen = useRef(intel.scan?.id);
  useEffect(() => {
    const sc = intel.scan;
    if (!sc || sc.id === scanSeen.current) return undefined;
    scanSeen.current = sc.id;
    setMapOpen(true);
    setLostSignal(false);
    Synth.blip();
    haptic.sonar();
    const left = Math.max(0, sc.until - serverNow());
    const t1 = setTimeout(() => {
      force((n) => n + 1); // hide the pins on the dot
      setLostSignal(true);
    }, left);
    const t2 = setTimeout(() => setLostSignal(false), left + 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [intel.scan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- hiders: radar alert ---- */
  const lastRadar = r.radar?.[r.radar.length - 1];
  const radarSeen = useRef(lastRadar?.id);
  useEffect(() => {
    if (!lastRadar || lastRadar.id === radarSeen.current) return;
    radarSeen.current = lastRadar.id;
    if (!hiding) return;
    buzz([200, 100, 200, 100, 200]);
    if (intel.ghostUsed === lastRadar.id) {
      pushBanner({ kind: 'ghost', Icon: Ghost, text: 'GHOST IMMUNITY ABSORBED THE RADAR — YOU STAYED INVISIBLE', ms: 6000 });
    } else {
      pushBanner({
        kind: 'radar',
        Icon: TriangleAlert,
        text: `HUNTER USED RADAR (${XP.radarPing} XP)! YOUR ZONE WAS EXPOSED FOR 3 SECONDS — MOVE OR STAY HIDDEN!`,
        ms: 6500,
        drain: Math.max(0, lastRadar.until - serverNow()),
      });
    }
  }, [lastRadar?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- supply drop ---- */
  const dropSeen = useRef(r.drop?.at);
  useEffect(() => {
    if (!r.drop || r.drop.at === dropSeen.current) return;
    dropSeen.current = r.drop.at;
    buzz([60, 40, 60]);
    if (!hiding) Synth.blip(); // hiders stay silent
    pushBanner({ kind: 'drop', Icon: Zap, text: `SUPPLY DROP LANDED — FIRST HIDER WITHIN ${DROP_RADIUS} m GETS +${XP.supplyDrop} XP & GHOST IMMUNITY`, ms: 6500 });
  }, [r.drop?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const claimSeen = useRef(r.drop?.claimedBy);
  useEffect(() => {
    const by = r.drop?.claimedBy;
    if (!by || by === claimSeen.current) return;
    claimSeen.current = by;
    if (by === me) {
      buzz([80, 40, 80, 40, 240]);
      pushBanner({ kind: 'drop', Icon: Ghost, text: `SUPPLY DROP SECURED · +${XP.supplyDrop} XP · GHOST IMMUNITY — INVISIBLE TO THE NEXT RADAR PING`, ms: 6500 });
    } else pushBanner({ kind: 'drop', Icon: Zap, text: `@${userOf(view, by)} GRABBED THE SUPPLY DROP`, ms: 4500 });
  }, [r.drop?.claimedBy]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- closing ring ---- */
  const ringStep = shrinkStep(zone, now);
  const stepSeen = useRef(ringStep);
  useEffect(() => {
    if (ringStep === stepSeen.current) return;
    stepSeen.current = ringStep;
    if (!ringStep) return;
    buzz([120, 60, 120]);
    pushBanner({ kind: 'ring', Icon: Crosshair, text: `RING CLOSING — ZONE NOW ${Math.round(radius)} m`, ms: 4500 });
  }, [ringStep]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- other players exposed ---- */
  const outIds = Object.keys(r.zoneRevealed || {})
    .filter((id) => id !== me)
    .sort()
    .join(',');
  const outSeen = useRef(outIds);
  useEffect(() => {
    const before = new Set(outSeen.current.split(',').filter(Boolean));
    outSeen.current = outIds;
    outIds
      .split(',')
      .filter((id) => id && !before.has(id))
      .forEach((id) => {
        const tracked = (intel.reveals || []).some((p) => p.id === id);
        pushBanner({
          kind: 'reveal',
          Icon: Satellite,
          text: tracked ? `@${userOf(view, id)} LEFT THE PLAYZONE — LIVE POSITION ON YOUR MAP` : `@${userOf(view, id)} LEFT THE PLAYZONE — POSITION EXPOSED`,
          ms: 5000,
        });
      });
  }, [outIds]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- out of bounds: countdown beeps + haptics, then siren + strobe while revealed ---- */
  const secsLeft = outDeadline ? Math.max(0, Math.ceil((outDeadline - now) / 1000)) : null;
  const lastSec = useRef(null);
  useEffect(() => {
    if (secsLeft != null && secsLeft !== lastSec.current) {
      Synth.beep(secsLeft <= 3);
      if (secsLeft <= 3) haptic.warning();
      else buzz(60);
    }
    lastSec.current = secsLeft;
  }, [secsLeft]);

  useEffect(() => {
    if (!revealed) return undefined;
    onStrobe(true);
    const siren = () => {
      Synth.penalty();
      buzz([400, 100, 400]);
    };
    siren();
    const id = setInterval(siren, 1000);
    return () => {
      clearInterval(id);
      onStrobe(false);
    };
  }, [revealed, onStrobe]);

  /* ---- hider heartbeat: a haptic lub-dub on every beat, faster as the hunter closes in ---- */
  const hb = hiding ? intel.hb : null;
  useEffect(() => {
    if (!hb) return undefined;
    const id = setInterval(() => haptic.heartbeat(BEAT_LEVEL[hb]), BEAT_MS[hb]);
    return () => clearInterval(id);
  }, [hb]);

  /* ---- purchased emergency pings: spent once the host confirms each one ---- */
  const store = useMonetization();
  const extraUsed = r.radarExtra?.[me] || 0;
  const seenExtra = useRef(extraUsed);
  useEffect(() => {
    if (extraUsed > seenExtra.current) consumeRadarPing();
    seenExtra.current = extraUsed;
  }, [extraUsed]);

  /* --------------------------------- render -------------------------------- */
  const allowance = radarAllowance(r, me);
  const radarLeft = allowance - (r.radarUses?.[me] || 0);
  const emergency = radarLeft <= 0 && !!view.monetized && packPings(store) > 0 && extraUsed < EMERGENCY_RADAR_MAX;
  const freePing = (r.radarUses?.[me] || 0) < (r.radarBonus?.[me] || 0);
  const armsAt = r.data.hideUntil || 0;
  const radarArming = now < armsAt;
  const nextShrink = nextShrinkAt(zone, now);
  const dropDist = drop && fix ? haversine(fix, drop) : null;
  const backBearing = fix ? bearing(fix, zone.center) : 0;
  const backDist = dist == null ? null : Math.max(0, dist - radius);

  const pins = [];
  if (drop) pins.push({ key: 'drop', kind: 'drop', lat: drop.lat, lng: drop.lng });
  (intel.reveals || []).forEach((p) => pins.push({ key: `rv-${p.id}`, kind: 'reveal', lat: p.lat, lng: p.lng, label: initials(nameOf(view, p.id)) }));
  if (scan) scan.blips.forEach((b, i) => pins.push({ key: `b${i}`, kind: 'blip', lat: b.lat, lng: b.lng, label: initials(nameOf(view, b.id)) }));
  const rings = [];
  if (radius < zone.radius - 0.5) rings.push({ r: zone.radius, faint: true });
  if (nextShrink && nextShrink - now <= 45000) rings.push({ r: zoneRadius(zone, nextShrink + 1), dashed: true });

  const chip = { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.6)' };
  const status = error
    ? error === 'denied'
      ? 'LOCATION BLOCKED — allow location for USEus'
      : 'NO GPS SIGNAL'
    : !fix
      ? 'Waiting for GPS…'
      : toEdge >= 0
        ? `ZONE ${Math.round(radius)} m · ${formatDistance(toEdge)} to edge`
        : `ZONE ${Math.round(radius)} m · ${formatDistance(-toEdge)} OUTSIDE`;
  const sub = zone.shrink ? (nextShrink ? `Ring closes in ${formatTime(nextShrink - now)}` : 'Ring fully closed') : zone.sim ? 'Simulated GPS' : fix ? `GPS ±${fix.acc} m` : 'Playzone';
  const out = !!(outDeadline || revealed);
  const disabledRadar = (radarLeft <= 0 && !emergency) || radarArming || !!scan;

  return (
    <>
      {/* Shade behind the HUD so the camera's REC stamp doesn't bleed between rows. */}
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.5)', 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: rowsBottom + 14, zIndex: 15 }} />
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 16, right: 16, top: rowsTop, zIndex: 25, gap: 8 }}
        onLayout={(e) => {
          const bottom = Math.ceil(rowsTop + e.nativeEvent.layout.height);
          setRowsBottom(bottom);
          onRows?.(bottom);
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity accessibilityLabel="Open tactical map" testID="open-map" onPress={() => setMapOpen(true)} style={[chip, { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }]}>
            <MapIcon size={17} color="#fff" />
          </TouchableOpacity>
          {/* Tapping a blocked-location status opens the app's settings. */}
          <TouchableOpacity
            disabled={error !== 'denied'}
            onPress={() => Linking.openSettings().catch(() => {})}
            style={[chip, { flex: 1, paddingHorizontal: 14, paddingVertical: 6 }]}
            testID="zone-status"
            accessibilityLabel={`zone ${toEdge == null ? 'pending' : toEdge >= 0 ? 'in' : 'out'}`}
          >
            <T size={12} w={600} color="#fff" numberOfLines={1}>
              {status}
            </T>
            <T size={10.5} color="rgba(255,255,255,0.6)" numberOfLines={1}>
              {error === 'denied' ? 'Tap to open Settings' : sub}
            </T>
          </TouchableOpacity>
        </View>

        {drop && (
          <TouchableOpacity
            onPress={() => setMapOpen(true)}
            testID="supply-drop"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Zap size={14} color="#fff" />
            <T size={12} w={700} color="#fff">
              SUPPLY DROP
            </T>
            <T size={12} w={600} color="rgba(255,255,255,0.8)" style={{ marginLeft: 'auto' }}>
              {dropDist == null ? 'on your map' : `${formatDistance(dropDist)} ${cardinal(bearing(fix, drop))}`}
            </T>
          </TouchableOpacity>
        )}

        {r.hunt && hunter && (
          <TouchableOpacity
            disabled={disabledRadar}
            testID="radar-ping"
            accessibilityLabel={`radar ${radarLeft} left`}
            onPress={() => {
              Synth.unlock();
              intent({ type: 'uavRadar', ...(radarLeft <= 0 && { emergency: true }) });
            }}
            style={{
              height: 44,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: disabledRadar ? 'rgba(255,255,255,0.15)' : '#fff',
              backgroundColor: disabledRadar ? 'rgba(0,0,0,0.6)' : '#fff',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Radar size={16} color={disabledRadar ? 'rgba(255,255,255,0.5)' : '#000'} />
            <T size={12.5} w={700} ls={0.4} color={disabledRadar ? 'rgba(255,255,255,0.5)' : '#000'}>
              {radarArming
                ? `RADAR ARMS IN ${formatTime(armsAt - now)}`
                : emergency
                  ? `EMERGENCY PING (${packPings(store)} LEFT • FREE)`
                  : radarLeft <= 0
                    ? `RADAR LOCKED (0/${allowance})`
                    : `RADAR PING (${radarLeft}/${allowance} LEFT • ${freePing ? 'FREE' : `${XP.radarPing} XP`})`}
            </T>
          </TouchableOpacity>
        )}

        {hiding && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              disabled={intel.decoy !== 'ready'}
              testID="decoy"
              onPress={() => {
                buzz(30);
                intent({ type: 'decoy' });
              }}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: intel.decoy === 'ready' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(0,0,0,0.6)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingHorizontal: 12,
              }}
            >
              <Crosshair size={14} color={intel.decoy === 'ready' ? '#fff' : 'rgba(255,255,255,0.5)'} />
              <T size={11.5} w={700} ls={0.4} numberOfLines={1} color={intel.decoy === 'ready' ? '#fff' : 'rgba(255,255,255,0.5)'}>
                {intel.decoy === 'ready' ? 'DECOY PING (1 LEFT)' : intel.decoy === 'armed' ? 'DECOY ARMED · NEXT RADAR' : 'DECOY USED'}
              </T>
            </TouchableOpacity>
            {intel.ghost && (
              <View style={{ height: 40, borderRadius: 999, backgroundColor: '#fff', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }} testID="ghost">
                <Ghost size={14} color="#000" />
                <T size={11.5} w={700} color="#000">
                  GHOST
                </T>
              </View>
            )}
          </View>
        )}

        {hb ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8 }} testID="heartbeat" accessibilityLabel={`heartbeat ${hb}`}>
            <Beat period={BEAT_MS[hb]}>
              <HeartPulse size={20} color="#000" />
            </Beat>
            <View style={{ flex: 1 }}>
              <T size={11.5} w={700} ls={0.4} color="#000">
                HUNTER WITHIN {hb} m
              </T>
              <Ecg period={BEAT_MS[hb]} />
            </View>
          </View>
        ) : null}

        {children}

        {banners.map((b) => (
          <View
            key={b.id}
            testID={`banner-${b.kind}`}
            style={
              b.kind === 'radar'
                ? { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' }
                : { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <b.Icon size={16} color={b.kind === 'radar' ? '#000' : '#fff'} style={{ marginTop: 1 }} />
              <T size={12.5} w={600} lh={1.35} color={b.kind === 'radar' ? '#000' : '#fff'} style={{ flex: 1 }}>
                {b.text}
              </T>
            </View>
            {b.drain > 0 && <Drain ms={b.drain} id={b.id} dark={b.kind === 'radar'} />}
          </View>
        ))}
      </View>

      {zone.sim && !mapOpen && <SimPad onStep={step} z={out ? 86 : 30} />}

      {/* Out of bounds */}
      {out && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 85, elevation: 85 }]} accessibilityRole="alert" testID={`zone-oob-${revealed ? 'revealed' : 'countdown'}`}>
          {revealed ? <Strobe style={StyleSheet.absoluteFill} /> : <OobPulse style={StyleSheet.absoluteFill} />}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <View style={{ width: '100%', maxWidth: 380, borderRadius: 28, borderWidth: 2, borderColor: '#fff', backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 28, alignItems: 'center' }}>
              <TriangleAlert size={30} color="#fff" />
              <T size={22} w={700} lh={1.15} color="#fff" center style={{ marginTop: 12 }}>
                OUT OF PLAYZONE! RETURN IN 10s OR POSITION REVEALED!
              </T>
              {revealed ? (
                <View style={{ marginTop: 16, alignSelf: 'stretch', borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12 }}>
                  <T size={18} w={700} color="#000" center>
                    POSITION REVEALED · {XP.zoneOut} XP
                  </T>
                  <T size={13} lh={1.35} color="#000" center style={{ marginTop: 4 }}>
                    Your live GPS pin is on the {r.hunt ? 'hunter’s' : 'squad’s'} map until you’re back inside.
                  </T>
                </View>
              ) : (
                <T size={96} w={700} color="#fff" tnum testID="oob-countdown" style={{ marginTop: 8 }}>
                  {secsLeft}
                </T>
              )}
              <View style={{ marginTop: 20 }}>
                <Compass target={backBearing} heading={heading} />
              </View>
              <T size={17} w={700} color="#fff" style={{ marginTop: 16 }}>
                {backDist == null ? 'Finding you…' : `${formatDistance(backDist)} back to the zone`}
              </T>
              <T size={13} color="rgba(255,255,255,0.6)" center style={{ marginTop: 4 }}>
                Head {cardinal(backBearing)}
                {heading == null ? ' · arrow points from north (no compass)' : ''}
              </T>
              <TouchableOpacity
                onPress={() => setMapOpen(true)}
                style={{ marginTop: 20, height: 44, alignSelf: 'stretch', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}
              >
                <T size={14} w={600} color="#fff">
                  Open map
                </T>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Tactical map */}
      {mapOpen && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: out ? 90 : 70, elevation: out ? 90 : 70 }]} testID="tactical-map-sheet">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, paddingTop: Math.max(14, insets.top) }}>
            <View style={{ flex: 1 }}>
              <T size={15} w={700} ls={0.4} color="#fff">
                TACTICAL MAP
              </T>
              <T size={12} color="rgba(255,255,255,0.6)" numberOfLines={1}>
                {status}
              </T>
            </View>
            <TouchableOpacity accessibilityLabel="Close map" testID="close-map" onPress={() => setMapOpen(false)} style={[chip, { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }]}>
              <X size={17} color="#fff" />
            </TouchableOpacity>
          </View>
          {scan && (
            <View style={{ marginHorizontal: 16, marginBottom: 8, borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10 }} testID="scan" accessibilityLabel={`scan ${scan.blips.length}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Radar size={15} color="#000" />
                <T size={12.5} w={700} ls={0.4} color="#000">
                  {scan.kind === 'signal' ? 'SIGNAL INTERCEPTED' : `RADAR SWEEP · ${scan.blips.length} SIGNAL${scan.blips.length === 1 ? '' : 'S'}`}
                </T>
              </View>
              <Drain ms={Math.max(0, scan.until - now)} id={scan.id} dark />
            </View>
          )}
          {!scan && lostSignal && (
            <View style={{ marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 10 }}>
              <T size={12.5} w={600} color="#fff">
                SIGNAL LOST — PINS HIDDEN
              </T>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <TacticalMap center={zone.center} radius={radius} fitRadius={zone.radius} rings={rings} me={fix && { lat: fix.lat, lng: fix.lng, heading }} pins={pins} />
            {zone.sim && <SimPad onStep={step} z={1000} />}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 4, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 + insets.bottom }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000' }} />
              <T size={11.5} color="rgba(255,255,255,0.7)">
                You
              </T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Zap size={12} color="rgba(255,255,255,0.7)" />
              <T size={11.5} color="rgba(255,255,255,0.7)">
                Supply drop
              </T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#fff' }} />
              <T size={11.5} color="rgba(255,255,255,0.7)">
                Out of zone (live)
              </T>
            </View>
            {hunter && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#fff' }} />
                <T size={11.5} color="rgba(255,255,255,0.7)">
                  Radar blip
                </T>
              </View>
            )}
          </View>
        </View>
      )}
    </>
  );
}
