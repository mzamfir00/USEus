import React, { useState } from 'react';
import { ChevronDown, Lock, Timer } from 'lucide-react';
import { castNames, fillText, missionById, timerRemaining } from '../../game/engine';
import { buzz } from '../../lib/sound';
import { Avatar, RichText, SectionLabel } from '../primitives';
import { assignmentFor, formatTime, useNow } from './helpers';

function SecretDirective({ view, names }) {
  const [open, setOpen] = useState(false);
  const m = missionById(view.round.missionId);
  const mine = view.secret?.saboteurId === view.me;

  if (!mine) {
    return (
      <div className="card flex items-center gap-4 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border)]">
          <Lock size={17} />
        </span>
        <div>
          <div className="text-[15px] font-semibold">Secret directive</div>
          <div className="muted mt-0.5 text-[13.5px] leading-snug">One player in this room has a classified objective. Trust no one.</div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        buzz(open ? 8 : [15, 25, 15]);
        setOpen((v) => !v);
      }}
      aria-expanded={open}
      className="card card-press w-full p-5 text-left"
    >
      <div className="flex items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)]">
          <Lock size={17} />
        </span>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">Secret directive</div>
          <div className="muted mt-0.5 text-[13.5px]">{open ? 'Only your phone received this.' : 'Only you can see this. Tap to reveal.'}</div>
        </div>
        <ChevronDown size={18} className={`muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && <p className="pop mt-4 border-t border-[var(--border)] pt-4 text-[18px] font-semibold leading-snug">{fillText(m.twist, names, view.packName)}</p>}
    </button>
  );
}

export default function Mission({ view, serverNow, intent, onOverlay }) {
  useNow(500);
  const r = view.round;
  const m = missionById(r.missionId);
  const names = castNames(view);
  const isHost = view.hostId === view.me;
  const mine = assignmentFor(view, view.me);
  const others = r.participants.filter((id) => id !== view.me);
  const player = (id) => view.players.find((p) => p.id === id);
  const left = timerRemaining(r.timer, serverNow());

  return (
    <div className="enter">
      <div className="card p-6">
        {mine ? (
          <>
            <div className="eyebrow">Your role</div>
            <div className="headline mt-1 text-[30px]">{mine.role.label}</div>
            <p className="mt-3 text-[17px] leading-snug">
              <RichText text={mine.task} names={names} pack={view.packName} />
            </p>
          </>
        ) : (
          <>
            <div className="eyebrow">You joined mid-mission</div>
            <div className="headline mt-1 text-[26px]">Hype the squad</div>
            <p className="muted mt-2 text-[15px]">You’ll be dealt a role in the next mission.</p>
          </>
        )}
        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <div className="eyebrow">{fillText(m.title, names, view.packName)}</div>
          <p className="mt-2 text-[16px] leading-relaxed text-[var(--fg)]/90">
            <RichText text={m.prompt} names={names} pack={view.packName} />
          </p>
        </div>
      </div>

      <div className="mt-3">
        <SecretDirective view={view} names={names} />
      </div>

      <SectionLabel>Squad assignments</SectionLabel>
      <div className="card divide overflow-hidden">
        {others.map((id) => {
          const a = assignmentFor(view, id);
          return (
            <div key={id} className="flex gap-3 px-5 py-4">
              <Avatar name={player(id)?.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15.5px] font-semibold">{player(id)?.name}</span>
                  <span className="muted shrink-0 text-[13px]">{a.role.label}</span>
                </div>
                <p className="muted mt-1 text-[14px] leading-snug">
                  <RichText text={a.task} names={names} pack={view.packName} />
                </p>
              </div>
            </div>
          );
        })}
        {!r.cast.p3 && (
          <div className="px-5 py-4">
            <div className="text-[15.5px] font-semibold">Everyone</div>
            <p className="muted mt-1 text-[14px] leading-snug">{m.roles.p3}</p>
          </div>
        )}
      </div>

      <div className="h-40" />
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-10">
        <div className="mx-auto max-w-md px-6 pb-[calc(16px+var(--safe-bottom))]">
          <button type="button" className="btn btn-primary justify-between !px-6" onClick={onOverlay}>
            <span className="flex items-center gap-2">
              <Timer size={18} /> Timer & camera
            </span>
            <span className="tnum flex items-center gap-2">
              {r.timer.running && <span className="live-dot !bg-[var(--bg)]" />}
              {formatTime(left)}
            </span>
          </button>
          {isHost && (
            <button type="button" className="muted mt-2 h-11 w-full text-[14px] font-medium" onClick={() => intent({ type: 'score' })}>
              End mission
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
