import React, { useEffect, useState } from 'react';
import { Building2, Car, Check, Dices, House, LocateFixed, ShoppingCart, Target, Trees, X } from 'lucide-react';
import { ARENAS, GAMES, gamesFor } from '../../game/games';
import { Avatar, SectionLabel } from '../primitives';

const ARENA_ICONS = { indoor: House, park: Trees, supermarket: ShoppingCart, streets: Building2, roadtrip: Car };

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
  const [locating, setLocating] = useState(false);
  const fits = gamesFor(st.arena, online.length);
  const chosen = GAMES[st.game];
  const canStart = st.mode === 'random' ? fits.length > 0 : online.length >= chosen.min;

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
                @{p.username}
                {p.isHost ? ' · Host' : ''}
              </div>
            </div>
            {isHost && !p.isHost && (
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => intent({ type: 'remove', id: p.id })} className="muted grid h-9 w-9 place-items-center">
                <X size={17} />
              </button>
            )}
          </div>
        ))}
      </div>

      <SectionLabel>{isHost ? 'Arena' : 'Arena · set by host'}</SectionLabel>
      <div className="grid grid-cols-5 gap-2">
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
              {a.label.split(' ')[0]}
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
          placeholder={`Exact location, e.g. ${st.arena === 'supermarket' ? 'Mega Image' : st.arena === 'park' ? 'Central Park' : 'Alex’s living room'}`}
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

      {st.mode === 'random' ? (
        <div className="card mt-3 p-4">
          <div className="text-[14px] font-medium">
            {fits.length ? `${fits.length} games fit ${ARENAS[st.arena].label.toLowerCase()}` : 'Not enough players for these games yet'}
          </div>
          <div className="muted mt-1 text-[13.5px] leading-snug">{fits.map((g) => g.name).join(' · ')}</div>
        </div>
      ) : (
        <>
          <div className="card divide mt-3 overflow-hidden">
            {Object.values(GAMES).map((g) => {
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

      <div className="h-32" />
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-10">
        <div className="mx-auto max-w-md px-6 pb-[calc(20px+var(--safe-bottom))]">
          {isHost ? (
            <button type="button" className="btn btn-primary" disabled={!canStart || online.length < 2} onClick={() => intent({ type: 'start' })}>
              {st.mode === 'random' ? 'Spin the wheel' : `Start ${chosen.name}`}
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
