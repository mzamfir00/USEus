import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SPIN_MS } from '../../game/constants';
import { MISSIONS } from '../../game/missions';
import { castNames, fillText, missionById } from '../../game/engine';
import { buzz, Synth } from '../../lib/sound';
import { assignmentFor } from './helpers';

// Synchronized roulette: every phone animates from the host's spin timestamp.
export default function Spin({ view, serverNow, onDone }) {
  const r = view.round;
  const mission = missionById(r.missionId);
  const names = castNames(view);
  const finalTitle = fillText(mission.title, names, view.packName);
  const titles = useMemo(() => MISSIONS.map((m) => fillText(m.title, names, view.packName)), [names, view.packName]);
  const [locked, setLocked] = useState(() => serverNow() - r.spunAt >= SPIN_MS - 150);
  const [reel, setReel] = useState({ title: locked ? finalTitle : '', k: 0 });
  const timer = useRef(null);
  const mine = assignmentFor(view, view.me);

  useEffect(() => {
    if (locked) return undefined;
    const total = Math.max(300, SPIN_MS - (serverNow() - r.spunAt));
    let elapsed = 0;
    let delay = 42 * (total / SPIN_MS) + 8;
    let k = 0;
    const step = () => {
      k += 1;
      Synth.tick(1 - Math.min(0.5, elapsed / total / 2));
      buzz(5);
      setReel({ title: titles[(k * 7 + Math.floor(Math.random() * titles.length)) % titles.length], k });
      elapsed += delay;
      delay = delay * 1.11 + 2;
      timer.current = setTimeout(
        elapsed + delay < total
          ? step
          : () => {
              Synth.lockIn();
              buzz([40, 30, 120]);
              setReel({ title: finalTitle, k: k + 1 });
              setLocked(true);
            },
        delay
      );
    };
    step();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.spinId]);

  return (
    <div className="flex flex-1 flex-col">
      {locked && <div key={`flash-${r.spinId}`} className="pointer-events-none fixed inset-0 z-40 bg-white" style={{ animation: 'flash .4s ease-out both' }} />}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="eyebrow">{locked ? `Mission ${r.n}` : 'Spinning'}</div>
        <div className="mt-4 flex min-h-[140px] items-center px-2">
          <div key={reel.k} className="headline text-[38px]" style={{ animation: locked ? 'pop .4s both' : 'reel .09s linear both' }}>
            {reel.title || ' '}
          </div>
        </div>
        {locked && mine && (
          <div className="pop mt-6">
            <div className="eyebrow">You are</div>
            <div className="mt-1 text-[22px] font-semibold">{mine.role.label}</div>
          </div>
        )}
      </div>
      <div className="pb-[calc(20px+var(--safe-bottom))] pt-6">
        <button type="button" className="btn btn-primary" disabled={!locked} onClick={onDone}>
          See your mission
        </button>
      </div>
    </div>
  );
}
