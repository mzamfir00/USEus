// Halloween Rituals: five urban-legend games built on the flashlight, mic, camera and sync.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Eye, Flame, Ghost, Hand, Lock, Moon, Music, PowerOff, Skull, UserX, Vote, Wind } from 'lucide-react-native';
import { RITUAL, blackoutAt, dopAlive, nextBlackout, statueCycle } from '../../core';
import { buzz, haptic, speak, Synth } from '../../lib/sound';
import { useTheme } from '../../theme';
import { Button, Card, Divided, Pill, Sheet, T } from '../primitives';
import { formatTime, useLater, useNow } from '../helpers';
import Camera from './Camera';
import { useGameTop } from './context';
import HorrorFx, { Breathe, HorrorTitle, Tremble, Vhs } from './HorrorFx';
import { useMotion } from './RedLight';
import { BottomBar, GameShell, PickPlayer, Pop, TopCard, confirm, nameOf, userOf } from './shared';

// Fires `fn` whenever `value` changes after mount (new extinguish, new noise, new blackout…).
function useOnChange(value, fn) {
  const seen = useRef(value);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (value === seen.current) return;
    const prev = seen.current;
    seen.current = value;
    cb.current(value, prev);
  }, [value]);
}

// Toggles every `ms` while `on` (flashlight strobes).
function useBlink(on, ms = 250) {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => setV((x) => !x), ms);
    return () => {
      clearInterval(id);
      setV(false);
    };
  }, [on, ms]);
  return v;
}

function Banner({ children, strong = false, testID }) {
  return (
    <TopCard testID={testID}>
      <View
        style={[
          { borderRadius: 18, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
          strong ? { backgroundColor: '#fff' } : { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.7)' },
        ]}
      >
        {children}
      </View>
    </TopCard>
  );
}

function ConfirmCaught({ label, onConfirm }) {
  return (
    <TouchableOpacity
      style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
      testID="confirm-caught"
      onPress={() =>
        confirm(`${label}?`, 'You’ll be out for the rest of the round.', () => {
          buzz([200, 80, 200]);
          onConfirm();
        }, 'I’m out')
      }
    >
      <T size={13.5} w={500} color="rgba(255,255,255,0.7)">
        {label}
      </T>
    </TouchableOpacity>
  );
}

function OutScreen({ title, sub, icon: Icon = Skull }) {
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 12, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]} testID="out-screen">
      <Icon size={34} color="rgba(255,255,255,0.7)" />
      <HorrorTitle size={40} style={{ marginTop: 16 }} center>
        {title}
      </HorrorTitle>
      <T size={15} color="rgba(255,255,255,0.6)" center style={{ marginTop: 12 }}>
        {sub}
      </T>
    </View>
  );
}

