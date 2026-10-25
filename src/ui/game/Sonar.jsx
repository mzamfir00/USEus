import React, { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { GAMES, XP } from '../../game/games';
import { SONAR_BEEP_MS, SONAR_COOLDOWN } from '../../game/engine';
import { buzz, Synth } from '../../lib/sound';
import { Sheet } from '../primitives';
import { useNow } from '../room/helpers';
import Camera from './Camera';
import { BottomBar, GameShell, nameOf } from './shared';

export function SonarHunter({ view, serverNow, intent, onLeave }) {
  useNow(200);
  const d = view.round.data;
  const [picking, setPicking] = useState(false);
  const now = serverNow();
  const cooldown = Math.max(0, d.cooldownUntil - now);
  const ready = cooldown === 0;
  const survivors = view.round.participants.filter((id) => view.round.roles[id] === 'survivor');

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={GAMES.blind_sonar.roles.hunter.label} onLeave={onLeave} light={ready}>
      <button
        type="button"
        aria-label="Emit sonar pulse"
        disabled={!ready}
        onClick={() => {
          buzz([60, 40, 60]);
          intent({ type: 'sonar' });
        }}
        className={`absolute inset-0 flex flex-col items-center justify-center px-8 text-center transition-colors duration-300 ${ready ? 'bg-white text-black' : 'bg-black text-white'}`}
      >
        {ready ? (
          <>
            <div className="text-[15px] font-medium text-black/50">Eyes closed</div>
            <div className="mt-4 text-[54px] font-bold leading-[0.95] tracking-[-0.04em]">TAP TO EMIT SONAR PULSE</div>
            <div className="mt-6 text-[15px] text-black/60">Anywhere on the screen</div>
          </>
        ) : (
          <>
            <div className="relative h-44 w-44">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="46" stroke="#262626" strokeWidth="3" fill="none" />
                <circle cx="50" cy="50" r="46" stroke="#fff" strokeWidth="3" fill="none" strokeDasharray={289} strokeDashoffset={289 * (cooldown / SONAR_COOLDOWN)} strokeLinecap="round" />
              </svg>
              <div className="tnum absolute inset-0 grid place-items-center text-[56px] font-bold">{Math.ceil(cooldown / 1000)}</div>
            </div>
            <div className="mt-6 text-[17px] font-semibold">Recharging sonar</div>
            <div className="mt-1 text-[14px] text-white/50">Listen for the beeps</div>
          </>
        )}
        <div className={`mt-10 text-[13px] ${ready ? 'text-black/40' : 'text-white/40'}`}>{d.pulses} pulse{d.pulses === 1 ? '' : 's'} sent</div>
      </button>
      <BottomBar>
        <button type="button" className={`btn ${ready ? 'bg-black text-white' : 'btn-primary'}`} onClick={() => setPicking(true)}>
          I caught someone
        </button>
      </BottomBar>
      {picking && (
        <Sheet title="Who did you catch?" onClose={() => setPicking(false)}>
          <div className="card divide overflow-hidden">
            {survivors.map((id) => (
              <button key={id} type="button" className="card-press flex w-full items-center justify-between px-5 py-4 text-left text-[17px] font-semibold" onClick={() => intent({ type: 'caught', id })}>
                {nameOf(view, id)}
              </button>
            ))}
          </div>
          <p className="muted mt-4 text-center text-[13px]">Survivors confirm on camera. Ends the round.</p>
        </Sheet>
      )}
    </GameShell>
  );
}

export function SonarSurvivor({ view, serverNow, intent, onLeave, hud }) {
  useNow(150);
  const d = view.round.data;
  const me = view.me;
  const now = serverNow();
  const played = useRef(view.round.data.pulses);
  const [beeping, setBeeping] = useState(false);
  const toPulse = d.pulseAt ? d.pulseAt - now : -1;
  const incoming = toPulse > 0 && toPulse <= 3200;

  // Fire the loud beep exactly at the host's pulse time on every survivor phone.
  useEffect(() => {
    if (d.pulses === played.current || !d.pulseAt) return undefined;
    played.current = d.pulses;
    const wait = d.pulseAt - serverNow();
    if (wait < -SONAR_BEEP_MS) return undefined;
    buzz(30);
    const t = setTimeout(() => {
      Synth.sonar();
      buzz([300, 120, 300, 120, 300]);
      setBeeping(true);
      setTimeout(() => setBeeping(false), SONAR_BEEP_MS);
    }, Math.max(0, wait));
    return () => clearTimeout(t);
  }, [d.pulses, d.pulseAt, serverNow]);

  const used = d.nearMiss[me] || 0;
  const coolingNear = now - (d.nearMissAt[me] || 0) < 8000;

  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Survivor · hunter is ${nameOf(view, view.round.participants.find((id) => view.round.roles[id] === 'hunter'))}`} onLeave={onLeave}>
      <Camera hud={hud} record flash={beeping}>
        {(incoming || beeping) && (
          <div className="absolute inset-x-4 top-[max(150px,calc(env(safe-area-inset-top)+136px))] mr-14 z-10 rounded-[18px] bg-white px-5 py-4 text-center text-black">
            <div className="text-[13px] font-medium text-black/50">{beeping ? 'Sonar hitting now' : 'Sonar incoming'}</div>
            <div className="tnum mt-1 flex items-center justify-center gap-2 text-[34px] font-bold tracking-[-0.03em]">
              {beeping ? (
                <>
                  <Volume2 size={30} /> BEEP
                </>
              ) : (
                `${Math.ceil(toPulse / 1000)}…`
              )}
            </div>
          </div>
        )}
        <BottomBar>
          <button type="button" disabled={used >= 3 || coolingNear} className="btn btn-primary" onClick={() => intent({ type: 'nearMiss' })}>
            Near miss · +{XP.nearMiss} XP
          </button>
          <div className="mt-2 text-center text-[12.5px] text-white/60">{3 - used} left · when the hunter passes within 1 m on camera</div>
        </BottomBar>
      </Camera>
    </GameShell>
  );
}
