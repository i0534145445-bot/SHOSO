#!/usr/bin/env python3
"""Original score for the film: freygish Hasidic ensemble — bowed strings,
clarinet, piano, contrabass, frame drum, and a wordless choir pad."""
import math, os, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import MEDIA, FF

SR = 44100
MUZ = MEDIA + "/music"
os.makedirs(MUZ, exist_ok=True)
TAU = 2.0 * np.pi


# ------------------------------------------------------------------ helpers
def lp(x, fc, poles=1):
    if fc <= 0:
        return np.zeros_like(x)
    n = len(x)
    N = 1 << int(np.ceil(np.log2(n * 2)))
    X = np.fft.rfft(x.astype(np.float64), N)
    w = TAU * np.fft.rfftfreq(N, 1.0 / SR)
    return np.fft.irfft(X / (1.0 + 1j * w / (TAU * fc)) ** poles, N)[:n]


def hp(x, fc):
    return x - lp(x, fc)


def bp(x, lo, hi):
    return lp(hp(x, lo), hi)


def norm(x, peak=0.9):
    x = np.asarray(x, np.float64)
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def fit(x, n):
    x = np.asarray(x, np.float64)
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x))])


def pan(x, pos):
    """pos -1..1 -> stereo array."""
    x = np.asarray(x, np.float64)
    l = x * math.cos((pos + 1) * math.pi / 4)
    r = x * math.sin((pos + 1) * math.pi / 4)
    return np.stack([l, r], 1)


def mix(*arrs):
    n = max((len(a) for a in arrs), default=0)
    o = np.zeros((n, 2))
    for a in arrs:
        a = np.asarray(a, np.float64)
        if a.ndim == 1:
            a = pan(a, 0.0)
        o[: len(a)] += a
    return o


def stack(*arrs):
    n = max(len(a) for a in arrs)
    return sum(fit(a, n) for a in arrs)


def env(n, a=0.01, d=0.2, s=0.7, r=0.4, sus_level=0.6):
    """ADSR amplitude envelope."""
    a_, d_, r_ = int(a * SR), int(d * SR), int(r * SR)
    s_ = max(0, n - a_ - d_ - r_)
    e = np.concatenate([
        np.linspace(0, 1, a_, endpoint=False) if a_ else np.array([]),
        np.linspace(1, sus_level, d_) if d_ else np.array([]),
        np.full(s_, sus_level),
        np.linspace(sus_level, 0, r_) if r_ else np.array([]),
    ])
    return fit(e, n)


def ramps(n, ms=8.0):
    k = int(SR * ms / 1000)
    e = np.ones(n)
    if k:
        e[:k] = np.linspace(0, 1, k)
        e[-k:] = np.linspace(1, 0, k)
    return e


def reverb(x, sec=2.2, mix=0.30):
    """Multi-tap schroeder-ish reverb via FFT convolution."""
    x = np.asarray(x, np.float64)
    one_d = x.ndim == 1
    if one_d:
        x = x[:, None]
    n = x.shape[0]
    N = 1 << int(np.ceil(np.log2(n * 2)))
    ir = np.zeros(int(SR * sec))
    rng = np.random.default_rng(7)
    for _ in range(1500):
        i = rng.integers(0, len(ir))
        ir[i] += rng.normal() * (1.0 - i / len(ir)) ** 3.0
    ir = lp(ir, 4200, 2)
    ir /= np.max(np.abs(ir)) or 1
    I = np.fft.rfft(ir, N)
    out = np.empty_like(x)
    for c in range(x.shape[1]):
        X = np.fft.rfft(x[:, c], N)
        wet = np.fft.irfft(X * I, N)[:n]
        out[:, c] = (1 - mix) * x[:, c] + mix * wet
    return out[:, 0] if one_d else out


