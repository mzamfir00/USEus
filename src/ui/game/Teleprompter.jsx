import React, { useEffect, useRef, useState } from 'react';
import { Film, Megaphone } from 'lucide-react';
import { INJECT_COOLDOWN } from '../../game/engine';
import { DIRECTIONS, GAMES } from '../../game/games';
import { buzz, Synth } from '../../lib/sound';
import { Sheet } from '../primitives';
import { useNow } from '../room/helpers';
import Camera from './Camera';
import { BottomBar, GameShell, nameOf } from './shared';

const LINE_MS = 4800;

// Script position is time-based so the actor and director stay in sync.
export function useScript(view, serverNow) {
  const r = view.round;
  const lines = r.data.script;
  const elapsed = Math.max(0, serverNow() - r.startsAt);
  const index = Math.min(lines.length, Math.floor(elapsed / LINE_MS));
  return { lines, index, progress: (elapsed % LINE_MS) / LINE_MS };
}

// Latest injected direction, shown for 5 seconds with a blip.
function useLatestInject(view, serverNow) {
  const injects = view.round.data.injects;
  const latest = injects[injects.length - 1];
  const seen = useRef(injects.length);
  useEffect(() => {
    if (injects.length > seen.current) {
      Synth.blip();
      buzz([50, 30, 50]);
    }
    seen.current = injects.length;
  }, [injects.length]);
  return latest && serverNow() - latest.at < 5000 ? latest : null;
}

export function TeleprompterActor({ view, serverNow, onLeave }) {
  useNow(200);
  const { lines, index, progress } = useScript(view, serverNow);
  const inject = useLatestInject(view, serverNow);
  const done = index >= lines.length;
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Actor · selling ${view.round.data.product}`} onLeave={onLeave}>
      <div className="absolute inset-0 flex flex-col justify-center px-7">
        {inject && (
          <div className="pop absolute inset-x-5 top-[max(84px,calc(env(safe-area-inset-top)+70px))] rounded-[20px] bg-white px-5 py-4 text-black">
            <div className="text-[12.5px] font-medium text-black/50">Stage direction from {nameOf(view, inject.by)}</div>
            <div className="mt-1 text-[24px] font-bold leading-tight tracking-[-0.02em]">{inject.text}</div>
          </div>
        )}
        {done ? (
          <div className="text-center">
            <div className="text-[44px] font-bold leading-tight tracking-[-0.03em]">Ad-lib the big finish.</div>
            <div className="mt-3 text-[16px] text-white/60">The director calls cut.</div>
          </div>
        ) : (
          <>
            {index > 0 && <div className="mb-6 text-[19px] leading-snug text-white/25">{lines[index - 1]}</div>}
            <div key={index} className="pop text-[34px] font-bold leading-[1.15] tracking-[-0.02em]">
              {lines[index]}
            </div>
            {lines[index + 1] && <div className="mt-6 text-[19px] leading-snug text-white/40">{lines[index + 1]}</div>}
            <div className="mt-10 h-[3px] w-full bg-white/15">
              <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mt-2 text-[12.5px] text-white/50">
              Line {index + 1} of {lines.length}
            </div>
          </>
        )}
      </div>
    </GameShell>
  );
}

function InjectGrid({ view, serverNow, intent }) {
  const last = view.round.data.injectAt[view.me] || 0;
  const cooling = Math.max(0, INJECT_COOLDOWN - (serverNow() - last));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="eyebrow">Inject a stage direction</span>
        {cooling > 0 && <span className="muted tnum text-[13px]">{Math.ceil(cooling / 1000)}s</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DIRECTIONS.map((d, i) => (
          <button
            key={d}
            type="button"
            disabled={cooling > 0}
            onClick={() => {
              buzz(20);
              intent({ type: 'inject', i });
            }}
            className="card card-press min-h-[72px] p-3 text-left text-[14px] font-semibold leading-snug disabled:opacity-40"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TeleprompterDirector({ view, serverNow, intent, onLeave, hud }) {
  useNow(250);
  const { lines, index } = useScript(view, serverNow);
  const inject = useLatestInject(view, serverNow);
  const [mirror, setMirror] = useState(true);
  const [sheet, setSheet] = useState(false);
  const canInject = view.round.participants.length <= 2;
  const actor = view.round.participants.find((id) => view.round.roles[id] === 'actor');
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={`Director · filming ${nameOf(view, actor)}`} onLeave={onLeave}>
      <Camera hud={hud} record micDefault>
        {mirror && (
          <div className="absolute inset-x-4 top-[max(150px,calc(env(safe-area-inset-top)+136px))] z-10 mr-14 rounded-[16px] border border-white/15 bg-black/65 px-4 py-3 backdrop-blur">
            <div className="text-[12px] text-white/55">{inject ? 'Direction just sent' : `Teleprompter · line ${Math.min(index + 1, lines.length)}`}</div>
            <div className="mt-0.5 text-[16px] font-semibold leading-snug">{inject ? inject.text : lines[index] || 'Ad-lib the finish — then cut.'}</div>
          </div>
        )}
        <BottomBar>
          <div className="grid grid-cols-[auto_auto_1fr] gap-2">
            <button type="button" aria-label="Toggle script mirror" className="btn btn-secondary !w-14 !px-0" onClick={() => setMirror((m) => !m)}>
              <Film size={18} />
            </button>
            {canInject ? (
              <button type="button" aria-label="Inject direction" className="btn btn-secondary !w-14 !px-0" onClick={() => setSheet(true)}>
                <Megaphone size={18} />
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="btn btn-primary" onClick={() => intent({ type: 'end' })}>
              Cut · end take
            </button>
          </div>
        </BottomBar>
      </Camera>
      {sheet && (
        <Sheet title="Stage directions" onClose={() => setSheet(false)}>
          <InjectGrid view={view} serverNow={serverNow} intent={intent} />
        </Sheet>
      )}
    </GameShell>
  );
}

export function TeleprompterSaboteur({ view, serverNow, intent, onLeave }) {
  useNow(250);
  const { lines, index } = useScript(view, serverNow);
  const recent = [...view.round.data.injects].reverse().slice(0, 3);
  return (
    <GameShell view={view} serverNow={serverNow} roleLabel={GAMES.teleprompter.roles.saboteur.label} onLeave={onLeave}>
      <div className="absolute inset-0 overflow-y-auto px-5 pb-10 pt-[max(84px,calc(env(safe-area-inset-top)+72px))]">
        <div className="card p-4">
          <div className="eyebrow">Actor is reading</div>
          <div className="mt-1 text-[17px] font-semibold leading-snug">{lines[index] || 'The big ad-libbed finish'}</div>
        </div>
        <div className="mt-5">
          <InjectGrid view={view} serverNow={serverNow} intent={intent} />
        </div>
        {recent.length > 0 && (
          <div className="mt-6">
            <div className="eyebrow mb-2 px-1">Recently injected</div>
            <div className="card divide overflow-hidden">
              {recent.map((i) => (
                <div key={i.at} className="flex justify-between gap-3 px-4 py-3 text-[14px]">
                  <span className="truncate">{i.text}</span>
                  <span className="muted shrink-0">{nameOf(view, i.by).split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
