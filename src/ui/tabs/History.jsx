import React from 'react';
import { Clock } from 'lucide-react';
import { DNA_STYLES } from '../../game/constants';
import { dnaInfo } from '../../game/engine';
import { roomBadges } from '../../lib/database';
import { Empty, LevelDots, ScreenHeader, SectionLabel } from '../primitives';

const when = (ts) => {
  const d = new Date(ts);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

export default function History({ account }) {
  const rooms = roomBadges(account.id).filter((r) => (r.dna?.completed || 0) > 0);
  const missions = account.history || [];

  return (
    <div className="enter">
      <ScreenHeader title="History" />

      {rooms.length > 0 && (
        <>
          <SectionLabel>Room evolution</SectionLabel>
          <div className="noscroll -mx-6 flex gap-3 overflow-x-auto px-6 pb-1">
            {rooms.map((r) => {
              const info = dnaInfo(r.dna);
              return (
                <div key={r.code} className="card w-[156px] shrink-0 p-4">
                  <div className="flex items-center justify-between">
                    <span className="tnum text-[15px] font-semibold tracking-[0.08em]">{r.code}</span>
                    <LevelDots stage={info.stage} />
                  </div>
                  <div className="headline mt-6 text-[17px]">{DNA_STYLES[info.style].name}</div>
                  <div className="muted mt-1 text-[12.5px]">
                    Level {info.stage} · {info.completed} mission{info.completed === 1 ? '' : 's'}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <SectionLabel>Missions</SectionLabel>
      {missions.length > 0 ? (
        <div className="card divide overflow-hidden">
          {missions.map((h, i) => (
            <div key={`${h.at}-${i}`} className="flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{h.mission}</div>
                <div className="muted mt-0.5 truncate text-[13.5px]">
                  Room {h.room} · with {h.squad.filter((n) => n !== account.name).join(', ') || 'the squad'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-medium">{h.outcome === 'complete' ? 'Completed' : 'Chickened'}</div>
                <div className="muted text-[12px]">{when(h.at)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={Clock} title="No missions yet" body="Missions you play show up here, along with the rooms you’ve evolved." />
      )}
    </div>
  );
}