# ------------------------------------------------------------------ instruments
def bow_string(freq, n, a=0.02, d=0.35, s=0.55, r=0.7, vib=5.0, bright=2600, bow_noise=0.05):
    """Bowed violin/viola: saw-ish harmonic stack + bow noise + vibrato."""
    t = np.arange(n) / SR
    ph = TAU * freq * t
    vib_ph = 0.006 * freq * np.sin(TAU * vib * t + np.random.rand() * TAU)
    w = TAU * freq * t + vib_ph * TAU
    partials = np.zeros(n)
    for k, amp in enumerate([1.0, .55, .38, .26, .17, .11, .07, .05], start=1):
        partials += amp * np.sin(k * w)
    partials /= 2.1
    low = 1.0 + 0.5 * np.sin(TAU * 0.7 * t)
    noise = np.random.default_rng(int(freq * 37) % 9999).normal(size=n)
    noise = bp(noise, 1200, bright) * bow_noise
    sig = lp(partials + noise, bright) * low
    return sig * env(n, a, d, s, r, s)


def clarinet(freq, n, a=0.045, d=0.25, s=0.6, r=0.5, vib=4.4, bright=1900):
    """Clarinet: odd-harmonic reed tone with a vocal vibrato."""
    t = np.arange(n) / SR
    w = TAU * freq * t + 0.004 * freq * np.sin(TAU * vib * t) * TAU
    sig = np.zeros(n)
    for k in (1, 3, 5, 7, 9):
        sig += (1.0 / k ** 1.15) * np.sin(k * w)
    sig /= 1.5
    breath = np.random.default_rng(int(freq * 91) % 9999).normal(size=n)
    sig = lp(sig + bp(breath, 900, 2600) * 0.035, bright)
    return sig * env(n, a, d, s, r, s)


def piano(freq, n, vel=0.7, decay=2.4):
    """Struck piano: fixed decay per partial, hammer thump."""
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k in range(1, 9):
        amp = vel / (k ** 1.5)
        dec = np.exp(-t / (decay / (1 + 0.32 * (k - 1))))
        det = 0.0012 * k * np.random.randn()
        sig += amp * np.sin(TAU * freq * k * (1 + det) * t) * dec
    thump = np.exp(-t / 0.012) * 0.22 * vel * np.random.default_rng(int(freq) % 999).normal(size=n)
    return lp(sig + thump, 5200) * 0.8


def bass(freq, n, a=0.02, d=0.3, s=0.5, r=0.4):
    t = np.arange(n) / SR
    sig = (np.sin(TAU * freq * t) * 0.9 + np.sin(TAU * 2 * freq * t) * 0.22
           + np.sin(TAU * 3 * freq * t) * 0.07)
    click = np.exp(-t / 0.008) * 0.3 * np.random.default_rng(int(freq) % 999).normal(size=n)
    return lp(sig + click, 420) * env(n, a, d, s, r, s) * 0.85


def pluck(freq, n, decay=1.6, bright=3000):
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k in range(1, 7):
        sig += (1.0 / k) * np.sin(TAU * freq * k * t) * np.exp(-t / (decay / k))
    return lp(sig / 2.2, bright)


def frame_drum(n, pattern_hits, gain=0.5):
    """pattern_hits = [(time_sec, deep?)]"""
    out = np.zeros(n)
    for tt, deep in pattern_hits:
        i = int(tt * SR)
        if i >= n:
            continue
        ln = int(SR * (0.42 if deep else 0.20))
        t = np.arange(ln) / SR
        f0 = 68 if deep else 168
        body = np.sin(TAU * f0 * t) * np.exp(-t / (0.16 if deep else 0.055))
        body += np.sin(TAU * f0 * 1.62 * t) * 0.4 * np.exp(-t / 0.05)
        noise = np.random.default_rng(i % 9999).normal(size=ln)
        skin = bp(noise, 900, 6500) * np.exp(-t / (0.05 if deep else 0.022)) * 0.7
        hit = (body * (1.0 if deep else 0.55) + skin) * (1.0 if deep else 0.62)
        seg = fit(hit * gain, min(ln, n - i))
        out[i:i + len(seg)] += seg
    return out


def choir(freq, n, a=1.2, r=1.6, level=0.16, voices=5):
    """Wordless 'ah' pad."""
    t = np.arange(n) / SR
    sig = np.zeros(n)
    rng = np.random.default_rng(3)
    for v in range(voices):
        det = 1.0 + rng.normal() * 0.004
        vib = 4.6 + rng.normal() * 0.5
        w = TAU * freq * det * t + 0.0025 * np.sin(TAU * vib * t) * TAU
        partial = np.zeros(n)
        for k, amp in enumerate([1.0, .5, .30, .16, .09, .05], start=1):
            partial += amp * np.sin(k * w)
        sig += lp(partial / 2.0, 1500)
    e = np.ones(n)
    ai, ri = int(a * SR), int(r * SR)
    if ai:
        e[:ai] = np.linspace(0, 1, ai) ** 2
    if ri:
        e[-ri:] = np.linspace(1, 0, ri) ** 2
    return sig / voices * level * e


