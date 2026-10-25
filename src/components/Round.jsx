import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, Pause, Play, RotateCcw, ShieldAlert, Trophy, Video } from 'lucide-react';
import { CATEGORIES, DIFFICULTY, HYPE_TASK, ROLES, SPIN_MS } from '../game/constants';
import { MISSIONS } from '../game/missions';
import { castNames, fillText, missionById, timerRemaining } from '../game/engine';
import { buzz, Synth } from '../lib/sound';
import { RichText } from './ui';

export const formatTime = (ms) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const missionNumber = (m) => `#${String(m.id).padStart(2, '0')}`;

// Role + public task for one player in the current round.
export function assignmentFor(view, id) {
  const r = view.round;
  const m = missionById(r.missionId);
  if (r.cast.p1 === id) return { role: ROLES.main, task: m.roles.p1 };
  if (r.cast.p2 === id) return { role: ROLES.director, task: m.roles.p2 };
  if (r.cast.p3 === id) return { role: ROLES.camera, task: m.roles.p3 };
  if (r.cast.extras.includes(id)) return { role: ROLES.hype, task: HYPE_TASK };
  return null;
}

export function useNow(ms = 250) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/* --------------------------------- Spin ---------------------------------- */

export function SpinStage({ view, serverNow, onOpen }) {
  const r = view.round;
  const mission = missionById(r.missionId);
  const names = castNames(view);
  const titles = useMemo(() => MISSIONS.map((m) => fillText(m.title, names, view.packName)), [names, view.packName]);
  const playerNames = view.players.filter((p) => r.participants.includes(p.id)).map((p) => p.name);
  const [locked, setLocked] = useState(() => serverNow() - r.spunAt >= SPIN_MS - 150);
  const [reel, setReel] = useState({ title: locked ? fillText(mission.title, names, view.packName) : '', flick: [], k: 0 });
  const timeout = useRef(null);

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
      setReel({
        title: titles[(k * 7 + Math.floor(Math.random() * titles.length)) % titles.length],
        flick: [0, 1, 2].map(() => playerNames[Math.floor(Math.random() * playerNames.length)]),
        k,
      });
      elapsed += delay;
      delay = delay * 1.11 + 2;
      if (elapsed + delay < total) timeout.current = setTimeout(step, delay);
      else
        timeout.current = setTimeout(() => {
          Synth.lockIn();
          buzz([40, 30, 120]);
          setReel({ title: fillText(mission.title, names, view.packName), flick: [], k: k + 1 });
          setLocked(true);
        }, delay);
    };
    step();
    return () => clearTimeout(timeout.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.spinId]);

  const name = (id) => view.players.find((p) => p.id === id)?.name || '—';
  const rows = [
    [ROLES.main, r.cast.p1],
    [ROLES.director, r.cast.p2],
    [ROLES.camera, r.cast.p3],
  ];

  return (
    <div className="flex flex-1 flex-col">
      {locked && <div key={`flash-${r.spinId}`} className="pointer-events-none fixed inset-0 z-40 bg-[var(--paper)]" style={{ animation: 'sr-flash .45s ease-out both' }} />}
      <div className="mt-8 flex items-baseline justify-between">
        <div className="label">Round {String(r.n).padStart(2, '0')}</div>
        <div className="label">{locked ? 'Locked' : 'Spinning'}</div>
      </div>
      <div className={`hero panel mt-3 overflow-hidden ${locked ? 'shake' : ''}`} data-tag="REEL">
        <div className="flex h-[150px] items-center justify-center px-5 text-center">
          <div key={reel.k} className="display accent text-[34px]" style={{ animation: locked ? 'sr-pop .4s both' : 'sr-reel .09s linear both' }}>
            {reel.title || '———'}
          </div>
        </div>
      </div>
      {locked && (
        <div className="pop mono mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-[var(--zinc)]">
          <span>{DIFFICULTY[mission.difficulty]}</span>
          <span>+{mission.xp} XP</span>
          <span>{formatTime(mission.duration * 1000)}</span>
          <span>Mission {missionNumber(mission)}</span>
        </div>
      )}

      <div className="mt-6 border-t border-[var(--line)]">
        {rows.map(([role, id], i) => (
          <div key={role.key} className="flex items-center gap-4 border-b border-[var(--line)] py-3.5">
            <span className="mono w-5 text-[12px] text-[var(--zinc)]">{role.index}</span>
            <div className="min-w-0 flex-1">
              <div className="label">{role.label}</div>
              <div key={locked ? 'l' : reel.k} className={`truncate text-[24px] font-extrabold ${locked ? 'pop' : 'opacity-40'}`} style={{ animationDelay: `${i * 90}ms` }}>
                {locked ? (id ? name(id) : 'The whole squad') : reel.flick[i] || '—'}
              </div>
            </div>
            {locked && <Lock size={15} />}
          </div>
        ))}
        {r.cast.extras.length > 0 && (
          <div className="flex items-center gap-4 border-b border-[var(--line)] py-3">
            <span className="mono w-5 text-[12px] text-[var(--zinc)]">D</span>
            <div className="min-w-0 flex-1">
              <div className="label">Hype crew</div>
              <div className="truncate text-[16px] font-bold">{r.cast.extras.map(name).join(', ')}</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 border-b border-[var(--line)] py-3.5">
          <span className="mono w-5 text-[12px] text-[var(--zinc)]">?</span>
          <div className="min-w-0 flex-1">
            <div className="label">Secret saboteur</div>
            <div className="flex items-center gap-2 text-[20px] font-extrabold">
              <span className="redact w-24" style={{ display: 'inline-block' }} /> Classified
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <button type="button" disabled={!locked} onClick={onOpen} className="btn btn-lg w-full">
          Open my briefing <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Briefing -------------------------------- */

function SecretCard({ owner, twist, isMe }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        Synth.click();
        buzz(open ? 10 : [20, 30, 20]);
        setOpen((v) => !v);
      }}
      className={`panel w-full px-4 py-4 text-left ${open ? 'selected' : ''}`}
      data-tag="EYES ONLY"
    >
      <div className="flex items-center justify-between">
        <span className="label">🔒 Secret agenda — strictly private</span>
        {open ? <EyeOff size={16} /> : <Eye size={16} />}
      </div>
      {open ? (
        <p className="pop mt-3 text-[19px] font-extrabold leading-snug">{twist}</p>
      ) : (
        <div className="mt-3">
          <div className="display text-[24px]">You are the saboteur</div>
          <div className="muted mt-1 text-[13px] font-semibold">
            {isMe ? 'Shield your screen, then tap to reveal.' : `Pass the phone to ${owner}. Tap to reveal — ${owner}'s eyes only.`}
          </div>
        </div>
      )}
    </button>
  );
}

