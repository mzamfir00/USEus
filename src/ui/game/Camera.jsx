import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Mic, MicOff, SwitchCamera } from 'lucide-react';
import { addClip } from '../../lib/clips';


const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || null;
};

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Live camera + monochrome HUD drawn onto a canvas. The canvas is both the preview and
// the recording source, so saved clips carry the same stamp the players see.
//   hud: { title, location, room, roundKey, game }
//   record: auto-record while true (when the camera is live)
const Camera = forwardRef(function Camera({ hud, record = false, micDefault = false, flash = false, children }, ref) {
  const video = useRef(null);
  const canvas = useRef(null);
  const stream = useRef(null);
  const recorder = useRef(null);
  const recStart = useRef(0);
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const flashRef = useRef(flash);
  flashRef.current = flash;
  // Canvas matches the screen's aspect so nothing (especially the stamp) gets cropped.
  const [{ W, H }] = useState(() => {
    const ratio = Math.min(2.3, Math.max(1.3, window.innerHeight / Math.max(1, window.innerWidth)));
    return { W: 720, H: Math.round(720 * ratio) };
  });
  const [status, setStatus] = useState('loading'); // loading | live | off
  const [facing, setFacing] = useState('environment');
  const [mic, setMic] = useState(micDefault);
  const [recording, setRecording] = useState(false);
  const supported = !!pickMime() && !!HTMLCanvasElement.prototype.captureStream;

  /* camera */
  useEffect(() => {
    let cancelled = false;
    let s = null;
    setStatus('loading');
    (async () => {
      const video0 = { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } };
      try {
        try {
          s = await navigator.mediaDevices.getUserMedia({ video: video0, audio: mic ? { echoCancellation: true, noiseSuppression: true } : false });
        } catch (e) {
          if (!mic) throw e;
          s = await navigator.mediaDevices.getUserMedia({ video: video0, audio: false });
        }
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
        setStatus('live');
      } catch (e) {
        if (!cancelled) setStatus('off');
      }
    })();
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [facing, mic]);

  /* compositor */
  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    let raf = 0;
    const draw = () => {
      const v = video.current;
      const h = hudRef.current || {};
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      if (v && v.readyState >= 2 && v.videoWidth) {
        const scale = Math.max(W / v.videoWidth, H / v.videoHeight);
        const dw = v.videoWidth * scale;
        const dh = v.videoHeight * scale;
        ctx.save();
        ctx.filter = 'grayscale(1) contrast(1.08)';
        if (facing === 'user') {
          ctx.translate(W, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        for (let x = 0; x <= W; x += 60) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
          ctx.stroke();
        }
        for (let y = 0; y <= H; y += 60) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
        ctx.fillStyle = '#8a8a8a';
        ctx.font = '600 30px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(status === 'loading' ? 'Starting camera…' : 'Camera unavailable', W / 2, H / 2);
        ctx.textAlign = 'left';
      }
      // gradients for legibility
      const top = ctx.createLinearGradient(0, 0, 0, 220);
      top.addColorStop(0, 'rgba(0,0,0,0.65)');
      top.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 220);

      // stamp
      const rec = recorder.current?.state === 'recording';
      ctx.fillStyle = '#fff';
      ctx.font = '700 30px Inter, system-ui, sans-serif';
      const dot = rec && Math.floor(Date.now() / 600) % 2 === 0;
      if (dot) {
        ctx.beginPath();
        ctx.arc(46, 196, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillText(`${rec ? 'REC' : 'LIVE'}${rec ? `  ${fmt(Date.now() - recStart.current)}` : ''}  •  ${(h.title || '').toUpperCase()}`, 66, 207, W - 170);
      ctx.font = '600 22px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const place = h.location ? h.location.toUpperCase() : '';
      ctx.fillText([place, h.room ? `ROOM ${h.room}` : '', new Date().toLocaleDateString(), 'USEus'].filter(Boolean).join('  •  '), 36, 243, W - 140);

      if (flashRef.current) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.floor(Date.now() / 150) % 2 ? 36 : 14;
        ctx.strokeRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [facing, status, W, H]);

  /* recording */
  const stop = useCallback(() => {
    const r = recorder.current;
    if (r && r.state !== 'inactive') r.stop();
    recorder.current = null;
    setRecording(false);
  }, []);

  const start = useCallback(() => {
    if (!supported || recorder.current) return;
    const mime = pickMime();
    const out = canvas.current.captureStream(30);
    stream.current?.getAudioTracks().forEach((t) => out.addTrack(t));
    const r = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: 1_800_000 });
    const chunks = [];
    const meta = { ...hudRef.current };
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      const durationMs = Date.now() - recStart.current;
      if (chunks.length && durationMs > 1200) {
        addClip({ blob: new Blob(chunks, { type: mime }), mime, roundKey: meta.roundKey, game: meta.game, title: meta.title, location: meta.location, durationMs });
      }
    };
    recStart.current = Date.now();
    r.start(1000);
    recorder.current = r;
    setRecording(true);
  }, [supported]);

  useEffect(() => {
    if (record && status === 'live') start();
    if (!record) stop();
  }, [record, status, start, stop]);

  useEffect(() => stop, [stop]);

  useImperativeHandle(ref, () => ({
    // Stamped still frame, downscaled for sending to the room.
    snapshot() {
      const c = document.createElement('canvas');
      c.width = 432;
      c.height = 768;
      c.getContext('2d').drawImage(canvas.current, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.62);
    },
    live: status === 'live',
  }));

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <video ref={video} playsInline muted className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0" />
      <canvas ref={canvas} width={W} height={H} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute right-4 top-[max(150px,calc(env(safe-area-inset-top)+136px))] z-10 flex flex-col gap-2">
        {status === 'live' && (
          <button type="button" aria-label="Flip camera" className="icon-btn !border-white/15 !bg-black/50" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>
            <SwitchCamera size={17} />
          </button>
        )}
        {status === 'live' && (
          <button type="button" aria-label={mic ? 'Mute microphone' : 'Record sound'} className="icon-btn !border-white/15 !bg-black/50" onClick={() => setMic((m) => !m)}>
            {mic ? <Mic size={17} /> : <MicOff size={17} />}
          </button>
        )}
        {status === 'live' && supported && (
          <button
            type="button"
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            onClick={() => (recording ? stop() : start())}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/40 bg-black/50"
          >
            <span className={recording ? 'h-3.5 w-3.5 rounded-[3px] bg-white' : 'h-4 w-4 rounded-full bg-white'} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
});

export default Camera;
