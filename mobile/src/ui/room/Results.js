import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResizeMode, Video } from 'expo-av';
import { Download, Radar, Share2, Siren } from 'lucide-react-native';
import { ARENAS, GAMES, XP } from '../../core';
import { downloadClip, shareClip, useClips } from '../../lib/clips';
import { buzz, haptic, Synth } from '../../lib/sound';
import { useTheme } from '../../theme';
import { roundKeyOf } from '../game/GameScreen';
import Photo from '../game/Photo';
import { nameOf } from '../game/shared';
import TacticalMap from '../game/zone/TacticalMap';
import { formatTime, useLater } from '../helpers';
import { Avatar, Button, Card, Divided, Eyebrow, LiveDot, SectionLabel, T, Title } from '../primitives';

const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

// Photos taken by players this phone blocked are never shown.
const hidden = (view, id) => !!view.players.find((p) => p.id === id)?.blocked;

function TextCard({ children, style }) {
  return (
    <Card style={style} inner={{ padding: 20 }}>
      {typeof children === 'string' ? <T size={14.5}>{children}</T> : children}
    </Card>
  );
}

function PhotoStrip({ items, width = 120, media, view, caption }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24, marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
      {items.map((p) => (
        <Card key={p.id} style={{ width }}>
          <View style={{ aspectRatio: 9 / 16, backgroundColor: '#000' }}>{media[p.id] && !hidden(view, p.by) ? <Photo uri={media[p.id]} /> : null}</View>
          <View style={{ padding: 10 }}>{caption(p)}</View>
        </Card>
      ))}
    </ScrollView>
  );
}

