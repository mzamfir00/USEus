import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Volume2 } from 'lucide-react-native';
import { GAMES, SONAR_BEEP_MS, SONAR_COOLDOWN, XP } from '../../core';
import { buzz, haptic, Synth } from '../../lib/sound';
import { Button, T } from '../primitives';
import { useNow } from '../helpers';
import Camera from './Camera';
import { BottomBar, GameShell, PickPlayer, TopCard, nameOf } from './shared';

export function SonarHunter({ view, serverNow, intent, onLeave }) {
  useNow(200);
  const d = view.round.data;
  const [picking, setPicking] = useState(false);
  const now = serverNow();
  const cooldown = Math.max(0, d.cooldownUntil - now);
  const ready = cooldown === 0;
  const survivors = view.round.participants.filter((id) => view.round.roles[id] === 'survivor');

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={GAMES.blind_sonar.roles.hunter.label} onLeave={onLeave} light={ready}>
      <TouchableOpacity
        accessibilityLabel="Emit sonar pulse"
        testID="emit-sonar"
        disabled={!ready}
        activeOpacity={0.85}
        onPress={() => {
          haptic.sonar();
          buzz([60, 40, 60]);
          intent({ type: 'sonar' });
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: ready ? '#fff' : '#000' }}
      >
        {ready ? (
          <>
            <T size={15} w={500} color="rgba(0,0,0,0.5)">
              Eyes closed
            </T>
            <T size={54} w={700} ls={-2} lh={0.95} color="#000" center style={{ marginTop: 16 }}>
              TAP TO EMIT SONAR PULSE
            </T>
            <T size={15} color="rgba(0,0,0,0.6)" style={{ marginTop: 24 }}>
              Anywhere on the screen
            </T>
          </>
        ) : (
          <>
            <View style={{ width: 176, height: 176 }}>
              <Svg viewBox="0 0 100 100" width={176} height={176} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={50} cy={50} r={46} stroke="#262626" strokeWidth={3} fill="none" />
                <Circle cx={50} cy={50} r={46} stroke="#fff" strokeWidth={3} fill="none" strokeDasharray="289" strokeDashoffset={289 * (cooldown / SONAR_COOLDOWN)} strokeLinecap="round" />
              </Svg>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <T size={56} w={700} tnum color="#fff">
                  {Math.ceil(cooldown / 1000)}
                </T>
              </View>
            </View>
            <T size={17} w={600} color="#fff" style={{ marginTop: 24 }}>
              Recharging sonar
            </T>
            <T size={14} color="rgba(255,255,255,0.5)" style={{ marginTop: 4 }}>
              Listen for the beeps
            </T>
          </>
        )}
        <T size={13} color={ready ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)'} style={{ marginTop: 40 }}>
          {d.pulses} pulse{d.pulses === 1 ? '' : 's'} sent
        </T>
      </TouchableOpacity>
      <BottomBar>
        <Button title="I caught someone" onPress={() => setPicking(true)} bg={ready ? '#000' : '#fff'} color={ready ? '#fff' : '#000'} testID="caught" />
      </BottomBar>
      {picking && (
        <PickPlayer
          title="Who did you catch?"
          ids={survivors}
          view={view}
          onPick={(id) => intent({ type: 'caught', id })}
          onClose={() => setPicking(false)}
          note="Survivors confirm on camera. Ends the round."
        />
      )}
    </GameShell>
  );
}

export function SonarSurvivor({ view, serverNow, intent, onLeave, hud }) {
  useNow(150);
  const d = view.round.data;
  const me = view.me;
  const now = serverNow();
  const played = useRef(view.round.data.pulses);
  const [beeping, setBeeping] = useState(false);
  const toPulse = d.pulseAt ? d.pulseAt - now : -1;
  const incoming = toPulse > 0 && toPulse <= 3200;

  // Fire the loud beep exactly at the host's pulse time on every survivor phone.
  useEffect(() => {
    if (d.pulses === played.current || !d.pulseAt) return undefined;
    played.current = d.pulses;
    const wait = d.pulseAt - serverNow();
    if (wait < -SONAR_BEEP_MS) return undefined;
    buzz(30);
    const timer = setTimeout(() => {
      Synth.sonar();
      haptic.sonar();
      setBeeping(true);
      setTimeout(() => setBeeping(false), SONAR_BEEP_MS);
    }, Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [d.pulses, d.pulseAt, serverNow]);

  const used = d.nearMiss[me] || 0;
  const coolingNear = now - (d.nearMissAt[me] || 0) < 8000;

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Survivor · hunter is ${nameOf(view, view.round.participants.find((id) => view.round.roles[id] === 'hunter'))}`} onLeave={onLeave}>
      <Camera hud={hud} record enforce flash={beeping}>
        {(incoming || beeping) && (
          <TopCard testID="sonar-incoming">
            <View style={{ borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' }}>
              <T size={13} w={500} color="rgba(0,0,0,0.5)">
                {beeping ? 'Sonar hitting now' : 'Sonar incoming'}
              </T>
              <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {beeping ? <Volume2 size={30} color="#000" /> : null}
                <T size={34} w={700} ls={-1} tnum color="#000">
                  {beeping ? 'BEEP' : `${Math.ceil(toPulse / 1000)}…`}
                </T>
              </View>
            </View>
          </TopCard>
        )}
        <BottomBar>
          <Button title={`Near miss · +${XP.nearMiss} XP`} disabled={used >= 3 || coolingNear} onPress={() => intent({ type: 'nearMiss' })} bg="#fff" color="#000" testID="near-miss" />
          <T size={12.5} color="rgba(255,255,255,0.6)" center style={{ marginTop: 8 }}>
            {3 - used} left · when the hunter passes within 1 m on camera
          </T>
        </BottomBar>
      </Camera>
    </GameShell>
  );
}
