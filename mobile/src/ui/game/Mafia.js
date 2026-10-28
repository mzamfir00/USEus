// Mafia: The AI Storyteller Edition — the in-game screen every phone shows. The host's engine
// drives the night → morning → debate → vote cycle; the Storyteller phone reads each step out
// loud; at night every screen is pitch black except the role being called, which gets a dim
// target list.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Moon, Volume2 } from 'lucide-react-native';
import { mafiaAlive, stepText, storytellerOf } from '../../core';
import { haptic, Synth } from '../../lib/sound';
import { narrate, stopNarration } from '../../lib/storyteller';
import { formatTime, useNow } from '../helpers';
import { SERIF } from '../../theme';
import { Avatar, Button, T } from '../primitives';
import Camera from './Camera';
import { RoleCard, roleTitle } from './MafiaBriefing';
import { GameShell, nameOf, userOf } from './shared';

const NIGHT = new Set(['dusk', 'mafia', 'mafiaSleep', 'doctor', 'doctorSleep', 'detective', 'detectiveSleep']);
const DIM = '#8a8a8a';
const DIMMER = '#3c3c3c';

// The Storyteller phone reads every step out loud at the host's scheduled moment.
function useStoryteller(view, serverNow) {
  const d = view.round.data;
  const step = d.step;
  const voice = storytellerOf(view) === view.me;
  const said = useRef(null);
  useEffect(() => {
    if (!voice || !step || said.current === step.id) return undefined;
    said.current = step.id;
    const wait = step.sayAt - serverNow();
    if (wait < -8000) return undefined; // joined late: never read an old line
    const text = stepText(step, d.lang);
    const timer = setTimeout(() => narrate(text, d.lang), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [voice, step?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopNarration(), []);
  return voice;
}

/* ---------------------------------- night --------------------------------- */

function Sleep({ voice, n }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]} testID="night-screen">
      <Moon size={22} color={DIMMER} />
      <T size={12.5} w={700} ls={2} color={DIMMER} center style={{ marginTop: 12 }}>
        NIGHT TIME — CLOSE YOUR EYES
      </T>
      <T size={11} color="#262626" style={{ marginTop: 6 }}>
        Night {n}
      </T>
      {voice && (
        <View style={{ position: 'absolute', bottom: 48, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Volume2 size={12} color="#262626" />
          <T size={11} color="#262626">
            Storyteller phone · volume up
          </T>
        </View>
      )}
    </View>
  );
}

// Dim, monochrome target list for the role that's awake.
function NightPicker({ title, sub, ids, view, selected, onSelect, marks = {}, action, onAction, actionDisabled, deadline, serverNow, testID }) {
  const insets = useSafeAreaInsets();
  const left = deadline ? Math.max(0, Math.ceil((deadline - serverNow()) / 1000)) : null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', paddingTop: insets.top + 28, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }]} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T size={13} w={800} ls={1.6} color={DIM}>
          {title}
        </T>
        {left != null && (
          <T size={13} w={700} tnum color={DIM} testID="night-timer">
            {left}s
          </T>
        )}
      </View>
      <T size={13} color="#5a5a5a" lh={1.35} style={{ marginTop: 6 }}>
        {sub}
      </T>
      <ScrollView style={{ flex: 1, marginTop: 16 }} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
        {ids.map((id) => {
          const on = selected === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => onSelect(id)}
              activeOpacity={0.7}
              accessibilityLabel={`Choose ${nameOf(view, id)}`}
              testID={`night-pick-${userOf(view, id)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: on ? '#8a8a8a' : '#1f1f1f', backgroundColor: on ? '#141414' : '#050505', paddingHorizontal: 16, paddingVertical: 14 }}
            >
              <T size={16} w={on ? 700 : 500} color={on ? '#c4c4c4' : DIM} style={{ flex: 1 }} numberOfLines={1}>
                {nameOf(view, id)}
                {id === view.me ? ' (you)' : ''}
              </T>
              {marks[id] ? (
                <T size={11.5} w={600} color="#6a6a6a">
                  {marks[id]}
                </T>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        onPress={onAction}
        disabled={actionDisabled}
        accessibilityRole="button"
        testID="night-action"
        style={{ height: 52, borderRadius: 999, borderWidth: 1, borderColor: actionDisabled ? '#1f1f1f' : '#6a6a6a', backgroundColor: actionDisabled ? '#000' : '#141414', alignItems: 'center', justifyContent: 'center' }}
      >
        <T size={14} w={800} ls={1.2} color={actionDisabled ? '#3a3a3a' : '#c4c4c4'}>
          {action}
        </T>
      </TouchableOpacity>
    </View>
  );
}

function MafiaTurn({ view, serverNow, intent }) {
  const mine = view.mine;
  const team = mine.team || [view.me];
  const ids = mafiaAlive(view.round).filter((id) => !team.includes(id));
  const picks = mine.picks || {};
  const marks = {};
  team
    .filter((id) => id !== view.me && picks[id])
    .forEach((id) => {
      marks[picks[id]] = `${nameOf(view, id).split(' ')[0]}${mine.locked?.[id] ? ' ✓' : ''}`;
    });
  const locked = !!mine.locked?.[view.me];
  const partners = team.filter((id) => id !== view.me && !view.round.data.dead[id]);
  return (
    <NightPicker
      testID="mafia-turn"
      view={view}
      serverNow={serverNow}
      deadline={mine.deadline}
      title="🔪 MAFIA · CHOOSE YOUR TARGET"
      sub={partners.length ? `Agree with ${partners.map((id) => nameOf(view, id).split(' ')[0]).join(' & ')}: you all have to confirm the same name.` : 'Tap a player, then confirm. Stay silent.'}
      ids={ids}
      selected={picks[view.me]}
      marks={marks}
      onSelect={(id) => intent({ type: 'mafiaPick', id })}
      action={locked ? 'LOCKED · WAITING FOR YOUR PARTNER' : picks[view.me] ? `CONFIRM: ${nameOf(view, picks[view.me]).toUpperCase()}` : 'TAP A PLAYER'}
      actionDisabled={locked || !picks[view.me]}
      onAction={() => intent({ type: 'mafiaConfirm' })}
    />
  );
}

function SaveOrCheck({ view, serverNow, intent, role }) {
  const [sel, setSel] = useState(null);
  const doctor = role === 'doctor';
  const ids = mafiaAlive(view.round).filter((id) => doctor || id !== view.me);
  return (
    <NightPicker
      testID={`${role}-turn`}
      view={view}
      serverNow={serverNow}
      deadline={view.mine.deadline}
      title={doctor ? '🩺 DOCTOR · WHO DO YOU SAVE?' : '🕵️ DETECTIVE · WHO DO YOU CHECK?'}
      sub={doctor ? 'Tap one player — yourself included — to protect them tonight.' : 'Tap one player to see, only on your screen, if they are Mafia.'}
      ids={ids}
      selected={sel}
      onSelect={setSel}
      action={sel ? `${doctor ? 'PROTECT' : 'INVESTIGATE'}: ${nameOf(view, sel).toUpperCase()}` : 'TAP A PLAYER'}
      actionDisabled={!sel}
      onAction={() => intent({ type: doctor ? 'mafiaProtect' : 'mafiaCheck', id: sel })}
    />
  );
}

function Verdict({ view, verdict }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]} testID="detective-verdict">
      <T size={13} w={700} ls={1.6} color={DIM}>
        {nameOf(view, verdict.id).toUpperCase()} IS
      </T>
      <T size={44} w={800} ls={-1} color="#fff" center style={{ marginTop: 12 }} testID="verdict-text">
        {verdict.mafia ? '[🔪 MAFIA]' : '[✅ INNOCENT]'}
      </T>
      <T size={12.5} color="#5a5a5a" style={{ marginTop: 16 }}>
        Remember it. Your screen goes dark in a moment.
      </T>
    </View>
  );
}

function Night({ view, serverNow, intent, kind, voice }) {
  const d = view.round.data;
  const mine = view.mine || {};
  const awake = !d.dead[view.me];
  const now = serverNow();
  let turn = null;
  if (awake && kind === 'mafia' && mine.role === 'mafia' && !mine.target) turn = 'mafia';
  if (awake && kind === 'doctor' && mine.role === 'doctor' && !mine.picked) turn = 'doctor';
  if (awake && kind === 'detective' && mine.role === 'detective' && !mine.picked) turn = 'detective';
  const verdict = kind === 'detective' && mine.verdict && mine.verdict.until > now ? mine.verdict : null;

  // Only the role being called feels its phone wake up.
  const woke = useRef(null);
  useEffect(() => {
    if (turn && woke.current !== d.step.id) {
      woke.current = d.step.id;
      haptic.wake();
    }
  }, [turn, d.step?.id]);

  if (verdict) return <Verdict view={view} verdict={verdict} />;
  if (turn === 'mafia') return <MafiaTurn view={view} serverNow={serverNow} intent={intent} />;
  if (turn) return <SaveOrCheck key={d.step.id} view={view} serverNow={serverNow} intent={intent} role={turn} />;
  return <Sleep voice={voice} n={d.n} />;
}

/* ----------------------------------- day ---------------------------------- */

function Page({ children, light = false, testID }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: light ? '#f4f4f1' : '#000' }} contentContainerStyle={{ paddingTop: insets.top + 76, paddingHorizontal: 22, paddingBottom: insets.bottom + 40 }} testID={testID}>
      {children}
    </ScrollView>
  );
}

function Roster({ view }) {
  const d = view.round.data;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {view.round.participants.map((id) => {
        const out = !!d.dead[id];
        return (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: out ? '#1f1f1f' : '#3a3a3a', paddingLeft: 4, paddingRight: 12, paddingVertical: 4, opacity: out ? 0.45 : 1 }}>
            <Avatar name={nameOf(view, id)} size={24} inverted={id === view.me} />
            <T size={13} w={500} color="#fff" style={out ? { textDecorationLine: 'line-through' } : null}>
              {nameOf(view, id).split(' ')[0]}
            </T>
            {out ? (
              <T size={11} color={DIM}>
                👻
              </T>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Morning({ view }) {
  const d = view.round.data;
  const rep = d.report || {};
  const mine = rep.victim === view.me;
  const ink = '#111';
  const headline = rep.victim ? `${nameOf(view, rep.victim).toUpperCase()} WAS ELIMINATED LAST NIGHT` : rep.saved ? 'THE DOCTOR SAVED A LIFE' : 'A QUIET NIGHT IN THE CITY';
  const body = rep.victim
    ? `The Mafia struck while the city slept. @${userOf(view, rep.victim)} is out of the game.`
    : rep.saved
      ? 'The Mafia tried to strike, but the Doctor got there just in time. Nobody died.'
      : 'Nobody was attacked. Nobody died.';
  return (
    <Page light testID="morning-report">
      <T size={11} w={700} ls={2.4} color="#555" center>
        MORNING EDITION · DAY {d.n}
      </T>
      <T size={38} color={ink} center style={{ fontFamily: SERIF, marginTop: 6 }}>
        The USEus Times
      </T>
      <View style={{ height: 3, backgroundColor: ink, marginTop: 10 }} />
      <View style={{ height: 1, backgroundColor: ink, marginTop: 3 }} />
      <T size={30} w={800} ls={-0.8} lh={1.08} color={ink} style={{ marginTop: 20 }} testID="morning-headline">
        {headline}
      </T>
      <T size={16} lh={1.45} color="#333" style={{ marginTop: 12 }}>
        {body}
      </T>
      {mine && (
        <View style={{ marginTop: 20, borderWidth: 2, borderColor: ink, padding: 16 }}>
          <T size={14} w={800} ls={0.6} color={ink}>
            👻 YOU’RE OUT — GHOST CAMERA MODE
          </T>
          <T size={14} lh={1.4} color="#333" style={{ marginTop: 6 }}>
            No talking and no voting from now on. Your phone becomes a camera: film the survivors’ reactions.
          </T>
        </View>
      )}
      <View style={{ height: 1, backgroundColor: ink, marginTop: 24 }} />
      <T size={12} w={700} ls={1.6} color="#555" style={{ marginTop: 12 }}>
        STILL STANDING · {mafiaAlive(view.round).length}
      </T>
      <T size={15} lh={1.5} color={ink} style={{ marginTop: 4 }}>
        {mafiaAlive(view.round)
          .map((id) => nameOf(view, id))
          .join(' · ')}
      </T>
    </Page>
  );
}

function Debate({ view, serverNow, intent }) {
  const d = view.round.data;
  const left = Math.max(0, (d.step.until || 0) - serverNow());
  const isHost = view.hostId === view.me;
  return (
    <Page testID="mafia-day">
      <T size={12} w={700} ls={2} color={DIM}>
        DAY {d.n} · DISCUSSION
      </T>
      <T size={84} w={800} ls={-3} tnum color="#fff" style={{ marginTop: 4, lineHeight: 92 }} testID="day-timer">
        {formatTime(left)}
      </T>
      <T size={16} lh={1.45} color="#fff">
        Who’s in the Mafia? Share what you noticed, accuse, defend. When the timer ends, everyone votes.
      </T>
      <Roster view={view} />
      {isHost && <Button title="Skip to Voting Early" onPress={() => intent({ type: 'mafiaSkip' })} style={{ marginTop: 24 }} testID="skip-to-vote" />}
      <View style={{ marginTop: 24 }}>
        <RoleCard view={view} compact />
      </View>
    </Page>
  );
}

function Ballot({ view, serverNow, intent }) {
  const d = view.round.data;
  const [sel, setSel] = useState(null);
  const alive = mafiaAlive(view.round);
  const cast = Object.keys(d.voted || {}).length;
  const voted = !!d.voted?.[view.me];
  const left = Math.max(0, (d.step.until || 0) - serverNow());
  return (
    <Page testID="mafia-ballot">
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T size={12} w={700} ls={2} color={DIM}>
          DAY {d.n} · TRIAL VOTE
        </T>
        <T size={13} w={700} tnum color={DIM}>
          {formatTime(left)}
        </T>
      </View>
      <T size={30} w={800} ls={-0.8} color="#fff" style={{ marginTop: 8 }} testID="votes-cast">
        Votes Cast: {cast}/{alive.length}
      </T>
      {voted ? (
        <T size={16} lh={1.45} color="#fff" style={{ marginTop: 16 }} testID="vote-done">
          Your vote is in. Everyone sees who voted for whom once the last ballot lands.
        </T>
      ) : (
        <>
          <T size={15} lh={1.4} color={DIM} style={{ marginTop: 8 }}>
            Tap the player you want to eliminate, then confirm — or skip.
          </T>
          <View style={{ marginTop: 16, gap: 8 }}>
            {alive
              .filter((id) => id !== view.me)
              .map((id) => {
                const on = sel === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setSel(id)}
                    activeOpacity={0.8}
                    testID={`ballot-${userOf(view, id)}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: on ? '#fff' : '#262626', backgroundColor: on ? '#fff' : '#0d0d0d', paddingHorizontal: 14, paddingVertical: 12 }}
                  >
                    <Avatar name={nameOf(view, id)} size={32} inverted={!on} />
                    <T size={16} w={600} color={on ? '#000' : '#fff'} style={{ flex: 1 }} numberOfLines={1}>
                      {nameOf(view, id)}
                    </T>
                  </TouchableOpacity>
                );
              })}
          </View>
          <Button title={sel ? `Vote to eliminate ${nameOf(view, sel).split(' ')[0]}` : 'Pick a player'} disabled={!sel} onPress={() => intent({ type: 'mafiaVote', id: sel })} style={{ marginTop: 20 }} testID="cast-vote" />
          <Button variant="secondary" title="Skip Vote (No Elimination)" onPress={() => intent({ type: 'mafiaVote', id: null })} style={{ marginTop: 10 }} testID="skip-vote" />
        </>
      )}
    </Page>
  );
}