function TaskList({ tasks, done, onTask }) {
  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 12 }}>
      {tasks.map((task, i) => {
        const ok = done.includes(i);
        return (
          <TouchableOpacity key={task} disabled={ok} onPress={() => onTask(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }} accessibilityLabel={task}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#fff', backgroundColor: ok ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {ok && <Check size={12} strokeWidth={3} color="#000" />}
            </View>
            <T size={14} color="#fff" style={[{ flex: 1 }, ok ? { textDecorationLine: 'line-through', opacity: 0.5 } : null]}>
              {task}
            </T>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const darkBtn = { bg: '#000', color: '#fff', style: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' } };

const hudOf = (hud, extra) => ({ ...hud, title: `${hud.title}${extra ? ` · ${extra}` : ''}` });

/* ============================== The Midnight Man ============================== */

// 12:00 AM → 3:33 AM across the round.
function ritualTime(r, now) {
  const p = Math.min(1, Math.max(0, (now - r.startsAt) / (r.endsAt - r.startsAt)));
  const mins = Math.floor(p * 213);
  const h = Math.floor(mins / 60);
  return `${h === 0 ? 12 : h}:${String(mins % 60).padStart(2, '0')} AM`;
}

export function MidnightHunter({ view, serverNow, intent, onLeave }) {
  useNow(250);
  const insets = useSafeAreaInsets();
  const top = useGameTop();
  const r = view.round;
  const d = r.data;
  const now = serverNow();
  const candles = r.participants.filter((id) => r.roles[id] === 'candle');
  const lit = candles.filter((id) => !d.caught[id] && !d.out[id]);
  const exposed = candles.filter((id) => d.exposed[id] && !d.caught[id]);
  const cooling = Math.max(0, d.cooldownUntil - now);
  const [target, setTarget] = useState(null);
  const [catching, setCatching] = useState(false);
  const status = (id) => (d.caught[id] ? 'TAKEN' : d.exposed[id] ? 'EXPOSED' : d.out[id] ? 'IN THE DARK' : 'LIT');

  useOnChange(exposed.join(','), (v, prev) => {
    if (v.split(',').filter(Boolean).length > prev.split(',').filter(Boolean).length) buzz([300, 100, 300]);
  });
  useEffect(() => {
    if (target && !lit.includes(target)) setTarget(null);
  }, [lit.join(','), target]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`The Midnight Man · ${lit.length} candle${lit.length === 1 ? '' : 's'} lit`} onLeave={onLeave}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
        <HorrorFx />
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 18 + insets.bottom, paddingTop: top.pad }}>
          <Vhs size={13} color="rgba(255,255,255,0.5)">
            ▶ PLAY · {ritualTime(r, now)}
          </Vhs>
          <HorrorTitle size={44} style={{ marginTop: 8 }}>
            The candles
          </HorrorTitle>
          <View style={{ marginTop: 16, gap: 8 }} testID="candles">
            {candles.map((id) => {
              const hot = d.exposed[id] && !d.caught[id];
              return (
                <View
                  key={id}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, borderColor: hot ? '#fff' : 'rgba(255,255,255,0.15)', backgroundColor: hot ? '#fff' : 'transparent', paddingHorizontal: 16, paddingVertical: 12 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: d.caught[id] ? 0.4 : 1 }}>
                    <Flame size={15} color={hot ? '#000' : '#fff'} style={{ opacity: d.out[id] || d.caught[id] ? 0.3 : 1 }} />
                    <T size={15} w={600} color={hot ? '#000' : '#fff'} style={d.caught[id] ? { textDecorationLine: 'line-through' } : null}>
                      {nameOf(view, id)}
                    </T>
                  </View>
                  <Vhs size={11} color={hot ? '#000' : 'rgba(255,255,255,0.6)'}>
                    {status(id)}
                  </Vhs>
                </View>
              );
            })}
          </View>
          {exposed.length > 0 && (
            <Pop style={{ marginTop: 12, borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12 }}>
              <Vhs size={11} color="rgba(0,0,0,0.6)">
                Shrieking now
              </Vhs>
              <T size={17} w={700} color="#000">
                {exposed.map((id) => `@${userOf(view, id)}`).join(', ')} — follow the scream
              </T>
            </Pop>
          )}
          <View style={{ marginTop: 'auto' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 12 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              <Pill label="Random candle" on={!target} onPress={() => setTarget(null)} />
              {lit.map((id) => (
                <Pill key={id} label={nameOf(view, id).split(' ')[0]} on={target === id} onPress={() => setTarget(id)} />
              ))}
            </ScrollView>
            <TouchableOpacity
              disabled={cooling > 0 || !lit.length}
              testID="extinguish"
              accessibilityLabel={`extinguish ${cooling > 0 ? Math.ceil(cooling / 1000) : 0}`}
              onPress={() => {
                Synth.unlock();
                buzz([60, 40, 160]);
                intent({ type: 'extinguish', ...(target && { id: target }) });
              }}
              style={{ minHeight: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: cooling > 0 || !lit.length ? 0.35 : 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Wind size={18} color="#000" />
                <T size={16} w={700} ls={0.4} color="#000">
                  EXTINGUISH CANDLE
                </T>
              </View>
              <T size={12} w={500} color="rgba(0,0,0,0.6)">
                {cooling > 0 ? `Ready in ${Math.ceil(cooling / 1000)}s` : `${target ? nameOf(view, target) : 'Random'} · 25s cooldown`}
              </T>
            </TouchableOpacity>
            <Button icon={Hand} title="I caught someone" {...darkBtn} style={[darkBtn.style, { marginTop: 8 }]} onPress={() => setCatching(true)} />
          </View>
        </View>
      </View>
      {catching && (
        <PickPlayer
          title="Who did you catch?"
          ids={candles.filter((id) => !d.caught[id])}
          view={view}
          onClose={() => setCatching(false)}
          onPick={(id) => {
            setCatching(false);
            intent({ type: 'caughtBy', id });
          }}
        />
      )}
    </GameShell>
  );
}

// Five matches in random spots; tap 1→5 to relight.
function Relight({ out, now, exposed, onDone }) {
  const insets = useSafeAreaInsets();
  const cells = useMemo(() => {
    let seed = out.at % 2147483647;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pool = Array.from({ length: 12 }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, RITUAL.relightTaps);
  }, [out.at]);
  const [next, setNext] = useState(0);
  const strobe = useBlink(exposed, 250);
  const left = Math.max(0, out.deadline - now);
  useEffect(() => {
    if (next >= RITUAL.relightTaps) onDone();
  }, [next]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 60, backgroundColor: exposed && strobe ? '#fff' : '#000', paddingHorizontal: 20, paddingBottom: 20 + insets.bottom, paddingTop: Math.max(80, insets.top + 66) }]}
      testID="relight"
      accessibilityLabel={`relight ${next}`}
    >
      <View style={{ borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center' }}>
        <Vhs size={12} color="rgba(255,255,255,0.6)">
          {exposed ? 'They can hear you' : 'Your candle went out'}
        </Vhs>
        <HorrorTitle size={34} style={{ marginTop: 4 }} center>
          {exposed ? 'EXPOSED' : 'Relight it'}
        </HorrorTitle>
        <T size={14} color="rgba(255,255,255,0.7)" center style={{ marginTop: 8 }}>
          {exposed ? 'Your phone is shrieking. Light the matches to stop it.' : `Tap the matches in order. ${Math.ceil(left / 1000)}s before you scream.`}
        </T>
        {!exposed && (
          <View style={{ marginTop: 12, height: 4, alignSelf: 'stretch', borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <View style={{ height: 4, backgroundColor: '#fff', width: `${(left / RITUAL.relightMs) * 100}%` }} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'stretch' }}>
        {Array.from({ length: 12 }, (_, cell) => {
          const n = cells.indexOf(cell);
          return (
            <View key={cell} style={{ width: '33.33%', height: '25%', padding: 6 }}>
              {n >= 0 ? (
                <TouchableOpacity
                  accessibilityLabel={`Match ${n + 1}`}
                  testID={`match-${n + 1}`}
                  onPress={() => {
                    if (n !== next) {
                      buzz(80);
                      return;
                    }
                    Synth.click();
                    haptic.tick();
                    setNext(next + 1);
                  }}
                  style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: n < next ? '#fff' : 'rgba(255,255,255,0.4)', backgroundColor: n < next ? '#fff' : '#000', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <Flame size={22} color={n < next ? '#000' : '#fff'} style={{ opacity: n < next ? 1 : 0.4 }} />
                  <T size={22} w={700} color={n < next ? '#000' : '#fff'}>
                    {n + 1}
                  </T>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function MidnightCandle({ view, serverNow, intent, onLeave, hud }) {
  useNow(200);
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const now = serverNow();
  const out = d.out[me];
  const exposed = !!d.exposed[me];
  const caught = !!d.caught[me];
  const strobe = useBlink(exposed && !caught, 250);

  useOnChange(out?.at, (at) => {
    if (!at) return;
    Synth.whisper();
    buzz([500, 120, 200]);
  });
  // Exposed: shriek until relit.
  useEffect(() => {
    if (!exposed || caught) return undefined;
    Synth.shriek();
    buzz([400, 100, 400]);
    const id = setInterval(() => {
      Synth.shriek();
      buzz([400, 100, 400]);
    }, 1500);
    return () => clearInterval(id);
  }, [exposed, caught]);

  const torch = caught ? false : out ? exposed && strobe : true;
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={caught ? 'Taken by the Midnight Man' : out ? 'Your candle is out' : 'Survivor · candle lit'} onLeave={onLeave}>
      <Camera hud={hudOf(hud, ritualTime(r, now))} record enforce={!caught} lensCheck={false} torch={torch}>
        <HorrorFx />
        {!out && !caught && (
          <Banner>
            <Vhs size={11.5} color="rgba(255,255,255,0.6)">
              {ritualTime(r, now)}
            </Vhs>
            <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Breathe>
                <Flame size={17} color="#fff" />
              </Breathe>
              <T size={17} w={700} color="#fff">
                Candle lit
              </T>
            </View>
          </Banner>
        )}
        <BottomBar>{!caught && <ConfirmCaught label="He got me" onConfirm={() => intent({ type: 'caughtBy' })} />}</BottomBar>
        {caught && <OutScreen title="Taken" sub="Stay silent until 3:33 AM. Keep watching." />}
      </Camera>
      {out && !caught && <Relight out={out} now={now} exposed={exposed} onDone={() => intent({ type: 'relight' })} />}
    </GameShell>
  );
}

/* ============================== The Weeping Statue ============================== */

function useStatueClock(r, serverNow, onSwitch) {
  useNow(100);
  const c = statueCycle(r, serverNow());
  useOnChange(c.lit, (lit) => onSwitch(lit));
  return c;
}

export function StatueEntity({ view, serverNow, intent, onLeave }) {
  const insets = useSafeAreaInsets();
  const r = view.round;
  const d = r.data;
  const c = useStatueClock(r, serverNow, (lit) => (lit ? haptic.warning() : buzz([60, 50, 60])));
  const [catching, setCatching] = useState(false);
  const watchers = r.participants.filter((id) => r.roles[id] === 'watcher');
  const report = () => {
    const now = serverNow();
    const cc = statueCycle(r, now);
    if (cc.lit && cc.left < RITUAL.statueLight - 500) intent({ type: 'statueMoved' });
  };
  const motion = useMotion(report);
  useOnChange(d.moves, (n) => n && buzz([600, 100, 600]));

  const Word = c.lit ? Tremble : View;
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`The Statue · ${c.lit ? 'FREEZE' : 'move'}`} onLeave={onLeave}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} testID={`statue-${c.lit ? 'light' : 'dark'}`}>
        <HorrorFx />
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: 96 + insets.bottom, top: Math.max(80, insets.top + 66), borderRadius: 28, borderWidth: 2, borderColor: c.lit ? '#fff' : 'rgba(255,255,255,0.1)' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Vhs size={13} color="rgba(255,255,255,0.5)">
            {c.lit ? 'The light is on them' : 'Total blackout'}
          </Vhs>
          <Word>
            <T size={76} w={700} ls={-4} color={c.lit ? '#fff' : 'rgba(255,255,255,0.8)'} style={{ marginTop: 8 }}>
              {c.lit ? 'FREEZE' : 'MOVE'}
            </T>
          </Word>
          <T size={34} w={700} tnum color="rgba(255,255,255,0.7)" style={{ marginTop: 16 }}>
            {Math.ceil(c.left / 1000)}
          </T>
          <T size={14} color="rgba(255,255,255,0.55)" center style={{ marginTop: 24, maxWidth: 300 }}>
            {motion.mode === 'sensor'
              ? 'Phone in your pocket. It feels it if you move in the light.'
              : motion.mode === 'ask'
                ? 'Tap below so your phone can feel you move.'
                : 'No motion sensor on this phone — freeze on your honour.'}
          </T>
          {motion.mode === 'ask' && <Pill label="Enable motion sensor" onPress={motion.ask} style={{ marginTop: 12, backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.3)' }} />}
          {d.moves > 0 && (
            <Vhs size={12} color="rgba(255,255,255,0.7)" style={{ marginTop: 16 }}>
              Moved in the light ×{d.moves}
            </Vhs>
          )}
        </View>
      </View>
      <BottomBar>
        <Button icon={Hand} title="I tagged someone" {...darkBtn} onPress={() => setCatching(true)} />
      </BottomBar>
      {catching && (
        <PickPlayer
          title="Who did you tag?"
          ids={watchers.filter((id) => !d.tagged[id])}
          view={view}
          onClose={() => setCatching(false)}
          onPick={(id) => {
            setCatching(false);
            intent({ type: 'caughtBy', id });
          }}
        />
      )}
    </GameShell>
  );
}

export function StatueWatcher({ view, serverNow, intent, onLeave, hud }) {
  const r = view.round;
  const d = r.data;
  const tagged = !!d.tagged[view.me];
  const later = useLater();
  const c = useStatueClock(r, serverNow, () => {
    Synth.clunk();
    haptic.tick();
  });
  const [moved, setMoved] = useState(false);
  useOnChange(d.moves, (n) => {
    if (!n) return;
    Synth.alert();
    setMoved(true);
    later(() => setMoved(false), 3000);
  });
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={tagged ? 'Tagged by the Statue' : `Survivor · ${c.lit ? 'light' : 'blackout'}`} onLeave={onLeave}>
      <Camera hud={hud} record enforce={!tagged} lensCheck={false} torch={!tagged && c.lit}>
        <HorrorFx />
        {moved && (
          <Banner strong>
            <Vhs size={11} color="rgba(0,0,0,0.6)">
              Snitched by its own phone
            </Vhs>
            <T size={19} w={700} color="#000" center>
              THE STATUE MOVED IN THE LIGHT
            </T>
          </Banner>
        )}
        {!c.lit && !tagged && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 15, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]} testID="blackout">
            <Vhs size={12} color="rgba(255,255,255,0.25)">
              Blackout
            </Vhs>
            <T size={40} w={700} tnum color="rgba(255,255,255,0.15)" style={{ marginTop: 4 }}>
              {Math.ceil(c.left / 1000)}
            </T>
          </View>
        )}
        <BottomBar>{!tagged && <ConfirmCaught label="It got me" onConfirm={() => intent({ type: 'caughtBy' })} />}</BottomBar>
        {tagged && <OutScreen title="You blinked" sub="The Statue got you. Stay still and keep watching." icon={Eye} />}
      </Camera>
    </GameShell>
  );
}

/* ============================== Daruma-san ============================== */

export function DarumaShadow({ view, serverNow, intent, onLeave }) {
  useNow(200);
  const r = view.round;
  const d = r.data;
  const now = serverNow();
  const frozen = now < d.frozenUntil;
  const walkers = r.participants.filter((id) => r.roles[id] === 'walker');
  const [catching, setCatching] = useState(false);
  useOnChange(d.freezes, (n) => {
    if (!n) return;
    Synth.sting();
    speak('Tomare!');
    buzz([700, 100, 300]);
  });
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={frozen ? 'The Shadow · FROZEN' : 'The Shadow · stalk them'} onLeave={onLeave}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: frozen ? '#fff' : '#000' }]} testID={`shadow-${frozen ? 'frozen' : 'free'}`}>
        {!frozen && <HorrorFx />}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          {frozen ? (
            <>
              <Vhs size={13} color="rgba(0,0,0,0.6)">
                @{userOf(view, d.frozenBy)} saw you
              </Vhs>
              <T size={72} w={700} ls={-3.5} color="#000" style={{ marginTop: 8 }}>
                TOMARE!
              </T>
              <T size={18} w={600} color="#000" style={{ marginTop: 12 }}>
                Freeze. Don’t move.
              </T>
              <T size={48} w={700} tnum color="#000" style={{ marginTop: 16 }}>
                {Math.ceil((d.frozenUntil - now) / 1000)}
              </T>
            </>
          ) : (
            <>
              <Moon size={30} color="rgba(255,255,255,0.5)" />
              <HorrorTitle size={46} style={{ marginTop: 12 }} center>
                Stay behind them
              </HorrorTitle>
              <T size={15} color="rgba(255,255,255,0.6)" center style={{ marginTop: 16, maxWidth: 300 }}>
                They can only see you in their selfie cameras. When someone calls TOMARE, you freeze for 5 seconds.
              </T>
              <View style={{ marginTop: 24, gap: 6, alignSelf: 'stretch' }}>
                {walkers.map((id) => (
                  <Vhs key={id} size={12.5} color={d.caught[id] ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)'} style={d.caught[id] ? { textDecorationLine: 'line-through' } : null}>
                    {nameOf(view, id)} · {d.done[id]?.length || 0}/3 checkpoints
                  </Vhs>
                ))}
              </View>
            </>
          )}
        </View>
      </View>
      <BottomBar>
        <Button
          disabled={frozen}
          icon={frozen ? Lock : Hand}
          title={frozen ? 'Frozen' : 'I caught someone'}
          {...(frozen ? { bg: '#000', color: '#fff' } : darkBtn)}
          onPress={() => setCatching(true)}
        />
      </BottomBar>
      {catching && (
        <PickPlayer
          title="Who did you catch?"
          ids={walkers.filter((id) => !d.caught[id])}
          view={view}
          onClose={() => setCatching(false)}
          onPick={(id) => {
            setCatching(false);
            intent({ type: 'caughtBy', id });
          }}
        />
      )}
    </GameShell>
  );
}

export function DarumaWalker({ view, serverNow, intent, onLeave, hud }) {
  useNow(250);
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const now = serverNow();
  const cam = useRef(null);
  const caught = !!d.caught[me];
  const tasks = d.tasks[me] || [];
  const done = d.done[me] || [];
  const uses = RITUAL.tomareUses - (d.tomare[me] || 0);
  const cooling = Math.max(0, (d.tomareAt[me] || 0) + RITUAL.tomareCooldown - now);
  const frozen = now < d.frozenUntil;
  useOnChange(d.freezes, (n) => n && buzz(60));

  // TOMARE freezes the Shadow at once; the selfie proof rides along when it's instant.
  const tomare = async () => {
    Synth.unlock();
    buzz([80, 40, 80]);
    const id = Math.random().toString(36).slice(2, 10);
    const img = cam.current?.live ? await Promise.race([cam.current.snapshot({ quick: true }), new Promise((res) => setTimeout(() => res(null), 900))]) : null;
    intent({ type: 'tomare', ...(img ? { mediaId: id, img } : {}) });
  };

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={caught ? 'Caught by the Shadow' : `Walker · ${done.length}/3 checkpoints`} onLeave={onLeave}>
      <Camera ref={cam} hud={hud} record enforce={!caught} lensCheck={false} lockFacing="user" glow torch={false}>
        <HorrorFx />
        <Banner strong={frozen}>
          {frozen ? (
            <>
              <Vhs size={11} color="rgba(0,0,0,0.6)">
                @{userOf(view, d.frozenBy)} called it
              </Vhs>
              <T size={19} w={700} color="#000">
                SHADOW FROZEN · {Math.ceil((d.frozenUntil - now) / 1000)}s
              </T>
            </>
          ) : (
            <>
              <Vhs size={11} color="rgba(255,255,255,0.6)">
                Never turn around
              </Vhs>
              <T size={15} w={600} color="#fff">
                Watch the dark behind you
              </T>
            </>
          )}
        </Banner>
        <BottomBar>
          {!caught && (
            <View style={{ gap: 8 }}>
              <TaskList tasks={tasks} done={done} onTask={(i) => intent({ type: 'checkpoint', i })} />
              <TouchableOpacity
                disabled={uses <= 0 || cooling > 0}
                onPress={tomare}
                testID="tomare"
                accessibilityLabel={`tomare ${uses}`}
                style={{ minHeight: 60, borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: uses <= 0 || cooling > 0 ? 0.3 : 1 }}
              >
                <T size={17} w={700} ls={0.4} color="#000">
                  {uses <= 0 ? 'NO TOMARE LEFT' : cooling > 0 ? `TOMARE IN ${Math.ceil(cooling / 1000)}s` : `TOMARE! (FREEZE SHADOW) · ${uses}`}
                </T>
              </TouchableOpacity>
              <ConfirmCaught label="The Shadow got me" onConfirm={() => intent({ type: 'caughtBy' })} />
            </View>
          )}
        </BottomBar>
        {caught && <OutScreen title="Caught" sub="You felt it before you saw it. Keep filming." icon={Ghost} />}
      </Camera>
    </GameShell>
  );
}

/* ============================== Dead Silence ============================== */

function Ripple({ id }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
  }, [v, id]);
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: 88, borderWidth: 2, borderColor: '#fff', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) }] },
      ]}
    />
  );
}

