import React, { useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { MAX_SHOTS } from '../../game/engine';
import { XP } from '../../game/games';
import { buzz, Synth } from '../../lib/sound';
import Camera from './Camera';
import { BottomBar, GameShell, nameOf, userOf } from './shared';

export function PaparazziSniper({ view, serverNow, intent, onLeave, hud, media }) {
  const cam = useRef(null);
  const [flash, setFlash] = useState(false);
  const target = view.mine?.target;
  const mine = view.round.data.shots.filter((s) => s.by === view.me);
  const left = MAX_SHOTS - mine.length;
  const last = mine[mine.length - 1];

  const shoot = () => {
    if (!cam.current || left <= 0) return;
    const img = cam.current.snapshot();
    Synth.shutter();
    buzz(40);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    intent({ type: 'shot', id: Math.random().toString(36).slice(2, 12), img });
  };

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel="Sniper · keep your target secret" onLeave={onLeave}>
      <Camera ref={cam} hud={hud}>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-56 w-56">
            <div className="absolute inset-0 rounded-full border border-white/70" />
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/50" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/50" />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white" />
          </div>
        </div>
        <div className="absolute inset-x-4 top-[calc(max(150px,calc(env(safe-area-inset-top)+136px))+var(--zone-h,0px))] z-10 mr-14 rounded-[16px] border border-white/15 bg-black/60 px-4 py-3 backdrop-blur">
          <div className="text-[12px] font-medium text-white/60">Target</div>
          <div className="text-[20px] font-bold leading-tight">{target ? `@${userOf(view, target)}` : '—'}</div>
          <div className="text-[13px] text-white/70">{target ? nameOf(view, target) : ''}</div>
        </div>
        {flash && <div className="absolute inset-0 z-30 bg-white" />}
        <BottomBar>
          <div className="flex items-center justify-between">
            <div className="h-16 w-12 overflow-hidden rounded-[10px] border border-white/30 bg-black/40">{last && media[last.id] && <img src={media[last.id]} alt="Last shot" className="h-full w-full object-cover" />}</div>
            <button type="button" aria-label="Take shot" disabled={left <= 0} onClick={shoot} className="grid h-20 w-20 place-items-center rounded-full border-4 border-white disabled:opacity-30">
              <span className="h-[60px] w-[60px] rounded-full bg-white transition-transform active:scale-90" />
            </button>
            <div className="w-12 text-center text-[13px] font-semibold">
              {left}
              <div className="text-[11px] font-normal text-white/60">left</div>
            </div>
          </div>
          <div className="mt-3 text-center text-[12.5px] text-white/60">Only counts if they’re not looking at your lens. The squad votes after.</div>
        </BottomBar>
      </Camera>
    </GameShell>
  );
}

export function PaparazziReview({ view, intent, media }) {
  const d = view.round.data;
  const isHost = view.hostId === view.me;
  return (
    <div className="enter pb-40">
      <div className="pt-6">
        <div className="eyebrow">Paparazzi review</div>
        <h2 className="title mt-2">Clean hit or spotted?</h2>
        <p className="muted mt-2 text-[15px]">Valid shots earn +{XP.validShot} XP. Vote on every shot that isn’t yours.</p>
      </div>
      {d.shots.length === 0 && <div className="card mt-6 p-6 text-center text-[15px]">No shots were taken this round.</div>}
      <div className="mt-6 space-y-4">
        {d.shots.map((shot) => {
          const votes = d.votes[shot.id] || {};
          const myVote = votes[view.me];
          const yes = Object.values(votes).filter(Boolean).length;
          const no = Object.values(votes).length - yes;
          const own = shot.by === view.me;
          return (
            <div key={shot.id} className="card overflow-hidden">
              <div className="aspect-[9/16] max-h-[420px] w-full bg-black">
                {media[shot.id] ? <img src={media[shot.id]} alt={`Shot of ${nameOf(view, shot.target)}`} className="h-full w-full object-cover" /> : <div className="muted grid h-full place-items-center text-[14px]">Loading photo…</div>}
              </div>
              <div className="p-4">
                <div className="text-[15px] font-semibold">
                  {nameOf(view, shot.by)} → {nameOf(view, shot.target)}
                </div>
                <div className="muted mt-0.5 text-[13px]">
                  {yes} clean · {no} spotted
                </div>
                {own ? (
                  <div className="muted mt-3 text-[13.5px]">Your shot — the squad decides.</div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" className={`btn !min-h-[46px] ${myVote === true ? 'btn-primary' : 'btn-secondary'}`} onClick={() => intent({ type: 'voteShot', id: shot.id, valid: true })}>
                      <Check size={16} /> Clean hit
                    </button>
                    <button type="button" className={`btn !min-h-[46px] ${myVote === false ? 'btn-primary' : 'btn-secondary'}`} onClick={() => intent({ type: 'voteShot', id: shot.id, valid: false })}>
                      <X size={16} /> Spotted
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-10">
        <div className="mx-auto max-w-md px-6 pb-[calc(16px+var(--safe-bottom))]">
          {isHost ? (
            <button type="button" className="btn btn-primary" onClick={() => intent({ type: 'finishReview' })}>
              Lock votes & reveal
            </button>
          ) : (
            <div className="muted flex h-14 items-center justify-center gap-2 text-[15px]">
              <span className="live-dot" /> The host locks the votes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