function VoteReveal({ view }) {
  const d = view.round.data;
  const v = d.verdict || {};
  const ballots = d.ballots || {};
  return (
    <Page testID="mafia-verdict">
      <T size={12} w={700} ls={2} color={DIM}>
        THE TOWN HAS VOTED
      </T>
      {v.out ? (
        <>
          <T size={40} w={800} ls={-1.2} lh={1.05} color="#fff" style={{ marginTop: 10 }}>
            {nameOf(view, v.out)} is out
          </T>
          <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#fff', padding: 18 }}>
            <T size={11.5} w={700} ls={1.6} color="rgba(0,0,0,0.5)">
              TRUE ROLE
            </T>
            <T size={30} w={800} color="#000" style={{ marginTop: 4 }} testID="verdict-role">
              {roleTitle(v.role)}
            </T>
          </View>
        </>
      ) : (
        <>
          <T size={36} w={800} ls={-1} lh={1.05} color="#fff" style={{ marginTop: 10 }} testID="verdict-none">
            Nobody is eliminated
          </T>
          <T size={15} color={DIM} style={{ marginTop: 8 }}>
            A tie at the top, or as many skips as votes.
          </T>
        </>
      )}
      <T size={12} w={700} ls={1.6} color={DIM} style={{ marginTop: 28 }}>
        WHO VOTED FOR WHOM
      </T>
      <View style={{ marginTop: 8, borderRadius: 18, borderWidth: 1, borderColor: '#262626' }}>
        {Object.entries(ballots).map(([voter, target], i) => (
          <View key={voter} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#1a1a1a' }}>
            <T size={15} w={600} color="#fff" style={{ flex: 1 }} numberOfLines={1}>
              {nameOf(view, voter)}
            </T>
            <T size={15} color={target ? '#fff' : DIM} numberOfLines={1}>
              {target ? `→ ${nameOf(view, target)}` : 'Skipped'}
            </T>
          </View>
        ))}
      </View>
    </Page>
  );
}

