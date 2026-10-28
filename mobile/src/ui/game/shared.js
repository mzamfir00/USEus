import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { CircleHelp, Siren, X } from 'lucide-react-native';
import { GAMES } from '../../core';
import { buzz, Synth } from '../../lib/sound';
import { PlayerActions } from '../Moderation';
import { Avatar, Button, Card, Divided, Eyebrow, Sheet, T } from '../primitives';
import { formatTime, useLater, useNow } from '../helpers';
import { RulesSections } from './Briefing';
import { VIOLATION_TEXT } from './Camera';
import { IntentContext, PenaltyContext, ZoneOffsetContext, ZoneStrobeContext, useGameTop } from './context';
import ZoneLayer from './zone/ZoneLayer';

export { IntentContext, ZoneStrobeContext } from './context';

export const nameOf = (view, id) => view.players.find((p) => p.id === id)?.name || 'Someone';
export const userOf = (view, id) => view.players.find((p) => p.id === id)?.username || '';

export const confirm = (title, message, onYes, yes = 'Leave') => {
  // Expo's web target (dev previews) has no native alert.
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
};

// Full-screen strobe alarm (Snitch Protocol): 250 ms white / 250 ms black.
function SnitchOverlay({ reason, onResume, cameraOff }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 80, elevation: 80, backgroundColor: on ? '#fff' : '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]} accessibilityRole="alert" testID="snitch-alarm">
      <View style={{ width: '100%', maxWidth: 380, borderRadius: 28, borderWidth: 1, borderColor: '#fff', backgroundColor: '#000', padding: 24, alignItems: 'center' }}>
        <Siren size={36} color="#fff" />
        <T size={13} w={600} upper ls={2.3} color="rgba(255,255,255,0.6)" style={{ marginTop: 12 }}>
          Snitch Protocol
        </T>
        <T size={28} w={700} ls={-0.8} color="#fff" center style={{ marginTop: 8 }}>
          {VIOLATION_TEXT[reason] || 'Not filming'}
        </T>
        <T size={14.5} lh={1.35} color="rgba(255,255,255,0.7)" center style={{ marginTop: 12 }}>
          {reason === 'blocked'
            ? 'Your phone is screaming and flashing. Take it out and point it at the action to stop it.'
            : reason === 'peek'
              ? 'You skipped the peek check. Pan your camera out of your hiding spot to stop the alarm.'
              : 'Your phone is screaming, flashing and telling the room. It stops when you’re filming again.'}
        </T>
        {onResume ? <Button title="Resume filming" onPress={onResume} style={{ marginTop: 24, alignSelf: 'stretch' }} bg="#fff" color="#000" testID="resume-filming" /> : null}
        {cameraOff ? (
          <Button variant="ghost" title="Camera blocked? Open Settings" color="#fff" onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: 8, alignSelf: 'stretch' }} />
        ) : null}
      </View>
    </View>
  );
}

