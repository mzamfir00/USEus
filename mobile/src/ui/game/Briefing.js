// Mission Briefing & Setup: the ready-up gate every game passes through before its countdown,
// and the same rules in the in-game "?" drawer.
import React, { useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, Footprints, Ghost, MapPin, Radar, Siren, Smartphone, Users, VenetianMask } from 'lucide-react-native';
import { HUNT, briefingFor, radarAllowance } from '../../core';
import { requestMotion, useMotionMode } from '../../lib/motion';
import { buzz, Synth } from '../../lib/sound';
import { useTheme } from '../../theme';
import { useAdBreak } from '../monetization/useAdBreak';
import { Avatar, Button, Card, Divided, Eyebrow, T, Title } from '../primitives';
import SafetyGate from '../Safety';
import HorrorFx, { HorrorTitle } from './HorrorFx';
import { MafiaBriefing, MafiaRules } from './MafiaBriefing';

const nameOf = (view, id) => view.players.find((p) => p.id === id)?.name || 'Someone';

function SectionTitle({ icon: Icon, children, right }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 10, marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon size={14} color={t.c.muted} />
      <Eyebrow style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.4, flex: 1 }}>{children}</Eyebrow>
      {right}
    </View>
  );
}

// The three briefing sections. `setupFirst` puts the room setup on top (the gate); the drawer
// leads with your own role and folds the setup away.
export function RulesSections({ view, setupFirst = true }) {
  const t = useTheme();
  const info = briefingFor(view);
  const [setupOpen, setSetupOpen] = useState(setupFirst);
  if (view.round.game === 'mafia') return <MafiaRules view={view} />; // secret roles: public guide only
  const labels = ['Do this in real life', 'On your screen', 'Penalty'];
  const icons = [Footprints, Smartphone, Siren];

  const setup = (
    <View key="setup" testID="brief-setup">
      <TouchableOpacity activeOpacity={setupFirst ? 1 : 0.7} onPress={() => !setupFirst && setSetupOpen((v) => !v)} accessibilityState={{ expanded: setupOpen }}>
        <SectionTitle icon={MapPin} right={!setupFirst ? <ChevronDown size={14} color={t.c.muted} style={{ transform: [{ rotate: setupOpen ? '180deg' : '0deg' }] }} /> : null}>
          Physical setup · step by step
        </SectionTitle>
      </TouchableOpacity>
      {setupOpen && (
        <Card>
          <Divided>
            {info.setup.map((step, i) => (
              <View key={step} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.c.fg, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={12} w={700} color={t.c.bg} tnum>
                    {i + 1}
                  </T>
                </View>
                <T size={14.5} lh={1.35} style={{ flex: 1 }}>
                  {step}
                </T>
              </View>
            ))}
          </Divided>
        </Card>
      )}
    </View>
  );

  const mine = (
    <View key="mine" testID="brief-role">
      <SectionTitle icon={VenetianMask}>Your role & phone controls</SectionTitle>
      <Card inner={{ padding: 16 }}>
        <Title size={22}>{info.label}</Title>
        {info.bullets.length > 0 ? (
          <View style={{ marginTop: 12, gap: 12 }}>
            {info.bullets.map((text, i) => {
              const Icon = icons[i];
              return (
                <View key={labels[i]} style={{ flexDirection: 'row', gap: 12 }}>
                  <Icon size={17} color={t.c.fg} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <T muted size={11.5} w={600} upper ls={1.1}>
                      {labels[i]}
                    </T>
                    <T size={14.5} lh={1.35} style={{ marginTop: 2 }}>
                      {text}
                    </T>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <T muted size={14.5} style={{ marginTop: 8 }}>
            You joined mid-round. Watch this one — you’re dealt in next time.
          </T>
        )}
        {info.zoneLine ? (
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: t.c.border, paddingTop: 12 }}>
            <Radar size={16} color={t.c.fg} style={{ marginTop: 2 }} />
            <T size={13.5} lh={1.35} style={{ flex: 1 }}>
              {info.zoneLine}
            </T>
          </View>
        ) : null}
      </Card>
    </View>
  );

  const others = (
    <View key="others" testID="brief-others">
      <SectionTitle icon={Users}>How the other roles work</SectionTitle>
      {info.others.length ? (
        <Card>
          <Divided>
            {info.others.map((o) => (
              <View key={o.key} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <T size={15} w={600}>
                    {o.hidden ? `${o.label} · hidden` : o.label}
                  </T>
                  {!o.hidden && (
                    <T muted size={12.5} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {o.names.join(', ')}
                    </T>
                  )}
                </View>
                <T muted size={13.5} lh={1.35} style={{ marginTop: 2 }}>
                  {o.summary}
                </T>
              </View>
            ))}
          </Divided>
        </Card>
      ) : (
        <Card inner={{ padding: 16 }}>
          <T muted size={14}>
            Everyone plays the same role{info.sameAs ? ` — ${info.sameAs.join(', ')} too` : ''}.
          </T>
        </Card>
      )}
    </View>
  );

  return setupFirst ? [setup, mine, others] : [mine, others, setup];
}

// Live "READY: 3/4 PLAYERS" + the big ready button and the host's force start.
function ReadyBar({ view, intent, label = 'I UNDERSTAND THE RULES — READY' }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const r = view.round;
  const here = r.participants.filter((id) => view.players.find((p) => p.id === id)?.connected);
  const ready = here.filter((id) => r.ready[id]);
  const amIn = r.participants.includes(view.me);
  const iAmReady = !!r.ready[view.me];
  const isHost = view.hostId === view.me;
  const waiting = here.filter((id) => !r.ready[id]).map((id) => nameOf(view, id).split(' ')[0]);

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30 }}>
      <LinearGradient colors={['transparent', t.c.bg, t.c.bg]} locations={[0, 0.35, 1]} style={{ paddingTop: 40, paddingHorizontal: 24, paddingBottom: 16 + insets.bottom }}>
        <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T size={13} w={700} ls={1} tnum testID="ready-count" accessibilityLabel={`ready ${ready.length}/${here.length}`}>
            READY: {ready.length}/{here.length} PLAYERS
          </T>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
            {here.map((id, i) => (
              <View key={id} style={{ marginLeft: i ? -8 : 0, borderRadius: 16, borderWidth: 2, borderColor: t.c.bg, opacity: r.ready[id] ? 1 : 0.4 }}>
                <Avatar name={nameOf(view, id)} size={28} inverted={!!r.ready[id]} />
                {r.ready[id] && (
                  <View style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: t.c.fg, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={9} strokeWidth={4} color={t.c.bg} />
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
        {amIn ? (
          iAmReady ? (
            <Button variant="secondary" icon={Check} title={`Ready — waiting for ${waiting.length ? waiting.join(', ') : 'the countdown'}`} onPress={() => intent({ type: 'ready', on: false })} testID="unready" />
          ) : (
            <Button
              title={label}
              testID="ready"
              onPress={() => {
                Synth.unlock();
                buzz(30);
                intent({ type: 'ready' });
              }}
            />
          )
        ) : (
          <View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}>
            <T muted size={15}>
              You’ll be dealt in next round.
            </T>
          </View>
        )}
        {isHost && (
          <View style={{ marginTop: 4, flexDirection: 'row' }}>
            <TouchableOpacity style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' }} onPress={() => intent({ type: 'lobby' })} testID="cancel-round">
              <T muted size={13.5} w={500}>
                Cancel round
              </T>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', opacity: ready.length === here.length ? 0.3 : 1 }}
              onPress={() => intent({ type: 'forceStart' })}
              disabled={ready.length === here.length}
              testID="force-start"
            >
              <T size={13.5} w={600}>
                Force start
              </T>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

// GPS hunts: the hunter can take a free extra radar charge, hiders a Ghost Shield that hides
// them from the first radar ping, each for a short rewarded ad (free with Pro). Offered only
// while that player is still reading the briefing, so an ad never overlaps the countdown.
function Boost({ view, intent }) {
  const t = useTheme();
  const r = view.round;
  const ads = useAdBreak(view, intent);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const me = view.me;
  const hunter = r.roles[me] === HUNT[r.game]?.role;
  const claimed = hunter ? !!r.radarBonus?.[me] : !!view.intel?.ghost;
  const kind = hunter ? 'radar' : 'ghost';
  const allowance = radarAllowance(r, me);

  const claim = async () => {
    setBusy(true);
    setNote('');
    const ok = await ads.rewarded(hunter ? 'Unlocking +1 bonus radar charge' : 'Activating your Ghost Shield', { hold: true });
    if (ok) {
      const has = (v) => (hunter ? !!v?.round?.radarBonus?.[me] : !!v?.intel?.ghost);
      if (!(await ads.confirm({ type: 'boost', kind }, has))) setNote('The room didn’t answer. Check your connection.');
    } else setNote(ok === null ? 'Connection is slow — try again in a moment.' : 'No reward: the ad was skipped.');
    setBusy(false);
  };

  const pro = ads.free ? ' · Pro perk' : '';
  const title = hunter ? `📡 +1 BONUS RADAR CHARGE ${ads.free ? '· PRO PERK' : '(WATCH AD)'}` : `👻 ACTIVATE GHOST SHIELD ${ads.free ? '· PRO PERK' : '(WATCH AD)'}`;
  return (
    <View style={{ marginTop: 20 }} testID="boost">
      {claimed ? (
        <View style={{ borderRadius: 18, backgroundColor: t.c.fg, paddingHorizontal: 16, paddingVertical: 14 }} testID={`boost-${kind}-on`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {hunter ? <Radar size={15} color={t.c.bg} /> : <Ghost size={15} color={t.c.bg} />}
            <T size={13} w={800} ls={0.4} color={t.c.bg}>
              {hunter ? `BONUS CHARGE READY · RADAR ${allowance}/${allowance}` : 'GHOST SHIELD ACTIVE'}
            </T>
          </View>
          <T size={12.5} lh={1.35} color={t.c.bg} style={{ marginTop: 2, opacity: 0.7 }}>
            {hunter ? 'Your extra ping costs no XP.' : 'The hunter’s first radar ping won’t show you.'}
          </T>
        </View>
      ) : (
        <TouchableOpacity
          disabled={busy}
          onPress={claim}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={title}
          testID={`boost-${kind}`}
          style={{ borderRadius: 18, borderWidth: 1, borderColor: t.c.fg, paddingHorizontal: 16, paddingVertical: 14, opacity: busy ? 0.5 : 1 }}
        >
          <T size={13} w={800} ls={0.4} lh={1.3}>
            {busy ? (hunter ? 'UNLOCKING THE CHARGE…' : 'SUMMONING THE SHIELD…') : title}
          </T>
          <T muted size={12.5} lh={1.35} style={{ marginTop: 2 }}>
            {hunter ? `Radar ${allowance}/${allowance} → ${allowance + 1}/${allowance + 1} this match, zero XP penalty${pro}.` : `Invisible to the hunter’s first radar ping this match${pro}.`}
          </T>
        </TouchableOpacity>
      )}
      {note ? (
        <T muted size={12.5} style={{ marginTop: 8 }}>
          {note}
        </T>
      ) : null}
    </View>
  );
}

// Outdoor arenas and the dark rituals re-confirm the IRL safety warning every round.
const safetyNote = (r, g) => {
  if (r.arena === 'roadtrip') return 'Roadtrip: drivers never play. Passengers only, and only while it is safe.';
  if (g.dark) return 'This ritual is played in the dark: clear the floor of anything you could trip over and keep away from stairs.';
  if (r.zone) return `Outdoor Playzone: stay inside the ${r.zone.radius} m boundary and never chase anyone into a road.`;
  return null;
};

export default function Briefing({ view, intent }) {
  const r = view.round;
  const info = briefingFor(view);
  const motion = useMotionMode();
  const risky = info.game.dark || r.arena !== 'indoor';
  const [agreed, setAgreed] = useState(!risky);

  useEffect(() => {
    buzz([40, 30, 40]);
  }, []);

  if (r.game === 'mafia') {
    return (
      <>
        <MafiaBriefing view={view} intent={intent} footer={<ReadyBar view={view} intent={intent} label="I HID MY ROLE — READY" />} />
        {!agreed && <SafetyGate extra={safetyNote(r, info.game)} onAgree={() => setAgreed(true)} />}
      </>
    );
  }

  return (
    <View style={{ flex: 1 }} testID="briefing">
      {info.horror && <HorrorFx />}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 230 }}>
        <Eyebrow style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.7 }}>Mission briefing & setup</Eyebrow>
        {info.horror ? (
          <HorrorTitle size={34} style={{ marginTop: 8 }}>
            {info.game.name}
          </HorrorTitle>
        ) : (
          <Title style={{ marginTop: 8 }}>{info.game.name}</Title>
        )}
        <T muted size={15} lh={1.35} style={{ marginTop: 8 }}>
          You are <T w={700}>{info.label}</T>. Read this, set the space up, then tap ready. The clock and the cameras start only when everyone is in.
        </T>
        {motion === 'ask' && (
          <Button
            variant="secondary"
            small
            title={r.zone ? 'Enable motion & compass' : 'Enable motion sensors'}
            style={{ marginTop: 16 }}
            onPress={() => {
              Synth.unlock();
              requestMotion();
            }}
          />
        )}
        {view.monetized && r.hunt && r.participants.includes(view.me) && !r.ready[view.me] && <Boost view={view} intent={intent} />}
        <RulesSections view={view} setupFirst />
      </ScrollView>
      <ReadyBar view={view} intent={intent} />
      {!agreed && <SafetyGate extra={safetyNote(r, info.game)} onAgree={() => setAgreed(true)} />}
    </View>
  );
}