function TheEnd({ view }) {
  const town = view.round.data.winner === 'town';
  useEffect(() => {
    Synth.success();
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: town ? '#fff' : '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }]} testID="mafia-end">
      <T size={44} w={800} ls={-1.4} lh={1.05} color={town ? '#000' : '#fff'} center>
        {town ? '🏆 CITIZENS WIN!' : '🔪 MAFIA WINS!'}
      </T>
      <T size={15} color={town ? 'rgba(0,0,0,0.6)' : DIM} center style={{ marginTop: 12 }}>
        Revealing every secret role…
      </T>
    </View>
  );
}

// Eliminated players: a camera to film the survivors, plus what's happening.
function GhostCam({ view, serverNow, hud, kind }) {
  const d = view.round.data;
  const insets = useSafeAreaInsets();
  const left = Math.max(0, (d.step.until || 0) - serverNow());
  const line = kind === 'vote' ? `Trial vote · Votes Cast: ${Object.keys(d.voted || {}).length}/${mafiaAlive(view.round).length}` : `Debate · ${formatTime(left)} left`;
  return (
    <Camera hud={hud} record>
      <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 110, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', padding: 16 }} testID="ghost-cam">
        <T size={13} w={800} ls={1.4} color="#fff">
          👻 GHOST CAM
        </T>
        <T size={14} lh={1.35} color="rgba(255,255,255,0.8)" style={{ marginTop: 4 }}>
          You’re out: no talking, no voting. Film the survivors’ reactions.
        </T>
        <T size={13} w={600} color="#fff" style={{ marginTop: 8 }}>
          {line}
        </T>
      </View>
    </Camera>
  );
}

export default function MafiaGame({ view, serverNow, intent, onLeave, hud }) {
  useNow(250);
  const d = view.round.data;
  const kind = d.step?.kind || 'dusk';
  const dead = !!d.dead[view.me];
  const night = NIGHT.has(kind);
  const voice = useStoryteller(view, serverNow);
  const label = dead ? 'Ghost · out of the game' : night ? `Night ${d.n}` : `Day ${d.n} · ${mafiaAlive(view.round).length} still standing`;

  let body;
  if (night) body = <Night view={view} serverNow={serverNow} intent={intent} kind={kind} voice={voice} />;
  else if (kind === 'morning') body = <Morning view={view} />;
  else if (kind === 'day') body = dead ? <GhostCam view={view} serverNow={serverNow} hud={hud} kind={kind} /> : <Debate view={view} serverNow={serverNow} intent={intent} />;
  else if (kind === 'vote') body = dead ? <GhostCam view={view} serverNow={serverNow} hud={hud} kind={kind} /> : <Ballot key={d.step.id} view={view} serverNow={serverNow} intent={intent} />;
  else if (kind === 'verdict') body = <VoteReveal view={view} />;
  else body = <TheEnd view={view} />;

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={label} onLeave={onLeave} hud={!night && kind !== 'end'} light={kind === 'morning'}>
      {body}
    </GameShell>
  );
}