export function SilenceHunter({ view, serverNow, onLeave }) {
  useNow(500);
  const r = view.round;
  const d = r.data;
  const [ping, setPing] = useState(0);
  const mice = r.participants.filter((id) => r.roles[id] === 'mouse');
  useOnChange(d.noise.count, (n) => {
    if (!n) return;
    buzz([120, 60, 120]);
    setPing((p) => p + 1);
  });
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`The Hunter · ${mice.filter((id) => !d.caught[id]).length} still moving`} onLeave={onLeave}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
        <HorrorFx />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 176, height: 176, alignItems: 'center', justifyContent: 'center' }}>
            {ping > 0 && <Ripple id={ping} />}
            <Music size={40} color={ping ? '#fff' : 'rgba(255,255,255,0.4)'} />
          </View>
          <HorrorTitle size={46} style={{ marginTop: 16 }} center>
            Listen.
          </HorrorTitle>
          <T size={15} color="rgba(255,255,255,0.6)" center style={{ marginTop: 12, maxWidth: 300 }}>
            Blindfold on. Every sound they make chimes from their own phone.
          </T>
          <Vhs size={12.5} color="rgba(255,255,255,0.7)" style={{ marginTop: 24 }}>
            Noises heard: {d.noise.count}
          </Vhs>
          <View style={{ marginTop: 8, gap: 4, alignItems: 'center' }}>
            {mice.map((id) => (
              <Vhs key={id} size={12} color={d.caught[id] ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)'} style={d.caught[id] ? { textDecorationLine: 'line-through' } : null}>
                {nameOf(view, id)} · {d.done[id]?.length || 0}/3 tasks
              </Vhs>
            ))}
          </View>
        </View>
      </View>
    </GameShell>
  );
}