function Reveal({ view, media }) {
  const res = view.results;
  const rv = res.reveal || {};
  const names = (ids, sep = ', ') => ids.map((id) => nameOf(view, id)).join(sep);
  switch (res.game) {
    case 'undercover':
      return (
        <TextCard>
          <Eyebrow>The undercover saboteur was</Eyebrow>
          <Title size={24} style={{ marginTop: 4 }}>
            {nameOf(view, rv.saboteur)}
          </Title>
          <View style={{ marginTop: 12, gap: 6 }}>
            {rv.tasks.map((task, i) => (
              <T key={task} size={14.5} muted={!rv.done.includes(i)} style={rv.done.includes(i) ? null : { textDecorationLine: 'line-through' }}>
                {rv.done.includes(i) ? '✓' : '·'} {task}
              </T>
            ))}
          </View>
        </TextCard>
      );
    case 'paparazzi':
      return rv.shots.length ? (
        <PhotoStrip
          items={rv.shots}
          width={150}
          media={media}
          view={view}
          caption={(s) => (
            <>
              <T size={12.5} w={600}>
                {s.valid ? 'Clean hit' : 'Spotted'}
              </T>
              <T muted size={12.5} numberOfLines={1}>
                {nameOf(view, s.by).split(' ')[0]} → {nameOf(view, s.target).split(' ')[0]}
              </T>
            </>
          )}
        />
      ) : null;
    case 'red_light':
      return rv.out.length ? <TextCard>{`Out: ${names(rv.out)}`}</TextCard> : null;
    case 'hot_potato':
      return <TextCard>{`${rv.passes} passes before it blew.`}</TextCard>;
    case 'floor_lava':
      return (
        <>
          <Card>
            <Divided>
              {Object.entries(rv.lava || {}).map(([id, t]) => (
                <View key={id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
                  <T size={14.5} w={500}>
                    {nameOf(view, id)}
                  </T>
                  <T muted size={14.5}>
                    {t.safe} safe · {t.burned} burned
                  </T>
                </View>
              ))}
            </Divided>
          </Card>
          {rv.proofs?.length > 0 && (
            <PhotoStrip
              items={rv.proofs}
              media={media}
              view={view}
              caption={(p) => (
                <>
                  <T size={12} w={600}>
                    {p.safe ? 'Safe' : 'Burned'}
                  </T>
                  <T muted size={12} numberOfLines={1}>
                    {nameOf(view, p.by).split(' ')[0]} · call {p.n}
                  </T>
                </>
              )}
            />
          )}
        </>
      );
    case 'hide_seek':
      return rv.found?.length ? <TextCard>{`Found: ${names(rv.found)}`}</TextCard> : null;
    case 'sardines':
      return rv.packed?.length ? <TextCard>{`Squeezed in: ${names(rv.packed, ' → ')}`}</TextCard> : null;
    case 'zombie_tag':
      return <TextCard>{`Horde: ${names(rv.zombies, ' → ')}`}</TextCard>;
    case 'marco_polo':
      return rv.tagged?.length ? <TextCard>{`Tagged: ${names(rv.tagged)}`}</TextCard> : null;
    case 'midnight_man':
      return (
        <TextCard>
          <T size={14.5}>
            {rv.blown} candle{rv.blown === 1 ? '' : 's'} blown out
            {rv.caught.length ? ` · taken: ${names(rv.caught)}` : ''}
          </T>
          {Object.keys(rv.exposures).length > 0 && (
            <T muted size={14.5} style={{ marginTop: 4 }}>
              Exposed:{' '}
              {Object.entries(rv.exposures)
                .map(([id, n]) => `${nameOf(view, id)} ×${n}`)
                .join(', ')}
            </T>
          )}
        </TextCard>
      );
    case 'weeping_statue':
      return (
        <TextCard>
          <T size={14.5}>{rv.tagged.length ? `Tagged: ${names(rv.tagged)}` : 'Nobody was tagged.'}</T>
          {rv.moves > 0 && (
            <T muted size={14.5} style={{ marginTop: 4 }}>
              The Statue moved in the light ×{rv.moves}
            </T>
          )}
        </TextCard>
      );
    case 'daruma': {
      const shots = (rv.shots || []).filter((p) => media[p.id] && !hidden(view, p.by));
      return (
        <>
          <TextCard>{`${rv.freezes} TOMARE call${rv.freezes === 1 ? '' : 's'}${rv.caught.length ? ` · caught: ${names(rv.caught)}` : ''}`}</TextCard>
          {shots.length > 0 && (
            <PhotoStrip
              items={shots}
              media={media}
              view={view}
              caption={(p) => (
                <T size={12} w={600} numberOfLines={1}>
                  TOMARE · {nameOf(view, p.by).split(' ')[0]}
                </T>
              )}
            />
          )}
        </>
      );
    }
    case 'dead_silence':
      return (
        <TextCard>
          <T size={14.5}>{rv.caught.length ? `Caught: ${names(rv.caught)}` : 'Nobody was caught.'}</T>
          {Object.keys(rv.noise).length > 0 && (
            <T muted size={14.5} style={{ marginTop: 4 }}>
              Noises:{' '}
              {Object.entries(rv.noise)
                .map(([id, n]) => `${nameOf(view, id)} ×${n}`)
                .join(', ')}
            </T>
          )}
        </TextCard>
      );
    case 'doppelganger':
      return (
        <TextCard>
          <Eyebrow>The Doppelgänger was</Eyebrow>
          <Title size={24} style={{ marginTop: 4 }}>
            {nameOf(view, rv.doppelganger)}
          </Title>
          {rv.taken.length > 0 && (
            <T size={14.5} style={{ marginTop: 8 }}>
              Taken in the dark: {names(rv.taken)}
            </T>
          )}
          {rv.banished.length > 0 && (
            <T muted size={14.5} style={{ marginTop: 4 }}>
              Innocents voted out: {names(rv.banished)}
            </T>
          )}
        </TextCard>
      );
    default:
      return null;
  }
}

// Snitch Protocol summary: who stopped filming and what it cost them.
function Strikes({ view }) {
  const t = useTheme();
  const strikes = Object.entries(view.results.reveal?.strikes || {}).filter(([, n]) => n > 0);
  if (!strikes.length) return null;
  return (
    <TextCard style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Siren size={13} color={t.c.muted} />
        <Eyebrow>Snitch Protocol</Eyebrow>
      </View>
      <View style={{ marginTop: 8, gap: 4 }}>
        {strikes.map(([id, n]) => (
          <View key={id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={14.5}>
              {nameOf(view, id)} stopped filming ×{n}
            </T>
            <T muted size={14.5} tnum>
              {n * XP.strike} XP
            </T>
          </View>
        ))}
      </View>
    </TextCard>
  );
}

// GPS Playzone replay: the zone, everyone's movement trail, radar pings and penalties.
function ZoneSummary({ view }) {
  const t = useTheme();
  const z = view.results.reveal?.zone;
  if (!z) return null;
  const hunters = new Set(z.hunters);
  const trails = Object.entries(z.trails).map(([id, pts]) => ({ key: id, pts, hunter: hunters.has(id), label: initials(nameOf(view, id)) }));
  const pins = [];
  z.radar.forEach((e) => e.lat != null && pins.push({ key: e.id, kind: 'radar', lat: e.lat, lng: e.lng }));
  z.outs.forEach((o, i) => o.lat != null && pins.push({ key: `out${i}`, kind: 'out', lat: o.lat, lng: o.lng }));
  if (z.drop) pins.push({ key: 'drop', kind: 'drop', lat: z.drop.lat, lng: z.drop.lng });
  const events = [
    ...z.radar.map((e) =>
      e.by
        ? { at: e.at, text: `${nameOf(view, e.by)} used radar · ${e.seen} hider${e.seen === 1 ? '' : 's'} exposed${e.decoys.length ? ` · ${e.decoys.length} decoy` : ''}`, xp: XP.radarPing }
        : { at: e.at, text: `${nameOf(view, e.decoys[0])} sent a decoy signal` }
    ),
    ...z.outs.map((o) => ({ at: o.at, text: `${nameOf(view, o.id)} left the zone · position revealed`, xp: XP.zoneOut })),
    ...(z.drop?.claimedBy ? [{ at: z.drop.claimedAt, text: `${nameOf(view, z.drop.claimedBy)} grabbed the supply drop`, xp: XP.supplyDrop }] : []),
  ].sort((a, b) => a.at - b.at);

  return (
    <>
      <SectionLabel>Playzone replay</SectionLabel>
      <Card testID="zone-summary">
        <View style={{ height: 288, backgroundColor: '#000' }}>
          <TacticalMap center={z.center} radius={z.finalRadius} fitRadius={z.radius} rings={z.finalRadius < z.radius ? [{ r: z.radius, faint: true }] : []} trails={trails} pins={pins} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, borderBottomWidth: 1, borderBottomColor: t.c.border, paddingHorizontal: 20, paddingVertical: 10 }}>
          <T muted size={12}>
            {z.radius} m zone{z.finalRadius < z.radius ? ` → ${z.finalRadius} m` : ''}
          </T>
          {z.hunt && (
            <T muted size={12}>
              Solid trail = hunter · dotted = hiders
            </T>
          )}
          {z.radar.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Radar size={12} color={t.c.muted} />
              <T muted size={12}>
                = radar ping
              </T>
            </View>
          )}
        </View>
        {events.length > 0 ? (
          <Divided>
            {events.map((e, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
                <T size={13.5} style={{ flex: 1 }}>
                  {e.text}
                </T>
                {e.xp ? (
                  <T muted size={13.5} tnum>
                    {e.xp > 0 ? '+' : ''}
                    {e.xp} XP
                  </T>
                ) : null}
              </View>
            ))}
          </Divided>
        ) : (
          <T muted size={13.5} style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            Clean round: nobody left the zone.
          </T>
        )}
      </Card>
    </>
  );
}

