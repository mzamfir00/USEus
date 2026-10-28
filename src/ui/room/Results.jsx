import React, { useEffect, useState } from 'react';
import { Download, Radar, Share2, Siren } from 'lucide-react';
import { ARENAS, GAMES, XP } from '../../game/games';
import { canShareClip, downloadClip, shareClip, useClips } from '../../lib/clips';
import { Synth } from '../../lib/sound';
import { Avatar, SectionLabel } from '../primitives';
import { roundKeyOf } from '../game/GameScreen';
import { roleTitle } from '../game/MafiaBriefing';
import { nameOf } from '../game/shared';
import { formatTime } from './helpers';
import LazyMap from '../game/zone/LazyMap';

const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

// Photos taken by players this phone blocked are never shown.
const hidden = (view, id) => !!view.players.find((p) => p.id === id)?.blocked;

// Mafia: who won, every secret role, and what happened each night and day.
function MafiaReveal({ view, rv }) {
  const roles = rv.roles || {};
  const out = new Set((rv.log || []).flatMap((e) => (e.kind === 'night' ? [e.victim] : [e.out])).filter(Boolean));
  const order = ['mafia', 'detective', 'doctor', 'citizen'];
  const ids = Object.keys(roles).sort((a, b) => order.indexOf(roles[a]) - order.indexOf(roles[b]));
  return (
    <>
      <div className="card p-5" data-mafia-reveal>
        <div className="text-[24px] font-extrabold tracking-tight">{rv.winner === 'town' ? '🏆 CITIZENS WIN!' : rv.winner === 'mafia' ? '🔪 MAFIA WINS!' : 'Game ended early'}</div>
        <div className="muted mt-1 text-[14px]">
          {rv.nights} night{rv.nights === 1 ? '' : 's'} in the city
        </div>
      </div>
      <SectionLabel>Every secret role</SectionLabel>
      <div className="card divide overflow-hidden">
        {ids.map((id) => (
          <div key={id} className={`flex items-center gap-3 px-5 py-3 ${out.has(id) ? 'opacity-55' : ''}`}>
            <span className="flex-1 truncate text-[15px] font-semibold">
              {nameOf(view, id)}
              {out.has(id) ? ' 👻' : ''}
            </span>
            <span className="text-[14px] font-bold">{roleTitle(roles[id])}</span>
          </div>
        ))}
      </div>
      {(rv.log || []).length > 0 && (
        <>
          <SectionLabel>How it played out</SectionLabel>
          <div className="card divide overflow-hidden">
            {rv.log.map((e, i) => (
              <div key={i} className="px-5 py-3">
                <div className="muted text-[12px] font-semibold">{e.kind === 'night' ? `NIGHT ${e.n}` : `DAY ${e.n} · VOTE`}</div>
                <div className="mt-0.5 text-[14.5px]">
                  {e.kind === 'night'
                    ? e.victim
                      ? `The Mafia eliminated ${nameOf(view, e.victim)}`
                      : e.saved
                        ? 'The Doctor saved the Mafia’s target'
                        : 'A quiet night'
                    : e.out
                      ? `The town voted out ${nameOf(view, e.out)} (${roleTitle(e.role)})`
                      : 'Nobody was voted out'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Reveal({ view, media }) {
  const res = view.results;
  const rv = res.reveal || {};
  switch (res.game) {
    case 'mafia':
      return <MafiaReveal view={view} rv={rv} />;
    case 'red_light':
      return rv.out.length ? <div className="card p-5 text-[14.5px]">Out: {rv.out.map((id) => nameOf(view, id)).join(', ')}</div> : null;
    case 'floor_lava':
      return (
        <>
          <div className="card divide overflow-hidden">
            {Object.entries(rv.lava || {}).map(([id, t]) => (
              <div key={id} className="flex justify-between px-5 py-3 text-[14.5px]">
                <span className="font-medium">{nameOf(view, id)}</span>
                <span className="muted">
                  {t.safe} safe · {t.burned} burned
                </span>
              </div>
            ))}
          </div>
          {rv.proofs?.length > 0 && (
            <div className="noscroll -mx-6 mt-3 flex gap-3 overflow-x-auto px-6">
              {rv.proofs.map((p) => (
                <div key={p.id} className="card w-[120px] shrink-0 overflow-hidden">
                  <div className="aspect-[9/16] bg-black">{media[p.id] && !hidden(view, p.by) && <img src={media[p.id]} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="p-2.5 text-[12px]">
                    <div className="font-semibold">{p.safe ? 'Safe' : 'Burned'}</div>
                    <div className="muted truncate">
                      {nameOf(view, p.by).split(' ')[0]} · call {p.n}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      );
    case 'hide_seek':
      return rv.found?.length ? <div className="card p-5 text-[14.5px]">Found: {rv.found.map((id) => nameOf(view, id)).join(', ')}</div> : null;
    case 'sardines':
      return rv.packed?.length ? <div className="card p-5 text-[14.5px]">Squeezed in: {rv.packed.map((id) => nameOf(view, id)).join(' → ')}</div> : null;
    case 'zombie_tag':
      return <div className="card p-5 text-[14.5px]">Horde: {rv.zombies.map((id) => nameOf(view, id)).join(' → ')}</div>;
    case 'marco_polo':
      return rv.tagged?.length ? <div className="card p-5 text-[14.5px]">Tagged: {rv.tagged.map((id) => nameOf(view, id)).join(', ')}</div> : null;
    case 'midnight_man':
      return (
        <div className="card p-5 text-[14.5px]">
          <div>
            {rv.blown} candle{rv.blown === 1 ? '' : 's'} blown out
            {rv.caught.length ? ` · taken: ${rv.caught.map((id) => nameOf(view, id)).join(', ')}` : ''}
          </div>
          {Object.keys(rv.exposures).length > 0 && (
            <div className="muted mt-1">
              Exposed:{' '}
              {Object.entries(rv.exposures)
                .map(([id, n]) => `${nameOf(view, id)} ×${n}`)
                .join(', ')}
            </div>
          )}
        </div>
      );
    case 'weeping_statue':
      return (
        <div className="card p-5 text-[14.5px]">
          {rv.tagged.length ? `Tagged: ${rv.tagged.map((id) => nameOf(view, id)).join(', ')}` : 'Nobody was tagged.'}
          {rv.moves > 0 && <div className="muted mt-1">The Statue moved in the light ×{rv.moves}</div>}
        </div>
      );
    case 'daruma':
      return (
        <>
          <div className="card p-5 text-[14.5px]">
            {rv.freezes} TOMARE call{rv.freezes === 1 ? '' : 's'}
            {rv.caught.length ? ` · caught: ${rv.caught.map((id) => nameOf(view, id)).join(', ')}` : ''}
          </div>
          {rv.shots?.some((p) => media[p.id] && !hidden(view, p.by)) && (
            <div className="noscroll -mx-6 mt-3 flex gap-3 overflow-x-auto px-6">
              {rv.shots
                .filter((p) => media[p.id] && !hidden(view, p.by))
                .map((p) => (
                  <div key={p.id} className="card w-[120px] shrink-0 overflow-hidden">
                    <div className="aspect-[9/16] bg-black">
                      <img src={media[p.id]} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="truncate p-2.5 text-[12px] font-semibold">TOMARE · {nameOf(view, p.by).split(' ')[0]}</div>
                  </div>
                ))}
            </div>
          )}
        </>
      );
    case 'dead_silence':
      return (
        <div className="card p-5 text-[14.5px]">
          {rv.caught.length ? `Caught: ${rv.caught.map((id) => nameOf(view, id)).join(', ')}` : 'Nobody was caught.'}
          {Object.keys(rv.noise).length > 0 && (
            <div className="muted mt-1">
              Noises:{' '}
              {Object.entries(rv.noise)
                .map(([id, n]) => `${nameOf(view, id)} ×${n}`)
                .join(', ')}
            </div>
          )}
        </div>
      );
    case 'doppelganger':
      return (
        <div className="card p-5">
          <div className="eyebrow">The Doppelgänger was</div>
          <div className="headline mt-1 text-[24px]">{nameOf(view, rv.doppelganger)}</div>
          {rv.taken.length > 0 && <div className="mt-2 text-[14.5px]">Taken in the dark: {rv.taken.map((id) => nameOf(view, id)).join(', ')}</div>}
          {rv.banished.length > 0 && <div className="muted mt-1 text-[14.5px]">Innocents voted out: {rv.banished.map((id) => nameOf(view, id)).join(', ')}</div>}
        </div>
      );
    default:
      return null;
  }
}

// Snitch Protocol summary: who stopped filming and what it cost them.
function Strikes({ view }) {
  const strikes = Object.entries(view.results.reveal?.strikes || {}).filter(([, n]) => n > 0);
  if (!strikes.length) return null;
  return (
    <div className="card mt-3 p-5">
      <div className="eyebrow flex items-center gap-1.5">
        <Siren size={13} /> Snitch Protocol
      </div>
      <div className="mt-2 space-y-1">
        {strikes.map(([id, n]) => (
          <div key={id} className="flex justify-between text-[14.5px]">
            <span>{nameOf(view, id)} stopped filming ×{n}</span>
            <span className="muted tnum">{n * XP.strike} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// GPS Playzone replay: the zone, everyone's movement trail, radar pings and penalties.
function ZoneSummary({ view }) {
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
      <div className="card overflow-hidden" data-zone-summary>
        <div className="h-72 bg-black">
          <LazyMap center={z.center} radius={z.finalRadius} fitRadius={z.radius} rings={z.finalRadius < z.radius ? [{ r: z.radius, faint: true }] : []} trails={trails} pins={pins} />
        </div>
        <div className="muted flex flex-wrap gap-x-4 gap-y-1 border-b border-[var(--border)] px-5 py-2.5 text-[12px]">
          <span>{z.radius} m zone{z.finalRadius < z.radius ? ` → ${z.finalRadius} m` : ''}</span>
          {z.hunt && <span>Solid trail = hunter · dotted = hiders</span>}
          {z.radar.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Radar size={12} /> = radar ping
            </span>
          )}
        </div>
        {events.length > 0 ? (
          <div className="divide">
            {events.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13.5px]">
                <span className="min-w-0">{e.text}</span>
                {e.xp ? (
                  <span className="muted tnum shrink-0">
                    {e.xp > 0 ? '+' : ''}
                    {e.xp} XP
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="muted px-5 py-3 text-[13.5px]">Clean round: nobody left the zone.</div>
        )}
      </div>
    </>
  );
}

function Clips({ roundKey }) {
  const clips = useClips(roundKey);
  const [note, setNote] = useState('');
  if (!clips.length) return null;
  return (
    <>
      <SectionLabel>Your clips from this round</SectionLabel>
      <div className="space-y-3">
        {clips.map((c) => (
          <div key={c.id} className="card overflow-hidden">
            <video src={c.url} controls playsInline className="aspect-[9/16] max-h-[460px] w-full bg-black object-contain" />
            <div className="p-3">
              <div className="truncate text-[14px] font-semibold">{c.title}</div>
              <div className="muted text-[12.5px]">
                {formatTime(c.durationMs)} · {c.mime.includes('mp4') ? 'MP4' : 'WebM'}
              </div>
              <div className="mt-3 flex gap-2">
                {canShareClip(c) && (
                  <button type="button" className="btn btn-primary !min-h-[44px] flex-1 text-[14.5px]" onClick={() => shareClip(c)} aria-label="Share video">
                    <Share2 size={17} /> Share
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary !min-h-[44px] flex-1 text-[14.5px]"
                  aria-label="Save video"
                  onClick={async () => {
                    const where = await downloadClip(c);
                    if (where) {
                      setNote(where);
                      setTimeout(() => setNote(''), 3500);
                    }
                  }}
                >
                  <Download size={17} /> Save
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {note && <div className="muted mt-2 text-center text-[13px]">{note}</div>}
      <p className="muted mt-2 text-center text-[12px]">Share straight to TikTok, Instagram Reels or WhatsApp.</p>
    </>
  );
}

export default function Results({ view, intent, media }) {
  const isHost = view.hostId === view.me;
  const res = view.results;
  const r = view.round;
  const won = res.winners.includes(view.me);

  useEffect(() => {
    if (won) Synth.success();
    else Synth.fail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.roundKey]);

  const ranked = [...view.players].sort((a, b) => b.xp - a.xp);
  return (
    <div className="enter flex flex-1 flex-col">
      <div className="pt-6">
        <div className="eyebrow">
          {GAMES[res.game].name} · {res.location || ARENAS[r.arena].full}
        </div>
        <h2 className="title mt-2">{res.headline}</h2>
        <p className="muted mt-2 text-[15px]">{won ? 'You’re on the winning side.' : 'Not your round.'}</p>
      </div>

      <div className="mt-6">
        <Reveal view={view} media={media} />
      </div>
      <Strikes view={view} />
      <ZoneSummary view={view} />

      {res.evolved && (
        <div className="card mt-3 flex items-center justify-between p-5">
          <span className="text-[15px] font-semibold">Room evolved</span>
          <span className="muted text-[14px]">
            Level {res.evolved.stage} · {res.evolved.name}
          </span>
        </div>
      )}

      <Clips roundKey={roundKeyOf(view)} />

      <SectionLabel>Leaderboard</SectionLabel>
      <div className="card divide overflow-hidden">
        {ranked.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
            <span className="muted tnum w-4 text-[14px]">{i + 1}</span>
            <Avatar name={p.name} size={34} inverted={p.id === view.me} />
            <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold">{p.name}</span>
            {res.deltas[p.id] ? (
              <span className="muted tnum text-[13px]">
                {res.deltas[p.id] > 0 ? '+' : ''}
                {res.deltas[p.id]}
              </span>
            ) : null}
            <span className="tnum w-16 text-right text-[15.5px] font-semibold">{p.xp}</span>
          </div>
        ))}
      </div>

      <div className="h-36" />
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-10">
        <div className="mx-auto max-w-md px-6 pb-[calc(16px+var(--safe-bottom))]">
          {isHost ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => intent({ type: 'start' })}>
                {view.settings.mode === 'random' ? 'Spin again' : `Play ${GAMES[view.settings.game].name} again`}
              </button>
              <button type="button" className="muted mt-2 h-11 w-full text-[14px] font-medium" onClick={() => intent({ type: 'lobby' })}>
                Change arena or game
              </button>
            </>
          ) : (
            <div className="muted flex h-14 items-center justify-center gap-2 text-[15px]">
              <span className="live-dot" /> Waiting for the host
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
