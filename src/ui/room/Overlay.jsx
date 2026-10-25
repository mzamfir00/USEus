import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Plus, RotateCcw, SwitchCamera, X } from 'lucide-react';
import { castNames, fillText, missionById, timerRemaining } from '../../game/engine';
import { buzz } from '../../lib/sound';
import { RichText } from '../primitives';
import { formatTime, missionNumber, useNow } from './helpers';

// Fullscreen timer + POV camera with the mission watermark, ready to be filmed.
export default function Overlay({ view, serverNow, intent, onClose }) {
  useNow(200);
  const video = useRef(null);
  const [camera, setCamera] = useState('loading'); // loading | live | off
  const [facing, setFacing] = useState('environment');
  const [recStart] = useState(() => Date.now());
  const r = view.round;
  const m = missionById(r.missionId);
  const names = castNames(view);
  const t = r.timer;
  const left = timerRemaining(t, serverNow());
  const urgent = t.running && left > 0 && left <= 10000;
  const canControl = r.participants.includes(view.me) || view.hostId === view.me;

  useEffect(() => {
    let stream = null;
    let cancelled = false;
    setCamera('loading');
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop());
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
        setCamera('live');
      } catch (e) {
        if (!cancelled) setCamera('off');
      }
      return undefined;
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [facing]);

  const op = (o) => {
    buzz(10);
    intent({ type: 'timer', op: o });
  };

  return (
    <div className="fade fixed inset-0 z-50 bg-black text-white">
      <div className="relative mx-auto h-full max-w-md overflow-hidden">
        <video
          ref={video}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover grayscale"
          style={{ opacity: camera === 'live' ? 0.75 : 0, transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-[13px] font-semibold backdrop-blur">
            <span className="live-dot !h-2.5 !w-2.5 !bg-white" /> REC <span className="tnum font-normal text-white/60">{formatTime(Date.now() - recStart)}</span>
          </div>
          <div className="flex gap-2">
            {camera === 'live' && (
              <button type="button" aria-label="Flip camera" className="icon-btn !border-white/15 !bg-black/50" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>
                <SwitchCamera size={18} />
              </button>
            )}
            <button type="button" aria-label="Close" className="icon-btn !border-white/15 !bg-black/50" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 top-[22%] text-center">
          <div className="text-[14px] font-medium text-white/60">{left === 0 ? "Time's up" : t.running ? 'Live' : 'Paused'}</div>
          <div key={urgent ? Math.ceil(left / 1000) : 'calm'} className={`tnum mt-1 text-[96px] font-bold leading-none tracking-[-0.04em] ${urgent ? 'pop' : ''}`}>
            {formatTime(left)}
          </div>
          {canControl && (
            <div className="mt-8 flex items-center justify-center gap-5">
              <button type="button" aria-label="Reset timer" onClick={() => op('reset')} className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-black/40 backdrop-blur">
                <RotateCcw size={20} />
              </button>
              <button
                type="button"
                aria-label={t.running ? 'Pause timer' : 'Start timer'}
                onClick={() => op('toggle')}
                className="grid h-20 w-20 place-items-center rounded-full bg-white text-black transition-transform active:scale-95"
              >
                {t.running ? <Pause size={30} fill="black" /> : <Play size={30} fill="black" className="ml-1" />}
              </button>
              <button type="button" aria-label="Add one minute" onClick={() => op('add')} className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-black/40 text-[13px] font-semibold backdrop-blur">
                <Plus size={14} className="-mr-0.5" />1m
              </button>
            </div>
          )}
        </div>

        <div className="absolute inset-x-4 bottom-[calc(16px+var(--safe-bottom))] overflow-hidden rounded-[20px] border border-white/15 bg-black/60 backdrop-blur-md">
          <div className="flex items-center justify-between bg-white px-4 py-2 text-[12px] font-semibold text-black">
            <span>USEus · Mission {missionNumber(m)}</span>
            <span className="tnum">Room {view.code}</span>
          </div>
          <div className="px-4 pb-4 pt-3">
            <div className="text-[15px] font-semibold">{fillText(m.title, names, view.packName)}</div>
            <p className="mt-1.5 text-[15px] leading-snug text-white/85">
              <RichText text={m.prompt} names={names} pack={view.packName} />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