function Clips({ roundKey }) {
  const clips = useClips(roundKey);
  const later = useLater();
  const [note, setNote] = useState('');
  if (!clips.length) return null;
  return (
    <>
      <SectionLabel>Your clips from this round</SectionLabel>
      <View style={{ gap: 12 }}>
        {clips.map((c) => (
          <Card key={c.id} testID="clip">
            <Video source={{ uri: c.uri }} useNativeControls resizeMode={ResizeMode.CONTAIN} style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 460, backgroundColor: '#000' }} />
            <View style={{ padding: 12 }}>
              <T size={14} w={600} numberOfLines={1}>
                {c.title}
              </T>
              <T muted size={12.5}>
                {formatTime(c.durationMs)} · MP4
              </T>
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button small icon={Share2} title="Share" onPress={() => shareClip(c)} accessibilityLabel="Share video" />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    small
                    variant="secondary"
                    icon={Download}
                    title="Save"
                    accessibilityLabel="Save video"
                    onPress={async () => {
                      const where = await downloadClip(c);
                      if (where) {
                        setNote(where);
                        later(() => setNote(''), 3500);
                      }
                    }}
                  />
                </View>
              </View>
            </View>
          </Card>
        ))}
      </View>
      {note ? (
        <T muted size={13} center style={{ marginTop: 8 }}>
          {note}
        </T>
      ) : null}
      <T muted size={12} center style={{ marginTop: 8 }}>
        Share straight to TikTok, Instagram Reels or WhatsApp.
      </T>
    </>
  );
}

