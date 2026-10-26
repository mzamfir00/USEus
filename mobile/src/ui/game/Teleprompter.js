import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Film, Megaphone } from 'lucide-react-native';
import { DIRECTIONS, GAMES, INJECT_COOLDOWN } from '../../core';
import { buzz, Synth } from '../../lib/sound';
import { Button, Card, Divided, Eyebrow, Sheet, T } from '../primitives';
import { useNow } from '../helpers';
import Camera from './Camera';
import { BottomBar, GameShell, Pop, TopCard, nameOf } from './shared';

const LINE_MS = 4800;

// Script position is time-based so the actor and director stay in sync.
export function useScript(view, serverNow) {
  const r = view.round;
  const lines = r.data.script;
  const elapsed = Math.max(0, serverNow() - r.startsAt);
  const index = Math.min(lines.length, Math.floor(elapsed / LINE_MS));
  return { lines, index, progress: (elapsed % LINE_MS) / LINE_MS };
}

// Latest injected direction, shown for 5 seconds with a blip.
function useLatestInject(view, serverNow) {
  const injects = view.round.data.injects;
  const latest = injects[injects.length - 1];
  const seen = useRef(injects.length);
  useEffect(() => {
    if (injects.length > seen.current) {
      Synth.blip();
      buzz([50, 30, 50]);
    }
    seen.current = injects.length;
  }, [injects.length]);
  return latest && serverNow() - latest.at < 5000 ? latest : null;
}