// Fullscreen game frame: leave button, game + role, synced round clock. `hud={false}` hides
// the top bar (Mafia nights: pitch-black screens).
export function GameShell({ view, serverNow, roleLabel, onLeave, children, light = false, hud = true }) {
  useNow(500);
  useKeepAwake(); // screen stays on for the whole round
  const insets = useSafeAreaInsets();
  const intent = useContext(IntentContext);
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false); // "?" drawer: re-read your briefing without stopping the camera
  const [actions, setActions] = useState(null); // block / report / remove sheet for one player
  const [zoneStrobe, setZoneStrobe] = useState(false);
  const [zoneRows, setZoneRows] = useState(0); // bottom edge of the GPS Playzone HUD, px from the top
  const [penalty, setPenalty] = useState(null);
  const isHost = view.hostId === view.me;
  const r = view.round;
  const left = Math.max(0, r.endsAt - serverNow());
  // Room-wide Snitch Protocol alerts (your own alarm is shown by your camera).
  const alarms = Object.keys(r.violations || {}).filter((id) => id !== view.me);
  const seen = useRef(new Set());
  useEffect(() => {
    const fresh = alarms.filter((id) => !seen.current.has(id));
    if (fresh.length) {
      Synth.alert();
      buzz([80, 40, 80]);
    }
    seen.current = new Set(alarms);
  }, [alarms.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // An alarm closes any open sheet so it can be seen.
  useEffect(() => {
    if (penalty) {
      setMenu(false);
      setRules(false);
      setActions(null);
    }
  }, [penalty]);

  const setPenaltyStable = useCallback((p) => setPenalty(p), []);
  const fg = light ? '#000' : '#fff';
  const chip = light
    ? { backgroundColor: 'rgba(0,0,0,0.1)', borderColor: 'rgba(0,0,0,0.15)' }
    : { backgroundColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.15)' };
  const zoneOffset = r.zone ? { h: Math.max(0, zoneRows + 8 - 150), top: Math.max(0, zoneRows + 8 - 84) } : { h: 0, top: 0 };
  const top = Math.max(14, insets.top);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: light ? '#fff' : '#000' }]} testID="game-shell">
      <ZoneOffsetContext.Provider value={zoneOffset}>
        <PenaltyContext.Provider value={setPenaltyStable}>
          <ZoneStrobeContext.Provider value={zoneStrobe}>
            <View style={StyleSheet.absoluteFill}>{children}</View>
          </ZoneStrobeContext.Provider>
        </PenaltyContext.Provider>

        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: top, display: hud ? 'flex' : 'none' }}>
          <TouchableOpacity
            accessibilityLabel={isHost ? 'Round menu' : 'Room menu'}
            testID="round-menu"
            onPress={() => setMenu(true)}
            style={[chip, { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }]}
          >
            <X size={17} color={fg} />
          </TouchableOpacity>
          <View pointerEvents="none" style={[chip, { flex: 1, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7 }]}>
            <T size={13} w={600} color={fg} numberOfLines={1}>
              {GAMES[r.game]?.name}
            </T>
            <T size={11.5} color={light ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'} numberOfLines={1} testID="role-label">
              {roleLabel}
            </T>
          </View>
          <TouchableOpacity accessibilityLabel="Rules" testID="rules" onPress={() => setRules(true)} style={[chip, { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }]}>
            <CircleHelp size={18} color={fg} />
          </TouchableOpacity>
          {!GAMES[r.game]?.untimed && (
            <View pointerEvents="none" style={[chip, { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 }]}>
              <T size={14} w={600} tnum color={fg} testID="round-clock">
                {formatTime(left)}
              </T>
            </View>
          )}
        </View>

        {r.zone && r.roles[view.me] ? (
          <ZoneLayer view={view} serverNow={serverNow} intent={intent} onStrobe={setZoneStrobe} onRows={setZoneRows}>
            {alarms.map((id) => (
              <AlarmBanner key={id} view={view} id={id} />
            ))}
          </ZoneLayer>
        ) : (
          alarms.length > 0 && (
            <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: Math.max(66, insets.top + 54), zIndex: 25, gap: 6 }}>
              {alarms.map((id) => (
                <AlarmBanner key={id} view={view} id={id} />
              ))}
            </View>
          )
        )}

        {penalty && <SnitchOverlay reason={penalty.reason} onResume={penalty.onResume} cameraOff={penalty.cameraOff} />}
      </ZoneOffsetContext.Provider>

      {rules && (
        <Sheet title="How to play" onClose={() => setRules(false)} testID="rules-drawer">
          <View style={{ marginTop: -20 }}>
            <RulesSections view={view} setupFirst={false} />
          </View>
          <Button title="Back to the game" onPress={() => setRules(false)} style={{ marginTop: 24 }} />
        </Sheet>
      )}
      {menu && (
        <Sheet title={isHost ? 'Host controls' : 'Room'} onClose={() => setMenu(false)} testID="room-menu">
          {isHost && (
            <Button
              title="End round now"
              testID="end-round"
              onPress={() => {
                setMenu(false);
                intent({ type: 'end' });
              }}
            />
          )}
          <Eyebrow style={{ marginBottom: 8, marginTop: 20 }}>Players · {isHost ? 'remove, block or report' : 'block or report'}</Eyebrow>
          <Card>
            <Divided>
              {view.players
                .filter((p) => p.id !== view.me)
                .map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setActions(p)}
                    accessibilityLabel={`Player options for ${p.name}`}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}
                  >
                    <Avatar name={p.name} size={32} />
                    <T size={15} w={600} numberOfLines={1} style={{ flex: 1 }}>
                      {p.name}
                    </T>
                    <T muted size={12.5}>
                      {p.blocked ? 'Blocked' : `@${p.username}`}
                    </T>
                  </TouchableOpacity>
                ))}
            </Divided>
          </Card>
          <Button
            variant="secondary"
            title="Leave room"
            style={{ marginTop: 20 }}
            onPress={() => confirm(isHost ? 'Close the room?' : 'Leave this room?', isHost ? 'Leaving closes the room for everyone.' : 'You can rejoin with the room code.', onLeave)}
          />
          {actions && (
            <PlayerActions
              player={actions}
              reporter={view.players.find((p) => p.id === view.me)}
              room={view.code}
              onRemove={isHost && actions.id !== view.hostId ? (p) => intent({ type: 'remove', id: p.id }) : null}
              onClose={() => {
                setActions(null);
                setMenu(false);
              }}
            />
          )}
        </Sheet>
      )}
    </View>
  );
}