export default function Results({ view, intent, media }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const isHost = view.hostId === view.me;
  const res = view.results;
  const r = view.round;
  const won = res.winners.includes(view.me);

  useEffect(() => {
    if (res.game === 'hot_potato') {
      Synth.boom();
      buzz([400, 100, 200]);
    } else if (won) {
      Synth.success();
      haptic.success();
    } else {
      Synth.fail();
      haptic.error();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.roundKey]);

  const ranked = [...view.players].sort((a, b) => b.xp - a.xp);
  return (
    <View style={{ flex: 1 }} testID="results">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 170 }}>
        <View style={{ paddingTop: 24 }}>
          <Eyebrow>
            {GAMES[res.game]?.name || 'Round'} · {res.location || ARENAS[r.arena]?.full || ''}
          </Eyebrow>
          <Title style={{ marginTop: 8 }} testID="headline">
            {res.headline}
          </Title>
          <T muted size={15} style={{ marginTop: 8 }}>
            {won ? 'You’re on the winning side.' : 'Not your round.'}
          </T>
        </View>

        <View style={{ marginTop: 24 }}>
          <Reveal view={view} media={media} />
        </View>
        <Strikes view={view} />
        <ZoneSummary view={view} />

        {res.evolved && (
          <Card style={{ marginTop: 12 }} inner={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 }}>
            <T size={15} w={600}>
              Room evolved
            </T>
            <T muted size={14}>
              Level {res.evolved.stage} · {res.evolved.name}
            </T>
          </Card>
        )}

        <Clips roundKey={roundKeyOf(view)} />

        <SectionLabel>Leaderboard</SectionLabel>
        <Card testID="leaderboard">
          <Divided>
            {ranked.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 }}>
                <T muted size={14} tnum style={{ width: 16 }}>
                  {i + 1}
                </T>
                <Avatar name={p.name} size={34} inverted={p.id === view.me} />
                <T size={15.5} w={600} numberOfLines={1} style={{ flex: 1 }}>
                  {p.name}
                </T>
                {res.deltas[p.id] ? (
                  <T muted size={13} tnum>
                    {res.deltas[p.id] > 0 ? '+' : ''}
                    {res.deltas[p.id]}
                  </T>
                ) : null}
                <T size={15.5} w={600} tnum style={{ width: 64, textAlign: 'right' }}>
                  {p.xp}
                </T>
              </View>
            ))}
          </Divided>
        </Card>
      </ScrollView>

      <LinearGradient colors={['transparent', t.c.bg, t.c.bg]} locations={[0, 0.35, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 40, paddingHorizontal: 24, paddingBottom: 16 + insets.bottom }}>
        {isHost ? (
          <>
            <Button title={view.settings.mode === 'random' ? 'Spin again' : `Play ${GAMES[view.settings.game]?.name || 'it'} again`} onPress={() => intent({ type: 'start' })} testID="play-again" />
            <Button variant="ghost" title="Change arena or game" color={t.c.muted} onPress={() => intent({ type: 'lobby' })} style={{ marginTop: 4, minHeight: 44 }} testID="to-lobby" />
          </>
        ) : (
          <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <LiveDot />
            <T muted size={15}>
              Waiting for the host
            </T>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