function TimerPanel({ view, serverNow, intent, canControl }) {
  useNow(200);
  const t = view.round.timer;
  const left = timerRemaining(t, serverNow());
  const urgent = t.running && left > 0 && left <= 10000;
  const secs = Math.ceil(left / 1000);
  const prev = useRef(secs);

  useEffect(() => {
    if (secs !== prev.current) {
      if (t.running && secs <= 10 && secs > 0) {
        Synth.beep(secs <= 3);
        buzz(secs <= 3 ? 60 : 25);
      }
      if (secs === 0 && prev.current > 0) {
        Synth.alarm();
        buzz([200, 80, 200, 80, 400]);
      }
      prev.current = secs;
    }
  }, [secs, t.running]);

  const op = (o) => {
    Synth.unlock();
    Synth.click();
    buzz(12);
    intent({ type: 'timer', op: o });
  };
  const full = left >= t.duration * 1000;
  const pct = Math.min(100, (left / Math.max(t.duration * 1000, left)) * 100);

  return (
    <div className={`panel mt-4 px-4 py-4 ${urgent ? 'urgent' : ''}`} data-tag="CLOCK">
      <div className="flex items-center justify-between">
        <span className="label flex items-center gap-2">
          {left === 0 ? "Time's up" : t.running ? 'Live — synced' : 'Paused'}
          {t.running && <span className="dot blink" />}
        </span>
        {canControl && (
          <button type="button" onClick={() => op('reset')} className="label flex items-center gap-1" aria-label="Reset timer">
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>
      <div key={urgent ? secs : 'calm'} className={`display tnum mt-2 text-center text-[84px] ${urgent ? 'pop' : ''}`}>
        {formatTime(left)}
      </div>
      <div className="mt-3 h-[3px] bg-[var(--line)]">
        <div className="h-full bg-[var(--paper)] transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      {canControl ? (
        <>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onClick={() => op('toggle')} className="btn">
              {t.running ? <Pause size={18} /> : <Play size={18} />}
              {t.running ? 'Pause' : left === 0 ? 'Restart' : full ? 'Start mission' : 'Resume'}
            </button>
            <button type="button" onClick={() => op('add')} className="btn-ghost">
              +1 min
            </button>
          </div>
          <button type="button" onClick={() => op('sim10')} className="mono mt-2 w-full border border-dashed border-[var(--line-strong)] py-2.5 text-[11px] uppercase tracking-[0.18em] text-[var(--zinc)]">
            Simulate last 10 seconds (test)
          </button>
        </>
      ) : (
        <div className="mono mt-3 text-center text-[11px] uppercase tracking-[0.16em] text-[var(--zinc)]">Controlled by the squad</div>
      )}
    </div>
  );
}