export function SilenceSurvivor({ view, serverNow, intent, onLeave, hud }) {
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const caught = !!d.caught[me];
  const tasks = d.tasks[me] || [];
  const done = d.done[me] || [];
  const noises = d.noiseBy[me] || 0;
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={caught ? 'Caught in the silence' : `Survivor · ${done.length}/3 tasks`} onLeave={onLeave}>
      <Camera
        hud={hud}
        record
        enforce={!caught}
        lensCheck={false}
        noiseMeter={!caught}
        noiseDb={-50}
        noiseHold={2}
        noiseCue="musicbox"
        noiseFlashMs={500}
        noiseCooldown={2500}
        onNoise={() => intent({ type: 'noise' })}
      >
        <HorrorFx />
        <Banner>
          <Vhs size={11} color="rgba(255,255,255,0.6)">
            Whisper threshold · 35 dB
          </Vhs>
          <T size={15} w={600} color="#fff">
            {noises ? `You made ${noises} sound${noises === 1 ? '' : 's'} (${noises * -25} XP)` : 'Not a sound.'}
          </T>
        </Banner>
        <BottomBar>
          {!caught && (
            <View style={{ gap: 8 }}>
              <TaskList tasks={tasks} done={done} onTask={(i) => intent({ type: 'silentTask', i })} />
              <ConfirmCaught label="The hunter got me" onConfirm={() => intent({ type: 'caughtBy' })} />
            </View>
          )}
        </BottomBar>
        {caught && <OutScreen title="Heard you" sub="Sit down where you were caught. Not a sound." />}
      </Camera>
    </GameShell>
  );
}

