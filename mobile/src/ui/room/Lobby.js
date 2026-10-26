import React, { useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Building2, Car, Check, Crosshair, Dices, Ellipsis, Flame, House, LocateFixed, ShoppingCart, Sparkles, Target, TreePine, Trees, X } from 'lucide-react-native';
import { ARENAS, GAMES, HALLOWEEN, HUNT, ZONE_ARENAS, ZONE_RADII, gamesFor, halloweenLive, packOf } from '../../core';
import { useTheme } from '../../theme';
import HorrorFx, { Breathe, HorrorTitle, Vhs } from '../game/HorrorFx';
import TacticalMap from '../game/zone/TacticalMap';
import { PlayerActions } from '../Moderation';
import { Avatar, Button, Card, Divided, Eyebrow, Field, LiveDot, Pill, SectionLabel, Segmented, Switch, T } from '../primitives';

const ARENA_ICONS = { indoor: House, park: Trees, forest: TreePine, supermarket: ShoppingCart, streets: Building2, roadtrip: Car };
const PLACEHOLDERS = { indoor: 'Alex’s living room', park: 'Central Park', forest: 'Pine Ridge Trail', supermarket: 'Mega Image', streets: 'Old Town', roadtrip: 'Rest stop on the A1' };
const SIM_CENTER = { lat: 40.7812, lng: -73.9665 }; // simulated GPS fallback (Central Park)

async function currentPosition(timeout) {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw Object.assign(new Error('denied'), { code: 1 });
  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
  ]);
}

function Toggle({ label, sub, on, disabled, onChange }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <View style={{ flex: 1 }}>
        <T size={14.5} w={500}>
          {label}
        </T>
        <T muted size={12.5} lh={1.3}>
          {sub}
        </T>
      </View>
      <Switch value={on} onChange={onChange} disabled={disabled} label={label} />
    </View>
  );
}

