import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, Plus, ScanLine, X } from 'lucide-react';
import { DNA_STYLES } from '../../game/constants';
import { dnaInfo } from '../../game/engine';
import { roomBadges } from '../../lib/database';
import { CodeInput, LevelDots, ScreenHeader, SectionLabel } from '../primitives';

const codeFromText = (text) => {
  try {
    const room = new URL(text).searchParams.get('room');
    if (/^\d{4}$/.test(room || '')) return room;
  } catch (e) {
    /* not a URL */
  }
  return /^\d{4}$/.test(text.trim()) ? text.trim() : null;
};

function QrScanner({ onCode, onClose }) {
  const video = useRef(null);
  const canvas = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream = null;
    let raf = 0;
    let stopped = false;
    let jsQR = null; // loaded on demand where BarcodeDetector is unavailable (e.g. iOS)
    const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    const scan = async () => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2) {
        let text = null;
        if (detector) {
          const found = await detector.detect(v).catch(() => []);
          text = found[0]?.rawValue || null;
        } else {
          if (!jsQR) jsQR = (await import('jsqr')).default;
          const c = canvas.current;
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(v, 0, 0);
          text = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data || null;
        }
        const code = text && codeFromText(text);
        if (code) {
          onCode(code);
          return;
        }
      }
      raf = requestAnimationFrame(scan);
    };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
        scan();
      } catch (e) {
        setError('Camera unavailable. Type the 4-digit code instead.');
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="fade fixed inset-0 z-50 bg-black">
      <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover grayscale" />
      <canvas ref={canvas} className="hidden" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-64 w-64 rounded-[32px] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
      </div>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 pt-[max(20px,var(--safe-top))]">
        <div className="text-[17px] font-semibold">Scan room QR</div>
        <button type="button" aria-label="Close scanner" className="icon-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-6 pb-[calc(32px+var(--safe-bottom))] text-center text-[14px] text-white/70">
        {error || 'Point your camera at the QR code on the host’s phone.'}
      </div>
    </div>
  );
}

export default function Play({ account, onCreate, onJoin }) {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const rooms = roomBadges(account.id).filter((r) => r.hosted).slice(0, 3);
  const first = account.name.split(' ')[0];

  return (
    <div className="enter">
      <ScreenHeader subtitle={`Hey ${first}`} title="Play" />

      <button type="button" onClick={() => onCreate()} className="card card-press flex w-full items-center gap-4 p-5 text-left">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)]">
          <Plus size={22} strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">Create a room</span>
          <span className="muted mt-0.5 block text-[14px]">Host a squad and spin the first mission</span>
        </span>
        <ChevronRight size={20} className="muted" />
      </button>

      <SectionLabel>Join a room</SectionLabel>
      <div className="card p-5">
        <CodeInput value={code} onChange={setCode} />
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-3">
          <button type="button" className="btn btn-secondary !w-14 !px-0" aria-label="Scan QR code" onClick={() => setScanning(true)}>
            <ScanLine size={20} />
          </button>
          <button type="button" className="btn btn-primary" disabled={code.length !== 4} onClick={() => onJoin(code)}>
            Join <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {rooms.length > 0 && (
        <>
          <SectionLabel>Your rooms</SectionLabel>
          <div className="card divide overflow-hidden">
            {rooms.map((r) => {
              const info = dnaInfo(r.dna);
              return (
                <button key={r.code} type="button" onClick={() => onCreate(r.code)} className="card-press flex w-full items-center gap-4 px-5 py-4 text-left">
                  <span className="tnum text-[20px] font-semibold tracking-[0.08em]">{r.code}</span>
                  <span className="muted min-w-0 flex-1 truncate text-[14px]">{DNA_STYLES[info.style].name}</span>
                  <LevelDots stage={info.stage} />
                  <ChevronRight size={18} className="muted" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onCode={(c) => {
            setScanning(false);
            onJoin(c);
          }}
        />
      )}
    </div>
  );
}
