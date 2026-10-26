// Native game camera (expo-camera CameraView).
//
//   record       auto-record while true (CameraView.recordAsync → clip in the app cache)
//   enforce      Snitch Protocol: stopping, leaving the app, losing the camera or (Android)
//                a phone left face-down in a pocket triggers the siren + torch/screen strobe
//                and alerts the room
//   violation    external violation (e.g. a failed peek check); onResume clears it
//   noiseMeter   live mic level (expo-av metering); loud for long enough → torch flash +
//                cue + onNoise(). The clip is recorded without sound while it listens.
//   pulseButton  hunters get a flash-pulse button; beacon = slow torch strobe (zombies)
//   onPan        called when the phone swings round quickly (gyroscope)
//   torch        game-controlled flashlight (true / false); hides the manual toggle
//   lockFacing   'user' | 'environment': no flipping (Daruma-san's selfie-only walkers)
//   lensCheck    false for pitch-dark games, where darkness is not a covered phone
//   glow         soft screen glow that lights a selfie face in the dark
//   noise*       noise snitch tuning: threshold dBFS, 100 ms samples to trigger, cue, flash, cooldown
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppState, Dimensions, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { LightSensor } from 'expo-sensors';
import { LinearGradient } from 'expo-linear-gradient';
import { Flashlight, FlashlightOff, Mic, MicOff, SwitchCamera, Zap } from 'lucide-react-native';
import { addClip } from '../../lib/clips';
import { prompt, promptOpen } from '../../lib/permissions';
import { startMeter } from '../../lib/meter';
import { stillFor, subscribeMotion, useMotionSensor } from '../../lib/motion';
import { buzz, Synth } from '../../lib/sound';
import { useLater } from '../helpers';
import { T } from '../primitives';
import { IntentContext, PenaltyContext, useGameTop, ZoneStrobeContext } from './context';

const SAMPLE_MS = 1500; // pocket check sampling interval
const DARK_LUX = 2; // ambient light below this = phone covered / in a pocket
const BLOCK_MS = 8000; // covered + motionless this long → warning
const WARN_S = 3; // warning countdown before the penalty
const PAN_ROT = 25; // gyroscope deg/s that counts as panning the camera
const NOISE_DB = -26; // noise snitch danger threshold (dBFS)
// 720p at a capped bitrate keeps clips small enough to share and the phone cool over a
// 10-minute round with the torch on. A clip rolls over into the next one at 10 minutes.
const VIDEO_QUALITY = '720p';
const VIDEO_BITRATE = 4000000;
const MAX_CLIP_S = 600;
// Android reports peak amplitude rather than RMS power: shift its readings to match.
const METER_OFFSET = Platform.OS === 'android' ? -6 : 0;

export const VIOLATION_TEXT = {
  stopped: 'Recording stopped',
  hidden: 'Left the app',
  camera: 'Camera turned off',
  blocked: 'Camera blocked',
  peek: 'Missed the peek check',
};

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const today = () => {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

function CtlButton({ label, onPress, children, on = false, disabled = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on, disabled }}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: on ? '#fff' : 'rgba(255,255,255,0.2)',
        backgroundColor: on ? '#fff' : 'rgba(0,0,0,0.55)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

// Thick white border that blinks while `flash` is on (sonar beeps, lava countdown).
function FlashFrame() {
  const [thick, setThick] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setThick((v) => !v), 150);
    return () => clearInterval(id);
  }, []);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: thick ? 18 : 7, borderColor: '#fff', zIndex: 6 }]} />;
}