function AlarmBanner({ view, id }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10 }} testID="alarm-banner">
      <Siren size={16} color="#000" />
      <T size={12.5} w={600} lh={1.3} color="#000" style={{ flex: 1 }}>
        @{userOf(view, id)} STOPPED FILMING — ALARM & FLASH TRIGGERED
      </T>
    </View>
  );
}

// Whole-screen flash when an event lands (sonar, freeze, bomb pass).
export function useFlash() {
  const [on, setOn] = useState(false);
  const later = useLater();
  const trigger = (ms = 2000) => {
    setOn(true);
    later(() => setOn(false), ms);
  };
  return [on, trigger];
}

export function BottomBar({ children, style }) {
  const insets = useSafeAreaInsets();
  return <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, paddingHorizontal: 20, paddingBottom: 18 + insets.bottom, paddingTop: 24 }, style]}>{children}</View>;
}

// Positioned card below the HUD (web: top-[max(150px,…)+zone] inset-x-4 mr-14).
export function TopCard({ children, style, pad = false, testID }) {
  const top = useGameTop();
  return (
    <View testID={testID} style={[{ position: 'absolute', left: 16, right: pad ? 20 : 72, top: pad ? top.pad : top.banner, zIndex: 10 }, style]}>
      {children}
    </View>
  );
}

// Fires `fn` on this phone at the host's scheduled time whenever `count` goes up
// (sonar pulses, radar pings, Marco calls). Missed events from before mount are skipped.
export function useScheduled(count, at, serverNow, fn, lateMs = 1500) {
  const seenCount = useRef(count);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (count === seenCount.current || !at) return undefined;
    seenCount.current = count;
    const wait = at - serverNow();
    if (wait < -lateMs) return undefined;
    const timer = setTimeout(() => cb.current(), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [count, at, serverNow, lateMs]);
}

// Eyes-closed countdown before seekers / hunters may look.
export function BlindCountdown({ until, serverNow, title, sub }) {
  useNow(200);
  const left = Math.max(0, Math.ceil((until - serverNow()) / 1000));
  const last = useRef(left);
  useEffect(() => {
    if (left !== last.current && left <= 5 && left > 0) Synth.beep(left <= 2);
    if (left === 0 && last.current > 0) {
      Synth.lockIn();
      buzz([100, 50, 200]);
    }
    last.current = left;
  }, [left]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]} testID="blind-countdown">
      <T size={15} w={500} color="rgba(255,255,255,0.5)" center>
        {title}
      </T>
      <T size={120} w={700} ls={-6} color="#fff" tnum style={{ marginTop: 12, lineHeight: 130 }}>
        {left}
      </T>
      <T size={16} color="rgba(255,255,255,0.7)" center style={{ marginTop: 16, maxWidth: 300 }}>
        {sub}
      </T>
    </View>
  );
}

// Bottom sheet to pick a player (caught / found / tagged).
export function PickPlayer({ title, ids, view, onPick, onClose, note }) {
  return (
    <Sheet title={title} onClose={onClose} testID="pick-player">
      {ids.length ? (
        <Card>
          <Divided>
            {ids.map((id) => (
              <TouchableOpacity key={id} onPress={() => onPick(id)} activeOpacity={0.7} style={{ paddingHorizontal: 20, paddingVertical: 16 }} accessibilityLabel={`Pick ${nameOf(view, id)}`}>
                <T size={17} w={600}>
                  {nameOf(view, id)}
                </T>
              </TouchableOpacity>
            ))}
          </Divided>
        </Card>
      ) : (
        <T muted size={15} center style={{ paddingVertical: 24 }}>
          Nobody left.
        </T>
      )}
      {note ? (
        <T muted size={13} center style={{ marginTop: 16 }}>
          {note}
        </T>
      ) : null}
    </Sheet>
  );
}

// Full-screen white flash layer.
export function FlashLayer({ on, color = '#fff' }) {
  if (!on) return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, zIndex: 40 }]} />;
}


// Scale-and-fade entrance (.pop) for banners and cards that appear mid-game.
export function Pop({ children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>{children}</Animated.View>;
}