# ------------------------------------------------------------------ theory
def hz(semis_from_a4):
    return 440.0 * 2 ** (semis_from_a4 / 12.0)


NOTE = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}


def n(name):
    """'D4' -> Hz (A4 = 440)."""
    m = __import__("re").match(r"^([A-G])([#b]?)(-?\d)$", name)
    p, acc, oct_ = m.group(1), m.group(2), int(m.group(3))
    s = NOTE[p] + (1 if acc == "#" else -1 if acc == "b" else 0)
    return hz(s + (oct_ - 4) * 12)


# D freygish / D harmonic minor flavours
SCALE_D_MIN = ["D", "E", "F", "G", "A", "Bb", "C"]
SCALE_FREY = ["D", "Eb", "F#", "G", "A", "Bb", "C"]


def deg(scale, i):
    base = scale[i % 7] + str(4 + (i // 7))
    return base if base[1] != "b" or True else base


# ------------------------------------------------------------------ cues
def cue_open(dur=26.0):
    """Dawn strings under the city + the rav's room. Slow, patient."""
    N = int(dur * SR)
    t = np.arange(N) / SR
    out = [np.zeros((N, 2))]
    # sustained D minor string bed, entering in layers
    for f, amp, pos, delay in [(n("D3"), .16, -.25, 0.0), (n("A3"), .13, .22, 1.2),
                               (n("F3"), .11, -.40, 2.6), (n("D4"), .10, .40, 4.2)]:
        i = int(delay * SR)
        seg = bow_string(f, N - i, a=1.6, d=1.0, s=.7, r=2.6, vib=4.4, bright=2100)
        out += [pan(np.concatenate([np.zeros(i), seg]) * amp, pos)]
    # drone
    out.append(pan(choir(n("D3"), N, a=3.4, r=3.4, level=.11), 0.0))
    # first melody statement at 8s: D E F G A ... rising
    mel = [(8.0, "D4", .9), (9.4, "E4", .6), (10.2, "F4", .6), (11.2, "G4", 1.0),
           (12.8, "A4", 1.1), (14.4, "G4", .7), (15.4, "F4", .8), (16.8, "E4", 1.4)]
    for tt, nt, ln in mel:
        i = int(tt * SR)
        L = int(ln * SR)
        out.append(pan(np.concatenate([np.zeros(i), clarinet(n(nt), L, a=.09, d=.3, s=.55, r=.5)]), .12) * .16)
    out.append(pan(np.concatenate([np.zeros(int(8 * SR)),
                                   bow_string(n("D4"), N - int(8 * SR), a=.9, d=.6, s=.5, r=2.0,
                                              bright=2400)]), .12) * .09)
    return norm(mix(*out), .78)


def cue_roots(dur=42.0):
    """Freygish lament, low and patient, for Poland and the crossing."""
    N = int(dur * SR)
    out = [np.zeros((N, 2))]
    for f, amp, pos, delay in [(n("D3"), .17, -.30, 0.0), (n("A2"), .14, .26, 1.0),
                               (n("Eb3"), .10, -.5, 3.0)]:
        i = int(delay * SR)
        out.append(pan(np.concatenate([np.zeros(i), bow_string(f, N - i, a=1.9, d=1.2, s=.62, r=3.0,
                                                               bright=1750)]), pos) * amp)
    out.append(pan(choir(n("D3"), N, a=4.0, r=4.0, level=.13), 0.0))
    # hexatonic freygish motive, twice
    mel1 = [(3.0, "D4", 1.2), (4.6, "Eb4", .7), (5.6, "F#4", 1.3), (7.4, "G4", 1.0),
            (8.8, "A4", 1.8), (11.2, "G4", .8), (12.4, "F#4", .8), (13.6, "Eb4", 1.6),
            (15.8, "D4", 2.4)]
    mel2 = [(21.0, "A4", 1.2), (22.6, "G4", .8), (23.8, "F#4", 1.2), (25.4, "Eb4", 1.0),
            (26.8, "D4", 2.0), (29.4, "A4", 1.2), (31.0, "Bb4", .9), (32.4, "A4", .9),
            (33.8, "G4", 1.6), (36.0, "D4", 3.0)]
    for mel, inst, amp in ((mel1, bow_string, .145), (mel2, clarinet, .135)):
        for tt, nt, ln in mel:
            i = int(tt * SR); L = int(ln * SR)
            out.append(pan(np.concatenate([np.zeros(i), inst(n(nt), L, a=.14 if inst is clarinet else .5,
                                                             d=.4, s=.5, r=.8, bright=2000)]), .16) * amp)
    # heartbeat pulse for the crossing, last 12s
    hits = [(tt, True) for tt in np.arange(31.0, dur - 1.0, 1.5)]
    out.append(pan(frame_drum(N, hits, .30), 0.0))
    return norm(mix(*out), .80)


def cue_yeshiva(dur=26.0):
    """Walking, curious: pizzicato walking bass + clarinet answers."""
    N = int(dur * SR)
    out = [np.zeros((N, 2))]
    b = np.zeros(N)
    seq = ["D2", "A2", "Bb2", "A2", "D2", "F2", "G2", "A2"]
    for i, nt_ in enumerate(seq * 6):
        i0 = int((i * 0.95) * SR)
        if i0 >= N:
            break
        b[i0:i0 + int(1.2 * SR)] += pluck(n(nt_), min(int(1.2 * SR), N - i0), decay=1.5) * .5
    out.append(pan(b, -.12))
    for tt, nt, ln in [(2.0, "D5", .7), (3.0, "F5", .6), (3.9, "E5", .6), (4.8, "D5", 1.0),
                       (6.4, "A4", .8), (7.4, "C5", .7), (8.3, "Bb4", .8), (9.4, "A4", 1.6),
                       (12.0, "D5", .7), (13.0, "F5", .6), (13.9, "G5", .9), (15.2, "F5", .7),
                       (16.2, "E5", 1.4), (18.6, "D5", 2.6)]:
        i = int(tt * SR); L = int(ln * SR)
        out.append(pan(np.concatenate([np.zeros(i), clarinet(n(nt), L, a=.05, d=.25, s=.55, r=.45,
                                                             bright=2100)]), .18) * .145)
    for f, amp, pos in [(n("D4"), .075, -.3), (n("A4"), .065, .3)]:
        out.append(pan(bow_string(f, N, a=1.4, d=1.0, s=.5, r=2.4, bright=2000), pos) * amp)
    hits = [(tt, tt % 1.9 < .1) for tt in np.arange(0.0, dur, 0.95)]
    out.append(pan(frame_drum(N, hits, .16), 0.0))
    return norm(mix(*out), .76)


def cue_rebbe(dur=22.0):
    """Awe: sustained harmonic-minor strings + piano cadence."""
    N = int(dur * SR)
    out = [np.zeros((N, 2))]
    for f, amp, pos, delay in [(n("D3"), .17, -.3, 0.0), (n("A3"), .13, .28, 1.4),
                               (n("F3"), .10, -.45, 3.0), (n("C#4"), .07, .42, 5.0)]:
        i = int(delay * SR)
        out.append(pan(np.concatenate([np.zeros(i), bow_string(f, N - i, a=1.8, d=1.0, s=.66, r=3.0,
                                                               bright=2300)]), pos) * amp)
    out.append(pan(choir(n("A3"), N, a=3.6, r=3.6, level=.13), 0.0))
    for tt, nt, v in [(6.0, "D4", .60), (6.9, "A4", .50), (7.8, "D5", .55), (9.6, "C#5", .55),
                      (11.4, "D5", .60), (13.6, "A4", .50), (14.5, "G4", .48), (16.6, "F4", .52)]:
        i = int(tt * SR)
        out.append(pan(np.concatenate([np.zeros(i), piano(n(nt), min(int(3.4 * SR), N - i), vel=v)]), .10) * .22)
    return norm(mix(*out), .80)


def cue_torah(dur=30.0):
    """Steady study: ostinato, warm and quiet, no drums."""
    N = int(dur * SR)
    out = [np.zeros((N, 2))]
    b = np.zeros(N)
    seq = ["D2", "D2", "A2", "G2"]
    for i in range(40):
        i0 = int((i * 0.72) * SR)
        if i0 >= N:
            break
        b[i0:i0 + int(1.0 * SR)] += bass(n(seq[i % 4]), min(int(1.0 * SR), N - i0), a=.03, d=.25, s=.45, r=.4) * .55
    out.append(pan(b, 0.0))
    for f, amp, pos in [(n("D4"), .085, -.32), (n("F4"), .065, .30), (n("A4"), .06, -.15)]:
        out.append(pan(bow_string(f, N, a=2.2, d=1.4, s=.55, r=3.0, bright=1900), pos) * amp)
    for tt, nt, ln in [(8.0, "D5", 1.0), (9.4, "F5", .8), (10.6, "E5", .9), (12.0, "D5", 1.4),
                       (15.0, "A4", 1.0), (16.4, "C5", .8), (17.6, "Bb4", 1.0), (19.0, "A4", 1.8),
                       (22.0, "D5", 1.2), (23.8, "G5", 1.0), (25.4, "F5", 1.8)]:
        i = int(tt * SR); L = int(ln * SR)
        out.append(pan(np.concatenate([np.zeros(i), clarinet(n(nt), L, a=.10, d=.3, s=.5, r=.7,
                                                             bright=1850)]), .12) * .12)
    out.append(pan(choir(n("D3"), N, a=5.0, r=5.0, level=.09), 0.0))
    return norm(mix(*out), .74)


def cue_lead(dur=30.0):
    """Weight and gathering: low brass-like strings, sparse drum."""
    N = int(dur * SR)
    out = [np.zeros((N, 2))]
    for f, amp, pos, delay in [(n("D2"), .19, 0.0, 0.0), (n("D3"), .13, -.34, 1.5),
                               (n("A3"), .11, .32, 3.2), (n("F3"), .09, -.46, 5.0)]:
        i = int(delay * SR)
        out.append(pan(np.concatenate([np.zeros(i), bow_string(f, N - i, a=2.0, d=1.2, s=.6, r=3.2,
                                                               bright=1650)]), pos) * amp)
    out.append(pan(choir(n("D3"), N, a=4.5, r=4.5, level=.12), 0.0))
    for tt, nt, ln in [(4.0, "D4", 2.0), (6.6, "F4", 1.4), (8.6, "G4", 2.4), (11.6, "A4", 2.6),
                       (15.0, "G4", 1.4), (17.0, "F4", 2.6), (20.6, "D4", 3.4)]:
        i = int(tt * SR); L = int(ln * SR)
        out.append(pan(np.concatenate([np.zeros(i), clarinet(n(nt), L, a=.2, d=.5, s=.55, r=1.0,
                                                             bright=1750)]), .14) * .13)
    hits = [(6.0, True), (11.6, True), (17.0, False), (20.6, True)]
    out.append(pan(frame_drum(N, hits, .34), 0.0))
    return norm(mix(*out), .80)


def cue_human(dur=28.0):
    """Warmth, a dance in 3 — freygish, clarinet-led, light drums."""
    N = int(dur * SR)
    out = [np.zeros((N, 2))]
    b = np.zeros(N)
    seq = ["D2", "A2", "D2", "A2", "Bb1", "A2", "G2", "A2"]
    for i in range(60):
        i0 = int((i * 0.44) * SR)
        if i0 >= N:
            break
        b[i0:i0 + int(0.66 * SR)] += bass(n(seq[i % 8]), min(int(0.66 * SR), N - i0), a=.02, d=.18, s=.42, r=.3) * .6
    out.append(pan(b, 0.0))
    for f, amp, pos in [(n("D4"), .075, -.3), (n("A4"), .07, .3), (n("F4"), .06, -.45)]:
        out.append(pan(bow_string(f, N, a=1.0, d=.7, s=.55, r=2.0, bright=2200), pos) * amp)
    mel = [(1.5, "D5", .5), (2.1, "Eb5", .4), (2.6, "F#5", .8), (3.6, "G5", .5), (4.2, "F#5", .4),
           (4.7, "Eb5", .9), (5.9, "D5", .7), (6.6, "A4", .5), (7.2, "D5", 1.2),
           (9.0, "A5", .5), (9.6, "G5", .4), (10.1, "F#5", .8), (11.1, "G5", .5), (11.7, "A5", 1.4),
           (14.0, "Bb5", .6), (14.8, "A5", .5), (15.4, "G5", .9), (16.6, "F#5", 1.4),
           (18.6, "G5", .6), (19.4, "F#5", .5), (20.0, "Eb5", .9), (21.2, "D5", 2.4),
           (24.6, "A4", .6), (25.4, "D5", 2.0)]
    for tt, nt, ln in mel:
        i = int(tt * SR); L = int(ln * SR)
        out.append(pan(np.concatenate([np.zeros(i), clarinet(n(nt), L, a=.035, d=.2, s=.6, r=.35,
                                                             bright=2400)]), .16) * .155)
    hits = []
    tt = 0.0
    k = 0
    while tt < dur - .5:
        hits.append((tt, k % 4 == 0))
        tt += 0.44
        k += 1
    out.append(pan(frame_drum(N, hits, .22), 0.0))
    return norm(mix(*out), .78)


def cue_finale(dur=34.0):
    """The theme returns, full, and resolves."""
    N = int(dur * SR)
    out = [np.zeros((N, 2))]
    for f, amp, pos, delay in [(n("D3"), .17, -.28, 0.0), (n("A3"), .14, .26, 1.0),
                               (n("F3"), .11, -.42, 2.4), (n("D4"), .10, .40, 4.0),
                               (n("A4"), .07, -.20, 7.0)]:
        i = int(delay * SR)
        out.append(pan(np.concatenate([np.zeros(i), bow_string(f, N - i, a=1.7, d=1.1, s=.68, r=3.4,
                                                               bright=2400)]), pos) * amp)
    out.append(pan(choir(n("D3"), N, a=4.0, r=5.0, level=.15), 0.0))
    mel = [(5.0, "D5", 1.0), (6.4, "E5", .7), (7.3, "F5", .8), (8.5, "G5", 1.2),
           (10.2, "A5", 1.8), (12.6, "G5", .8), (13.8, "F5", .9), (15.2, "E5", 1.8),
           (17.8, "D5", 1.2), (19.4, "A5", 1.0), (20.8, "Bb5", 1.0), (22.2, "A5", 1.6),
           (24.6, "G5", 1.0), (26.0, "F5", 1.4), (28.0, "E5", 2.0), (30.6, "D5", 3.4)]
    for tt, nt, ln in mel:
        i = int(tt * SR); L = int(ln * SR)
        out.append(pan(np.concatenate([np.zeros(i), bow_string(n(nt), L, a=.45, d=.6, s=.55, r=1.4,
                                                               bright=2500)]), .14) * .175)
        out.append(pan(np.concatenate([np.zeros(i), clarinet(n(nt), L, a=.07, d=.3, s=.55, r=.8,
                                                             bright=2100)]), -.14) * .09)
    for tt, nt, v in [(30.6, "D3", .55), (30.9, "A3", .40), (31.2, "D4", .45), (31.5, "F4", .40),
                      (31.9, "A4", .42), (32.3, "D5", .50)]:
        i = int(tt * SR)
        out.append(pan(np.concatenate([np.zeros(i), piano(n(nt), min(int(4.0 * SR), N - i), vel=v)]), 0) * .24)
    hits = [(5.0, True), (10.2, True), (17.8, True), (24.6, False), (30.6, True)]
    out.append(pan(frame_drum(N, hits, .30), 0.0))
    return norm(mix(*out), .84)


CUES = dict(open=(cue_open, 26.0), roots=(cue_roots, 42.0), yeshiva=(cue_yeshiva, 26.0),
            rebbe=(cue_rebbe, 22.0), torah=(cue_torah, 30.0), lead=(cue_lead, 30.0),
            human=(cue_human, 28.0), finale=(cue_finale, 34.0))


def render_all():
    for name, (fn, dur) in CUES.items():
        y = fn(dur)
        y = reverb(y, 2.4, 0.26)
        y = norm(y, 0.82) * ramps(len(y), 12.0)[:, None]
        p = f"{MUZ}/{name}.wav"
        subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error",
                        "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "pipe:0",
                        "-c:a", "pcm_s16le", p], input=y.astype(np.float32).tobytes(), check=True)
        print("cue", name, len(y) / SR, os.path.getsize(p))


if __name__ == "__main__":
    render_all()
