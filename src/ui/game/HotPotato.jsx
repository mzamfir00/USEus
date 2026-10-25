import React, { useEffect, useRef } from 'react';
import { Bomb } from 'lucide-react';
import { DARE_MS } from '../../game/engine';
import { buzz, Synth } from '../../lib/sound';
import { useNow } from '../room/helpers';
import { GameShell, nameOf } from './shared';

export default function HotPotato({ view, serverNow, intent, onLeave }) {
  useNow(100);
  const r = view.round;
  const d = r.data;
  const me = view.me;
  const holding = d.holder === me;
  const now = serverNow();
  const held = now - d.since;
  const dareLeft = Math.max(0, DARE_MS - held);
  const elapsed = Math.max(0, now - r.startsAt);
  const nextTick = useRef(0);

  // Accelerating tick on the holder's phone (tempo follows round time, not the hidden fuse).
  useEffect(() => {
    if (!holding) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      if (t < nextTick.current) return;
      const interval = Math.max(110, 820 - (Date.now() - r.startsAt) / 90);
      nextTick.current = t + interval;
      Synth.tick(1.2);
      buzz(15);
    }, 40);
    return () => clearInterval(id);
  }, [holding, r.startsAt]);

  useEffect(() => {
    if (holding) {
      Synth.blip();
      buzz([80, 40, 80, 40, 160]);
    }
  }, [holding, d.passes]);

  const pulse = Math.max(0.12, 0.7 - elapsed / 120000);
  const others = r.participants.filter((id) => id !== me && view.players.find((p) => p.id === id)?.connected);

  if (!holding) {
    return (
      <GameShell view={view} serverNow={serverNow} roleLabel="Safe — for now" onLeave={onLeave}>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <div className="text-[15px] font-medium text-white/50">The bomb is with</div>
          <div className="mt-2 text-[48px] font-bold leading-none tracking-[-0.04em]">{nameOf(view, d.holder)}</div>
          <div className="card mt-10 w-full p-5">
            <div className="eyebrow">Their dare</div>
            <div className="mt-1 text-[22px] font-semibold">{d.dare}</div>
          </div>
          <div className="mt-6 text-[14px] text-white/50">Film them. Be ready to catch the bomb.</div>
          <div className="mt-2 text-[13px] text-white/35">{d.passes} pass{d.passes === 1 ? '' : 'es'} so far</div>
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel="You’re holding the bomb" onLeave={onLeave}>
      <div className="absolute inset-0" style={{ animation: `blink ${pulse}s steps(2) infinite`, background: '#fff', opacity: 0.18 }} />
      <div className="absolute inset-0 flex flex-col px-6 pb-[calc(20px+var(--safe-bottom))] pt-[max(92px,calc(env(safe-area-inset-top)+80px))]">
        <div className="text-center">
          <Bomb size={64} strokeWidth={1.6} className="mx-auto" />
          <div className="mt-3 text-[15px] font-medium text-white/60">Do the dare, then pass it</div>
          <div className="mt-2 text-[34px] font-bold leading-tight tracking-[-0.03em]">{d.dare}</div>
          <div className="mx-auto mt-5 h-[3px] w-48 bg-white/15">
            <div className="h-full bg-white" style={{ width: `${(1 - dareLeft / DARE_MS) * 100}%` }} />
          </div>
          <div className="tnum mt-2 text-[13px] text-white/60">{dareLeft > 0 ? `${Math.ceil(dareLeft / 1000)}s` : 'Pass it now'}</div>
        </div>
        <div className="mt-auto">
          <div className="eyebrow mb-2 px-1 !text-white/60">Throw it to</div>
          <div className="grid grid-cols-2 gap-2">
            {others.map((id) => (
              <button
                key={id}
                type="button"
                disabled={dareLeft > 0}
                onClick={() => {
                  buzz(30);
                  intent({ type: 'pass', to: id });
                }}
                className="btn btn-primary !min-h-[60px] !text-[17px] disabled:opacity-25"
              >
                {nameOf(view, id).split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </GameShell>
  );
}