// GPS Playzone: lock the arena centre with one tap, pick a radius, optional closing ring.
function ZoneSetup({ st, isHost, set }) {
  const t = useTheme();
  const z = st.zone;
  const [locking, setLocking] = useState(false);
  const [note, setNote] = useState('');
  const lock = async () => {
    setLocking(true);
    setNote('');
    try {
      const pos = await currentPosition(z.sim ? 5000 : 15000);
      set({ zone: { center: { lat: pos.coords.latitude, lng: pos.coords.longitude } } });
      setNote(`Locked to ±${Math.round(pos.coords.accuracy || 0)} m`);
    } catch (e) {
      if (z.sim) {
        set({ zone: { center: SIM_CENTER } });
        setNote('No GPS here — using a simulated centre.');
      } else setNote(e?.code === 1 ? 'Location permission denied. Allow it in Settings, or turn on simulated GPS to test indoors.' : 'No GPS fix yet. Step outside, or turn on simulated GPS to test indoors.');
    }
    setLocking(false);
  };
  const hunts = Object.keys(HUNT)
    .map((id) => GAMES[id].short)
    .join(', ');

  return (
    <>
      <SectionLabel right={<Switch value={z.on} disabled={!isHost} onChange={() => set({ zone: { on: !z.on } })} label="GPS Playzone" testID="zone-toggle" />}>GPS Playzone</SectionLabel>
      <Card inner={{ paddingHorizontal: 16, paddingTop: 16 }} testID="zone-setup">
        {!z.on ? (
          <T muted size={13.5} lh={1.35} style={{ paddingBottom: 16 }}>
            Off. Turn it on for a live GPS boundary, out-of-bounds penalties, radar pings and supply drops.
          </T>
        ) : (
          <>
            <Button
              small
              variant={z.center ? 'secondary' : 'primary'}
              icon={Crosshair}
              disabled={!isHost || locking}
              onPress={lock}
              testID="lock-center"
              title={locking ? 'Getting a GPS fix…' : z.center ? 'Re-lock arena center here' : 'Lock arena center here'}
            />
            {note || z.center ? (
              <T muted size={12.5} center style={{ marginTop: 8 }} testID="zone-center">
                {z.center ? `${z.center.lat.toFixed(5)}, ${z.center.lng.toFixed(5)}` : ''}
                {z.center && note ? ' · ' : ''}
                {note}
              </T>
            ) : null}
            {z.center && (
              <View style={{ marginTop: 12, height: 176, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: t.c.border }}>
                <TacticalMap center={z.center} radius={z.radius} interactive={false} />
              </View>
            )}
            <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ZONE_RADII.map((o) => {
                const on = z.radius === o.m;
                return (
                  <TouchableOpacity
                    key={o.m}
                    disabled={!isHost}
                    onPress={() => set({ zone: { radius: o.m } })}
                    accessibilityState={{ selected: on }}
                    style={{ width: '48.5%', borderRadius: 14, borderWidth: 1, borderColor: on ? t.c.fg : t.c.border, backgroundColor: on ? t.c.fg : 'transparent', paddingHorizontal: 12, paddingVertical: 10, opacity: !isHost && !on ? 0.4 : 1 }}
                  >
                    <T size={16} w={700} tnum color={on ? t.c.bg : t.c.fg}>
                      {o.m} m
                    </T>
                    <T size={12} color={on ? t.c.bg : t.c.muted} style={on ? { opacity: 0.7 } : null}>
                      {o.label}
                    </T>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ marginTop: 4 }}>
              <Divided>
                <Toggle label="Shrinking battle-royale ring" sub="Final 3 minutes: the zone shrinks 20% every 45 s." on={z.shrink} disabled={!isHost} onChange={(v) => set({ zone: { shrink: v } })} />
                <Toggle label="Simulated GPS" sub="Indoor testing: phones move with an on-screen pad instead of real GPS." on={z.sim} disabled={!isHost} onChange={(v) => set({ zone: { sim: v } })} />
              </Divided>
            </View>
            <T muted size={12.5} lh={1.35} style={{ borderTopWidth: 1, borderTopColor: t.c.border, paddingVertical: 12 }}>
              Every phone shares its location during the round. Radar pings, decoys, heartbeat and the supply drop play in {hunts}.
            </T>
          </>
        )}
      </Card>
    </>
  );
}

// GPS → place name with the phone's built-in geocoder, falling back to coordinates.
async function locateName() {
  const pos = await currentPosition(10000);
  const { latitude: lat, longitude: lon } = pos.coords;
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (a) {
      const place = a.name && !/^\d/.test(a.name) ? a.name : a.street;
      const area = a.district || a.subregion || a.city;
      const label = [place, area].filter(Boolean).join(', ');
      if (label) return label.slice(0, 48);
    }
  } catch (e) {
    /* offline: use coordinates */
  }
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

export default function Lobby({ view, intent, onInvite }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = view.me;
  const isHost = view.hostId === me;
  const host = view.players.find((p) => p.isHost);
  const online = view.players.filter((p) => p.connected);
  const st = view.settings;
  const [location, setLocation] = useState(st.location);
  const [actions, setActions] = useState(null); // player whose block / report / remove sheet is open
  const meP = view.players.find((p) => p.id === me);
  const [locating, setLocating] = useState(false);
  const seasonal = halloweenLive();
  const pack = st.pack === 'halloween' && seasonal ? 'halloween' : 'party';
  const fits = gamesFor(st.arena, online.length, pack);
  // A room saved by another app version may name a game this build doesn't know.
  const chosen = GAMES[st.game] || Object.values(GAMES).find((g) => packOf(g) === pack) || Object.values(GAMES)[0];
  const packGames = Object.values(GAMES).filter((g) => packOf(g) === pack);
  const set = (patch) => intent({ type: 'settings', ...patch });
  const choosePack = (id) => {
    if (id === pack) return;
    const first = Object.values(GAMES).find((g) => packOf(g) === id && g.arenas.includes(st.arena)) || Object.values(GAMES).find((g) => packOf(g) === id);
    set({ pack: id, game: first.id, starter: null });
  };
  const zoneArena = ZONE_ARENAS.includes(st.arena) && !!st.zone;
  const needsCenter = zoneArena && st.zone.on && !st.zone.center;
  const canStart = (st.mode === 'random' ? fits.length > 0 : online.length >= chosen.min) && !needsCenter;

  useEffect(() => setLocation(st.location), [st.location]);

  return (
    <View style={{ flex: 1 }} testID="lobby">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
        <TouchableOpacity onPress={onInvite} style={{ marginTop: 4, alignItems: 'center' }} accessibilityLabel="Share room code" testID="room-code">
          <Eyebrow>Room code</Eyebrow>
          <T size={64} w={700} ls={7} tnum style={{ marginTop: 4, lineHeight: 70 }}>
            {view.code}
          </T>
          <T muted size={13.5} style={{ marginTop: 8 }}>
            Tap to share or show QR
          </T>
        </TouchableOpacity>

        <SectionLabel
          right={
            <T muted size={13}>
              {online.length} here
            </T>
          }
        >
          Players
        </SectionLabel>
        <Card testID="players">
          <Divided>
            {view.players.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, opacity: p.connected ? 1 : 0.4 }}>
                <Avatar name={p.name} size={36} inverted={p.id === me} />
                <View style={{ flex: 1 }}>
                  <T size={15.5} w={600} numberOfLines={1}>
                    {p.name}
                    {p.id === me ? <T muted w={400}> (you)</T> : null}
                  </T>
                  <T muted size={13} numberOfLines={1}>
                    {p.blocked ? 'Hidden on this phone' : `@${p.username}`}
                    {p.isHost ? ' · Host' : ''}
                  </T>
                </View>
                {p.id !== me && (
                  <TouchableOpacity accessibilityLabel={`Player options for ${p.name}`} onPress={() => setActions(p)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Ellipsis size={18} color={t.c.muted} />
                  </TouchableOpacity>
                )}
                {isHost && !p.isHost && (
                  <TouchableOpacity accessibilityLabel={`Remove ${p.name}`} onPress={() => intent({ type: 'remove', id: p.id })} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <X size={17} color={t.c.muted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </Divided>
        </Card>

        <SectionLabel>{isHost ? 'Arena' : 'Arena · set by host'}</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Object.values(ARENAS).map((a) => {
            const Icon = ARENA_ICONS[a.id];
            const on = st.arena === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                disabled={!isHost}
                onPress={() => set({ arena: a.id })}
                accessibilityState={{ selected: on }}
                testID={`arena-${a.id}`}
                style={{ flexGrow: 1, flexBasis: '30%', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: 1, paddingVertical: 12, borderColor: on ? t.c.fg : t.c.border, backgroundColor: on ? t.c.fg : t.c.card, opacity: !isHost && !on ? 0.4 : 1 }}
              >
                <Icon size={19} color={on ? t.c.bg : t.c.fg} />
                <T size={11} w={500} color={on ? t.c.bg : t.c.fg}>
                  {a.label}
                </T>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
          <Field
            style={{ flex: 1, height: 48 }}
            inputStyle={{ fontSize: 15 }}
            value={location}
            editable={isHost}
            onChangeText={setLocation}
            onBlur={() => location !== st.location && set({ location })}
            onSubmitEditing={() => location !== st.location && set({ location })}
            returnKeyType="done"
            placeholder={`Exact location, e.g. ${PLACEHOLDERS[st.arena] || PLACEHOLDERS.indoor}`}
            maxLength={48}
            accessibilityLabel="Exact location name"
          />
          {isHost && (
            <TouchableOpacity
              accessibilityLabel="Use my location"
              disabled={locating}
              onPress={async () => {
                setLocating(true);
                try {
                  const name = await locateName();
                  setLocation(name);
                  set({ location: name });
                } catch (e) {
                  /* permission denied */
                }
                setLocating(false);
              }}
              style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: t.c.border, backgroundColor: t.c.card, alignItems: 'center', justifyContent: 'center', opacity: locating ? 0.5 : 1 }}
            >
              <LocateFixed size={18} color={t.c.fg} />
            </TouchableOpacity>
          )}
        </View>

        {zoneArena && <ZoneSetup st={st} isHost={isHost} set={set} />}

        <SectionLabel>Game</SectionLabel>
        <View pointerEvents={isHost ? 'auto' : 'none'} style={{ opacity: isHost ? 1 : 0.7 }}>
          <Segmented
            value={st.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'random', label: 'Random roulette', testID: 'mode-random' },
              { value: 'manual', label: 'Choose game', testID: 'mode-manual' },
            ]}
          />
        </View>

        {seasonal && (
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }} testID="packs">
            <TouchableOpacity
              disabled={!isHost}
              onPress={() => choosePack('party')}
              accessibilityState={{ selected: pack === 'party' }}
              style={{ flex: 1, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, borderColor: pack === 'party' ? t.c.fg : t.c.border, backgroundColor: pack === 'party' ? t.c.fg : t.c.card }}
            >
              <Sparkles size={17} color={pack === 'party' ? t.c.bg : t.c.fg} />
              <T size={14} w={600} color={pack === 'party' ? t.c.bg : t.c.fg} style={{ marginTop: 8 }}>
                All games
              </T>
              <T size={12} color={pack === 'party' ? t.c.bg : t.c.muted} style={pack === 'party' ? { opacity: 0.7 } : null}>
                Party & classics · 11
              </T>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!isHost}
              onPress={() => choosePack('halloween')}
              accessibilityLabel={HALLOWEEN.name}
              accessibilityState={{ selected: pack === 'halloween' }}
              testID="pack-halloween"
              style={{ flex: 1, overflow: 'hidden', borderRadius: 16, borderWidth: pack === 'halloween' ? 2 : 1, borderColor: pack === 'halloween' ? '#fff' : '#3a3a3a', backgroundColor: '#050505', paddingHorizontal: 14, paddingVertical: 12 }}
            >
              <HorrorFx />
              <Breathe>
                <Flame size={17} color="#fff" />
              </Breathe>
              <HorrorTitle size={19} style={{ marginTop: 6 }}>
                Halloween Horror
              </HorrorTitle>
              <Vhs size={10.5} color="rgba(255,255,255,0.6)" style={{ marginTop: 4 }}>
                5 rituals · until {HALLOWEEN.until}
              </Vhs>
            </TouchableOpacity>
          </View>
        )}

        {st.mode === 'random' ? (
          <Card style={{ marginTop: 12 }} inner={{ padding: 16 }}>
            <T size={14} w={500}>
              {fits.length ? `${fits.length} ${pack === 'halloween' ? 'rituals' : 'games'} fit ${ARENAS[st.arena].label.toLowerCase()}` : 'Not enough players for these games yet'}
            </T>
            <T muted size={13.5} lh={1.35} style={{ marginTop: 4 }}>
              {fits.map((g) => g.name).join(' · ')}
            </T>
          </Card>
        ) : (
          <>
            <Card style={{ marginTop: 12 }}>
              <Divided>
                {packGames.map((g) => {
                  const on = st.game === g.id;
                  const enough = online.length >= g.min;
                  const fit = g.arenas.includes(st.arena);
                  const fg = on ? t.c.bg : t.c.fg;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      disabled={!isHost}
                      activeOpacity={0.7}
                      onPress={() => set({ game: g.id, starter: null })}
                      testID={`game-${g.id}`}
                      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: on ? t.c.fg : 'transparent' }}
                    >
                      <View style={{ flex: 1 }}>
                        <T size={15.5} w={600} color={fg}>
                          {g.name}
                        </T>
                        <T size={13} lh={1.3} color={on ? t.c.bg : t.c.muted} style={[{ marginTop: 2 }, on ? { opacity: 0.7 } : null]}>
                          {g.tagline}
                        </T>
                        <T size={12} color={on ? t.c.bg : t.c.muted} style={[{ marginTop: 4 }, on ? { opacity: 0.6 } : null]}>
                          {g.min}+ players{fit ? '' : ` · best in ${g.arenas.map((a) => ARENAS[a].label).join(', ')}`}
                          {enough ? '' : ' · need more players'}
                        </T>
                      </View>
                      {on && <Check size={18} color={t.c.bg} style={{ marginTop: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </Divided>
            </Card>
            {chosen.starter && (
              <>
                <SectionLabel>{chosen.starter}</SectionLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
                  <Pill icon={Dices} label="Random" on={!st.starter} onPress={() => isHost && set({ starter: null })} />
                  {online.map((p) => (
                    <Pill key={p.id} label={p.name.split(' ')[0]} on={st.starter === p.id} onPress={() => isHost && set({ starter: p.id })} />
                  ))}
                </ScrollView>
              </>
            )}
          </>
        )}
      </ScrollView>

      {actions && (
        <PlayerActions
          player={actions}
          reporter={meP}
          room={view.code}
          onRemove={isHost && !actions.isHost ? (p) => intent({ type: 'remove', id: p.id }) : null}
          onClose={() => setActions(null)}
        />
      )}

      <LinearGradient colors={['transparent', t.c.bg, t.c.bg]} locations={[0, 0.35, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 40, paddingHorizontal: 24, paddingBottom: 20 + insets.bottom }}>
        {isHost ? (
          <Button
            title={needsCenter ? 'Lock the arena center first' : st.mode === 'random' ? 'Spin the wheel' : `Start ${chosen.name}`}
            icon={st.mode === 'random' ? Dices : Target}
            disabled={!canStart || online.length < 2}
            onPress={() => intent({ type: 'start' })}
            testID="start"
          />
        ) : (
          <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <LiveDot />
            <T muted size={15}>
              Waiting for {host?.name.split(' ')[0] || 'the host'} to start
            </T>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
