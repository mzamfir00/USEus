import React, { useEffect, useState } from 'react';
import { Building2, Car, Check, Crosshair, Dices, Flame, House, LocateFixed, MoreHorizontal, ShoppingCart, Sparkles, Target, TreePine, Trees, X } from 'lucide-react';
import { ARENAS, GAMES, gamesFor, HALLOWEEN, halloweenLive, HUNT, packOf, ZONE_ARENAS, ZONE_RADII } from '../../game/games';
import HorrorFx from '../game/HorrorFx';
import { PlayerActions } from '../Moderation';
import { Avatar, SectionLabel } from '../primitives';
import LazyMap from '../game/zone/LazyMap';
import { StorytellerSetup } from '../game/MafiaBriefing';

const ARENA_ICONS = { indoor: House, park: Trees, forest: TreePine, supermarket: ShoppingCart, streets: Building2, roadtrip: Car };
const PLACEHOLDERS = { indoor: 'Alex’s living room', park: 'Central Park', forest: 'Pine Ridge Trail', supermarket: 'Mega Image', streets: 'Old Town', roadtrip: 'Rest stop on the A1' };
const SIM_CENTER = { lat: 40.7812, lng: -73.9665 }; // simulated GPS fallback (Central Park)

const getPosition = (opts) => new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));

function Toggle({ label, sub, on, disabled, onChange }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-medium">{label}</div>
        <div className="muted text-[12.5px] leading-snug">{sub}</div>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!on)} />
    </div>
  );
}

