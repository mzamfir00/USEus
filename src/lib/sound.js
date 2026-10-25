// Web Audio synth — every sound effect is generated in code, no audio files.

export const Synth = (() => {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;

  const ensure = () => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return muted ? null : ctx;
  };

  const tone = (c, { type = 'sine', freq, endFreq, start = 0, dur, vol, attack = 0.002, filter }) => {
    const t = c.currentTime + start;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc.connect(gain);
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter.type;
      f.frequency.setValueAtTime(filter.freq, t);
      if (filter.endFreq) f.frequency.exponentialRampToValueAtTime(filter.endFreq, t + dur);
      if (filter.q) f.Q.value = filter.q;
      node = gain.connect(f);
    }
    node.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  const noise = (c, { start = 0, dur, vol, type = 'highpass', freq = 3000, endFreq }) => {
    const t = c.currentTime + start;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  };

  return {
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
    },
    // Sharp mechanical ratchet tick for the roulette.
    tick(pitch = 1) {
      const c = ensure();
      if (!c) return;
      tone(c, { type: 'square', freq: 2400 * pitch, endFreq: 380, dur: 0.035, vol: 0.16 });
      noise(c, { dur: 0.028, vol: 0.32, type: 'highpass', freq: 3500 });
      tone(c, { type: 'triangle', freq: 180, endFreq: 90, dur: 0.05, vol: 0.12 });
    },
    // Heavy "lock-in" bass drop + impact + synth stab.
    lockIn() {
      const c = ensure();
      if (!c) return;
      tone(c, { type: 'sine', freq: 190, endFreq: 32, dur: 1.3, vol: 0.95, attack: 0.005 });
      tone(c, { type: 'triangle', freq: 95, endFreq: 30, dur: 0.9, vol: 0.5 });
      noise(c, { dur: 0.45, vol: 0.7, type: 'lowpass', freq: 1800, endFreq: 120 });
      tone(c, { type: 'sawtooth', freq: 110, dur: 0.9, vol: 0.22, filter: { type: 'lowpass', freq: 4200, endFreq: 180, q: 6 } });
      tone(c, { type: 'sawtooth', freq: 164.8, dur: 0.9, vol: 0.18, filter: { type: 'lowpass', freq: 4200, endFreq: 180, q: 6 } });
      tone(c, { type: 'square', freq: 1760, endFreq: 880, dur: 0.18, vol: 0.06, start: 0.02 });
    },
    // Countdown beep for the final 10 seconds.
    beep(urgent = false) {
      const c = ensure();
      if (!c) return;
      tone(c, { type: 'square', freq: urgent ? 1320 : 990, dur: 0.12, vol: 0.18, filter: { type: 'lowpass', freq: 3500 } });
    },
    // Time's up alarm.
    alarm() {
      const c = ensure();
      if (!c) return;
      [0, 0.22, 0.44, 0.66].forEach((s, i) =>
        tone(c, { type: 'sawtooth', freq: i % 2 ? 660 : 880, dur: 0.2, vol: 0.22, start: s, filter: { type: 'lowpass', freq: 3000 } })
      );
      tone(c, { type: 'sine', freq: 120, endFreq: 40, dur: 1, vol: 0.6, start: 0.66 });
    },
    success() {
      const c = ensure();
      if (!c) return;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        tone(c, { type: 'triangle', freq: f, dur: 0.35, vol: 0.22, start: i * 0.08 })
      );
      tone(c, { type: 'sine', freq: 130, endFreq: 50, dur: 0.6, vol: 0.5 });
      noise(c, { dur: 0.8, vol: 0.12, type: 'highpass', freq: 6000, start: 0.3 });
    },
    fail() {
      const c = ensure();
      if (!c) return;
      [392, 370, 349.2].forEach((f, i) =>
        tone(c, { type: 'sawtooth', freq: f, dur: 0.38, vol: 0.18, start: i * 0.4, filter: { type: 'lowpass', freq: 1400 } })
      );
      tone(c, { type: 'sawtooth', freq: 330, endFreq: 240, dur: 1.1, vol: 0.2, start: 1.2, filter: { type: 'lowpass', freq: 1200 } });
    },
    click() {
      const c = ensure();
      if (!c) return;
      tone(c, { type: 'sine', freq: 880, endFreq: 520, dur: 0.06, vol: 0.12 });
    },
    // Loud 2-second sonar: four pings with a falling echo — built to be heard across a room.
    sonar() {
      const c = ensure();
      if (!c) return;
      [0, 0.5, 1, 1.5].forEach((s) => {
        tone(c, { type: 'sine', freq: 1480, endFreq: 1180, dur: 0.42, vol: 0.9, start: s, attack: 0.004 });
        tone(c, { type: 'square', freq: 740, dur: 0.12, vol: 0.25, start: s, filter: { type: 'lowpass', freq: 2400 } });
        tone(c, { type: 'sine', freq: 1480, endFreq: 1180, dur: 0.3, vol: 0.25, start: s + 0.18 });
      });
    },
    // Freeze siren: two fast up/down sweeps.
    siren() {
      const c = ensure();
      if (!c) return;
      [0, 0.45].forEach((s) => {
        tone(c, { type: 'sawtooth', freq: 520, endFreq: 1400, dur: 0.22, vol: 0.35, start: s, filter: { type: 'lowpass', freq: 3200 } });
        tone(c, { type: 'sawtooth', freq: 1400, endFreq: 520, dur: 0.22, vol: 0.35, start: s + 0.22, filter: { type: 'lowpass', freq: 3200 } });
      });
    },
    boom() {
      const c = ensure();
      if (!c) return;
      noise(c, { dur: 1.4, vol: 1, type: 'lowpass', freq: 2200, endFreq: 60 });
      tone(c, { type: 'sine', freq: 120, endFreq: 28, dur: 1.4, vol: 1 });
      tone(c, { type: 'triangle', freq: 60, endFreq: 25, dur: 1.1, vol: 0.6 });
    },
    shutter() {
      const c = ensure();
      if (!c) return;
      noise(c, { dur: 0.05, vol: 0.5, type: 'highpass', freq: 2500 });
      noise(c, { dur: 0.06, vol: 0.4, type: 'bandpass', freq: 1200, start: 0.07 });
    },
    blip() {
      const c = ensure();
      if (!c) return;
      tone(c, { type: 'triangle', freq: 660, dur: 0.09, vol: 0.25 });
      tone(c, { type: 'triangle', freq: 990, dur: 0.12, vol: 0.25, start: 0.08 });
    },
    whoosh() {
      const c = ensure();
      if (!c) return;
      noise(c, { dur: 0.5, vol: 0.35, type: 'bandpass', freq: 400, endFreq: 4000 });
    },
  };
})();

export const buzz = (pattern) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    /* vibration unsupported */
  }
};
