import React, { useEffect } from 'react';
import { Download, Share2 } from 'lucide-react';
import { ARENAS, GAMES } from '../../game/games';
import { canShareClip, downloadClip, shareClip, useClips } from '../../lib/clips';
import { buzz, Synth } from '../../lib/sound';
import { Avatar, SectionLabel } from '../primitives';
import { roundKeyOf } from '../game/GameScreen';
import { nameOf } from '../game/shared';
import { formatTime } from './helpers';

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
    default:
      return null;
  }
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