export function TeleprompterActor({ view, serverNow, onLeave }) {
  useNow(200);
  const { lines, index, progress } = useScript(view, serverNow);
  const inject = useLatestInject(view, serverNow);
  const done = index >= lines.length;
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Actor · selling ${view.round.data.product}`} onLeave={onLeave}>
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', paddingHorizontal: 28 }]} testID="teleprompter">
        {inject && (
          <TopCard pad style={{ left: 20 }}>
            <Pop style={{ borderRadius: 20, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16 }}>
              <T size={12.5} w={500} color="rgba(0,0,0,0.5)">
                Stage direction from {nameOf(view, inject.by)}
              </T>
              <T size={24} w={700} ls={-0.5} lh={1.15} color="#000" style={{ marginTop: 4 }}>
                {inject.text}
              </T>
            </Pop>
          </TopCard>
        )}
        {done ? (
          <View style={{ alignItems: 'center' }}>
            <T size={44} w={700} ls={-1.3} lh={1.15} color="#fff" center>
              Ad-lib the big finish.
            </T>
            <T size={16} color="rgba(255,255,255,0.6)" style={{ marginTop: 12 }}>
              The director calls cut.
            </T>
          </View>
        ) : (
          <>
            {index > 0 && (
              <T size={19} lh={1.35} color="rgba(255,255,255,0.25)" style={{ marginBottom: 24 }}>
                {lines[index - 1]}
              </T>
            )}
            <Pop key={index}>
              <T size={34} w={700} lh={1.15} ls={-0.7} color="#fff">
                {lines[index]}
              </T>
            </Pop>
            {lines[index + 1] ? (
              <T size={19} lh={1.35} color="rgba(255,255,255,0.4)" style={{ marginTop: 24 }}>
                {lines[index + 1]}
              </T>
            ) : null}
            <View style={{ marginTop: 40, height: 3, backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <View style={{ height: 3, backgroundColor: '#fff', width: `${progress * 100}%` }} />
            </View>
            <T size={12.5} color="rgba(255,255,255,0.5)" style={{ marginTop: 8 }}>
              Line {index + 1} of {lines.length}
            </T>
          </>
        )}
      </View>
    </GameShell>
  );
}

function InjectGrid({ view, serverNow, intent }) {
  const last = view.round.data.injectAt[view.me] || 0;
  const cooling = Math.max(0, INJECT_COOLDOWN - (serverNow() - last));
  return (
    <View>
      <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Eyebrow>Inject a stage direction</Eyebrow>
        {cooling > 0 && (
          <T muted size={13} tnum>
            {Math.ceil(cooling / 1000)}s
          </T>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DIRECTIONS.map((d, i) => (
          <Card
            key={d}
            style={{ width: '48.5%', opacity: cooling > 0 ? 0.4 : 1 }}
            inner={{ minHeight: 72, padding: 12 }}
            disabled={cooling > 0}
            accessibilityLabel={d}
            onPress={() => {
              buzz(20);
              intent({ type: 'inject', i });
            }}
          >
            <T size={14} w={600} lh={1.3}>
              {d}
            </T>
          </Card>
        ))}
      </View>
    </View>
  );
}

export function TeleprompterDirector({ view, serverNow, intent, onLeave, hud }) {
  useNow(250);
  const { lines, index } = useScript(view, serverNow);
  const inject = useLatestInject(view, serverNow);
  const [mirror, setMirror] = useState(true);
  const [sheet, setSheet] = useState(false);
  const canInject = view.round.participants.length <= 2;
  const actor = view.round.participants.find((id) => view.round.roles[id] === 'actor');
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Director · filming ${nameOf(view, actor)}`} onLeave={onLeave}>
      <Camera hud={hud} record micDefault enforce>
        {mirror && (
          <TopCard>
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 16, paddingVertical: 12 }}>
              <T size={12} color="rgba(255,255,255,0.55)">
                {inject ? 'Direction just sent' : `Teleprompter · line ${Math.min(index + 1, lines.length)}`}
              </T>
              <T size={16} w={600} lh={1.3} color="#fff" style={{ marginTop: 2 }}>
                {inject ? inject.text : lines[index] || 'Ad-lib the finish — then cut.'}
              </T>
            </View>
          </TopCard>
        )}
        <BottomBar>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="secondary" icon={Film} accessibilityLabel="Toggle script mirror" onPress={() => setMirror((m) => !m)} style={{ width: 56, paddingHorizontal: 0 }} />
            {canInject ? <Button variant="secondary" icon={Megaphone} accessibilityLabel="Inject direction" onPress={() => setSheet(true)} style={{ width: 56, paddingHorizontal: 0 }} /> : null}
            <View style={{ flex: 1 }}>
              <Button title="Cut · end take" bg="#fff" color="#000" onPress={() => intent({ type: 'end' })} testID="cut" />
            </View>
          </View>
        </BottomBar>
      </Camera>
      {sheet && (
        <Sheet title="Stage directions" onClose={() => setSheet(false)}>
          <InjectGrid view={view} serverNow={serverNow} intent={intent} />
        </Sheet>
      )}
    </GameShell>
  );
}

export function TeleprompterSaboteur({ view, serverNow, intent, onLeave }) {
  useNow(250);
  const insets = useSafeAreaInsets();
  const { lines, index } = useScript(view, serverNow);
  const recent = [...view.round.data.injects].reverse().slice(0, 3);
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={GAMES.teleprompter.roles.saboteur.label} onLeave={onLeave}>
      <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: Math.max(84, insets.top + 72) }}>
        <Card inner={{ padding: 16 }}>
          <Eyebrow>Actor is reading</Eyebrow>
          <T size={17} w={600} lh={1.3} style={{ marginTop: 4 }}>
            {lines[index] || 'The big ad-libbed finish'}
          </T>
        </Card>
        <View style={{ marginTop: 20 }}>
          <InjectGrid view={view} serverNow={serverNow} intent={intent} />
        </View>
        {recent.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Eyebrow style={{ marginBottom: 8, paddingHorizontal: 4 }}>Recently injected</Eyebrow>
            <Card>
              <Divided>
                {recent.map((i) => (
                  <View key={i.at} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                    <T size={14} numberOfLines={1} style={{ flex: 1 }}>
                      {i.text}
                    </T>
                    <T muted size={14}>
                      {nameOf(view, i.by).split(' ')[0]}
                    </T>
                  </View>
                ))}
              </Divided>
            </Card>
          </View>
        )}
      </ScrollView>
    </GameShell>
  );
}
