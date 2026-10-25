import React, { useState } from 'react';
import { Check, ChevronDown, Lock } from 'lucide-react';
import { castNames, fillText, missionById } from '../../game/engine';
import { buzz } from '../../lib/sound';
import { Avatar, RichText } from '../primitives';
import Camera from './Camera';
import { BottomBar, GameShell, nameOf } from './shared';

export function UndercoverPlay({ view, serverNow, intent, onLeave, hud }) {
  const m = missionById(view.round.data.missionId);
  const names = castNames(view);
  const secret = view.mine?.saboteur ? view.mine : null;
  const [open, setOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(true);
  const isHost = view.hostId === view.me;

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={secret ? 'Undercover · stay hidden' : 'Crew · spot the saboteur'} onLeave={onLeave}>
      <Camera hud={hud} record micDefault>
        <BottomBar>
          <div className="space-y-2">
            <button type="button" onClick={() => setBriefOpen((v) => !v)} className="w-full rounded-[18px] border border-white/15 bg-black/65 px-4 py-3 text-left backdrop-blur">
              <div className="flex items-center justify-between text-[12.5px] text-white/60">
                <span>{fillText(m.title, names, view.packName)}</span>
                <ChevronDown size={15} className={briefOpen ? 'rotate-180' : ''} />
              </div>
              {briefOpen && (
                <p className="mt-1 text-[14.5px] leading-snug text-white">
                  <RichText text={m.prompt} names={names} pack={view.packName} />
                </p>
              )}
            </button>
            {secret ? (
              <div className="rounded-[18px] bg-white px-4 py-3 text-black">
                <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
                  <span className="flex items-center gap-2 text-[14px] font-semibold">
                    <Lock size={14} /> Your covert tasks · {secret.done.length}/3
                  </span>
                  <span className="text-[12.5px] text-black/50">{open ? 'Hide' : 'Peek'}</span>
                </button>
                {open && (
                  <div className="mt-2 space-y-1.5">
                    {secret.tasks.map((t, i) => {
                      const done = secret.done.includes(i);
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={done}
                          onClick={() => {
                            buzz(15);
                            intent({ type: 'task', i });
                          }}
                          className="flex w-full items-center gap-3 text-left text-[14px]"
                        >
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border border-black ${done ? 'bg-black text-white' : ''}`}>{done && <Check size={12} strokeWidth={3} />}</span>
                          <span className={done ? 'line-through opacity-50' : ''}>{t}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-[18px] border border-white/15 bg-black/65 px-4 py-3 text-[13.5px] text-white/80 backdrop-blur">
                <Lock size={14} /> One player is secretly sabotaging this video. Trust no one.
              </div>
            )}
            {isHost && (
              <button type="button" className="h-10 w-full text-[13.5px] font-medium text-white/70" onClick={() => intent({ type: 'end' })}>
                End early & vote
              </button>
            )}
          </div>
        </BottomBar>
      </Camera>
    </GameShell>
  );
}

export function UndercoverVote({ view, intent }) {
  const r = view.round;
  const myVote = r.data.votes[view.me];
  const voted = Object.keys(r.data.votes).length;
  const isHost = view.hostId === view.me;
  return (
    <div className="enter pb-40">
      <div className="pt-6">
        <div className="eyebrow">Time’s up</div>
        <h2 className="title mt-2">Who was undercover?</h2>
        <p className="muted mt-2 text-[15px]">
          {voted} of {r.participants.length} voted. Majority accusation catches them.
        </p>
      </div>
      <div className="card divide mt-6 overflow-hidden">
        {r.participants
          .filter((id) => id !== view.me)
          .map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                buzz(20);
                intent({ type: 'accuse', id });
              }}
              className={`card-press flex w-full items-center gap-3 px-5 py-4 text-left ${myVote === id ? 'bg-[var(--fg)] text-[var(--bg)]' : ''}`}
            >
              <Avatar name={nameOf(view, id)} size={38} inverted={myVote !== id} />
              <span className="flex-1 text-[16px] font-semibold">{nameOf(view, id)}</span>
              {myVote === id && <span className="text-[13px] font-medium">Your vote</span>}
            </button>
          ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-10">
        <div className="mx-auto max-w-md px-6 pb-[calc(16px+var(--safe-bottom))]">
          {isHost ? (
            <button type="button" className="btn btn-primary" onClick={() => intent({ type: 'finishReview' })}>
              Reveal the saboteur
            </button>
          ) : (
            <div className="muted flex h-14 items-center justify-center gap-2 text-[15px]">
              <span className="live-dot" /> Reveals when everyone has voted
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
