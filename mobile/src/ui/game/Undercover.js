import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, Lock } from 'lucide-react-native';
import { castNames, fillText, missionById } from '../../core';
import { buzz } from '../../lib/sound';
import { useTheme } from '../../theme';
import { Avatar, Button, Card, Divided, Eyebrow, LiveDot, RichText, T, Title } from '../primitives';
import Camera from './Camera';
import { BottomBar, GameShell, nameOf } from './shared';

export function UndercoverPlay({ view, serverNow, intent, onLeave, hud }) {
  const m = missionById(view.round.data.missionId);
  const names = castNames(view);
  const secret = view.mine?.saboteur ? view.mine : null;
  const [open, setOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(true);
  const isHost = view.hostId === view.me;

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={secret ? 'Undercover · stay hidden' : 'Crew · spot the saboteur'} onLeave={onLeave}>
      <Camera hud={hud} record micDefault enforce>
        <BottomBar>
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setBriefOpen((v) => !v)}
              activeOpacity={0.8}
              style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 16, paddingVertical: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T size={12.5} color="rgba(255,255,255,0.6)" style={{ flex: 1 }}>
                  {fillText(m.title, names, view.packName)}
                </T>
                <ChevronDown size={15} color="rgba(255,255,255,0.6)" style={{ transform: [{ rotate: briefOpen ? '180deg' : '0deg' }] }} />
              </View>
              {briefOpen && <RichText text={m.prompt} names={names} pack={view.packName} size={14.5} w={400} style={{ marginTop: 4, color: '#fff' }} />}
            </TouchableOpacity>
            {secret ? (
              <View style={{ borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12 }} testID="covert-tasks">
                <TouchableOpacity onPress={() => setOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Lock size={14} color="#000" />
                    <T size={14} w={600} color="#000">
                      Your covert tasks · {secret.done.length}/3
                    </T>
                  </View>
                  <T size={12.5} color="rgba(0,0,0,0.5)">
                    {open ? 'Hide' : 'Peek'}
                  </T>
                </TouchableOpacity>
                {open && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {secret.tasks.map((task, i) => {
                      const done = secret.done.includes(i);
                      return (
                        <TouchableOpacity
                          key={task}
                          disabled={done}
                          onPress={() => {
                            buzz(15);
                            intent({ type: 'task', i });
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#000', backgroundColor: done ? '#000' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                            {done && <Check size={12} strokeWidth={3} color="#fff" />}
                          </View>
                          <T size={14} color="#000" style={[{ flex: 1 }, done ? { textDecorationLine: 'line-through', opacity: 0.5 } : null]}>
                            {task}
                          </T>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 16, paddingVertical: 12 }}>
                <Lock size={14} color="rgba(255,255,255,0.8)" />
                <T size={13.5} color="rgba(255,255,255,0.8)" style={{ flex: 1 }}>
                  One player is secretly sabotaging this video. Trust no one.
                </T>
              </View>
            )}
            {isHost && (
              <TouchableOpacity style={{ height: 40, alignItems: 'center', justifyContent: 'center' }} onPress={() => intent({ type: 'end' })}>
                <T size={13.5} w={500} color="rgba(255,255,255,0.7)">
                  End early & vote
                </T>
              </TouchableOpacity>
            )}
          </View>
        </BottomBar>
      </Camera>
    </GameShell>
  );
}

export function UndercoverVote({ view, intent }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const r = view.round;
  const myVote = r.data.votes[view.me];
  const voted = Object.keys(r.data.votes).length;
  const isHost = view.hostId === view.me;
  return (
    <View style={{ flex: 1 }} testID="undercover-vote">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160 }}>
        <View style={{ paddingTop: 24 }}>
          <Eyebrow>Time’s up</Eyebrow>
          <Title style={{ marginTop: 8 }}>Who was undercover?</Title>
          <T muted size={15} style={{ marginTop: 8 }}>
            {voted} of {r.participants.length} voted. Majority accusation catches them.
          </T>
        </View>
        <Card style={{ marginTop: 24 }}>
          <Divided>
            {r.participants
              .filter((id) => id !== view.me)
              .map((id) => (
                <TouchableOpacity
                  key={id}
                  activeOpacity={0.7}
                  accessibilityLabel={`Accuse ${nameOf(view, id)}`}
                  onPress={() => {
                    buzz(20);
                    intent({ type: 'accuse', id });
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: myVote === id ? t.c.fg : 'transparent' }}
                >
                  <Avatar name={nameOf(view, id)} size={38} inverted={myVote !== id} />
                  <T size={16} w={600} color={myVote === id ? t.c.bg : t.c.fg} style={{ flex: 1 }}>
                    {nameOf(view, id)}
                  </T>
                  {myVote === id && (
                    <T size={13} w={500} color={t.c.bg}>
                      Your vote
                    </T>
                  )}
                </TouchableOpacity>
              ))}
          </Divided>
        </Card>
      </ScrollView>
      <LinearGradient colors={['transparent', t.c.bg, t.c.bg]} locations={[0, 0.35, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 40, paddingHorizontal: 24, paddingBottom: 16 + insets.bottom }}>
        {isHost ? (
          <Button title="Reveal the saboteur" onPress={() => intent({ type: 'finishReview' })} testID="finish-review" />
        ) : (
          <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <LiveDot />
            <T muted size={15}>
              Reveals when everyone has voted
            </T>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
