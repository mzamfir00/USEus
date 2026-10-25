import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Siren, X } from 'lucide-react';
import { GAMES } from '../../game/games';
import { buzz, Synth } from '../../lib/sound';
import { Sheet } from '../primitives';
import { formatTime, useNow } from '../room/helpers';

// Lets the shell send intents (host: end round) without threading props through every game.
export const IntentContext = createContext(() => {});

export const nameOf = (view, id) => view.players.find((p) => p.id === id)?.name || 'Someone';
export const userOf = (view, id) => view.players.find((p) => p.id === id)?.username || '';

// Keeps the screen awake during active play.
export function useWakeLock() {
  useEffect(() => {
    let lock = null;
    let released = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen');
      } catch (e) {
        lock = null;
      }
    };
    request();
    const onVisible = () => document.visibilityState === 'visible' && !released && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, []);
}

// Fullscreen game frame: leave button, game + role, synced round clock.
export function GameShell({ view, serverNow, roleLabel, onLeave, children, light = false }) {
  useNow(500);
  useWakeLock();
  const intent = useContext(IntentContext);
  const [menu, setMenu] = useState(false);
  const isHost = view.hostId === view.me;
  const r = view.round;
  const left = Math.max(0, r.endsAt - serverNow());
  // Room-wide Snitch Protocol alerts (your own alarm is shown by your camera).
  const alarms = Object.keys(r.violations || {}).filter((id) => id !== view.me);
  const seen = useRef(new Set());
  useEffect(() => {
    const fresh = alarms.filter((id) => !seen.current.has(id));
    if (fresh.length) {
      Synth.alert();
      buzz([80, 40, 80]);
    }
    seen.current = new Set(alarms);
  }, [alarms.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const fg = light ? 'text-black' : 'text-white';
  const chip = light ? 'bg-black/10 border-black/15' : 'bg-black/55 border-white/15';
  return (
    <div className={`fade fixed inset-0 z-40 ${light ? 'bg-white' : 'bg-black'} ${fg}`}>
      <div className="relative mx-auto h-full max-w-md overflow-hidden">
        {children}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label={isHost ? 'Round menu' : 'Leave room'}
            onClick={() => (isHost ? setMenu(true) : window.confirm('Leave this room?') && onLeave())}
            className={`pointer-events-auto grid h-10 w-10 place-items-center rounded-full border backdrop-blur ${chip}`}
          >
            <X size={17} />
          </button>
          <div className={`min-w-0 flex-1 rounded-full border px-4 py-2 backdrop-blur ${chip}`}>
            <div className="truncate text-[13px] font-semibold leading-tight">{GAMES[r.game].name}</div>
            <div className={`truncate text-[11.5px] leading-tight ${light ? 'text-black/60' : 'text-white/60'}`}>{roleLabel}</div>
          </div>
          {r.game !== 'hot_potato' && <div className={`tnum rounded-full border px-3.5 py-2.5 text-[14px] font-semibold backdrop-blur ${chip}`}>{formatTime(left)}</div>}
        </div>
        {alarms.length > 0 && (
          <div className="pointer-events-none absolute inset-x-4 top-[max(66px,calc(env(safe-area-inset-top)+54px))] z-[25] space-y-1.5">
            {alarms.map((id) => (
              <div key={id} className="pop flex items-center gap-2.5 rounded-[14px] bg-white px-3.5 py-2.5 text-[12.5px] font-semibold leading-snug text-black">
                <Siren size={16} className="shrink-0" />
                <span>
                  @{userOf(view, id)} STOPPED FILMING — ALARM & FLASH TRIGGERED
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {menu && (
        <div className="text-[var(--fg)]">
          <Sheet title="Host controls" onClose={() => setMenu(false)}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setMenu(false);
                intent({ type: 'end' });
              }}
            >
              End round now
            </button>
            <button type="button" className="btn btn-secondary mt-3" onClick={() => window.confirm('Leaving closes the room for everyone. Leave?') && onLeave()}>
              Leave room
            </button>
          </Sheet>
        </div>
      )}
    </div>
  );
}

// Whole-screen flash when an event lands (sonar, freeze, bomb pass).
export function useFlash() {
  const [on, setOn] = useState(false);
  const trigger = (ms = 2000) => {
    setOn(true);
    setTimeout(() => setOn(false), ms);
  };
  return [on, trigger];
}

export function BottomBar({ children }) {
  return <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-[calc(18px+var(--safe-bottom))] pt-6">{children}</div>;
}

// Fires `fn` on this phone at the host's scheduled time whenever `count` goes up
// (sonar pulses, radar pings, Marco calls). Missed events from before mount are skipped.
export function useScheduled(count, at, serverNow, fn, lateMs = 1500) {
  const seen = useRef(count);
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (count === seen.current || !at) return undefined;
    seen.current = count;
    const wait = at - serverNow();
    if (wait < -lateMs) return undefined;
    const t = setTimeout(() => cb.current(), Math.max(0, wait));
    return () => clearTimeout(t);
  }, [count, at, serverNow, lateMs]);
}

// Eyes-closed countdown before seekers / hunters may look.
export function BlindCountdown({ until, serverNow, title, sub }) {
  useNow(200);
  const left = Math.max(0, Math.ceil((until - serverNow()) / 1000));
  const last = useRef(left);
  useEffect(() => {
    if (left !== last.current && left <= 5 && left > 0) Synth.beep(left <= 2);
    if (left === 0 && last.current > 0) {
      Synth.lockIn();
      buzz([100, 50, 200]);
    }
    last.current = left;
  }, [left]);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black px-8 text-center text-white">
      <div className="text-[15px] font-medium text-white/50">{title}</div>
      <div className="tnum mt-3 text-[120px] font-bold leading-none tracking-[-0.05em]">{left}</div>
      <div className="mt-4 max-w-[28ch] text-[16px] text-white/70">{sub}</div>
    </div>
  );
}

// Bottom sheet to pick a player (caught / found / tagged).
export function PickPlayer({ title, ids, view, onPick, onClose, note }) {
  return (
    <div className="text-[var(--fg)]">
      <Sheet title={title} onClose={onClose}>
        {ids.length ? (
          <div className="card divide overflow-hidden">
            {ids.map((id) => (
              <button key={id} type="button" className="card-press flex w-full items-center justify-between px-5 py-4 text-left text-[17px] font-semibold" onClick={() => onPick(id)}>
                {nameOf(view, id)}
              </button>
            ))}
          </div>
        ) : (
          <div className="muted py-6 text-center text-[15px]">Nobody left.</div>
        )}
        {note && <p className="muted mt-4 text-center text-[13px]">{note}</p>}
      </Sheet>
    </div>
  );
}
