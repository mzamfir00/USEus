import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Flashlight, FlashlightOff, Mic, MicOff, Siren, SwitchCamera, Zap } from 'lucide-react';
import { addClip } from '../../lib/clips';
import { stillFor } from '../../lib/motion';
import { buzz, Synth } from '../../lib/sound';
import { IntentContext } from './shared';

const SAMPLE_MS = 1500; // covered-lens sampling interval
const BLOCK_STD = 6; // luminance std-dev below this = nothing visible (pocket / hand)
const BLOCK_MS = 8000; // covered + motionless this long → warning
const WARN_S = 3; // warning countdown before the penalty
const PAN_DIFF = 16; // mean frame difference that counts as panning the camera
const NOISE_DB = -26; // noise snitch danger threshold (dBFS)

export const VIOLATION_TEXT = {
  stopped: 'Recording stopped',
  hidden: 'Left the app',
  camera: 'Camera turned off',
  blocked: 'Camera blocked',
  peek: 'Missed the peek check',
};

const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || null;
};

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function CtlButton({ label, onClick, children, on = false, disabled = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-full border backdrop-blur transition-colors disabled:opacity-40 ${on ? 'border-white bg-white text-black' : 'border-white/20 bg-black/55 text-white'}`}
    >
      {children}
    </button>
  );
}

// Live camera + monochrome HUD drawn onto a canvas. The canvas is both the preview and the
// recording source, so clips carry the stamp players see and survive camera flips.
//
//   record       auto-record while true
//   enforce      Snitch Protocol: stopping, leaving the app, losing the camera or covering the
//                lens triggers the siren + torch/screen strobe and alerts the room
//   violation    external violation (e.g. a failed peek check); onResume clears it
//   noiseMeter   live mic level; loud for >1 s → torch flash + chirp + onNoise()
//   pulseButton  hunters get a flash-pulse button; beacon = slow torch strobe (zombies)
//   onPan        called when the picture changes a lot (camera panned)
const Camera = forwardRef(function Camera(
  { hud, record = false, micDefault = false, flash = false, children, enforce = false, violation = null, onResume, noiseMeter = false, onNoise, pulseButton = false, beacon = false, onPan },
  ref
) {
  const intentCtx = useContext(IntentContext);
  const intentRef = useRef(intentCtx);
  intentRef.current = intentCtx;
  const video = useRef(null);
  const canvas = useRef(null);
  const camStream = useRef(null);
  const micStream = useRef(null);
  const recorder = useRef(null);
  const recStart = useRef(0);
  const meterBar = useRef(null);
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const flashRef = useRef(flash);
  flashRef.current = flash;
  const onPanRef = useRef(onPan);
  onPanRef.current = onPan;
  const onNoiseRef = useRef(onNoise);
  onNoiseRef.current = onNoise;
  const enforceRef = useRef(enforce);
  enforceRef.current = enforce;
  const torchBusy = useRef(false);
  const torchWant = useRef(false);
  const torchActual = useRef(false);
  const transient = useRef(false);

  const [{ W, H }] = useState(() => {
    const ratio = Math.min(2.3, Math.max(1.3, window.innerHeight / Math.max(1, window.innerWidth)));
    return { W: 720, H: Math.round(720 * ratio) };
  });
  const [status, setStatus] = useState('loading'); // loading | live | off
  const [facing, setFacing] = useState('environment');
  const [restart, setRestart] = useState(0);
  const [micOn, setMicOn] = useState(micDefault || noiseMeter);
  const [micState, setMicState] = useState('off'); // off | loading | on | denied
  const [recording, setRecording] = useState(false);
  const [userStopped, setUserStopped] = useState(false);
  const [torchCap, setTorchCap] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [internal, setInternal] = useState(null); // our own violation reason
  const [warning, setWarning] = useState(null); // seconds left before a "blocked" penalty
  const [meterArmed, setMeterArmed] = useState(true);
  const [notice, setNotice] = useState('');
  const supported = !!pickMime() && !!HTMLCanvasElement.prototype.captureStream;

  const statusRef = useRef(status);
  statusRef.current = status;
  const facingRef = useRef(facing);
  facingRef.current = facing;
  const torchCapRef = useRef(torchCap);
  torchCapRef.current = torchCap;
  const torchOnRef = useRef(torchOn);
  torchOnRef.current = torchOn;
  const penalty = enforce ? internal || violation : violation;
  const penaltyRef = useRef(penalty);
  penaltyRef.current = penalty;
  const blockedNow = useRef(false);
  const resumeWanted = useRef(false);

  const say = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(''), 2600);
  };

  /* --------------------------------- camera -------------------------------- */
  useEffect(() => {
    let cancelled = false;
    let s = null;
    setStatus('loading');
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        camStream.current = s;
        torchActual.current = false;
        const track = s.getVideoTracks()[0];
        // `ended` only fires when the OS/user kills the camera, never for our own flips.
        track.addEventListener('ended', () => !cancelled && setStatus('off'));
        let caps = {};
        try {
          caps = track.getCapabilities?.() || {};
        } catch (e) {
          caps = {};
        }
        setTorchCap(!!caps.torch);
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
      camStream.current = null;
    };
  }, [facing, restart]);

  /* ---------------------------------- mic ---------------------------------- */
  // Separate from the camera so flipping never interrupts the recording's audio.
  useEffect(() => {
    if (!(micOn || noiseMeter)) {
      setMicState('off');
      return undefined;
    }
    let cancelled = false;
    let s = null;
    setMicState('loading');
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } })
      .then((st) => {
        if (cancelled) {
          st.getTracks().forEach((t) => t.stop());
          return;
        }
        s = st;
        micStream.current = st;
        setMicState('on');
      })
      .catch(() => !cancelled && setMicState('denied'));
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
      micStream.current = null;
    };
  }, [micOn, noiseMeter]);

  /* --------------------------------- torch --------------------------------- */
  const pushTorch = useCallback(async () => {
    if (torchBusy.current) return;
    const track = camStream.current?.getVideoTracks()[0];
    if (!track || track.readyState !== 'live' || !torchCapRef.current) return;
    torchBusy.current = true;
    while (torchWant.current !== torchActual.current) {
      const want = torchWant.current;
      try {
        await track.applyConstraints({ advanced: [{ torch: want }] });
      } catch (e) {
        /* torch unsupported on this track */
      }
      torchActual.current = want;
    }
    torchBusy.current = false;
  }, []);

  // Final torch = manual flashlight (rear camera) OR any active pulse / strobe.
  const syncTorch = useCallback(() => {
    torchWant.current = (torchOnRef.current && facingRef.current === 'environment') || transient.current;
    pushTorch();
  }, [pushTorch]);

  useEffect(syncTorch, [torchOn, facing, status, torchCap, syncTorch]);

  // Brief light: hardware torch when available, otherwise a white screen flash.
  const flashFor = useCallback(
    (ms) => {
      if (torchCapRef.current && facingRef.current === 'environment' && statusRef.current === 'live') {
        transient.current = true;
        syncTorch();
        setTimeout(() => {
          transient.current = false;
          syncTorch();
        }, ms);
      } else {
        setScreenFlash(true);
        setTimeout(() => setScreenFlash(false), ms);
      }
    },
    [syncTorch]
  );

  const pulse = useCallback(() => {
    buzz([60, 60, 60, 60, 60]);
    [0, 240, 480, 720].forEach((t) => setTimeout(() => flashFor(130), t));
  }, [flashFor]);

  // Zombie beacon: slow torch strobe.
  useEffect(() => {
    if (!beacon || penalty) return undefined;
    let on = false;
    const id = setInterval(() => {
      on = !on;
      transient.current = on;
      syncTorch();
    }, 1000);
    return () => {
      clearInterval(id);
      transient.current = false;
      syncTorch();
    };
  }, [beacon, penalty, syncTorch]);

  /* ------------------------------- compositor ------------------------------ */
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
      const top = ctx.createLinearGradient(0, 0, 0, 280);
      top.addColorStop(0, 'rgba(0,0,0,0.65)');
      top.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 280);

      const rec = recorder.current?.state === 'recording';
      ctx.fillStyle = '#fff';
      ctx.font = '700 30px Inter, system-ui, sans-serif';
      if (rec && Math.floor(Date.now() / 600) % 2 === 0) {
        ctx.beginPath();
        ctx.arc(46, 196, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillText(`${rec ? 'REC' : 'LIVE'}${rec ? `  ${fmt(Date.now() - recStart.current)}` : ''}  •  ${(h.title || '').toUpperCase()}`, 66, 207, W - 170);
      ctx.font = '600 22px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const place = h.location ? h.location.toUpperCase() : '';
      ctx.fillText([place, h.room ? `ROOM ${h.room}` : '', new Date().toLocaleDateString(), 'USEus'].filter(Boolean).join('  •  '), 36, 243, W - 140);

      // The clip records the snitch moment too.
      if (penaltyRef.current) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, H / 2 - 50, W, 100);
        ctx.fillStyle = '#000';
        ctx.font = '800 38px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`SNITCH ALARM · ${(VIOLATION_TEXT[penaltyRef.current] || '').toUpperCase()}`, W / 2, H / 2 + 13, W - 40);
        ctx.textAlign = 'left';
      }
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

  /* -------------------------------- recording ------------------------------- */
  const stop = useCallback(() => {
    const r = recorder.current;
    recorder.current = null;
    if (r && r.state !== 'inactive') r.stop();
    setRecording(false);
  }, []);

  const start = useCallback(() => {
    if (!supported || recorder.current) return;
    const mime = pickMime();
    const out = canvas.current.captureStream(30);
    micStream.current?.getAudioTracks().forEach((t) => out.addTrack(t));
    const r = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: 1_800_000 });
    const chunks = [];
    const meta = { ...hudRef.current };
    const began = Date.now();
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      const durationMs = Date.now() - began;
      if (chunks.length && durationMs > 1200) {
        addClip({ blob: new Blob(chunks, { type: mime }), mime, roundKey: meta.roundKey, game: meta.game, title: meta.title, location: meta.location, durationMs });
      }
    };
    r.onerror = () => {
      if (recorder.current === r) recorder.current = null;
      setRecording(false);
      if (enforceRef.current) setInternal('stopped');
    };
    recStart.current = began;
    r.start(1000);
    recorder.current = r;
    setRecording(true);
  }, [supported]);

  useEffect(() => {
    if (record && !userStopped && status === 'live' && micState !== 'loading') start();
    if (!record) stop();
  }, [record, userStopped, status, micState, start, stop]);

  // Mic turned on/off mid-recording: start a new clip so the audio matches.
  const lastMic = useRef(micState);
  useEffect(() => {
    if (lastMic.current !== micState && (micState === 'on' || micState === 'off') && recorder.current) {
      stop();
      start();
    }
    lastMic.current = micState;
  }, [micState, start, stop]);

  useEffect(() => stop, [stop]);

  /* ---------------------------- Snitch Protocol ----------------------------- */
  const filming = supported ? recording : status === 'live';

  useEffect(() => {
    if (!enforce) {
      setInternal(null);
      setWarning(null);
    }
  }, [enforce]);

  // 1. Leaving the app / switching tabs.
  useEffect(() => {
    if (!enforce) return undefined;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        intentRef.current({ type: 'violation', reason: 'hidden' }); // send before the OS suspends us
        setInternal((v) => v || 'hidden');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [enforce]);

  // 2. Camera denied / killed.
  useEffect(() => {
    if (enforce && status === 'off') setInternal((v) => v || 'camera');
  }, [enforce, status]);

  // 3. Covered lens + motionless phone (and panning detection for peek checks).
  const wantsPan = !!onPan; // callers pass a fresh function every render; only presence matters
  useEffect(() => {
    if (!enforce && !wantsPan) return undefined;
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 24;
    const cx = c.getContext('2d', { willReadFrequently: true });
    let prev = null;
    let coveredSince = null;
    const id = setInterval(() => {
      const v = video.current;
      if (!v || v.readyState < 2 || statusRef.current !== 'live') {
        prev = null;
        coveredSince = null;
        blockedNow.current = false;
        return;
      }
      cx.drawImage(v, 0, 0, 32, 24);
      const d = cx.getImageData(0, 0, 32, 24).data;
      const lum = new Float32Array(768);
      let sum = 0;
      for (let i = 0; i < 768; i += 1) {
        const l = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
        lum[i] = l;
        sum += l;
      }
      const mean = sum / 768;
      let variance = 0;
      let diff = 0;
      for (let i = 0; i < 768; i += 1) {
        variance += (lum[i] - mean) ** 2;
        if (prev) diff += Math.abs(lum[i] - prev[i]);
      }
      const std = Math.sqrt(variance / 768);
      diff = prev ? diff / 768 : 0;
      prev = lum;
      if (diff > PAN_DIFF) onPanRef.current?.();
      if (!enforceRef.current) return;

      const still = stillFor(); // null = no motion sensor data available
      const blocked = std < BLOCK_STD && (still === null || still > SAMPLE_MS);
      blockedNow.current = blocked;
      if (!blocked) {
        coveredSince = null;
        setWarning(null);
        setInternal((v) => (v === 'blocked' ? null : v)); // uncovered = filming again
        return;
      }
      coveredSince = coveredSince || Date.now();
      if (Date.now() - coveredSince >= BLOCK_MS) setWarning((w) => (w === null && !penaltyRef.current ? WARN_S : w));
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [enforce, wantsPan]);

  // Warning countdown → penalty unless the lens is uncovered in time.
  useEffect(() => {
    if (warning === null) return undefined;
    if (warning === WARN_S) {
      Synth.beep(true);
      buzz([150, 80, 150]);
    }
    const t = setTimeout(() => {
      if (!blockedNow.current) setWarning(null);
      else if (warning <= 1) {
        setWarning(null);
        setInternal((v) => v || 'blocked');
      } else {
        Synth.beep(true);
        setWarning(warning - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [warning]);

  // THE PENALTY: siren + torch strobe + screen strobe + room alert, until filming resumes.
  const active = !!penalty;
  useEffect(() => {
    if (!active) return undefined;
    intentRef.current({ type: 'violation', reason: penaltyRef.current });
    Synth.penalty();
    buzz([400, 100, 400]);
    const siren = setInterval(() => {
      Synth.penalty();
      buzz([400, 100, 400]);
    }, 1000);
    let on = false;
    const strobe = setInterval(() => {
      on = !on;
      transient.current = on;
      syncTorch();
    }, 250);
    return () => {
      clearInterval(siren);
      clearInterval(strobe);
      transient.current = false;
      syncTorch();
      intentRef.current({ type: 'resolved' });
    };
  }, [active, syncTorch]);

  // Clears our own violations once the camera is genuinely live and recording again.
  useEffect(() => {
    if (!internal || internal === 'blocked' || !resumeWanted.current) return;
    if (status === 'live' && filming && document.visibilityState === 'visible') {
      resumeWanted.current = false;
      setInternal(null);
    }
  }, [internal, status, filming]);

  const resume = () => {
    Synth.unlock();
    if (violation && onResume) onResume();
    if (internal && internal !== 'blocked') {
      resumeWanted.current = true;
      setUserStopped(false);
      if (statusRef.current !== 'live') setRestart((k) => k + 1);
      else if (supported && !recorder.current) start();
      else if (filming && document.visibilityState === 'visible') {
        resumeWanted.current = false;
        setInternal(null);
      }
    }
  };

  /* ------------------------------- noise meter ------------------------------ */
  useEffect(() => {
    if (!noiseMeter || micState !== 'on' || !micStream.current) return undefined;
    const ctx = Synth.rawContext();
    if (!ctx) return undefined;
    const src = ctx.createMediaStreamSource(micStream.current);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    let loud = 0;
    let quietUntil = 0;
    const id = setInterval(() => {
      setMeterArmed(ctx.state === 'running');
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
      const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-8);
      const level = Math.max(0, Math.min(1, (db + 70) / 60));
      if (meterBar.current) {
        meterBar.current.style.height = `${level * 100}%`;
        meterBar.current.style.background = db > NOISE_DB ? '#fff' : 'rgba(255,255,255,0.55)';
      }
      const now = Date.now();
      if (now < quietUntil || penaltyRef.current) {
        loud = 0;
        return;
      }
      loud = db > NOISE_DB ? loud + 1 : Math.max(0, loud - 1);
      if (loud >= 10) {
        // Noise for >1 s: the phone snitches with a flash and a chirp.
        loud = 0;
        quietUntil = now + 6000;
        flashFor(1000);
        Synth.chirp();
        buzz(120);
        onNoiseRef.current?.();
      }
    }, 100);
    return () => {
      clearInterval(id);
      src.disconnect();
    };
  }, [noiseMeter, micState, flashFor]);

  useImperativeHandle(ref, () => ({
    snapshot() {
      const c = document.createElement('canvas');
      c.width = 432;
      c.height = Math.round((432 * H) / W);
      c.getContext('2d').drawImage(canvas.current, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.62);
    },
    flash: flashFor,
    pulse,
    live: status === 'live',
  }));

  const screenLight = torchOn && (facing === 'user' || !torchCap);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <video ref={video} playsInline muted className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0" />
      <canvas ref={canvas} width={W} height={H} className="absolute inset-0 h-full w-full object-cover" />
      {screenLight && <div className="pointer-events-none absolute inset-0 z-[5]" style={{ boxShadow: 'inset 0 0 0 22vmin #fff' }} />}
      {screenFlash && <div className="pointer-events-none absolute inset-0 z-30 bg-white" />}

      <div className="absolute right-4 top-[max(150px,calc(env(safe-area-inset-top)+136px))] z-10 flex flex-col items-center gap-2">
        {status === 'live' && (
          <CtlButton label="Flip camera" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>
            <SwitchCamera size={18} />
          </CtlButton>
        )}
        <CtlButton
          label={torchOn ? 'Flashlight off' : 'Flashlight on'}
          on={torchOn}
          onClick={() => {
            const next = !torchOn;
            setTorchOn(next);
            if (next && !(torchCap && facing === 'environment')) say(facing === 'user' ? 'Front screen light on' : 'No hardware flashlight here — using the screen');
          }}
        >
          {torchOn ? <Flashlight size={18} /> : <FlashlightOff size={18} />}
        </CtlButton>
        {pulseButton && (
          <CtlButton label="Strobe flash pulse" onClick={pulse}>
            <Zap size={18} />
          </CtlButton>
        )}
        <CtlButton
          label={micOn || noiseMeter ? 'Mute microphone' : 'Record sound'}
          on={micState === 'on'}
          onClick={() => (noiseMeter ? say('The mic stays on — the noise snitch is listening') : setMicOn((m) => !m))}
        >
          {micState === 'on' ? <Mic size={18} /> : <MicOff size={18} />}
        </CtlButton>
        {status === 'live' && supported && (
          <button
            type="button"
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            onClick={() => {
              if (recording) {
                stop();
                setUserStopped(true);
                if (enforce) setInternal('stopped');
              } else {
                setUserStopped(false);
                start();
              }
            }}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-black/55"
          >
            <span className={recording ? 'h-3.5 w-3.5 rounded-[3px] bg-white' : 'h-4 w-4 rounded-full bg-white'} />
          </button>
        )}
        {noiseMeter && (
          <button
            type="button"
            aria-label="Noise snitch meter"
            onClick={() => {
              Synth.unlock();
              setMeterArmed(true);
            }}
            className="mt-1 flex flex-col items-center gap-1"
          >
            <div className="relative h-24 w-2.5 overflow-hidden rounded-full border border-white/30 bg-black/50">
              <div ref={meterBar} className="absolute inset-x-0 bottom-0 h-0 rounded-full bg-white/60 transition-[height] duration-100" />
              <div className="absolute inset-x-0 border-t border-white" style={{ bottom: `${((NOISE_DB + 70) / 60) * 100}%` }} />
            </div>
            <span className="text-[9.5px] font-semibold tracking-wide text-white/80">{micState === 'denied' ? 'NO MIC' : meterArmed ? 'NOISE' : 'TAP'}</span>
          </button>
        )}
      </div>

      {notice && (
        <div className="pop absolute inset-x-6 bottom-[calc(170px+var(--safe-bottom))] z-20 rounded-full bg-white px-4 py-2.5 text-center text-[13.5px] font-medium text-black">{notice}</div>
      )}

      {warning !== null && !penalty && (
        <div className="absolute inset-x-4 top-[max(150px,calc(env(safe-area-inset-top)+136px))] z-30 mr-14 rounded-[18px] bg-white px-5 py-4 text-center text-black">
          <div className="text-[13px] font-semibold">Camera blocked / not filming</div>
          <div className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.02em]">Resume in {warning}…</div>
          <div className="mt-1 text-[12.5px] text-black/60">Uncover the lens or the alarm goes off</div>
        </div>
      )}

      {children}

      {penalty && (
        <div className="fixed inset-0 z-[80] grid place-items-center px-6" style={{ animation: 'strobe .5s steps(1) infinite' }} role="alertdialog" aria-label="Snitch alarm">
          <div className="w-full max-w-sm rounded-[28px] border border-white bg-black p-6 text-center text-white">
            <Siren size={36} className="mx-auto" />
            <div className="mt-3 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/60">Snitch Protocol</div>
            <div className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.03em]">{VIOLATION_TEXT[penalty] || 'Not filming'}</div>
            <p className="mt-3 text-[14.5px] leading-snug text-white/70">
              {penalty === 'blocked'
                ? 'Your phone is screaming and flashing. Uncover the lens and point it at the action to stop it.'
                : penalty === 'peek'
                  ? 'You skipped the peek check. Pan your camera out of your hiding spot to stop the alarm.'
                  : 'Your phone is screaming, flashing and telling the room. It stops when you’re filming again.'}
            </p>
            {penalty !== 'blocked' && (
              <button type="button" onClick={resume} className="btn btn-primary mt-6">
                Resume filming
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default Camera;
