import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { FREEZE_GRACE, GAMES } from '../../core';
import { motionLive, requestMotion, subscribeMotion, useMotionMode } from '../../lib/motion';
import { buzz, Synth } from '../../lib/sound';
import { Button, T } from '../primitives';
import { useNow } from '../helpers';
import Camera from './Camera';
import { BottomBar, GameShell, TopCard, confirm, nameOf } from './shared';

export function RedLightWatcher({ view, serverNow, intent, onLeave }) {
  useNow(250);
  const d = view.round.data;
  const red = d.light === 'red';
  const locked = serverNow() - d.changedAt < 1500;
  const runners = view.round.participants.filter((id) => view.round.roles[id] === 'runner');
  const fg = red ? '#fff' : '#000';
  const dim = red ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={GAMES.red_light.roles.watcher.label} onLeave={onLeave} light={!red}>
      <TouchableOpacity
        disabled={locked}
        testID="toggle-light"
        activeOpacity={0.9}
        onPress={() => {
          buzz(red ? 30 : [80, 40, 80]);
          intent({ type: 'light' });
        }}
        style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: red ? '#000' : '#fff' }]}
      >
        <T size={15} w={500} color={dim}>
          {red ? 'Red light' : 'Green light'}
        </T>
        <T size={64} w={700} ls={-3} color={fg} style={{ marginTop: 12 }}>
          {red ? 'FREEZE!' : 'GO'}
        </T>
        <T size={16} color={dim} style={{ marginTop: 24 }}>
          {locked ? '…' : red ? 'Tap for green light' : 'Tap to call FREEZE'}
        </T>
      </TouchableOpacity>
      <BottomBar>
        <View style={{ borderRadius: 20, borderWidth: 1, borderColor: red ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', backgroundColor: red ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 16, paddingVertical: 12 }}>
          <T size={12.5} w={500} color={dim}>
            Runners
          </T>
          <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 }}>
            {runners.map((id) => (
              <T key={id} size={15} w={600} color={fg} style={d.out[id] ? { textDecorationLine: 'line-through', opacity: 0.4 } : null}>
                {nameOf(view, id)}
                {d.out[id] ? ' · out' : ''}
              </T>
            ))}
          </View>
        </View>
      </BottomBar>
    </GameShell>
  );
}

// Motion detection from the shared sensor feed; without live readings (denied or not yet
// granted) the hold-still button referees instead.
export function useMotion(onMove) {
  const mode = useMotionMode();
  const [live, setLive] = useState(() => motionLive());
  const cb = useRef(onMove);
  cb.current = onMove;
  useEffect(() => {
    if (mode !== 'sensor') return undefined;
    let last = null;
    const off = subscribeMotion((m, { accel, rot }) => {
      let moved = accel > 1.6 || rot > 70;
      const g = m.accelerationIncludingGravity;
      if (m.acceleration?.x == null && g?.x != null) {
        if (last) moved = moved || Math.hypot(g.x - last.x, g.y - last.y, g.z - last.z) > 2.2;
        last = { x: g.x, y: g.y, z: g.z };
      }
      if (moved) cb.current();
    });
    const timer = setInterval(() => setLive(motionLive()), 1000);
    return () => {
      off();
      clearInterval(timer);
    };
  }, [mode]);
  return { mode: mode === 'ask' ? 'ask' : mode === 'sensor' && live ? 'sensor' : 'touch', ask: requestMotion };
}

function Strobe() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 75);
    return () => clearInterval(id);
  }, []);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 30, backgroundColor: '#fff', opacity: on ? 0.9 : 0 }]} />;
}

export function RedLightRunner({ view, serverNow, intent, onLeave, hud }) {
  useNow(150);
  const d = view.round.data;
  const me = view.me;
  const out = !!d.out[me];
  const red = d.light === 'red';
  const now = serverNow();
  const armed = red && now - d.changedAt >= FREEZE_GRACE && !out;
  const [holding, setHolding] = useState(false);
  const [alarm, setAlarm] = useState(false);
  const flips = useRef(d.flips);
  const report = () => armed && intent({ type: 'moved' });
  const motion = useMotion(report);
  // Until the motion sensor is actually running, the hold-still button is the referee.
  const touch = motion.mode !== 'sensor';

  // Siren + flash the moment the watcher calls freeze.
  useEffect(() => {
    if (d.flips === flips.current) return undefined;
    flips.current = d.flips;
    if (d.light !== 'red' || out) return undefined;
    Synth.siren();
    buzz([200, 60, 200]);
    setAlarm(true);
    const timer = setTimeout(() => setAlarm(false), 900);
    return () => clearTimeout(timer);
  }, [d.flips, d.light, out]);

  // Touch fallback: releasing the hold during red counts as moving.
  useEffect(() => {
    if (touch && armed && !holding) intent({ type: 'moved' });
  }, [touch, armed, holding, intent]);

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={out ? 'Out · keep filming' : 'Runner · reach the watcher'} onLeave={onLeave}>
      <Camera hud={hud} record enforce>
        {alarm && <Strobe />}
        <TopCard>
          <View
            pointerEvents="none"
            style={[
              { borderRadius: 18, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' },
              out ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.7)' } : red ? { backgroundColor: '#fff' } : { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.6)' },
            ]}
            testID="light-state"
          >
            <T size={30} w={700} ls={-1} color={!out && red ? '#000' : '#fff'}>
              {out ? 'YOU MOVED · OUT' : red ? 'FREEZE' : 'GREEN · MOVE'}
            </T>
            {!out && red && (
              <T size={13} color="rgba(0,0,0,0.6)">
                {touch ? 'Keep holding the button' : 'Your phone is watching for motion'}
              </T>
            )}
          </View>
        </TopCard>
        <BottomBar>
          {motion.mode === 'ask' && !out && <Button variant="secondary" title="Enable motion sensor" onPress={motion.ask} style={{ marginBottom: 12 }} />}
          {touch && !out && (
            <Pressable
              onPressIn={() => setHolding(true)}
              onPressOut={() => setHolding(false)}
              testID="hold-still"
              style={{ marginBottom: 12, minHeight: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: holding ? '#fff' : '#141414', borderWidth: holding ? 0 : 1, borderColor: '#262626' }}
            >
              <T size={16} w={600} color={holding ? '#000' : '#fff'}>
                {holding ? 'Holding still…' : 'Hold here while frozen'}
              </T>
            </Pressable>
          )}
          {!out && <Button title="I tagged the watcher" bg="#fff" color="#000" onPress={() => confirm('Tagged the watcher?', 'Only if you really touched them.', () => intent({ type: 'tagged' }), 'Yes')} testID="tagged-watcher" />}
        </BottomBar>
      </Camera>
    </GameShell>
  );
}
