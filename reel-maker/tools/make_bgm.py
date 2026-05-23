#!/usr/bin/env python3
"""Synthesize a royalty-free background track for WSTI reels.

Professional, fast, "building momentum" electronic bed:
  - driving four-on-the-floor kick
  - off-beat closed hats
  - sine sub-bass following the chord roots
  - bright plucked arpeggio over an uplifting Am-F-C-G progression
  - layers build in over time (intro -> full -> tail) for a "progress" feel

Output: public/music/wsti-drive.wav  (~31s, 44.1kHz stereo)
This is generated from scratch, so it is safe to use anywhere.
"""
from __future__ import annotations
import os
import numpy as np

SR = 44100
BPM = 123.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
BARS = 16
DUR = BAR * BARS
N = int(DUR * SR)
t = np.arange(N) / SR


def midi(n: int) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def env(length: int, a: float, d: float, s: float, r: float, sus=0.7) -> np.ndarray:
    e = np.zeros(length)
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    ai = max(1, ai)
    e[:ai] = np.linspace(0, 1, ai)
    if di > 0:
        e[ai:ai + di] = np.linspace(1, sus, di)
    si = max(0, length - ai - di - ri)
    e[ai + di:ai + di + si] = sus
    if ri > 0:
        e[ai + di + si:] = np.linspace(sus, 0, length - (ai + di + si))
    return e[:length]


def place(buf: np.ndarray, sig: np.ndarray, at: float, gain=1.0):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def kick(dur=0.4):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 120 * np.exp(-tt * 26) + 45
    body = np.sin(2 * np.pi * np.cumsum(f) / SR)
    click = np.random.randn(n) * np.exp(-tt * 220) * 0.3
    return (body * np.exp(-tt * 7) + click) * 0.9


def hat(dur=0.05):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    noise = np.random.randn(n)
    # crude high-pass: subtract a smoothed copy
    sm = np.convolve(noise, np.ones(8) / 8, mode="same")
    return (noise - sm) * np.exp(-tt * 90) * 0.45


def sub(freq, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * tt) + 0.25 * np.sin(2 * np.pi * 2 * freq * tt)
    return sig * env(n, 0.005, 0.06, 0.0, 0.08, sus=0.85)


def pluck(freq, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    # additive saw-ish with a few harmonics, gently rolled off
    sig = np.zeros(n)
    for h, amp in [(1, 1.0), (2, 0.5), (3, 0.32), (4, 0.18), (5, 0.1)]:
        sig += amp * np.sin(2 * np.pi * freq * h * tt)
    sig /= 2.1
    return sig * env(n, 0.002, 0.05, 0.0, dur * 0.6, sus=0.5)


def pad(freqs, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    sig = np.zeros(n)
    for f in freqs:
        sig += np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 2 * tt)
    sig /= len(freqs) * 2
    return sig * env(n, 0.4, 0.3, 0.0, 0.6, sus=0.8)


def riser(dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    noise = np.random.randn(n)
    sweep = noise * (tt / dur) ** 2
    return sweep * 0.35


# Am - F - C - G  (root midi, chord tones for arp/pad)
PROG = [
    (45, [57, 60, 64, 69]),  # Am
    (41, [57, 60, 65, 69]),  # F
    (48, [60, 64, 67, 72]),  # C
    (43, [59, 62, 67, 71]),  # G
]

buf = np.zeros(N + SR)

for bar in range(BARS):
    bar_t = bar * BAR
    root, tones = PROG[bar % 4]

    # --- arpeggio: 8 sixteenth-ish notes per bar, always present ---
    arp_seq = [tones[i % len(tones)] + (12 if i >= 4 else 0) for i in range(8)]
    for i, note in enumerate(arp_seq):
        place(buf, pluck(midi(note), BEAT * 0.5 * 0.95), bar_t + i * (BEAT * 0.5),
              gain=0.5 if bar < 2 else 0.62)

    # --- pad: from the start, swells ---
    place(buf, pad([midi(x) for x in tones[:3]], BAR), bar_t, gain=0.22 if bar < 4 else 0.18)

    # --- bass: enters bar 2 ---
    if bar >= 2:
        for b in range(4):
            place(buf, sub(midi(root), BEAT * 0.92), bar_t + b * BEAT, gain=0.85)

    # --- drums: enter bar 4 (the "drop") ---
    if bar >= 4:
        for b in range(4):
            place(buf, kick(), bar_t + b * BEAT, gain=1.0)
        for h in range(8):
            if h % 2 == 1:  # off-beats
                place(buf, hat(), bar_t + h * (BEAT * 0.5), gain=0.8 if bar < 12 else 0.95)

    # --- risers into the drop (bar 4) and final section (bar 12) ---
    if bar in (3, 11):
        place(buf, riser(BAR), bar_t, gain=0.5)

buf = buf[:N]

# master: soft saturation + normalize + gentle fade in/out
buf = np.tanh(buf * 1.1)
buf /= np.max(np.abs(buf)) + 1e-9
buf *= 0.89
fin = int(0.04 * SR)
fout = int(1.2 * SR)
buf[:fin] *= np.linspace(0, 1, fin)
buf[-fout:] *= np.linspace(1, 0, fout)

stereo = np.stack([buf, buf], axis=1)
pcm = (stereo * 32767).astype(np.int16)

out = os.path.join(os.path.dirname(__file__), "..", "public", "music", "wsti-drive.wav")
out = os.path.abspath(out)

import wave
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

print(f"wrote {out}  ({DUR:.1f}s, {os.path.getsize(out)//1024} KB)")
