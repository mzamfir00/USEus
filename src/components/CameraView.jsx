import React, { useEffect, useRef, useState } from 'react';
import { CameraOff, ScanLine, SwitchCamera, X } from 'lucide-react';
import { castNames, fillText, missionById, timerRemaining } from '../game/engine';
import { formatTime, missionNumber, useNow } from './Round';
import { RichText } from './ui';

// POV REC / Stamp mode: live camera (or a simulated viewfinder) with the game watermark.
export default function CameraView({ view, serverNow, onClose }) {
  useNow(250);
  const videoRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [facing, setFacing] = useState('environment');
  const [recStart] = useState(() => Date.now());
  const m = missionById(view.round.missionId);
  const names = castNames(view);
  const left = timerRemaining(view.round.timer, serverNow());
  const urgent = view.round.timer.running && left > 0 && left <= 10000;

  useEffect(() => {
    let stream = null;
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('live');
      } catch (e) {
        if (!cancelled) setStatus('fallback');
      }
    })();
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  return (
    <div className="fade fixed inset-0 z-50 bg-black text-[#FAFAFA]">
      <div className={`relative mx-auto h-full w-full max-w-md overflow-hidden ${urgent ? 'urgent' : ''}`}>
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover grayscale"
          style={{ opacity: status === 'live' ? 1 : 0, transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
        />
        {status !== 'live' && (
          <div className="absolute inset-0 overflow-hidden bg-[#09090B]">
            <div className="radar-grid" />
            <svg className="grain" width="140%" height="140%" style={{ opacity: 0.22 }}>
              <filter id="cam-grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter="url(#cam-grain)" />
            </svg>
            <div className="scanline" />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center border border-white/30">
                  {status === 'loading' ? <ScanLine size={26} className="animate-pulse" /> : <CameraOff size={26} />}
                </div>
                <div className="label">{status === 'loading' ? 'Requesting camera…' : 'Simulated feed'}</div>
                {status === 'fallback' && <div className="mx-auto mt-1 max-w-[26ch] text-[12px] text-white/45">Camera blocked — film this screen with another phone.</div>}
              </div>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/15" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/15" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/15" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/15" />
        </div>
        <div className="pointer-events-none absolute inset-3">
          {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'].map((c) => (
            <span key={c} className={`absolute h-9 w-9 border-white ${c}`} />
          ))}
        </div>

        <div className="absolute left-6 top-[max(1.5rem,env(safe-area-inset-top))] space-y-2">
          <div className="flex items-center gap-2 bg-black/60 px-3 py-2 backdrop-blur">
            <span className="dot blink !h-3 !w-3 !bg-white" />
            <span className="text-[13px] font-extrabold tracking-[0.2em]">REC</span>
            <span className="mono tnum text-[12px] text-white/60">{formatTime(Date.now() - recStart)}</span>
          </div>
          <div className={`display tnum w-fit px-3 py-1.5 text-[36px] ${urgent ? 'bg-white text-black' : 'bg-black/60 backdrop-blur'}`}>{formatTime(left)}</div>
        </div>

        <div className="absolute right-6 top-[max(1.5rem,env(safe-area-inset-top))] flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button type="button" aria-label="Switch camera" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} className="grid h-11 w-11 place-items-center bg-black/60 backdrop-blur">
              <SwitchCamera size={18} />
            </button>
            <button type="button" aria-label="Close camera" onClick={onClose} className="grid h-11 w-11 place-items-center bg-black/60 backdrop-blur">
              <X size={20} />
            </button>
          </div>
          <div className="mono bg-black/50 px-2 py-1 text-[9.5px] tracking-[0.2em]">SQUAD ROULETTE</div>
        </div>

        <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] border border-white/25 bg-black/65 backdrop-blur-md">
          <div className="mono flex items-center justify-between bg-white px-3 py-1.5 text-[10.5px] font-bold tracking-[0.2em] text-black">
            <span>MISSION {missionNumber(m)} • SQUAD ROULETTE</span>
            <span>#{view.code}</span>
          </div>
          <div className="px-4 pb-4 pt-3">
            <div className="display text-[14px]">{fillText(m.title, names, view.packName)}</div>
            <p className="mt-1.5 text-[18px] font-extrabold leading-[1.22]">
              <RichText text={m.prompt} names={names} pack={view.packName} />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
