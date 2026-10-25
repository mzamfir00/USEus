import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { CHICKEN_PENALTY, SABOTEUR_BONUS, SPEED_BONUS } from '../../game/constants';
import { castNames, fillText, missionById, timerRemaining } from '../../game/engine';
import { Avatar, SectionLabel } from '../primitives';

export default function Results({ view, intent, serverNow }) {
  const isHost = view.hostId === view.me;
  const r = view.round;
  const m = missionById(r.missionId);
  const names = castNames(view);
  const res = view.results;
  const [sabWon, setSabWon] = useState(false);
  const player = (id) => view.players.find((p) => p.id === id);
  const timeLeft = timerRemaining(r.timer, serverNow()) > 0;

  if (!res) {
    return (
      <div className="enter flex flex-1 flex-col">
        <div className="flex-1 pt-8">
          <div className="eyebrow">{fillText(m.title, names, view.packName)}</div>
          <h2 className="title mt-2">Did the squad pull it off?</h2>
          {isHost ? (
            <button type="button" onClick={() => setSabWon((v) => !v)} className="card card-press mt-8 flex w-full items-center gap-4 p-5 text-left" aria-pressed={sabWon}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${sabWon ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]' : 'border-[var(--faint)]'}`}>
                {sabWon && <Check size={14} strokeWidth={3} />}
              </span>
              <span>
                <span className="block text-[15.5px] font-semibold">The saboteur got away with it</span>
                <span className="muted mt-0.5 block text-[13.5px]">+{SABOTEUR_BONUS} XP to the saboteur. Revealed after scoring.</span>
              </span>
            </button>
          ) : (
            <p className="muted mt-4 flex items-center gap-2 text-[15px]">
              <span className="live-dot" /> The host is scoring the mission
            </p>
          )}
        </div>
        {isHost && (
          <div className="space-y-3 pb-[calc(20px+var(--safe-bottom))] pt-6">
            <button type="button" className="btn btn-primary" onClick={() => intent({ type: 'resolve', outcome: 'complete', saboteurWon: sabWon })}>
              Mission complete · +{m.xp + (timeLeft ? SPEED_BONUS : 0)} XP
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => intent({ type: 'resolve', outcome: 'chicken', saboteurWon: sabWon })}>
              Chickened out · −{CHICKEN_PENALTY} XP
            </button>
            <button type="button" className="muted h-10 w-full text-[14px]" onClick={() => intent({ type: 'backToRound' })}>
              Back to mission
            </button>
          </div>
        )}
      </div>
    );
  }

  const complete = res.outcome === 'complete';
  const ranked = [...view.players].sort((a, b) => b.xp - a.xp);
  return (
    <div className="enter flex flex-1 flex-col">
      <div className="pt-8">
        <div className="eyebrow">Mission {r.n}</div>
        <h2 className="title mt-2">{complete ? 'Mission complete' : 'Chickened out'}</h2>
        {res.penalty && <p className="mt-3 text-[16px] leading-snug">{res.penalty}</p>}
      </div>

      <div className="card mt-6 p-5">
        <div className="eyebrow">The saboteur was</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="headline text-[22px]">{player(res.saboteurId)?.name || 'Someone'}</span>
          <span className="muted text-[13px]">{res.saboteurWon ? `Got away · +${SABOTEUR_BONUS}` : 'Caught'}</span>
        </div>
        <p className="muted mt-2 text-[14px] leading-snug">{fillText(m.twist, names, view.packName)}</p>
      </div>

      {res.evolved && (
        <div className="card mt-3 flex items-center justify-between p-5">
          <span className="text-[15px] font-semibold">Room evolved</span>
          <span className="muted text-[14px]">
            Level {res.evolved.stage} · {res.evolved.name}
          </span>
        </div>
      )}

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
              <button type="button" className="btn btn-primary" onClick={() => intent({ type: 'spin' })}>
                Next mission
              </button>
              <button type="button" className="muted mt-2 h-11 w-full text-[14px] font-medium" onClick={() => intent({ type: 'lobby' })}>
                Back to lobby
              </button>
            </>
          ) : (
            <div className="muted flex h-14 items-center justify-center gap-2 text-[15px]">
              <span className="live-dot" /> Waiting for the next mission
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
