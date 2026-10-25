import React, { useEffect, useRef, useState } from 'react';
import { FREEZE_GRACE } from '../../game/engine';
import { GAMES } from '../../game/games';
import { motionLive, requestMotion, subscribeMotion, useMotionMode } from '../../lib/motion';
import { buzz, Synth } from '../../lib/sound';
import { useNow } from '../room/helpers';
import Camera from './Camera';
import { BottomBar, GameShell, nameOf } from './shared';

export function RedLightWatcher({ view, serverNow, intent, onLeave }) {
  useNow(250);
  const d = view.round.data;
  const red = d.light === 'red';
  const locked = serverNow() - d.changedAt < 1500;
  const runners = view.round.participants.filter((id) => view.round.roles[id] === 'runner');
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={GAMES.red_light.roles.watcher.label} onLeave={onLeave} light={!red}>
      <button
        type="button"
        disabled={locked}
        onClick={() => {
          buzz(red ? 30 : [80, 40, 80]);
          intent({ type: 'light' });
        }}
        className={`absolute inset-0 flex flex-col items-center justify-center px-8 text-center transition-colors duration-150 ${red ? 'bg-black text-white' : 'bg-white text-black'}`}
      >
        <div className={`text-[15px] font-medium ${red ? 'text-white/50' : 'text-black/50'}`}>{red ? 'Red light' : 'Green light'}</div>
        <div className="mt-3 text-[64px] font-bold leading-[0.9] tracking-[-0.05em]">{red ? 'FREEZE!' : 'GO'}</div>
        <div className={`mt-6 text-[16px] ${red ? 'text-white/60' : 'text-black/60'}`}>{locked ? '…' : red ? 'Tap for green light' : 'Tap to call FREEZE'}</div>
      </button>
      <BottomBar>
        <div className={`rounded-[20px] border px-4 py-3 ${red ? 'border-white/15 bg-white/5' : 'border-black/10 bg-black/5'}`}>
          <div className={`text-[12.5px] font-medium ${red ? 'text-white/55' : 'text-black/55'}`}>Runners</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {runners.map((id) => (
              <span key={id} className={`text-[15px] font-semibold ${d.out[id] ? 'line-through opacity-40' : ''}`}>
                {nameOf(view, id)}
                {d.out[id] ? ' · out' : ''}
              </span>
            ))}
          </div>
        </div>
      </BottomBar>
    </GameShell>
  );
}

// Motion detection from the shared sensor feed; without live readings (desktop, denied or
// not yet granted) the hold-still button referees instead.
function useMotion(onMove) {
  const mode = useMotionMode();
  const [live, setLive] = useState(() => motionLive());
  const cb = useRef(onMove);
  cb.current = onMove;
  useEffect(() => {
    if (mode !== 'sensor') return undefined;
    let last = null;
    const off = subscribeMotion((e, { accel, rot }) => {
      let moved = accel > 1.6 || rot > 70;
      const g = e.accelerationIncludingGravity;
      if (e.acceleration?.x == null && g?.x != null) {
        if (last) moved = moved || Math.hypot(g.x - last.x, g.y - last.y, g.z - last.z) > 2.2;
        last = { x: g.x, y: g.y, z: g.z };
      }
      if (moved) cb.current();
    });
    const t = setInterval(() => setLive(motionLive()), 1000);
    return () => {
      off();
      clearInterval(t);
    };
  }, [mode]);
  return { mode: mode === 'ask' ? 'ask' : mode === 'sensor' && live ? 'sensor' : 'touch', ask: requestMotion };
}

export function RedLightRunner({ view, serverNow, intent, onLeave, hud }) {
  useNow(150);
  const d = view.round.data;
  const me = view.me;
  const out = !!d.out[me];
  const red = d.light === 'red';
  const now = serverNow();
  const armed = red && now - d.changedAt >= FREEZE_GRACE && !out;
  const [holding, setHolding] = useState(false);
  const [alarm, setAlarm] = useState(false);
  const flips = useRef(d.flips);
  const report = () => armed && intent({ type: 'moved' });
  const motion = useMotion(report);
  // Until the motion sensor is actually running, the hold-still button is the referee.
  const touch = motion.mode !== 'sensor';

  // Siren + flash the moment the watcher calls freeze.
  useEffect(() => {
    if (d.flips === flips.current) return undefined;
    flips.current = d.flips;
    if (d.light !== 'red' || out) return undefined;
    Synth.siren();
    buzz([200, 60, 200]);
    setAlarm(true);
    const t = setTimeout(() => setAlarm(false), 900);
    return () => clearTimeout(t);
  }, [d.flips, d.light, out]);

  // Touch fallback: releasing the hold during red counts as moving.
  useEffect(() => {
    if (touch && armed && !holding) intent({ type: 'moved' });
  }, [touch, armed, holding, intent]);

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={out ? 'Out · keep filming' : 'Runner · reach the watcher'} onLeave={onLeave}>
      <Camera hud={hud} record enforce>
        {alarm && <div className="pointer-events-none absolute inset-0 z-30" style={{ animation: 'flash .15s steps(2) infinite', background: '#fff' }} />}
        <div className="absolute inset-x-4 top-[max(150px,calc(env(safe-area-inset-top)+136px))] z-10 mr-14">
          <div className={`pointer-events-none rounded-[18px] px-5 py-3 text-center ${out ? 'border border-white/20 bg-black/70 text-white' : red ? 'bg-white text-black' : 'border border-white/20 bg-black/60 text-white backdrop-blur'}`}>
            <div className="text-[30px] font-bold tracking-[-0.03em]">{out ? 'YOU MOVED · OUT' : red ? 'FREEZE' : 'GREEN · MOVE'}</div>
            {!out && red && <div className="text-[13px] text-black/60">{touch ? 'Keep holding the button' : 'Your phone is watching for motion'}</div>}
          </div>
        </div>
        <BottomBar>
          {motion.mode === 'ask' && !out && (
            <button type="button" className="btn btn-secondary mb-3" onClick={motion.ask}>
              Enable motion sensor
            </button>
          )}
          {touch && !out && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setHolding(true);
              }}
              onPointerUp={() => setHolding(false)}
              onPointerCancel={() => setHolding(false)}
              onContextMenu={(e) => e.preventDefault()}
              className={`btn mb-3 select-none ${holding ? 'btn-primary' : 'btn-secondary'}`}
            >
              {holding ? 'Holding still…' : 'Hold here while frozen'}
            </button>
          )}
          {!out && (
            <button type="button" className="btn btn-primary" onClick={() => window.confirm('Did you tag the watcher?') && intent({ type: 'tagged' })}>
              I tagged the watcher
            </button>
          )}
        </BottomBar>
      </Camera>
    </GameShell>
  );
}
