import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { MapPin } from 'lucide-react-native';
import { ARENAS, GAMES, PICK_MS, WHEEL_MS } from '../../core';
import { purgeOldClips } from '../../lib/clips';
import { prepareRound } from '../../lib/permissions';
import { buzz, haptic, Synth } from '../../lib/sound';
import { useTheme } from '../../theme';
import { Eyebrow, T, Title } from '../primitives';
import { useNow } from '../helpers';
import Briefing from './Briefing';
import HorrorFx, { HorrorTitle } from './HorrorFx';
import { nameOf } from './shared';

const roleBrief = (view) => {
  const r = view.round;
  const g = GAMES[r.game];
  const role = r.roles[view.me];
  if (!role) return { label: 'Spectator', brief: 'You joined mid-round. Watch this one — you’re in next time.' };
  if (r.game === 'undercover' && view.mine?.saboteur) return g.roles.saboteur;
  if (r.game === 'doppelganger' && view.mine?.doppelganger) return g.roles.doppelganger;
  if (r.game === 'paparazzi') return { label: 'Sniper', brief: `${g.roles.sniper.brief} Your target: ${nameOf(view, view.mine?.target)}.` };
  return g.roles[role] || { label: role, brief: '' };
};

// Monochrome roulette wheel over the games that fit the arena.
function Wheel({ view, serverNow, onLocked }) {
  const t = useTheme();
  const r = view.round;
  const pool = r.pool;
  const seg = 360 / pool.length;
  const idx = Math.max(0, pool.indexOf(r.game));
  const elapsed = serverNow() - r.spunAt;
  const late = elapsed >= WHEEL_MS - 200;
  const final = 360 * 6 + (360 - (idx + 0.5) * seg);
  const angle = useRef(new Animated.Value(late ? final : 0)).current;
  const [locked, setLocked] = useState(late);
  const timers = useRef([]);
  const size = Math.min(Dimensions.get('window').width * 0.84, 340);

  useEffect(() => {
    if (late) {
      onLocked();
      return undefined;
    }
    const total = WHEEL_MS - elapsed;
    const pending = timers.current;
    Animated.timing(angle, { toValue: final, duration: total, easing: Easing.bezier(0.12, 0.62, 0.08, 1), useNativeDriver: true }).start();
    // Ticks (sound + haptic) slow down with the wheel.
    let at = 0;
    let gap = 45;
    while (at + gap < total - 120) {
      at += gap;
      timers.current.push(
        setTimeout(() => {
          Synth.tick(0.9);
          haptic.tick();
        }, at)
      );
      gap *= 1.09;
    }
    timers.current.push(
      setTimeout(() => {
        Synth.lockIn();
        buzz([40, 30, 120]);
        setLocked(true);
        onLocked();
      }, total)
    );
    return () => pending.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.spinId]);

  const rotate = angle.interpolate({ inputRange: [0, 3600], outputRange: ['0deg', '3600deg'] });
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }} testID="wheel">
      <View style={{ position: 'absolute', left: size / 2 - 11, top: -6, zIndex: 10, width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderTopWidth: 18, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: t.c.fg }} />
      <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
        <Svg viewBox="-100 -100 200 200" width={size} height={size}>
          {pool.map((id, i) => {
            const a0 = ((i * seg - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
            const large = seg > 180 ? 1 : 0;
            const path =
              pool.length === 1
                ? 'M -96 0 A 96 96 0 1 1 96 0 A 96 96 0 1 1 -96 0'
                : `M 0 0 L ${96 * Math.cos(a0)} ${96 * Math.sin(a0)} A 96 96 0 ${large} 1 ${96 * Math.cos(a1)} ${96 * Math.sin(a1)} Z`;
            const mid = (i + 0.5) * seg;
            const on = locked && i === idx;
            return (
              <G key={id}>
                <Path d={path} fill={on ? '#fff' : i % 2 ? '#141414' : '#000'} stroke="#262626" strokeWidth={1} />
                <G transform={`rotate(${mid - 90}) translate(56 0)${mid > 180 ? ' rotate(180)' : ''}`}>
                  <SvgText textAnchor="middle" alignmentBaseline="middle" fontSize={pool.length > 6 ? 7.4 : 9} fontFamily="Inter_700Bold" fill={on ? '#000' : '#fff'} y={3}>
                    {GAMES[id].short}
                  </SvgText>
                </G>
              </G>
            );
          })}
          <Circle r={96} fill="none" stroke="#fff" strokeWidth={1.5} />
          <Circle r={16} fill="#000" stroke="#fff" strokeWidth={1.5} />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default function Intro({ view, serverNow, intent }) {
  useNow(200);
  const r = view.round;
  const g = GAMES[r.game];
  const now = serverNow();
  const isRandom = r.mode === 'random';
  const revealAt = r.revealAt || r.spunAt + (isRandom ? WHEEL_MS : PICK_MS);
  const [locked, setLocked] = useState(!isRandom || now >= revealAt);
  const revealed = now >= revealAt;
  const startsIn = r.startsAt ? Math.max(0, Math.ceil((r.startsAt - now) / 1000)) : null;
  const brief = roleBrief(view);
  const played = useRef(false);
  const horror = g.pack === 'halloween';

  // Ask for camera, microphone and location during the briefing, so no prompt lands mid-round.
  useEffect(() => {
    if (r.stage !== 'brief') return;
    prepareRound({ films: g.film.includes(r.roles[view.me]), zone: r.zone });
    purgeOldClips(`${view.code}:${r.n}:${r.spinId}`);
  }, [r.spinId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRandom && !played.current && now < revealAt) {
      played.current = true;
      Synth.lockIn();
      buzz([40, 30, 120]);
    }
  }, [isRandom, now, revealAt]);

  // Everyone tapped ready: a short countdown chime before the clock starts.
  const lastCount = useRef(null);
  useEffect(() => {
    if (r.stage !== 'live' || startsIn === null) return;
    if (startsIn !== lastCount.current && startsIn > 0 && startsIn <= 3) {
      Synth.beep(startsIn === 1);
      haptic.tick();
    }
    lastCount.current = startsIn;
  }, [r.stage, startsIn]);

  const GameTitle = ({ size, style }) =>
    horror ? (
      <HorrorTitle size={size} style={style} center>
        {g.name}
      </HorrorTitle>
    ) : (
      <Title size={size} style={[{ textAlign: 'center' }, style]}>
        {g.name}
      </Title>
    );

  // Wheel / host pick first, then the Mission Briefing until everyone is ready.
  if (r.stage === 'brief') {
    if (revealed) return <Briefing view={view} intent={intent} />;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40, paddingHorizontal: 24 }} testID="intro-pick">
        <Eyebrow>{isRandom ? `Random roulette · ${ARENAS[r.arena].label}${horror ? ' · Halloween' : ''}` : 'Host’s pick'}</Eyebrow>
        <View style={{ marginTop: 24, width: '100%' }}>{isRandom ? <Wheel view={view} serverNow={serverNow} onLocked={() => setLocked(true)} /> : <GameTitle size={44} />}</View>
        {isRandom && locked && <GameTitle size={32} style={{ marginTop: 24 }} />}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40, paddingHorizontal: 24 }} testID="countdown-screen">
      {horror && <HorrorFx />}
      <Eyebrow>Everyone’s ready · {g.name}</Eyebrow>
      <T muted size={15} w={500} style={{ marginTop: 24 }}>
        You are
      </T>
      {horror ? (
        <HorrorTitle size={40} style={{ marginTop: 4 }} center>
          {brief.label}
        </HorrorTitle>
      ) : (
        <Title size={40} style={{ marginTop: 4, textAlign: 'center' }}>
          {brief.label}
        </Title>
      )}
      <T size={16} lh={1.5} center style={{ marginTop: 16, maxWidth: 320 }}>
        {brief.brief}
      </T>
      {r.location ? (
        <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MapPin size={14} color="#8a8a8a" />
          <T muted size={13.5}>
            {r.location}
          </T>
        </View>
      ) : null}
      <View style={{ marginTop: 40, alignItems: 'center' }}>
        <T size={64} w={700} tnum>
          {startsIn}
        </T>
        <T muted size={14} style={{ marginTop: 8 }}>
          {g.film.includes(r.roles[view.me]) ? 'Cameras roll at zero' : 'Starting'}
        </T>
      </View>
    </View>
  );
}