function Hud({ hud, recording, recStart }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 600);
    return () => clearInterval(id);
  }, []);
  const blink = Math.floor(Date.now() / 600) % 2 === 0;
  const place = hud?.location ? hud.location.toUpperCase() : '';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 260, zIndex: 2 }}>
      <LinearGradient colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', left: 18, right: 70, top: 112 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {recording ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: blink ? '#fff' : 'transparent' }} /> : null}
          <T size={14} w={700} color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>
            {`${recording ? `REC  ${fmt(Date.now() - recStart)}` : 'LIVE'}  •  ${(hud?.title || '').toUpperCase()}`}
          </T>
        </View>
        <T size={10.5} w={600} color="rgba(255,255,255,0.85)" numberOfLines={1} style={{ marginTop: 4 }}>
          {[place, hud?.room ? `ROOM ${hud.room}` : '', today(), 'USEus'].filter(Boolean).join('  •  ')}
        </T>
      </View>
    </View>
  );
}

const Camera = forwardRef(function Camera(
  {
    hud,
    record = false,
    micDefault = true,
    flash = false,
    children,
    enforce = false,
    violation = null,
    onResume,
    noiseMeter = false,
    onNoise,
    pulseButton = false,
    beacon = false,
    onPan,
    torch,
    lockFacing,
    lensCheck = true,
    glow = false,
    noiseDb = NOISE_DB,
    noiseHold = 10,
    noiseCue = 'chirp',
    noiseFlashMs = 1000,
    noiseCooldown = 6000,
  },
  ref
) {
  const later = useLater();
  const intentCtx = useContext(IntentContext);
  const intentRef = useRef(intentCtx);
  intentRef.current = intentCtx;
  const zoneStrobe = useContext(ZoneStrobeContext); // GPS Playzone out-of-bounds penalty
  const top = useGameTop();
  const setPenaltyOverlay = useContext(PenaltyContext);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();

  const cam = useRef(null);
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const onPanRef = useRef(onPan);
  onPanRef.current = onPan;
  const onNoiseRef = useRef(onNoise);
  onNoiseRef.current = onNoise;
  const enforceRef = useRef(enforce);
  enforceRef.current = enforce;

  const [status, setStatus] = useState('loading'); // loading | live | off
  const [facing, setFacing] = useState(lockFacing || 'environment');
  const [restart, setRestart] = useState(0);
  const [micOn, setMicOn] = useState(micDefault);
  const [recording, setRecording] = useState(false);
  const [manual, setManual] = useState(false); // recording started by hand in a non-recording game
  const [userStopped, setUserStopped] = useState(false);
  const [swapping, setSwapping] = useState(false); // Android: brief switch to photo mode for a snapshot
  const [torchOn, setTorchOn] = useState(false);
  const [transient, setTransient] = useState(false); // pulses / strobes
  const [screenFlash, setScreenFlash] = useState(false);
  const [internal, setInternal] = useState(null); // our own violation reason
  const [warning, setWarning] = useState(null); // seconds left before a "blocked" penalty
  const [level, setLevel] = useState(0); // noise meter 0..1
  const [loud, setLoud] = useState(false);
  const [meterState, setMeterState] = useState('off'); // off | on | denied
  const [notice, setNotice] = useState('');

  const recRef = useRef({ active: false, stopWanted: false, startedAt: 0 });
  const statusRef = useRef(status);
  statusRef.current = status;
  const facingRef = useRef(facing);
  facingRef.current = facing;
  const lit = torch ?? torchOn; // game-forced flashlight wins over the manual toggle
  const lensRef = useRef(lensCheck);
  lensRef.current = lensCheck;
  const noiseRef = useRef({ noiseDb, noiseHold, noiseCue, noiseFlashMs, noiseCooldown });
  noiseRef.current = { noiseDb, noiseHold, noiseCue, noiseFlashMs, noiseCooldown };
  const penalty = enforce ? internal || violation : violation;
  const penaltyRef = useRef(penalty);
  penaltyRef.current = penalty;
  const blockedNow = useRef(false);
  const resumeWanted = useRef(false);
  const swapRef = useRef(null); // pending Android snapshot { resolve }

  // Expo's web target (dev previews) can't record video: the viewfinder alone counts as filming.
  const canRecord = Platform.OS !== 'web';
  const wantVideo = canRecord && (record || manual) && !swapping;
  const mode = wantVideo ? 'video' : 'picture';
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const camFacing = facing === 'user' ? 'front' : 'back';
  // The noise snitch owns the microphone, so the clip is recorded silently while it listens.
  const muted = noiseMeter || !micOn || !micPerm?.granted;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const say = (text) => {
    setNotice(text);
    later(() => setNotice(''), 2600);
  };

  // Flipping rebuilds the capture session: end the clip first so it isn't read as a snitch.
  const flipTo = useCallback((next) => {
    if (recRef.current.active) {
      recRef.current.stopWanted = true;
      try {
        cam.current?.stopRecording();
      } catch (e) {
        /* already stopped */
      }
    }
    setFacing(next);
  }, []);

  useEffect(() => {
    if (lockFacing && facing !== lockFacing) flipTo(lockFacing);
  }, [lockFacing, facing, flipTo]);

  /* ------------------------------ permissions ------------------------------ */
  useEffect(() => {
    if (camPerm && !camPerm.granted) {
      if (camPerm.canAskAgain) prompt(requestCamPerm);
      else setStatus('off');
    }
  }, [camPerm, requestCamPerm]);

  useEffect(() => {
    if ((micOn || noiseMeter) && micPerm && !micPerm.granted && micPerm.canAskAgain) prompt(requestMicPerm);
  }, [micOn, noiseMeter, micPerm, requestMicPerm]);

  useEffect(() => {
    if (camPerm && !camPerm.granted && !camPerm.canAskAgain) setStatus('off');
  }, [camPerm]);

  // Re-arm "loading" whenever the camera is rebuilt (restart; on Android also a flip or a
  // photo/video mode switch, which rebinds the camera and fires onCameraReady again).
  useEffect(() => {
    setStatus((s) => (s === 'off' && camPerm?.granted ? 'loading' : s));
  }, [restart, camPerm?.granted]);
  const firstBind = useRef(true);
  useEffect(() => {
    if (firstBind.current) {
      firstBind.current = false;
      return;
    }
    if (Platform.OS === 'android') setStatus((s) => (s === 'live' ? 'loading' : s));
  }, [mode, camFacing]);

  /* --------------------------------- torch --------------------------------- */
  const enableTorch = status === 'live' && ((lit && camFacing === 'back') || transient);

  // Brief light: hardware torch on the rear camera, otherwise a white screen flash.
  const flashFor = useCallback(
    (ms) => {
      if (facingRef.current === 'environment' && statusRef.current === 'live') {
        setTransient(true);
        later(() => setTransient(false), ms);
      } else {
        setScreenFlash(true);
        later(() => setScreenFlash(false), ms);
      }
    },
    [later]
  );

  const pulse = useCallback(() => {
    buzz([60, 60, 60, 60, 60]);
    [0, 240, 480, 720].forEach((t) => later(() => flashFor(130), t));
  }, [flashFor, later]);

  // Zombie beacon: slow torch strobe.
  useEffect(() => {
    if (!beacon || penalty || zoneStrobe) return undefined;
    const id = setInterval(() => setTransient((v) => !v), 1000);
    return () => {
      clearInterval(id);
      setTransient(false);
    };
  }, [beacon, penalty, zoneStrobe]);

  // Playzone penalty: the flashlight strobes (250 ms) while your position is revealed.
  useEffect(() => {
    if (!zoneStrobe || penalty) return undefined;
    const id = setInterval(() => setTransient((v) => !v), 250);
    return () => {
      clearInterval(id);
      setTransient(false);
    };
  }, [zoneStrobe, penalty]);

  /* -------------------------------- recording ------------------------------- */
  const stop = useCallback(() => {
    const r = recRef.current;
    if (!r.active) return;
    r.stopWanted = true;
    try {
      cam.current?.stopRecording();
    } catch (e) {
      /* already stopped */
    }
  }, []);

  const failures = useRef(0);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  const shouldRecord = useRef(false);
  shouldRecord.current = wantVideo && (record ? !userStopped : true);
  const start = useCallback(async () => {
    const r = recRef.current;
    if (r.active || !cam.current || statusRef.current !== 'live' || modeRef.current !== 'video') return;
    r.active = true;
    r.stopWanted = false;
    r.startedAt = Date.now();
    setRecording(true);
    const meta = { ...hudRef.current };
    const began = r.startedAt;
    let uri = null;
    let failed = false;
    try {
      const res = await cam.current.recordAsync({ maxDuration: MAX_CLIP_S });
      uri = res?.uri || null;
    } catch (e) {
      failed = true;
    }
    const durationMs = Date.now() - began;
    if (uri && durationMs > 1200) addClip({ uri, roundKey: meta.roundKey, game: meta.game, title: meta.title, location: meta.location, durationMs });
    const expected = r.stopWanted;
    r.active = false;
    r.stopWanted = false;
    setRecording(false);
    if (swapRef.current || !mounted.current) return;
    const again = (ms) => later(() => statusRef.current === 'live' && start(), ms);
    // Stopped on purpose (flip, mic change) or hit the 10-minute limit: carry straight on.
    // (iOS reports the limit as an error, Android as a normal finish: both just roll over.)
    const rolledOver = durationMs >= MAX_CLIP_S * 1000 - 2000;
    if (expected || rolledOver) {
      if (shouldRecord.current) again(rolledOver ? 0 : 350);
      return;
    }
    // A recorder that fails right as it starts (camera still settling) gets a few retries.
    if (failed && durationMs < 1500 && failures.current < 3 && (AppState.currentState === 'active' || promptOpen())) {
      failures.current += 1;
      again(800);
      return;
    }
    failures.current = 0;
    // Stopped by the system (camera lost, app backgrounded) rather than by us. A permission
    // prompt pauses the camera too: just start again.
    if (promptOpen()) {
      again(1500);
      return;
    }
    if (enforceRef.current) setInternal((v) => v || 'stopped');
  }, [later]);

  useEffect(() => {
    if (!wantVideo) {
      stop();
      return undefined;
    }
    if (!((record ? !userStopped : true) && status === 'live' && mode === 'video')) return undefined;
    // Give a freshly (re)configured camera a moment before recording.
    const timer = setTimeout(start, 350);
    return () => clearTimeout(timer);
  }, [wantVideo, record, userStopped, status, mode, start, stop]);

  // Mic turned on/off mid-recording: start a new clip so the audio matches.
  const lastMuted = useRef(muted);
  useEffect(() => {
    if (lastMuted.current !== muted && recRef.current.active) stop();
    lastMuted.current = muted;
  }, [muted, stop]);

  useEffect(() => stop, [stop]);

  /* ---------------------------- Snitch Protocol ----------------------------- */
  const filming = wantVideo ? recording : status === 'live';

  useEffect(() => {
    if (!enforce) {
      setInternal(null);
      setWarning(null);
    }
  }, [enforce]);

  // 1. Leaving the app.
  useEffect(() => {
    if (!enforce) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && !promptOpen()) {
        intentRef.current({ type: 'violation', reason: 'hidden' }); // send before the OS suspends us
        setInternal((v) => v || 'hidden');
      }
    });
    return () => sub.remove();
  }, [enforce]);

  // 2. Camera denied / killed.
  useEffect(() => {
    if (enforce && status === 'off') setInternal((v) => v || 'camera');
  }, [enforce, status]);

  // 3. Panning (peek checks) from the gyroscope.
  const wantsPan = !!onPan;
  useEffect(() => {
    if (!wantsPan) return undefined;
    let last = 0;
    return subscribeMotion((m, { rot }) => {
      if (rot > PAN_ROT && Date.now() - last > 500) {
        last = Date.now();
        onPanRef.current?.();
      }
    });
  }, [wantsPan]);

  // 4. Phone covered or in a pocket and motionless (ambient light sensor, Android).
  useMotionSensor(enforce && lensCheck && Platform.OS === 'android');
  useEffect(() => {
    if (!enforce || !lensCheck || Platform.OS !== 'android') return undefined;
    let lux = null;
    let coveredSince = null;
    let sub = null;
    let id = null;
    let cancelled = false;
    LightSensor.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) return;
        LightSensor.setUpdateInterval(500);
        sub = LightSensor.addListener((d) => {
          lux = d.illuminance;
        });
        id = setInterval(() => {
          if (lux == null || statusRef.current !== 'live' || !enforceRef.current || !lensRef.current) {
            coveredSince = null;
            blockedNow.current = false;
            return;
          }
          const still = stillFor(); // null = no motion sensor data available
          const blocked = lux < DARK_LUX && (still === null || still > SAMPLE_MS);
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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
      if (id) clearInterval(id);
      blockedNow.current = false;
    };
  }, [enforce, lensCheck]);

  // Warning countdown → penalty unless the phone is uncovered in time.
  useEffect(() => {
    if (warning === null) return undefined;
    if (warning === WARN_S) {
      Synth.beep(true);
      buzz([150, 80, 150]);
    }
    const timer = setTimeout(() => {
      if (!blockedNow.current) setWarning(null);
      else if (warning <= 1) {
        setWarning(null);
        setInternal((v) => v || 'blocked');
      } else {
        Synth.beep(true);
        setWarning(warning - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
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
    const strobe = setInterval(() => setTransient((v) => !v), 250);
    return () => {
      clearInterval(siren);
      clearInterval(strobe);
      setTransient(false);
      intentRef.current({ type: 'resolved' });
    };
  }, [active]);

  // Clears our own violations once the camera is genuinely live and recording again.
  useEffect(() => {
    if (!internal || internal === 'blocked' || !resumeWanted.current) return;
    if (status === 'live' && filming && AppState.currentState === 'active') {
      resumeWanted.current = false;
      setInternal(null);
    }
  }, [internal, status, filming]);

  const resume = useCallback(() => {
    Synth.unlock();
    if (violation && onResume) onResume();
    if (internal && internal !== 'blocked') {
      resumeWanted.current = true;
      setUserStopped(false);
      if (statusRef.current !== 'live') {
        setStatus('loading');
        setRestart((k) => k + 1);
      } else if (modeRef.current === 'video' && !recRef.current.active) start();
      else if (filming) {
        resumeWanted.current = false;
        setInternal(null);
      }
    }
  }, [violation, onResume, internal, filming, start]);

  // The alarm overlay sits above the whole game shell. It only changes with the reason; the
  // button always calls the latest resume() through a ref.
  const resumeRef = useRef(resume);
  resumeRef.current = resume;
  const stableResume = useCallback(() => resumeRef.current(), []);
  useEffect(() => {
    setPenaltyOverlay?.(penalty ? { reason: penalty, onResume: penalty !== 'blocked' ? stableResume : null, cameraOff: status === 'off' } : null);
  }, [penalty, status, stableResume, setPenaltyOverlay]);
  useEffect(() => () => setPenaltyOverlay?.(null), [setPenaltyOverlay]);

  /* ------------------------------- noise meter ------------------------------ */
  useEffect(() => {
    if (!noiseMeter) {
      setMeterState('off');
      return undefined;
    }
    if (!micPerm?.granted) {
      if (micPerm && !micPerm.canAskAgain) setMeterState('denied');
      return undefined;
    }
    let count = 0;
    let quietUntil = 0;
    let first = true;
    const stopMeter = startMeter(
      (raw) => {
        if (first) {
          first = false;
          setMeterState('on');
        }
        const db = raw + METER_OFFSET;
        const n = noiseRef.current;
        setLevel(Math.max(0, Math.min(1, (db + 70) / 60)));
        setLoud(db > n.noiseDb);
        const now = Date.now();
        if (now < quietUntil || penaltyRef.current) {
          count = 0;
          return;
        }
        count = db > n.noiseDb ? count + 1 : Math.max(0, count - 1);
        if (count >= n.noiseHold) {
          // Sustained noise: the phone snitches with a flash and a sound cue.
          count = 0;
          quietUntil = now + n.noiseCooldown;
          flashFor(n.noiseFlashMs);
          if (n.noiseCue === 'musicbox') Synth.musicBox();
          else Synth.chirp();
          buzz(120);
          onNoiseRef.current?.();
        }
      },
      {
        onError: (e) => {
          console.warn('[camera] noise meter', e);
          setMeterState('denied');
        },
      }
    );
    return stopMeter;
  }, [noiseMeter, micPerm?.granted, micPerm?.canAskAgain, flashFor]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -------------------------------- snapshot -------------------------------- */
  // Only the small base64 copy travels to the room; both cache files are deleted at once.
  const shrink = async (uri) => {
    const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 432 } }], {
      compress: 0.55,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    [uri, out.uri].forEach((u) => u && FileSystem.deleteAsync(u, { idempotent: true }).catch(() => {}));
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
  };

  const takePhoto = async () => {
    const pic = await cam.current?.takePictureAsync({ quality: 0.5, skipProcessing: true, shutterSound: false });
    return pic?.uri ? shrink(pic.uri) : null;
  };

  const onReady = () => {
    setStatus('live');
    const pending = swapRef.current;
    if (pending && modeRef.current === 'picture') {
      // Android snapshot while recording: photo mode is up, take it and switch back.
      later(async () => {
        let img = null;
        try {
          img = await takePhoto();
        } catch (e) {
          img = null;
        }
        swapRef.current = null;
        setSwapping(false);
        pending.resolve(img);
      }, 250);
    }
  };

  useImperativeHandle(ref, () => ({
    // Resolves to a small JPEG data URI (or null when the camera can't take one now).
    // `quick` skips Android's clip split (for moments that can't wait, like TOMARE).
    async snapshot({ quick = false } = {}) {
      if (statusRef.current !== 'live' || !cam.current) return null;
      try {
        if (modeRef.current === 'picture' || Platform.OS === 'ios') return await takePhoto();
        if (quick) return null;
        // Android records and photographs in different camera modes: split the clip,
        // take the photo, then carry on recording.
        if (swapRef.current) return null;
        return await new Promise((resolve) => {
          swapRef.current = { resolve };
          stop();
          setStatus('loading');
          setSwapping(true);
          later(() => {
            if (swapRef.current?.resolve === resolve) {
              swapRef.current = null;
              setSwapping(false);
              resolve(null);
            }
          }, 4000);
        });
      } catch (e) {
        return null;
      }
    },
    flash: flashFor,
    pulse,
    get live() {
      return statusRef.current === 'live';
    },
  }));

  const screenLight = lit && camFacing === 'front';
  const vmin = Math.min(Dimensions.get('window').width, Dimensions.get('window').height) / 100;
  const ctlTop = top.banner;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', overflow: 'hidden' }]} testID="camera" accessibilityLabel={`camera torch ${enableTorch ? 'on' : 'off'} ${camFacing}`}>
      {camPerm?.granted && status !== 'off' ? (
        <CameraView
          key={`${restart}`}
          ref={cam}
          style={StyleSheet.absoluteFill}
          facing={camFacing}
          mode={mode}
          mute={muted}
          enableTorch={enableTorch}
          videoQuality={VIDEO_QUALITY}
          videoBitrate={VIDEO_BITRATE}
          mirror={camFacing === 'front'}
          animateShutter={false}
          onCameraReady={onReady}
          onMountError={() => setStatus('off')}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
          <T size={15} w={600} color="#8a8a8a" center>
            {status === 'off' || (camPerm && !camPerm.granted && !camPerm.canAskAgain) ? 'Camera unavailable — allow camera access in Settings' : 'Starting camera…'}
          </T>
        </View>
      )}
      <Hud hud={hud} recording={recording} recStart={recRef.current.startedAt} />
      {screenLight && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 22 * vmin, borderColor: '#fff', zIndex: 5 }]} />}
      {glow && !screenLight && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 16 * vmin, borderColor: 'rgba(255,255,255,0.16)', zIndex: 5 }]} />}
      {flash && <FlashFrame />}
      {screenFlash && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', zIndex: 30 }]} />}

      <View style={{ position: 'absolute', right: 16, top: ctlTop, zIndex: 10, alignItems: 'center', gap: 8 }}>
        {status === 'live' && !lockFacing && (
          <CtlButton label="Flip camera" onPress={() => flipTo(facing === 'user' ? 'environment' : 'user')}>
            <SwitchCamera size={18} color="#fff" />
          </CtlButton>
        )}
        {torch === undefined && (
          <CtlButton
            label={torchOn ? 'Flashlight off' : 'Flashlight on'}
            on={torchOn}
            onPress={() => {
              const next = !torchOn;
              setTorchOn(next);
              if (next && camFacing === 'front') say('Front screen light on');
            }}
          >
            {torchOn ? <Flashlight size={18} color="#000" /> : <FlashlightOff size={18} color="#fff" />}
          </CtlButton>
        )}
        {pulseButton && (
          <CtlButton label="Strobe flash pulse" onPress={pulse}>
            <Zap size={18} color="#fff" />
          </CtlButton>
        )}
        <CtlButton
          label={noiseMeter ? 'Noise snitch listening' : micOn ? 'Mute microphone' : 'Record sound'}
          on={noiseMeter ? meterState === 'on' : !muted}
          onPress={() => (noiseMeter ? say('The mic stays on — the noise snitch is listening') : setMicOn((m) => !m))}
        >
          {(noiseMeter ? meterState === 'on' : !muted) ? <Mic size={18} color="#000" /> : <MicOff size={18} color="#fff" />}
        </CtlButton>
        {status === 'live' && canRecord && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
            testID="record-toggle"
            onPress={() => {
              if (recording) {
                stop();
                setManual(false);
                setUserStopped(true);
                if (enforce) setInternal('stopped');
              } else {
                setUserStopped(false);
                if (!record) setManual(true);
                else start();
              }
            }}
            style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={recording ? { width: 14, height: 14, borderRadius: 3, backgroundColor: '#fff' } : { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' }} />
          </TouchableOpacity>
        )}
        {noiseMeter && (
          <View accessibilityLabel="Noise snitch meter" style={{ marginTop: 4, alignItems: 'center', gap: 4 }}>
            <View style={{ height: 96, width: 10, borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${level * 100}%`, borderRadius: 5, backgroundColor: loud ? '#fff' : 'rgba(255,255,255,0.55)' }} />
              <View style={{ position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#fff', bottom: `${((noiseDb + 70) / 60) * 100}%` }} />
            </View>
            <T size={9.5} w={600} ls={0.4} color="rgba(255,255,255,0.8)">
              {meterState === 'denied' ? 'NO MIC' : 'NOISE'}
            </T>
          </View>
        )}
      </View>

      {notice ? (
        <View style={{ position: 'absolute', left: 24, right: 24, bottom: 170, zIndex: 20, borderRadius: 999, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10 }}>
          <T size={13.5} w={500} color="#000" center>
            {notice}
          </T>
        </View>
      ) : null}

      {warning !== null && !penalty && (
        <View style={{ position: 'absolute', left: 16, right: 72, top: ctlTop, zIndex: 30, borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16 }}>
          <T size={13} w={600} color="#000" center>
            Phone covered / not filming
          </T>
          <T size={22} w={700} color="#000" center style={{ marginTop: 4 }}>
            Resume in {warning}…
          </T>
          <T size={12.5} color="rgba(0,0,0,0.6)" center style={{ marginTop: 4 }}>
            Take it out and point it at the action or the alarm goes off
          </T>
        </View>
      )}

      {children}
    </View>
  );
});

export default Camera;
