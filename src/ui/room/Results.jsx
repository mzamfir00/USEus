import React, { useEffect } from 'react';
import { Download, Radar, Share2, Siren } from 'lucide-react';
import { ARENAS, GAMES, XP } from '../../game/games';
import { canShareClip, downloadClip, shareClip, useClips } from '../../lib/clips';
import { buzz, Synth } from '../../lib/sound';
import { Avatar, SectionLabel } from '../primitives';
import { roundKeyOf } from '../game/GameScreen';
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

function Reveal({ view, media }) {
  const res = view.results;
  const rv = res.reveal || {};
  switch (res.game) {
    case 'undercover':
      return (
        <div className="card p-5">
          <div className="eyebrow">The undercover saboteur was</div>
          <div className="headline mt-1 text-[24px]">{nameOf(view, rv.saboteur)}</div>
          <div className="mt-3 space-y-1.5">
            {rv.tasks.map((t, i) => (
              <div key={t} className={`text-[14.5px] ${rv.done.includes(i) ? '' : 'muted line-through'}`}>
                {rv.done.includes(i) ? '✓' : '·'} {t}
              </div>
            ))}
          </div>
        </div>
      );
    case 'paparazzi':
      return rv.shots.length ? (
        <div className="noscroll -mx-6 flex gap-3 overflow-x-auto px-6">
          {rv.shots.map((s) => (
            <div key={s.id} className="card w-[150px] shrink-0 overflow-hidden">
              <div className="aspect-[9/16] bg-black">{media[s.id] && <img src={media[s.id]} alt="" className="h-full w-full object-cover" />}</div>
              <div className="p-3 text-[12.5px]">
                <div className="font-semibold">{s.valid ? 'Clean hit' : 'Spotted'}</div>
                <div className="muted truncate">
                  {nameOf(view, s.by).split(' ')[0]} → {nameOf(view, s.target).split(' ')[0]}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null;
    case 'red_light':
      return rv.out.length ? <div className="card p-5 text-[14.5px]">Out: {rv.out.map((id) => nameOf(view, id)).join(', ')}</div> : null;
    case 'hot_potato':
      return <div className="card p-5 text-[14.5px]">{rv.passes} passes before it blew.</div>;
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
                  <div className="aspect-[9/16] bg-black">{media[p.id] && <img src={media[p.id]} alt="" className="h-full w-full object-cover" />}</div>
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
  if (!clips.length) return null;
  return (
    <>
      <SectionLabel>Your clips from this round</SectionLabel>
      <div className="space-y-3">
        {clips.map((c) => (
          <div key={c.id} className="card overflow-hidden">
            <video src={c.url} controls playsInline className="aspect-[9/16] max-h-[460px] w-full bg-black object-contain" />
            <div className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{c.title}</div>
                <div className="muted text-[12.5px]">
                  {formatTime(c.durationMs)} · {c.mime.includes('mp4') ? 'MP4' : 'WebM'}
                </div>
              </div>
              <button type="button" className="icon-btn" aria-label="Save video" onClick={() => downloadClip(c)}>
                <Download size={17} />
              </button>
              {canShareClip(c) && (
                <button type="button" className="icon-btn" aria-label="Share video" onClick={() => shareClip(c)}>
                  <Share2 size={17} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Results({ view, intent, media }) {
  const isHost = view.hostId === view.me;
  const res = view.results;
  const r = view.round;
  const won = res.winners.includes(view.me);

  useEffect(() => {
    if (res.game === 'hot_potato') {
      Synth.boom();
      buzz([400, 100, 200]);
    } else if (won) Synth.success();
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
