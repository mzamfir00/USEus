import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, Share, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import QRCode from 'react-native-qrcode-svg';
import { Share2, X } from 'lucide-react-native';
import { DNA_STYLES, dnaInfo } from '../../core';
import { errorText } from '../../hooks/useRoom';
import { inviteUrl } from '../../lib/platform';
import { buzz, haptic, Synth } from '../../lib/sound';
import { useTheme } from '../../theme';
import GameScreen, { ReviewScreen } from '../game/GameScreen';
import Intro from '../game/Intro';
import { confirm } from '../game/shared';
import { useNow } from '../helpers';
import { useBlocked } from '../Moderation';
import { Button, Card, Divided, Eyebrow, Hazard, IconButton, LevelDots, Sheet, T, Title } from '../primitives';
import Lobby from './Lobby';
import Results from './Results';

function InviteSheet({ code, onClose }) {
  const link = inviteUrl(code);
  return (
    <Sheet title="Invite friends" onClose={onClose} testID="invite-sheet">
      <View style={{ alignSelf: 'center', borderRadius: 24, backgroundColor: '#fff', padding: 16 }} accessibilityLabel={`QR code for room ${code}`}>
        <QRCode value={link} size={228} color="#000" backgroundColor="#fff" quietZone={4} />
      </View>
      <T size={44} w={700} ls={6} tnum center style={{ marginTop: 24 }} testID="invite-code">
        {code}
      </T>
      <T muted size={14} center style={{ marginTop: 4 }}>
        Friends scan the code or enter it in Play.
      </T>
      <Button
        icon={Share2}
        title="Share invite link"
        style={{ marginTop: 24 }}
        onPress={() => Share.share({ title: 'USEus', message: `Join my USEus room: ${code}\n${link}`, url: link }).catch(() => {})}
        testID="share-invite"
      />
    </Sheet>
  );
}

function DnaSheet({ info, onClose }) {
  return (
    <Sheet title="Room DNA" onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Eyebrow>Level {info.stage} of 3</Eyebrow>
          <Title size={26} style={{ marginTop: 4 }}>
            {DNA_STYLES[info.style].name}
          </Title>
        </View>
        <LevelDots stage={info.stage} />
      </View>
      <T muted size={14.5} lh={1.5} style={{ marginTop: 12 }}>
        {DNA_STYLES[info.style].motto}
      </T>
      <Card style={{ marginTop: 24 }}>
        <Divided>
          {['auteur', 'dossier', 'kinetic'].map((id) => (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
              <T size={15} w={500}>
                {DNA_STYLES[id].name}
              </T>
              <T muted size={13}>
                {id === 'auteur' ? 'Indoor · Supermarket' : id === 'dossier' ? 'Park · City streets' : 'Roadtrip'}
              </T>
            </View>
          ))}
        </Divided>
      </Card>
      <T muted size={13} lh={1.5} style={{ marginTop: 16 }}>
        Every finished round evolves the room. The arena you play most decides its style. Players unlock each style for their profile.
      </T>
    </Sheet>
  );
}

function Evolution({ info, onDone }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    Synth.success();
    haptic.success();
    buzz([30, 40, 80]);
    const timer = setTimeout(() => done.current(), 2800);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <Pressable onPress={onDone} style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }} testID="evolution">
        <T size={14} w={500} color="rgba(0,0,0,0.5)">
          Room evolved
        </T>
        <T size={64} w={700} ls={-2.5} color="#000" style={{ marginTop: 12 }}>
          Level {info.stage}
        </T>
        <T size={22} w={600} color="#000" style={{ marginTop: 12 }}>
          {DNA_STYLES[info.style].name}
        </T>
      </Pressable>
    </Modal>
  );
}

// Last-5-seconds beeps on every phone (not for the bomb, whose fuse is secret).
function useTimerAlerts(view, serverNow) {
  const prev = useRef(null);
  useEffect(() => {
    if (view?.phase !== 'round' || view.round.game === 'hot_potato') return undefined;
    const id = setInterval(() => {
      const now = serverNow();
      if (view.round.stage !== 'live' || now < view.round.startsAt) return;
      const secs = Math.ceil(Math.max(0, view.round.endsAt - now) / 1000);
      if (prev.current !== null && secs !== prev.current) {
        if (secs <= 5 && secs > 0) {
          Synth.beep(secs <= 2);
          haptic.tick();
        }
        if (secs === 0 && prev.current > 0) {
          Synth.alarm();
          buzz([200, 80, 200]);
        }
      }
      prev.current = secs;
    }, 200);
    return () => clearInterval(id);
  }, [view, serverNow]);
}

