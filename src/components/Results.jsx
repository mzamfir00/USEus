import React, { useState } from 'react';
import { Check, ChevronLeft, Dices, House } from 'lucide-react';
import { CHICKEN_PENALTY, SABOTEUR_BONUS, SPEED_BONUS } from '../game/constants';
import { castNames, fillText, missionById, timerRemaining } from '../game/engine';
import { Synth } from '../lib/sound';

function Leaderboard({ view }) {
  const deltas = view.results?.deltas || {};
  const sorted = [...view.players].sort((a, b) => b.xp - a.xp);
  const max = Math.max(1, ...sorted.map((p) => p.xp));
  return (
    <div className="border-t border-[var(--line)]">
      {sorted.map((p, i) => (
        <div key={p.id} className="rise relative border-b border-[var(--line)] py-3" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="absolute inset-y-0 left-0 bg-[var(--paper)] opacity-[0.07] transition-[width] duration-700" style={{ width: `${Math.max(0, (p.xp / max) * 100)}%` }} />
          <div className="relative flex items-center gap-3">
            <span className="mono w-6 text-[12px] text-[var(--zinc)]">{String(i + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1 truncate text-[18px] font-extrabold">
              {p.name}
              {p.id === view.me && <span className="mono ml-2 text-[10px] text-[var(--zinc)]">YOU</span>}
            </span>
            {deltas[p.id] ? (
              <span className={`pop mono px-1.5 text-[11px] font-bold ${deltas[p.id] > 0 ? 'bg-[var(--paper)] text-[var(--ink)]' : 'border border-[var(--paper)]'}`}>
                {deltas[p.id] > 0 ? '+' : ''}
                {deltas[p.id]}
              </span>
            ) : null}
            <span className="display tnum w-20 text-right text-[20px]">
              {p.xp}
              <span className="mono ml-1 text-[9px] text-[var(--zinc)]">XP</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Results({ view, intent, serverNow }) {
  const isHost = view.hostId === view.me;
  const r = view.round;
  const m = missionById(r.missionId);
  const names = castNames(view);
  const res = view.results;
  const [sabWon, setSabWon] = useState(false);
  const name = (id) => view.players.find((p) => p.id === id)?.name || 'Someone';
  const timeLeft = timerRemaining(r.timer, serverNow()) > 0;

  if (!res) {
    return (
      <div className="rise pb-10">
        <div className="mt-10 label">Mission #{String(m.id).padStart(2, '0')} — {fillText(m.title, names, view.packName)}</div>
        <h2 className="display mt-3 text-[clamp(34px,11vw,46px)]">
          Did the squad <span className="accent">pull it off?</span>
        </h2>
        {isHost ? (
          <>
            <button
              type="button"
              onClick={() => {
                Synth.click();
                setSabWon((v) => !v);
              }}
              className={`panel mt-8 flex w-full items-start gap-3 px-4 py-4 text-left ${sabWon ? 'selected' : ''}`}
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center border border-current">{sabWon && <Check size={14} strokeWidth={3} />}</span>
              <span>
                <span className="block text-[16px] font-extrabold">The saboteur pulled off their secret objective</span>
                <span className="muted mt-1 block text-[13px]">Nobody caught it → +{SABOTEUR_BONUS} XP to the saboteur. Identity revealed after scoring.</span>
              </span>
            </button>
            <div className="mt-4 grid gap-3">
              <button type="button" className="btn btn-lg w-full flex-col !gap-0.5 py-4" onClick={() => intent({ type: 'resolve', outcome: 'complete', saboteurWon: sabWon })}>
                <span>Mission complete</span>
                <span className="mono text-[10.5px] font-medium tracking-[0.12em] opacity-60">
                  +{m.xp} XP each{timeLeft ? ` · +${SPEED_BONUS} beat the clock` : ''}
                </span>
              </button>
              <button type="button" className="btn-ghost btn-lg w-full flex-col !gap-0.5 py-4" onClick={() => intent({ type: 'resolve', outcome: 'chicken', saboteurWon: sabWon })}>
                <span>Chickened out</span>
                <span className="mono text-[10.5px] font-medium tracking-[0.12em] opacity-60">−{CHICKEN_PENALTY} XP + a penalty dare</span>
              </button>
              <button type="button" className="label mt-2 flex items-center justify-center gap-1 py-2" onClick={() => intent({ type: 'backToRound' })}>
                <ChevronLeft size={13} /> Back to the mission
              </button>
            </div>
          </>
        ) : (
          <div className="mono mt-10 flex items-center gap-2 border border-[var(--line)] px-4 py-4 text-[11px] uppercase tracking-[0.18em] text-[var(--zinc)]">
            <span className="dot blink" /> Host is scoring the mission…
          </div>
        )}
      </div>
    );
  }

  const complete = res.outcome === 'complete';
  return (
    <div className="pb-10">
      <div className="pop mt-10">
        <div className="label">Round {String(r.n).padStart(2, '0')} — result</div>
        <h2 className="display mt-3 text-[clamp(34px,11.5vw,52px)]">{complete ? <>Mission accomplished</> : <>Chickened out</>}</h2>
      </div>

      <div className="panel rise mt-7 px-4 py-4" data-tag="DECLASSIFIED">
        <div className="label">The saboteur was</div>
        <div className="display mt-1 text-[30px]">{name(res.saboteurId)}</div>
        <p className="muted mt-2 text-[14px] leading-snug">“{fillText(m.twist, names, view.packName)}”</p>
        <div className="mono mt-3 text-[11px] uppercase tracking-[0.16em]">{res.saboteurWon ? `Pulled it off · +${SABOTEUR_BONUS} XP` : 'Caught / failed'}</div>
      </div>

      {res.penalty && (
        <div className="shake mt-4 border border-[var(--paper)] px-4 py-4">
          <div className="label">Penalty dare</div>
          <p className="mt-1.5 text-[19px] font-extrabold leading-snug">{res.penalty}</p>
        </div>
      )}

      {res.evolved && (
        <div className="rise mt-4 bg-[var(--paper)] px-4 py-4 text-[var(--ink)]">
          <div className="mono text-[10.5px] uppercase tracking-[0.2em] opacity-60">Room DNA evolved</div>
          <div className="display mt-1 text-[24px]">
            LV.{res.evolved.stage} — {res.evolved.name}
          </div>
        </div>
      )}

      <div className="mt-8 label">Room leaderboard</div>
      <div className="mt-3">
        <Leaderboard view={view} />
      </div>

      <div className="mt-8 space-y-3">
        {isHost ? (
          <>
            <button
              type="button"
              className="btn btn-lg w-full"
              onClick={() => {
                Synth.unlock();
                Synth.whoosh();
                intent({ type: 'spin' });
              }}
            >
              <Dices size={20} /> Next round
            </button>
            <div className="mono text-center text-[10.5px] uppercase tracking-[0.16em] text-[var(--zinc)]">Roles rotate automatically</div>
            <button type="button" className="btn-ghost w-full" onClick={() => intent({ type: 'lobby' })}>
              <House size={16} /> Back to lobby
            </button>
          </>
        ) : (
          <div className="mono flex items-center justify-center gap-2 border border-[var(--line)] py-4 text-[11px] uppercase tracking-[0.18em] text-[var(--zinc)]">
            <span className="dot blink" /> Waiting for the next spin
          </div>
        )}
      </div>
    </div>
  );
}