// GPS Playzone: lock the arena centre with one tap, pick a radius, optional closing ring.
function ZoneSetup({ st, isHost, set }) {
  const z = st.zone;
  const [locking, setLocking] = useState(false);
  const [note, setNote] = useState('');
  const lock = async () => {
    setLocking(true);
    setNote('');
    try {
      if (!navigator.geolocation) throw new Error('no-geo');
      const pos = await getPosition({ enableHighAccuracy: true, timeout: z.sim ? 5000 : 15000, maximumAge: 0 });
      set({ zone: { center: { lat: pos.coords.latitude, lng: pos.coords.longitude } } });
      setNote(`Locked to ±${Math.round(pos.coords.accuracy)} m`);
    } catch (e) {
      if (z.sim) {
        set({ zone: { center: SIM_CENTER } });
        setNote('No GPS here — using a simulated centre.');
      } else setNote(e?.code === 1 ? 'Location permission denied. Allow it, or turn on simulated GPS to test indoors.' : 'No GPS fix yet. Step outside, or turn on simulated GPS to test indoors.');
    }
    setLocking(false);
  };
  const hunts = Object.keys(HUNT)
    .map((id) => GAMES[id].short)
    .join(', ');

  return (
    <>
      <SectionLabel
        right={
          <button type="button" role="switch" aria-checked={z.on} aria-label="GPS Playzone" className="switch" disabled={!isHost} onClick={() => set({ zone: { on: !z.on } })} />
        }
      >
        GPS Playzone
      </SectionLabel>
      <div className="card px-4 pt-4" data-zone-setup>
        {!z.on ? (
          <p className="muted pb-4 text-[13.5px] leading-snug">Off. Turn it on for a live GPS boundary, out-of-bounds penalties, radar pings and supply drops.</p>
        ) : (
          <>
            <button type="button" className={`btn ${z.center ? 'btn-secondary' : 'btn-primary'} !min-h-[48px] text-[15px]`} disabled={!isHost || locking} onClick={lock}>
              <Crosshair size={17} className={locking ? 'animate-spin' : ''} />
              {locking ? 'Getting a GPS fix…' : z.center ? 'Re-lock arena center here' : 'Lock arena center here'}
            </button>
            {(note || z.center) && (
              <div className="muted mt-2 text-center text-[12.5px]" data-zone-center={z.center ? `${z.center.lat},${z.center.lng}` : ''}>
                {z.center ? `${z.center.lat.toFixed(5)}, ${z.center.lng.toFixed(5)}` : ''}
                {z.center && note ? ' · ' : ''}
                {note}
              </div>
            )}
            {z.center && (
              <div className="mt-3 h-44 overflow-hidden rounded-[14px] border border-[var(--border)]">
                <LazyMap center={z.center} radius={z.radius} interactive={false} />
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {ZONE_RADII.map((o) => (
                <button
                  key={o.m}
                  type="button"
                  disabled={!isHost}
                  aria-pressed={z.radius === o.m}
                  onClick={() => set({ zone: { radius: o.m } })}
                  className={`rounded-[14px] border px-3 py-2.5 text-left transition-colors ${z.radius === o.m ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]' : 'border-[var(--border)] disabled:opacity-40'}`}
                >
                  <div className="tnum text-[16px] font-bold">{o.m} m</div>
                  <div className={`text-[12px] ${z.radius === o.m ? 'opacity-70' : 'muted'}`}>{o.label}</div>
                </button>
              ))}
            </div>
            <div className="divide mt-1">
              <Toggle label="Shrinking battle-royale ring" sub="Final 3 minutes: the zone shrinks 20% every 45 s." on={z.shrink} disabled={!isHost} onChange={(v) => set({ zone: { shrink: v } })} />
              <Toggle label="Simulated GPS" sub="Indoor testing: phones move with an on-screen pad instead of real GPS." on={z.sim} disabled={!isHost} onChange={(v) => set({ zone: { sim: v } })} />
            </div>
            <p className="muted border-t border-[var(--border)] py-3 text-[12.5px] leading-snug">
              Every phone shares its location during the round. Radar pings, decoys, heartbeat and the supply drop play in {hunts}.
            </p>
          </>
        )}
      </div>
    </>
  );
}

// GPS → place name (OpenStreetMap reverse geocoding), falling back to coordinates.
async function locateName() {
  const pos = await new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
  );
  const { latitude: lat, longitude: lon } = pos.coords;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lon}`, { headers: { Accept: 'application/json' } });
    const j = await res.json();
    const a = j.address || {};
    const place = j.name || a.amenity || a.shop || a.leisure || a.park || a.tourism || a.building || a.road;
    const area = a.suburb || a.neighbourhood || a.city || a.town || a.village;
    const label = [place, area].filter(Boolean).join(', ');
    if (label) return label;
  } catch (e) {
    /* offline or blocked: use coordinates */
  }
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

export default function Lobby({ view, intent, onInvite }) {
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
  const chosen = GAMES[st.game];
  const packGames = Object.values(GAMES).filter((g) => packOf(g) === pack);
  const choosePack = (id) => {
    if (id === pack) return;
    const first = Object.values(GAMES).find((g) => packOf(g) === id && g.arenas.includes(st.arena)) || Object.values(GAMES).find((g) => packOf(g) === id);
    set({ pack: id, game: first.id, starter: null });
  };
  const zoneArena = ZONE_ARENAS.includes(st.arena) && !!st.zone;
  const needsCenter = zoneArena && st.zone.on && !st.zone.center;
  const canStart = (st.mode === 'random' ? fits.length > 0 : online.length >= chosen.min) && !needsCenter;

  useEffect(() => setLocation(st.location), [st.location]);
  const set = (patch) => intent({ type: 'settings', ...patch });

  return (
    <div className="enter flex flex-1 flex-col">
      <button type="button" onClick={onInvite} className="mt-1 text-center" aria-label="Share room code">
        <div className="eyebrow">Room code</div>
        <div className="tnum mt-1 text-[64px] font-bold leading-none tracking-[0.12em]">{view.code}</div>
        <div className="muted mt-2 text-[13.5px]">Tap to share or show QR</div>
      </button>

      <SectionLabel right={<span className="muted text-[13px]">{online.length} here</span>}>Players</SectionLabel>
      <div className="card divide overflow-hidden">
        {view.players.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 px-5 py-3 ${p.connected ? '' : 'opacity-40'}`}>
            <Avatar name={p.name} size={36} inverted={p.id === me} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15.5px] font-semibold">
                {p.name}
                {p.id === me && <span className="muted font-normal"> (you)</span>}
              </div>
              <div className="muted truncate text-[13px]">
                {p.blocked ? 'Hidden on this phone' : `@${p.username}`}
                {p.isHost ? ' · Host' : ''}
              </div>
            </div>
            {p.id !== me && (
              <button type="button" aria-label={`Player options for ${p.name}`} onClick={() => setActions(p)} className="muted grid h-9 w-9 place-items-center">
                <MoreHorizontal size={18} />
              </button>
            )}
            {isHost && !p.isHost && (
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => intent({ type: 'remove', id: p.id })} className="muted grid h-9 w-9 place-items-center">
                <X size={17} />
              </button>
            )}
          </div>
        ))}
      </div>
      {actions && (
        <PlayerActions
          player={actions}
          reporter={meP}
          room={view.code}
          onRemove={isHost && !actions.isHost ? (p) => intent({ type: 'remove', id: p.id }) : null}
          onClose={() => setActions(null)}
        />
      )}

      <SectionLabel>{isHost ? 'Arena' : 'Arena · set by host'}</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {Object.values(ARENAS).map((a) => {
          const Icon = ARENA_ICONS[a.id];
          const on = st.arena === a.id;
          return (
            <button
              key={a.id}
              type="button"
              disabled={!isHost}
              onClick={() => set({ arena: a.id })}
              className={`flex flex-col items-center gap-1.5 rounded-[16px] border py-3 text-[11px] font-medium transition-colors ${on ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]' : 'border-[var(--border)] bg-[var(--card)] disabled:opacity-40'}`}
            >
              <Icon size={19} />
              {a.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="field !h-12 text-[15px]"
          value={location}
          disabled={!isHost}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => location !== st.location && set({ location })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder={`Exact location, e.g. ${PLACEHOLDERS[st.arena] || PLACEHOLDERS.indoor}`}
          maxLength={48}
          aria-label="Exact location name"
        />
        {isHost && (
          <button
            type="button"
            aria-label="Use my location"
            className="icon-btn !h-12 !w-12"
            disabled={locating}
            onClick={async () => {
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
          >
            <LocateFixed size={18} className={locating ? 'animate-pulse' : ''} />
          </button>
        )}
      </div>

      {zoneArena && <ZoneSetup st={st} isHost={isHost} set={set} />}

      <SectionLabel>Game</SectionLabel>
      <div className="segmented">
        <button type="button" aria-pressed={st.mode === 'random'} disabled={!isHost} onClick={() => set({ mode: 'random' })}>
          <span className="inline-flex items-center gap-1.5">
            <Dices size={15} /> Random roulette
          </span>
        </button>
        <button type="button" aria-pressed={st.mode === 'manual'} disabled={!isHost} onClick={() => set({ mode: 'manual' })}>
          <span className="inline-flex items-center gap-1.5">
            <Target size={15} /> Choose game
          </span>
        </button>
      </div>

      {seasonal && (
        <div className="mt-3 grid grid-cols-2 gap-2" data-packs>
          <button
            type="button"
            disabled={!isHost}
            aria-pressed={pack === 'party'}
            onClick={() => choosePack('party')}
            className={`rounded-[16px] border px-3.5 py-3 text-left transition-colors ${pack === 'party' ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]' : 'border-[var(--border)] bg-[var(--card)] disabled:opacity-50'}`}
          >
            <Sparkles size={17} />
            <div className="mt-2 text-[14px] font-semibold">All games</div>
            <div className={`text-[12px] ${pack === 'party' ? 'opacity-70' : 'muted'}`}>Party & classics · {Object.values(GAMES).filter((g) => packOf(g) === 'party').length}</div>
          </button>
          <button
            type="button"
            disabled={!isHost}
            aria-pressed={pack === 'halloween'}
            aria-label={HALLOWEEN.name}
            onClick={() => choosePack('halloween')}
            className={`pack-horror relative overflow-hidden rounded-[16px] border px-3.5 py-3 text-left text-white ${pack === 'halloween' ? '!border-white shadow-[0_0_0_1px_#fff]' : 'disabled:opacity-50'}`}
          >
            <HorrorFx />
            <div className="relative">
              <Flame size={17} className="breathe" />
              <div className="horror-title mt-1.5 text-[19px] leading-none">Halloween Horror</div>
              <div className="vhs mt-1 text-[10.5px] text-white/60">{Object.values(GAMES).filter((g) => packOf(g) === 'halloween').length} rituals · until {HALLOWEEN.until}</div>
            </div>
          </button>
        </div>
      )}

      {st.mode === 'random' ? (
        <div className="card mt-3 p-4">
          <div className="text-[14px] font-medium">
            {fits.length ? `${fits.length} ${pack === 'halloween' ? 'rituals' : 'games'} fit ${ARENAS[st.arena].label.toLowerCase()}` : 'Not enough players for these games yet'}
          </div>
          <div className="muted mt-1 text-[13.5px] leading-snug">{fits.map((g) => g.name).join(' · ')}</div>
        </div>
      ) : (
        <>
          <div className="card divide mt-3 overflow-hidden">
            {packGames.map((g) => {
              const on = st.game === g.id;
              const enough = online.length >= g.min;
              const fit = g.arenas.includes(st.arena);
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={!isHost}
                  onClick={() => set({ game: g.id, starter: null })}
                  className={`card-press flex w-full items-start gap-3 px-4 py-3.5 text-left ${on ? 'bg-[var(--fg)] text-[var(--bg)]' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[15.5px] font-semibold">{g.name}</div>
                    <div className={`mt-0.5 text-[13px] leading-snug ${on ? 'opacity-70' : 'muted'}`}>{g.tagline}</div>
                    <div className={`mt-1 text-[12px] ${on ? 'opacity-60' : 'muted'}`}>
                      {g.min}+ players{fit ? '' : ` · best in ${g.arenas.map((a) => ARENAS[a].label).join(', ')}`}
                      {enough ? '' : ' · need more players'}
                    </div>
                  </div>
                  {on && <Check size={18} className="mt-1 shrink-0" />}
                </button>
              );
            })}
          </div>
          {chosen.starter && (
            <>
              <SectionLabel>{chosen.starter}</SectionLabel>
              <div className="noscroll -mx-6 flex gap-2 overflow-x-auto px-6">
                <button type="button" disabled={!isHost} onClick={() => set({ starter: null })} className={`pill ${!st.starter ? 'pill-on' : ''}`}>
                  <Dices size={14} /> Random
                </button>
                {online.map((p) => (
                  <button key={p.id} type="button" disabled={!isHost} onClick={() => set({ starter: p.id })} className={`pill ${st.starter === p.id ? 'pill-on' : ''}`}>
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {(st.mode === 'manual' ? chosen?.id === 'mafia' : fits.some((g) => g.id === 'mafia')) && <StorytellerSetup view={view} intent={intent} where="lobby" />}

      <div className="h-32" />
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-10">
        <div className="mx-auto max-w-md px-6 pb-[calc(20px+var(--safe-bottom))]">
          {isHost ? (
            <button type="button" className="btn btn-primary" disabled={!canStart || online.length < 2} onClick={() => intent({ type: 'start' })}>
              {needsCenter ? 'Lock the arena center first' : st.mode === 'random' ? 'Spin the wheel' : `Start ${chosen.name}`}
            </button>
          ) : (
            <div className="muted flex h-14 items-center justify-center gap-2 text-[15px]">
              <span className="live-dot" /> Waiting for {host?.name.split(' ')[0] || 'the host'} to start
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
