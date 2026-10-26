import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { MAX_SHOTS, XP } from '../../core';
import { buzz, Synth } from '../../lib/sound';
import { useTheme } from '../../theme';
import { Button, Card, Eyebrow, LiveDot, T, Title } from '../primitives';
import Camera from './Camera';
import Photo from './Photo';
import { BottomBar, FlashLayer, GameShell, TopCard, nameOf, userOf } from './shared';

export function PaparazziSniper({ view, serverNow, intent, onLeave, hud, media }) {
  const cam = useRef(null);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const target = view.mine?.target;
  const mine = view.round.data.shots.filter((s) => s.by === view.me);
  const left = MAX_SHOTS - mine.length;
  const last = mine[mine.length - 1];

  const shoot = async () => {
    if (!cam.current || left <= 0 || busy) return;
    setBusy(true);
    Synth.shutter();
    buzz(40);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    const img = await cam.current.snapshot();
    setBusy(false);
    intent({ type: 'shot', id: Math.random().toString(36).slice(2, 12), ...(img ? { img } : {}) });
  };

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel="Sniper · keep your target secret" onLeave={onLeave}>
      <Camera ref={cam} hud={hud}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: 224, height: 224 }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 112, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' }} />
            <View style={{ position: 'absolute', left: 111.5, top: 0, height: 224, width: 1, backgroundColor: 'rgba(255,255,255,0.5)' }} />
            <View style={{ position: 'absolute', top: 111.5, left: 0, width: 224, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' }} />
            <View style={{ position: 'absolute', left: 106, top: 106, width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: '#fff' }} />
          </View>
        </View>
        <TopCard>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 12 }}>
            <T size={12} w={500} color="rgba(255,255,255,0.6)">
              Target
            </T>
            <T size={20} w={700} color="#fff" testID="target">
              {target ? `@${userOf(view, target)}` : '—'}
            </T>
            <T size={13} color="rgba(255,255,255,0.7)">
              {target ? nameOf(view, target) : ''}
            </T>
          </View>
        </TopCard>
        <FlashLayer on={flash} />
        <BottomBar>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ width: 48, height: 64, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
              {last && media[last.id] ? <Photo uri={media[last.id]} accessibilityLabel="Last shot" /> : null}
            </View>
            <TouchableOpacity
              accessibilityLabel="Take shot"
              testID="take-shot"
              disabled={left <= 0 || busy}
              onPress={shoot}
              activeOpacity={0.7}
              style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: left <= 0 ? 0.3 : 1 }}
            >
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', transform: [{ scale: busy ? 0.9 : 1 }] }} />
            </TouchableOpacity>
            <View style={{ width: 48, alignItems: 'center' }}>
              <T size={13} w={600} color="#fff">
                {left}
              </T>
              <T size={11} color="rgba(255,255,255,0.6)">
                left
              </T>
            </View>
          </View>
          <T size={12.5} color="rgba(255,255,255,0.6)" center style={{ marginTop: 12 }}>
            Only counts if they’re not looking at your lens. The squad votes after.
          </T>
        </BottomBar>
      </Camera>
    </GameShell>
  );
}

export function PaparazziReview({ view, intent, media }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const d = view.round.data;
  const isHost = view.hostId === view.me;
  return (
    <View style={{ flex: 1 }} testID="paparazzi-review">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160 }}>
        <View style={{ paddingTop: 24 }}>
          <Eyebrow>Paparazzi review</Eyebrow>
          <Title style={{ marginTop: 8 }}>Clean hit or spotted?</Title>
          <T muted size={15} style={{ marginTop: 8 }}>
            Valid shots earn +{XP.validShot} XP. Vote on every shot that isn’t yours.
          </T>
        </View>
        {d.shots.length === 0 && (
          <Card style={{ marginTop: 24 }} inner={{ padding: 24 }}>
            <T size={15} center>
              No shots were taken this round.
            </T>
          </Card>
        )}
        <View style={{ marginTop: 24, gap: 16 }}>
          {d.shots.map((shot) => {
            const votes = d.votes[shot.id] || {};
            const myVote = votes[view.me];
            const yes = Object.values(votes).filter(Boolean).length;
            const no = Object.values(votes).length - yes;
            const own = shot.by === view.me;
            return (
              <Card key={shot.id}>
                <View style={{ aspectRatio: 9 / 16, maxHeight: 420, width: '100%', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                  {view.players.find((p) => p.id === shot.by)?.blocked ? (
                    <T muted size={14}>
                      Photo hidden — you blocked this player
                    </T>
                  ) : media[shot.id] ? (
                    <Photo uri={media[shot.id]} accessibilityLabel={`Shot of ${nameOf(view, shot.target)}`} />
                  ) : (
                    <T muted size={14}>
                      {shot.noPhoto ? 'No photo' : 'Loading photo…'}
                    </T>
                  )}
                </View>
                <View style={{ padding: 16 }}>
                  <T size={15} w={600}>
                    {nameOf(view, shot.by)} → {nameOf(view, shot.target)}
                  </T>
                  <T muted size={13} style={{ marginTop: 2 }}>
                    {yes} clean · {no} spotted
                  </T>
                  {own ? (
                    <T muted size={13.5} style={{ marginTop: 12 }}>
                      Your shot — the squad decides.
                    </T>
                  ) : (
                    <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Button small icon={Check} title="Clean hit" variant={myVote === true ? 'primary' : 'secondary'} onPress={() => intent({ type: 'voteShot', id: shot.id, valid: true })} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button small icon={X} title="Spotted" variant={myVote === false ? 'primary' : 'secondary'} onPress={() => intent({ type: 'voteShot', id: shot.id, valid: false })} />
                      </View>
                    </View>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
      <LinearGradient colors={['transparent', t.c.bg, t.c.bg]} locations={[0, 0.35, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 40, paddingHorizontal: 24, paddingBottom: 16 + insets.bottom }}>
        {isHost ? (
          <Button title="Lock votes & reveal" onPress={() => intent({ type: 'finishReview' })} testID="finish-review" />
        ) : (
          <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <LiveDot />
            <T muted size={15}>
              The host locks the votes
            </T>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
