"""Renders the USEus sound effects to WAV files (mobile/assets/sounds/).

The web app synthesises its sounds live with Web Audio (src/lib/sound.js). React Native has
no audio graph, so the same recipes — oscillators with exponential pitch ramps, exponential
gain envelopes, biquad filters with sweeping cutoffs, filtered white noise — are rendered
offline here and bundled with the native app. Re-run after changing a recipe:

    python3 mobile/scripts/make-sounds.py
"""
import math
import os
import wave

import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
rng = np.random.default_rng(7)


def ramp_exp(a, b, n):
    a, b = max(a, 1e-4), max(b, 1e-4)
    return a * (b / a) ** (np.arange(n) / max(1, n - 1))


def biquad(x, ftype, f0, f1, q, dur):
    """Time-varying RBJ biquad, cutoff swept exponentially from f0 to f1 over dur."""
    n = len(x)
    nd = int(dur * SR)
    freqs = np.concatenate([ramp_exp(f0, f1 or f0, max(1, nd)), np.full(max(0, n - nd), f1 or f0)])[:n]
    y = np.zeros(n)
    x1 = x2 = y1 = y2 = 0.0
    block = 32
    for s in range(0, n, block):
        f = min(freqs[s], SR * 0.45)
        w0 = 2 * math.pi * f / SR
        cw, sw = math.cos(w0), math.sin(w0)
        alpha = sw / (2 * q)
        if ftype == 'lowpass':
            b0, b1, b2 = (1 - cw) / 2, 1 - cw, (1 - cw) / 2
        elif ftype == 'highpass':
            b0, b1, b2 = (1 + cw) / 2, -(1 + cw), (1 + cw) / 2
        else:  # bandpass, constant 0 dB peak
            b0, b1, b2 = alpha, 0.0, -alpha
        a0, a1, a2 = 1 + alpha, -2 * cw, 1 - alpha
        b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0
        for i in range(s, min(n, s + block)):
            xi = x[i]
            yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2, x1, y2, y1 = x1, xi, y1, yi
            y[i] = yi
    return y


def q_of(ftype, q):
    # Web Audio: lowpass/highpass Q is resonance in dB, bandpass Q is a quality factor.
    if ftype in ('lowpass', 'highpass'):
        return 10 ** ((q if q is not None else 1) / 20)
    return q if q is not None else 1


class Mix:
    def __init__(self, length):
        self.buf = np.zeros(int((length + 0.3) * SR))

    def add(self, sig, start):
        i = int(start * SR)
        end = min(len(self.buf), i + len(sig))
        self.buf[i:end] += sig[: end - i]

    def tone(self, type='sine', freq=440, endFreq=None, start=0, dur=0.2, vol=0.3, attack=0.002, filter=None):
        n = int((dur + 0.05) * SR)
        nd = int(dur * SR)
        f = np.concatenate([ramp_exp(freq, endFreq or freq, nd), np.full(n - nd, endFreq or freq)])
        phase = 2 * math.pi * np.cumsum(f) / SR
        cyc = (phase / (2 * math.pi)) % 1
        wave_ = {
            'sine': np.sin(phase),
            'square': np.where(cyc < 0.5, 1.0, -1.0),
            'sawtooth': 2 * cyc - 1,
            'triangle': 1 - 4 * np.abs(cyc - 0.5),
        }[type]
        na = max(1, int(attack * SR))
        env = np.concatenate([ramp_exp(1e-4, vol, na), ramp_exp(vol, 1e-4, max(1, nd - na)), np.zeros(max(0, n - nd))])[:n]
        sig = wave_ * env
        if filter:
            sig = biquad(sig, filter['type'], filter['freq'], filter.get('endFreq'), q_of(filter['type'], filter.get('q')), dur)
        self.add(sig, start)

    def noise(self, start=0, dur=0.2, vol=0.3, type='highpass', freq=3000, endFreq=None, q=None):
        n = int((dur + 0.05) * SR)
        nd = int(dur * SR)
        src = rng.uniform(-1, 1, n)
        sig = biquad(src, type, freq, endFreq, q_of(type, q), dur)
        env = np.concatenate([ramp_exp(vol, 1e-4, max(1, nd)), np.zeros(n - nd)])[:n]
        self.add(sig * env, start)

    def render(self, name):
        x = self.buf * 0.8
        t = 10 ** (-10 / 20)  # ~DynamicsCompressor: threshold -10 dB, ratio 6
        mag = np.abs(x)
        x = np.where(mag > t, np.sign(x) * (t + (mag - t) / 6), x)
        nz = np.nonzero(np.abs(x) > 1e-4)[0]
        x = x[: (nz[-1] + int(0.02 * SR)) if len(nz) else len(x)]
        peak = np.max(np.abs(x)) or 1
        x = x * min(0.95 / peak, 2.6)  # make-up gain, capped so quiet cues stay quiet
        fade = min(len(x), int(0.005 * SR))
        x[-fade:] *= np.linspace(1, 0, fade)
        pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
        with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())


