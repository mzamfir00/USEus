import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bomb } from 'lucide-react-native';
import { DARE_MS } from '../../core';
import { buzz, haptic, Synth } from '../../lib/sound';
import { Card, Eyebrow, T } from '../primitives';
import { useNow } from '../helpers';
import { GameShell, nameOf } from './shared';

function Blink({ period }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), (period * 1000) / 2);
    return () => clearInterval(id);
  }, [period]);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: on ? 0.18 : 0 }]} />;
}

export default function HotPotato({ view, serverNow, intent, onLeave }) {
  useNow(100);
  const insets = useSafeAreaInsets();
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const holding = d.holder === me;
  const now = serverNow();
  const held = now - d.since;
  const dareLeft = Math.max(0, DARE_MS - held);
  const elapsed = Math.max(0, now - r.startsAt);
  const nextTick = useRef(0);

  // Accelerating tick on the holder's phone (tempo follows round time, not the hidden fuse).
  useEffect(() => {
    if (!holding) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      if (t < nextTick.current) return;
      const interval = Math.max(110, 820 - (Date.now() - r.startsAt) / 90);
      nextTick.current = t + interval;
      Synth.tick(1.2);
      haptic.tick();
    }, 40);
    return () => clearInterval(id);
  }, [holding, r.startsAt]);

  useEffect(() => {
    if (holding) {
      Synth.blip();
      buzz([80, 40, 80, 40, 160]);
    }
  }, [holding, d.passes]);

  const pulse = Math.max(0.12, 0.7 - elapsed / 120000);
  const others = r.participants.filter((id) => id !== me && view.players.find((p) => p.id === id)?.connected);

  if (!holding) {
    return (
      <GameShell view={view} serverNow={serverNow} roleLabel="Safe — for now" onLeave={onLeave}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <T size={15} w={500} color="rgba(255,255,255,0.5)">
            The bomb is with
          </T>
          <T size={48} w={700} ls={-2} color="#fff" center style={{ marginTop: 8 }} testID="bomb-holder">
            {nameOf(view, d.holder)}
          </T>
          <Card style={{ marginTop: 40, alignSelf: 'stretch' }} inner={{ padding: 20 }}>
            <Eyebrow>Their dare</Eyebrow>
            <T size={22} w={600} style={{ marginTop: 4 }}>
              {d.dare}
            </T>
          </Card>
          <T size={14} color="rgba(255,255,255,0.5)" style={{ marginTop: 24 }}>
            Film them. Be ready to catch the bomb.
          </T>
          <T size={13} color="rgba(255,255,255,0.35)" style={{ marginTop: 8 }}>
            {d.passes} pass{d.passes === 1 ? '' : 'es'} so far
          </T>
        </View>
      </GameShell>
    );
  }

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel="You’re holding the bomb" onLeave={onLeave}>
      <Blink period={pulse} />
      <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 20 + insets.bottom, paddingTop: Math.max(92, insets.top + 80) }}>
        <View style={{ alignItems: 'center' }}>
          <Bomb size={64} strokeWidth={1.6} color="#fff" />
          <T size={15} w={500} color="rgba(255,255,255,0.6)" style={{ marginTop: 12 }}>
            Do the dare, then pass it
          </T>
          <T size={34} w={700} ls={-1} lh={1.15} color="#fff" center style={{ marginTop: 8 }}>
            {d.dare}
          </T>
          <View style={{ marginTop: 20, height: 3, width: 192, backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <View style={{ height: 3, backgroundColor: '#fff', width: `${(1 - dareLeft / DARE_MS) * 100}%` }} />
          </View>
          <T size={13} tnum color="rgba(255,255,255,0.6)" style={{ marginTop: 8 }}>
            {dareLeft > 0 ? `${Math.ceil(dareLeft / 1000)}s` : 'Pass it now'}
          </T>
        </View>
        <View style={{ marginTop: 'auto' }}>
          <Eyebrow color="rgba(255,255,255,0.6)" style={{ marginBottom: 8, paddingHorizontal: 4 }}>
            Throw it to
          </Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {others.map((id) => (
              <TouchableOpacity
                key={id}
                disabled={dareLeft > 0}
                accessibilityLabel={`Pass to ${nameOf(view, id)}`}
                onPress={() => {
                  buzz(30);
                  intent({ type: 'pass', to: id });
                }}
                style={{ width: '48.5%', minHeight: 60, borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: dareLeft > 0 ? 0.25 : 1 }}
              >
                <T size={17} w={600} color="#000">
                  {nameOf(view, id).split(' ')[0]}
                </T>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </GameShell>
  );
}