export function Briefing({ view, serverNow, intent, localIds, onCamera }) {
  const r = view.round;
  const m = missionById(r.missionId);
  const names = castNames(view);
  const me = view.me;
  const isHost = view.hostId === me;
  const mine = assignmentFor(view, me);
  const participant = r.participants.includes(me);
  const name = (id) => view.players.find((p) => p.id === id)?.name || 'Someone';
  const others = r.participants.filter((id) => id !== me);
  const secretOwner = view.secret?.saboteurId;
  const cat = CATEGORIES[r.category];

  return (
    <div className="pb-28">
      <div className="mono mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-[var(--zinc)]">
        <span>{cat.index} {cat.id === 'creator' ? view.packName : cat.label}</span>
        <span>{DIFFICULTY[m.difficulty]}</span>
        <span>+{m.xp} XP</span>
      </div>

      <div className="hero panel rise mt-3 px-5 py-5" data-tag={`MISSION ${missionNumber(m)}`}>
        <div className="display accent text-[15px]">{fillText(m.title, names, view.packName)}</div>
        <p className={`mt-3 font-extrabold leading-[1.16] ${m.prompt.length > 230 ? 'text-[22px]' : 'text-[25px]'}`}>
          <RichText text={m.prompt} names={names} pack={view.packName} />
        </p>
      </div>

      {/* 1 — MY ASSIGNMENT */}
      <div className="mt-6 label">01 — My assignment</div>
      {mine ? (
        <div className="rise mt-3 border border-[var(--paper)] bg-[var(--paper)] px-5 py-5 text-[var(--ink)]">
          <div className="mono text-[11px] uppercase tracking-[0.2em] opacity-60">
            Role {mine.role.index} · {mine.role.label}
          </div>
          <div className="display mt-2 text-[34px]">{name(me)}</div>
          <p className="mt-3 text-[17px] font-semibold leading-snug">
            <RichText text={mine.task} names={names} pack={view.packName} />
          </p>
        </div>
      ) : (
        <div className="panel mt-3 px-4 py-4">
          <div className="text-[16px] font-bold">{participant ? 'Stand by.' : 'You joined mid-round.'}</div>
          <div className="muted mt-1 text-[14px]">Hype the squad for this one — you are dealt in next round.</div>
        </div>
      )}

      {/* 2 — SECRET AGENDA */}
      <div className="mt-6 label">02 — Secret agenda</div>
      <div className="mt-3">
        {secretOwner && localIds.includes(secretOwner) ? (
          <SecretCard owner={name(secretOwner)} isMe={secretOwner === me} twist={fillText(m.twist, names, view.packName)} />
        ) : (
          <div className="panel flex gap-3 px-4 py-4" data-tag="CLASSIFIED">
            <ShieldAlert size={20} className="mt-0.5 shrink-0" />
            <p className="text-[14px] font-extrabold uppercase leading-snug tracking-wide">
              ⚠️ 1 player in this room has received a classified secret objective. Trust no one.
            </p>
          </div>
        )}
      </div>

      <TimerPanel view={view} serverNow={serverNow} intent={intent} canControl={participant || isHost} />

      <button
        type="button"
        onClick={() => {
          Synth.unlock();
          Synth.whoosh();
          onCamera();
        }}
        className="btn-ghost mt-4 w-full justify-between"
      >
        <span className="flex items-center gap-3">
          <Video size={18} /> POV REC / Stamp mode
        </span>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="dot blink" /> REC
        </span>
      </button>

      {/* 3 — OTHER SQUAD MEMBERS */}
      <div className="mt-8 label">03 — Squad public missions</div>
      <div className="mt-3 border-t border-[var(--line)]">
        {others.map((id) => {
          const a = assignmentFor(view, id);
          const p = view.players.find((x) => x.id === id);
          return (
            <div key={id} className="border-b border-[var(--line)] py-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="truncate text-[19px] font-extrabold">
                  {p?.name || 'Someone'}
                  {p?.isBot && <span className="mono ml-2 text-[10px] text-[var(--zinc)]">PASS-THE-PHONE</span>}
                </div>
                <div className="mono shrink-0 text-[10.5px] uppercase tracking-[0.16em] text-[var(--zinc)]">
                  {a.role.index} · {a.role.label}
                </div>
              </div>
              <p className="muted mt-1.5 text-[14px] leading-snug">
                <RichText text={a.task} names={names} pack={view.packName} />
              </p>
            </div>
          );
        })}
        {!r.cast.p3 && (
          <div className="border-b border-[var(--line)] py-4">
            <div className="text-[19px] font-extrabold">The whole squad</div>
            <p className="muted mt-1.5 text-[14px] leading-snug">{m.roles.p3}</p>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-md bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
          {isHost ? (
            <button
              type="button"
              className="btn btn-lg w-full"
              onClick={() => {
                Synth.click();
                intent({ type: 'score' });
              }}
            >
              <Trophy size={18} /> End mission & score
            </button>
          ) : (
            <div className="mono border border-[var(--line)] bg-[var(--bg)] py-4 text-center text-[11px] uppercase tracking-[0.18em] text-[var(--zinc)]">
              The host ends & scores the mission
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