function Status({ title, body, busy, onLeave }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 96, paddingHorizontal: 24 }} testID="room-status">
      {busy && <ActivityIndicator size="large" color={t.c.fg} style={{ marginBottom: 24 }} />}
      <Title size={24} style={{ textAlign: 'center' }}>
        {title}
      </Title>
      {body ? (
        <T muted size={15} lh={1.35} center style={{ marginTop: 8, maxWidth: 300 }}>
          {body}
        </T>
      ) : null}
      {!busy && <Button variant="secondary" title="Back" onPress={onLeave} style={{ marginTop: 32, paddingHorizontal: 32 }} testID="status-back" />}
    </View>
  );
}

export default function Room({ room, code, onLeave }) {
  useKeepAwake(); // lobby, rounds and results keep the screen on
  const t = useTheme();
  const { status, view: rawView, media, error, serverNow, intent, role } = room;
  // Players this phone blocked are shown as "Blocked player" everywhere in the room.
  const blocked = useBlocked();
  const view = useMemo(() => {
    if (!rawView || !Object.keys(blocked).length) return rawView;
    return {
      ...rawView,
      players: rawView.players.map((p) => (blocked[p.username] && p.id !== rawView.me ? { ...p, name: 'Blocked player', blocked: true } : p)),
    };
  }, [rawView, blocked]);
  const [sheet, setSheet] = useState(null); // invite | dna
  const [evolved, setEvolved] = useState(null);
  useNow(view?.phase === 'round' ? 250 : 5000);
  const lastDna = useRef(null);
  const info = dnaInfo(view?.dna);
  useTimerAlerts(view, serverNow);

  useEffect(() => {
    if (!view) return;
    const sig = `${info.stage}:${info.style}`;
    if (lastDna.current && lastDna.current !== sig && info.stage > 0) setEvolved(info);
    lastDna.current = sig;
  }, [view, info]);

  const live = view && (status === 'live' || status === 'reconnecting');
  const roomCode = view?.code || code;
  const isHost = role === 'host';
  const askLeave = () =>
    live ? confirm(isHost ? 'Close the room?' : 'Leave this room?', isHost ? 'Leaving closes the room for everyone.' : 'You can rejoin with the room code.', onLeave) : onLeave();

  // Android back: leave (with confirmation) instead of closing the app mid-room.
  const leaveRef = useRef(askLeave);
  leaveRef.current = askLeave;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const inGame = live && view.phase === 'round' && view.round.stage !== 'brief' && serverNow() >= view.round.startsAt;
  if (inGame) {
    return <GameScreen key={view.round.spinId} view={view} serverNow={serverNow} intent={intent} media={media} onLeave={onLeave} />;
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']} testID="room">
      <View style={{ paddingHorizontal: 24, paddingBottom: 12, paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton icon={X} label="Leave room" onPress={askLeave} testID="leave-room" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T size={15} w={600}>
              {roomCode ? `Room ${roomCode}` : 'Room'}
            </T>
            <T muted size={12} testID="room-connection">
              {status === 'live' ? (isHost ? 'You’re hosting' : 'Connected') : status === 'reconnecting' ? 'Reconnecting…' : ' '}
            </T>
          </View>
          {live ? (
            <TouchableOpacity
              onPress={() => setSheet('dna')}
              accessibilityLabel="Room DNA"
              style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.c.border, backgroundColor: t.c.card, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <LevelDots stage={info.stage} />
              <T size={13}>{DNA_STYLES[info.style].short}</T>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
        {live && <Hazard style={{ marginTop: 12 }} />}
      </View>

      {status === 'connecting' && <Status busy title={isHost ? 'Creating room' : `Joining room ${code}`} body={isHost ? null : 'Connecting to the host’s phone…'} />}
      {status === 'error' && <Status title="Couldn’t connect" body={error || errorText()} onLeave={onLeave} />}
      {status === 'ended' && <Status title="Room closed" body="The host has ended this room." onLeave={onLeave} />}
      {status === 'kicked' && <Status title="Removed from room" body="The host removed you from this room." onLeave={onLeave} />}

      {live && (
        <View style={{ flex: 1, paddingTop: 8 }}>
          {view.phase === 'lobby' && <Lobby view={view} intent={intent} onInvite={() => setSheet('invite')} />}
          {view.phase === 'round' && <Intro key={view.round.spinId} view={view} serverNow={serverNow} intent={intent} />}
          {view.phase === 'review' && <ReviewScreen view={view} intent={intent} media={media} />}
          {view.phase === 'results' && <Results key={view.round.spinId} view={view} intent={intent} media={media} />}
        </View>
      )}

      {sheet === 'invite' && roomCode && <InviteSheet code={roomCode} onClose={() => setSheet(null)} />}
      {sheet === 'dna' && <DnaSheet info={info} onClose={() => setSheet(null)} />}
      {evolved && <Evolution info={evolved} onDone={() => setEvolved(null)} />}
    </SafeAreaView>
  );
}