/* ============================== The Doppelgänger ============================== */

function Flicker({ children }) {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1780),
        Animated.timing(o, { toValue: 0.45, duration: 20, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.delay(60),
        Animated.timing(o, { toValue: 0.75, duration: 20, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 60, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ opacity: o }}>{children}</Animated.View>;
}

export function Doppelganger({ view, serverNow, intent, onLeave, hud }) {
  useNow(200);
  const t = useTheme();
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const now = serverNow();
  const isDop = !!view.mine?.doppelganger;
  const b = blackoutAt(r, now);
  const alive = dopAlive(r);
  const taken = !!d.taken[me];
  const banished = !!d.banished[me];
  const out = taken || banished;
  const [voting, setVoting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [secretOpen, setSecretOpen] = useState(true);
  const [toast, setToast] = useState(null);
  const claimedNow = b && d.claimedIn[b.k];
  const later = useLater();

  useOnChange(!!b, (dark) => {
    if (dark) {
      Synth.powerDown();
      buzz([300, 100, 300]);
    } else Synth.powerUp();
  });
  // Victims are announced to everyone else only once the lights come back.
  const announced = Object.keys(d.taken)
    .filter((id) => id !== me && !(b && d.taken[id] >= b.start))
    .join(',');
  useOnChange(announced, (v, prev) => {
    const fresh = v.split(',').filter((id) => id && !prev.split(',').includes(id));
    if (fresh.length) {
      setToast(`@${fresh.map((id) => userOf(view, id)).join(', @')} was taken in the dark`);
      buzz([200, 100, 200]);
      later(() => setToast(null), 5000);
    }
  });
  const banishedIds = Object.keys(d.banished).join(',');
  useOnChange(banishedIds, (v, prev) => {
    const fresh = v.split(',').filter((id) => id && !prev.split(',').includes(id));
    if (fresh.length && !fresh.includes(me)) {
      setToast(`@${userOf(view, fresh[0])} was voted out — and was innocent`);
      later(() => setToast(null), 5000);
    }
  });

  const tally = {};
  Object.values(d.accuse).forEach((id) => (tally[id] = (tally[id] || 0) + 1));
  const need = Math.floor(alive.length / 2) + 1;
  const nextCut = Math.max(0, nextBlackout(r, now) - now);

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={out ? (taken ? 'Taken' : 'Banished') : b ? 'POWER OUTAGE' : `Explorer · power cut in ${formatTime(nextCut)}`} onLeave={onLeave}>
      <Camera hud={hud} record enforce={!out} lensCheck={false} torch={!out && !b}>
        <HorrorFx />
        {toast && !b && (
          <Banner strong>
            <T size={16} w={700} color="#000" center>
              {toast}
            </T>
          </Banner>
        )}
        {isDop && !out && !b && !toast && (
          <TopCard testID="secret-role">
            <TouchableOpacity onPress={() => setSecretOpen((v) => !v)} style={{ borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Skull size={15} color="#000" />
                <T size={13.5} w={700} color="#000">
                  {secretOpen ? 'YOU ARE THE DOPPELGÄNGER' : 'Secret role · tap to show'}
                </T>
              </View>
              {secretOpen && (
                <T size={13} color="rgba(0,0,0,0.7)" style={{ marginTop: 4 }}>
                  Act normal. When the power cuts, claim the player next to you.
                </T>
              )}
            </TouchableOpacity>
          </TopCard>
        )}
        {b && !out && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 15, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]} testID="blackout">
            <PowerOff size={28} color="rgba(255,255,255,0.25)" />
            <Vhs size={12} color="rgba(255,255,255,0.3)" style={{ marginTop: 12 }}>
              Power outage
            </Vhs>
            <Flicker>
              <T size={44} w={700} tnum color="rgba(255,255,255,0.2)" style={{ marginTop: 4 }}>
                {Math.ceil((b.end - now) / 1000)}
              </T>
            </Flicker>
            {isDop && (
              <TouchableOpacity
                disabled={!!claimedNow}
                onPress={() => setClaiming(true)}
                testID="claim"
                style={{ marginTop: 32, height: 56, width: '100%', maxWidth: 280, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', opacity: claimedNow ? 0.4 : 1 }}
              >
                <T size={15} w={700} ls={0.4} color="#fff">
                  {claimedNow ? 'VICTIM CLAIMED' : 'CLAIM VICTIM'}
                </T>
              </TouchableOpacity>
            )}
          </View>
        )}
        <BottomBar>
          {!out && !b && <Button icon={Vote} title={`Accuse${d.accuse[me] ? ` · ${nameOf(view, d.accuse[me]).split(' ')[0]}` : ''}`} bg="rgba(0,0,0,0.7)" color="#fff" style={darkBtn.style} onPress={() => setVoting(true)} testID="accuse" />}
        </BottomBar>
        {taken && <OutScreen title="You were taken" sub="You’re a ghost now. Stay silent — let them work it out." icon={Ghost} />}
        {banished && <OutScreen title="Banished" sub="The squad voted you out. You were innocent." icon={UserX} />}
      </Camera>
      {claiming && (
        <PickPlayer
          title="Who is next to you?"
          ids={alive.filter((id) => id !== me)}
          view={view}
          onClose={() => setClaiming(false)}
          onPick={(id) => {
            setClaiming(false);
            buzz(40);
            intent({ type: 'claim', id });
          }}
          note="One claim per blackout."
        />
      )}
      {voting && (
        <Sheet title="Who is the Doppelgänger?" onClose={() => setVoting(false)}>
          <T muted size={14} style={{ marginTop: -12, marginBottom: 16 }}>
            {need} votes unmask or banish someone. Tap again to take your vote back.
          </T>
          <Card>
            <Divided>
              {alive
                .filter((id) => id !== me)
                .map((id) => {
                  const mine = d.accuse[me] === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      activeOpacity={0.7}
                      accessibilityLabel={`Accuse ${nameOf(view, id)}`}
                      onPress={() => {
                        buzz(20);
                        intent({ type: 'accuse', id: mine ? null : id });
                        setVoting(false);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: mine ? t.c.fg : 'transparent' }}
                    >
                      <T size={16} w={600} color={mine ? t.c.bg : t.c.fg}>
                        {nameOf(view, id)}
                      </T>
                      <T size={13} w={500} tnum color={mine ? t.c.bg : t.c.fg}>
                        {tally[id] || 0}/{need}
                      </T>
                    </TouchableOpacity>
                  );
                })}
            </Divided>
          </Card>
        </Sheet>
      )}
    </GameShell>
  );
}