def sound(name, length):
    def deco(fn):
        m = Mix(length)
        fn(m)
        m.render(name)
        return fn
    return deco


@sound('tick', 0.1)
def _(m):
    m.tone(type='square', freq=2400 * 0.9, endFreq=380, dur=0.035, vol=0.16)
    m.noise(dur=0.028, vol=0.32, type='highpass', freq=3500)
    m.tone(type='triangle', freq=180, endFreq=90, dur=0.05, vol=0.12)

@sound('lockin', 1.4)
def _(m):
    m.tone(type='sine', freq=190, endFreq=32, dur=1.3, vol=0.95, attack=0.005)
    m.tone(type='triangle', freq=95, endFreq=30, dur=0.9, vol=0.5)
    m.noise(dur=0.45, vol=0.7, type='lowpass', freq=1800, endFreq=120)
    m.tone(type='sawtooth', freq=110, dur=0.9, vol=0.22, filter={'type': 'lowpass', 'freq': 4200, 'endFreq': 180, 'q': 6})
    m.tone(type='sawtooth', freq=164.8, dur=0.9, vol=0.18, filter={'type': 'lowpass', 'freq': 4200, 'endFreq': 180, 'q': 6})
    m.tone(type='square', freq=1760, endFreq=880, dur=0.18, vol=0.06, start=0.02)

@sound('beep', 0.2)
def _(m):
    m.tone(type='square', freq=990, dur=0.12, vol=0.18, filter={'type': 'lowpass', 'freq': 3500})

@sound('beep_urgent', 0.2)
def _(m):
    m.tone(type='square', freq=1320, dur=0.12, vol=0.18, filter={'type': 'lowpass', 'freq': 3500})

@sound('alarm', 1.8)
def _(m):
    for i, s in enumerate([0, 0.22, 0.44, 0.66]):
        m.tone(type='sawtooth', freq=660 if i % 2 else 880, dur=0.2, vol=0.22, start=s, filter={'type': 'lowpass', 'freq': 3000})
    m.tone(type='sine', freq=120, endFreq=40, dur=1, vol=0.6, start=0.66)

@sound('success', 1.2)
def _(m):
    for i, f in enumerate([523.25, 659.25, 783.99, 1046.5, 1318.5]):
        m.tone(type='triangle', freq=f, dur=0.35, vol=0.22, start=i * 0.08)
    m.tone(type='sine', freq=130, endFreq=50, dur=0.6, vol=0.5)
    m.noise(dur=0.8, vol=0.12, type='highpass', freq=6000, start=0.3)

@sound('fail', 2.4)
def _(m):
    for i, f in enumerate([392, 370, 349.2]):
        m.tone(type='sawtooth', freq=f, dur=0.38, vol=0.18, start=i * 0.4, filter={'type': 'lowpass', 'freq': 1400})
    m.tone(type='sawtooth', freq=330, endFreq=240, dur=1.1, vol=0.2, start=1.2, filter={'type': 'lowpass', 'freq': 1200})

@sound('click', 0.1)
def _(m):
    m.tone(type='sine', freq=880, endFreq=520, dur=0.06, vol=0.12)

@sound('sonar', 2.1)
def _(m):
    for s in [0, 0.5, 1, 1.5]:
        m.tone(type='sine', freq=1480, endFreq=1180, dur=0.42, vol=0.9, start=s, attack=0.004)
        m.tone(type='square', freq=740, dur=0.12, vol=0.25, start=s, filter={'type': 'lowpass', 'freq': 2400})
        m.tone(type='sine', freq=1480, endFreq=1180, dur=0.3, vol=0.25, start=s + 0.18)

@sound('siren', 0.95)
def _(m):
    for s in [0, 0.45]:
        m.tone(type='sawtooth', freq=520, endFreq=1400, dur=0.22, vol=0.35, start=s, filter={'type': 'lowpass', 'freq': 3200})
        m.tone(type='sawtooth', freq=1400, endFreq=520, dur=0.22, vol=0.35, start=s + 0.22, filter={'type': 'lowpass', 'freq': 3200})

@sound('boom', 1.5)
def _(m):
    m.noise(dur=1.4, vol=1, type='lowpass', freq=2200, endFreq=60)
    m.tone(type='sine', freq=120, endFreq=28, dur=1.4, vol=1)
    m.tone(type='triangle', freq=60, endFreq=25, dur=1.1, vol=0.6)

@sound('shutter', 0.2)
def _(m):
    m.noise(dur=0.05, vol=0.5, type='highpass', freq=2500)
    m.noise(dur=0.06, vol=0.4, type='bandpass', freq=1200, start=0.07)

@sound('blip', 0.25)
def _(m):
    m.tone(type='triangle', freq=660, dur=0.09, vol=0.25)
    m.tone(type='triangle', freq=990, dur=0.12, vol=0.25, start=0.08)

