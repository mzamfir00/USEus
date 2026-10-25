import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Radar, Siren } from 'lucide-react';
import { requestMotion, useMotionMode } from '../../lib/motion';
import { PICK_MS, WHEEL_MS } from '../../game/engine';
import { ARENAS, GAMES, HUNT, XP } from '../../game/games';
import { buzz, Synth } from '../../lib/sound';
import { useNow } from '../room/helpers';
import { nameOf } from './shared';

const roleBrief = (view) => {
  const r = view.round;
  const g = GAMES[r.game];
  const role = r.roles[view.me];
  if (!role) return { label: 'Spectator', brief: 'You joined mid-round. Watch this one — you’re in next time.' };
  if (r.game === 'undercover' && view.mine?.saboteur) return g.roles.saboteur;
  if (r.game === 'paparazzi') return { label: 'Sniper', brief: `${g.roles.sniper.brief} Your target: ${nameOf(view, view.mine?.target)}.` };
  return g.roles[role];
};

// Monochrome roulette wheel over the games that fit the arena.
function Wheel({ view, serverNow, onLocked }) {
  const r = view.round;
  const pool = r.pool;
  const seg = 360 / pool.length;
  const idx = Math.max(0, pool.indexOf(r.game));
  const elapsed = serverNow() - r.spunAt;
  const late = elapsed >= WHEEL_MS - 200;
  const final = 360 * 6 + (360 - (idx + 0.5) * seg);
  const [angle, setAngle] = useState(late ? final : 0);
  const [locked, setLocked] = useState(late);
  const timers = useRef([]);

  useEffect(() => {
    if (late) {
      onLocked();
      return undefined;
    }
    const total = WHEEL_MS - elapsed;
    requestAnimationFrame(() => requestAnimationFrame(() => setAngle(final)));
    // Ticks slow down with the wheel.
    let t = 0;
    let gap = 45;
    while (t + gap < total - 120) {
      t += gap;
      timers.current.push(setTimeout(() => Synth.tick(0.9), t));
      gap *= 1.09;
    }
    timers.current.push(
      setTimeout(() => {
        Synth.lockIn();
        buzz([40, 30, 120]);
        setLocked(true);
        onLocked();
      }, total)
    );
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.spinId]);

  const total = Math.max(0, WHEEL_MS - elapsed);
  return (
    <div className="relative mx-auto aspect-square w-[min(84vw,340px)]">
      <div className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[11px] border-t-[18px] border-x-transparent border-t-[var(--fg)]" />
      <svg
        viewBox="-100 -100 200 200"
        className="h-full w-full"
        style={{ transform: `rotate(${angle}deg)`, transition: late ? 'none' : `transform ${total}ms cubic-bezier(.12,.62,.08,1)` }}
      >
        {pool.map((id, i) => {
          const a0 = ((i * seg - 90) * Math.PI) / 180;
          const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
          const large = seg > 180 ? 1 : 0;
          const path = pool.length === 1 ? 'M -96 0 A 96 96 0 1 1 96 0 A 96 96 0 1 1 -96 0' : `M 0 0 L ${96 * Math.cos(a0)} ${96 * Math.sin(a0)} A 96 96 0 ${large} 1 ${96 * Math.cos(a1)} ${96 * Math.sin(a1)} Z`;
          const mid = (i + 0.5) * seg;
          const on = locked && i === idx;
          return (
            <g key={id}>
              <path d={path} fill={on ? '#fff' : i % 2 ? '#141414' : '#000'} stroke="#262626" strokeWidth="1" />
              <text
                transform={`rotate(${mid - 90}) translate(56 0)${mid > 180 ? ' rotate(180)' : ''}`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={pool.length > 6 ? 7.4 : 9}
                fontWeight="700"
                fill={on ? '#000' : '#fff'}
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                {GAMES[id].short}
              </text>
            </g>
          );
        })}
        <circle r="96" fill="none" stroke="#fff" strokeWidth="1.5" />
        <circle r="16" fill="#000" stroke="#fff" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export default function Intro({ view, serverNow }) {
  useNow(200);
  const r = view.round;
  const g = GAMES[r.game];
  const now = serverNow();
  const isRandom = r.mode === 'random';
  const revealAt = r.spunAt + (isRandom ? WHEEL_MS : PICK_MS);
  const [locked, setLocked] = useState(!isRandom || now >= revealAt);
  const showRole = now >= revealAt;
  const startsIn = Math.max(0, Math.ceil((r.startsAt - now) / 1000));
  const brief = roleBrief(view);
  const played = useRef(false);
  const motion = useMotionMode();
  const films = g.film.includes(r.roles[view.me]);

  // Ask for location during the intro so the prompt doesn't land mid-game.
  useEffect(() => {
    if (r.zone && !r.zone.sim) navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, timeout: 15000 });
  }, [r.spinId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isRandom && !played.current && now < revealAt) {
      played.current = true;
      Synth.lockIn();
      buzz([40, 30, 120]);
    }
  }, [isRandom, now, revealAt]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-10 text-center">
      {!showRole ? (
        <>
          <div className="eyebrow">{isRandom ? `Random roulette · ${ARENAS[r.arena].label}` : 'Host’s pick'}</div>
          <div className="mt-6 w-full">
            {isRandom ? (
              <Wheel view={view} serverNow={serverNow} onLocked={() => setLocked(true)} />
            ) : (
              <div className="pop title text-[44px]">{g.name}</div>
            )}
          </div>
          {isRandom && locked && <div className="pop title mt-6 text-[32px]">{g.name}</div>}
        </>
      ) : (
        <div className="enter w-full">
          <div className="eyebrow">{g.name}</div>
          <div className="mt-6 text-[15px] font-medium text-[var(--muted)]">You are</div>
          <div className="title mt-1 text-[40px]">{brief.label}</div>
          <p className="mx-auto mt-4 max-w-[32ch] text-[16px] leading-relaxed">{brief.brief}</p>
          {films && (
            <div className="mx-auto mt-5 flex max-w-[32ch] items-start gap-2 rounded-[16px] border border-[var(--border)] px-4 py-3 text-left text-[13px] leading-snug">
              <Siren size={16} className="mt-0.5 shrink-0" />
              <span>Snitch Protocol: you must keep filming. Stopping, leaving the app or covering the lens sets off a siren and flashing lights.</span>
            </div>
          )}
          {r.zone && (
            <div className="mx-auto mt-3 flex max-w-[32ch] items-start gap-2 rounded-[16px] border border-[var(--border)] px-4 py-3 text-left text-[13px] leading-snug" data-zone-intro>
              <Radar size={16} className="mt-0.5 shrink-0" />
              <span>
                GPS Playzone · {r.zone.radius} m{r.zone.shrink ? ', shrinking in the final 3 minutes' : ''}. Leave it for 10 s and your live position is revealed ({XP.zoneOut} XP).
                {r.hunt ? ` ${HUNT[r.game].hunter}s get 2 radar pings; ${HUNT[r.game].hiders} get a decoy, a heartbeat warning and a mid-round supply drop.` : ''}
                {r.zone.sim ? ' Simulated GPS: move with the on-screen pad.' : ''}
              </span>
            </div>
          )}
          {motion === 'ask' && (
            <button
              type="button"
              className="btn btn-secondary mx-auto mt-4 !w-auto px-6"
              onClick={() => {
                Synth.unlock();
                requestMotion();
              }}
            >
              {r.zone ? 'Enable motion & compass' : 'Enable motion sensors'}
            </button>
          )}
          {r.location && (
            <div className="muted mt-6 inline-flex items-center gap-1.5 text-[13.5px]">
              <MapPin size={14} /> {r.location}
            </div>
          )}
          <div className="mt-10">
            <div className="tnum text-[64px] font-bold leading-none">{startsIn}</div>
            <div className="muted mt-2 text-[14px]">Starting</div>
          </div>
        </div>
      )}
    </div>
  );
}
