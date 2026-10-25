import React, { createContext, useContext, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GAMES } from '../../game/games';
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