@sound('penalty', 1.05)
def _(m):
    for i, s in enumerate([0, 0.25, 0.5, 0.75]):
        m.tone(type='square', freq=1850 if i % 2 else 2650, dur=0.24, vol=0.5, start=s, attack=0.003, filter={'type': 'lowpass', 'freq': 6000})
        m.tone(type='sawtooth', freq=925 if i % 2 else 1325, dur=0.24, vol=0.25, start=s)

@sound('alert', 0.35)
def _(m):
    m.tone(type='square', freq=1320, dur=0.12, vol=0.2, filter={'type': 'lowpass', 'freq': 4000})
    m.tone(type='square', freq=1760, dur=0.16, vol=0.2, start=0.14, filter={'type': 'lowpass', 'freq': 4000})

@sound('chirp', 0.35)
def _(m):
    m.tone(type='sine', freq=2200, endFreq=3600, dur=0.12, vol=0.6)
    m.tone(type='sine', freq=2400, endFreq=4000, dur=0.12, vol=0.6, start=0.16)

@sound('radar', 1.05)
def _(m):
    for s in [0, 0.35, 0.7]:
        m.tone(type='sine', freq=1200, endFreq=900, dur=0.3, vol=0.85, start=s)

@sound('polo', 0.6)
def _(m):
    m.tone(type='sawtooth', freq=330, dur=0.22, vol=0.5, filter={'type': 'bandpass', 'freq': 700, 'q': 4})
    m.tone(type='sawtooth', freq=262, dur=0.3, vol=0.5, start=0.24, filter={'type': 'bandpass', 'freq': 520, 'q': 4})

@sound('marco', 0.6)
def _(m):
    m.tone(type='sawtooth', freq=392, dur=0.22, vol=0.4, filter={'type': 'bandpass', 'freq': 800, 'q': 4})
    m.tone(type='sawtooth', freq=330, dur=0.3, vol=0.4, start=0.24, filter={'type': 'bandpass', 'freq': 650, 'q': 4})

@sound('infect', 0.9)
def _(m):
    m.tone(type='sawtooth', freq=110, endFreq=70, dur=0.8, vol=0.5, filter={'type': 'lowpass', 'freq': 600})
    m.noise(dur=0.6, vol=0.3, type='bandpass', freq=300)

@sound('whoosh', 0.55)
def _(m):
    m.noise(dur=0.5, vol=0.35, type='bandpass', freq=400, endFreq=4000)

@sound('whisper', 2.0)
def _(m):
    m.noise(dur=1.8, vol=0.55, type='bandpass', freq=380, endFreq=1400)
    m.noise(dur=1.2, vol=0.4, type='bandpass', freq=2600, endFreq=900, start=0.25)
    for s in [0.15, 0.55, 0.95]:
        m.noise(dur=0.35, vol=0.35, type='highpass', freq=5200, start=s)
    m.tone(type='sine', freq=92, endFreq=61, dur=1.9, vol=0.35)

@sound('shriek', 1.0)
def _(m):
    for f in [1480, 1567, 2217]:
        m.tone(type='sawtooth', freq=f, endFreq=f * 0.82, dur=0.9, vol=0.32, filter={'type': 'highpass', 'freq': 900})
    m.noise(dur=0.9, vol=0.45, type='highpass', freq=3000)

@sound('musicbox', 1.4)
def _(m):
    for i, f in enumerate([1318.5, 1567.98, 1975.53, 1244.51]):
        m.tone(type='sine', freq=f, dur=0.7, vol=0.4, start=i * 0.16)
        m.tone(type='triangle', freq=f * 2.01, dur=0.25, vol=0.12, start=i * 0.16)

@sound('clunk', 0.35)
def _(m):
    m.noise(dur=0.06, vol=0.8, type='bandpass', freq=1800)
    m.noise(dur=0.08, vol=0.6, type='lowpass', freq=600, start=0.05)
    m.tone(type='sine', freq=70, endFreq=40, dur=0.25, vol=0.6)

@sound('powerdown', 1.5)
def _(m):
    m.tone(type='sawtooth', freq=120, endFreq=28, dur=1.4, vol=0.45, filter={'type': 'lowpass', 'freq': 900, 'endFreq': 80})
    m.noise(dur=0.25, vol=0.6, type='lowpass', freq=400)

@sound('powerup', 0.7)
def _(m):
    m.tone(type='sawtooth', freq=40, endFreq=120, dur=0.6, vol=0.3, filter={'type': 'lowpass', 'freq': 300, 'endFreq': 1200})

@sound('sting', 0.7)
def _(m):
    for s in [0, 0.03]:
        m.tone(type='square', freq=220 + s * 1000, endFreq=110, dur=0.6, vol=0.4, start=s, filter={'type': 'lowpass', 'freq': 2400})
    m.noise(dur=0.4, vol=0.4, type='bandpass', freq=900)

print('rendered', len([f for f in os.listdir(OUT) if f.endswith('.wav')]), 'sounds')
