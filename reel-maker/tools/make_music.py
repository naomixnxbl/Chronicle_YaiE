#!/usr/bin/env python3
"""Synthesize several royalty-free background tracks for WSTI reels.
Generated from scratch -> safe to use anywhere. Output: public/music/*.wav
"""
from __future__ import annotations
import os, wave
import numpy as np

SR = 44100
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "music"))
os.makedirs(OUT, exist_ok=True)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(length, a, d, s, r, sus=0.7):
    e = np.zeros(length)
    ai, di, ri = max(1, int(a * SR)), int(d * SR), int(r * SR)
    e[:ai] = np.linspace(0, 1, ai)
    if di:
        e[ai:ai + di] = np.linspace(1, sus, di)
    si = max(0, length - ai - di - ri)
    e[ai + di:ai + di + si] = sus
    if ri:
        e[ai + di + si:] = np.linspace(sus, 0, length - (ai + di + si))
    return e[:length]


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i] * gain


def kick(dur=0.4, punch=26, base=45):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 120 * np.exp(-t * punch) + base
    body = np.sin(2 * np.pi * np.cumsum(f) / SR)
    click = np.random.randn(n) * np.exp(-t * 220) * 0.3
    return (body * np.exp(-t * 7) + click) * 0.9


def hat(dur=0.05, decay=90):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = np.random.randn(n)
    sm = np.convolve(noise, np.ones(8) / 8, mode="same")
    return (noise - sm) * np.exp(-t * decay)


def snare(dur=0.2):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = np.random.randn(n) * np.exp(-t * 22)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28)
    return (noise * 0.7 + tone * 0.5)


def clap(dur=0.18):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.random.randn(n) * np.exp(-t * 30) * 0.6


def sub(freq, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)
    return sig * env(n, 0.005, 0.06, 0, 0.08, sus=0.85)


def pluck(freq, dur, harm=(1, .5, .32, .18, .1)):
    n = int(dur * SR); t = np.arange(n) / SR
    sig = sum(a * np.sin(2 * np.pi * freq * (h + 1) * t) for h, a in enumerate(harm))
    return sig / 2.1 * env(n, 0.002, 0.05, 0, dur * 0.6, sus=0.5)


def pad(freqs, dur, soft=False):
    n = int(dur * SR); t = np.arange(n) / SR
    sig = np.zeros(n)
    for f in freqs:
        sig += np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2 * t)
    sig /= len(freqs) * 2
    return sig * env(n, 0.5 if soft else 0.4, 0.3, 0, 0.6, sus=0.8)


def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.random.randn(n) * (t / dur) ** 2 * 0.35


def render(name, bpm, prog, *, bars=16, drums="full", arp=True, soft_pad=False, bass=True, claps=False):
    beat = 60.0 / bpm
    bar = 4 * beat
    N = int(bar * bars * SR)
    buf = np.zeros(N + SR)
    for b in range(bars):
        bt = b * bar
        root, tones = prog[b % len(prog)]
        if arp:
            seq = [tones[i % len(tones)] + (12 if i >= 4 else 0) for i in range(8)]
            for i, note in enumerate(seq):
                place(buf, pluck(midi(note), beat * 0.5 * 0.95), bt + i * beat * 0.5, gain=0.5 if b < 2 else 0.6)
        place(buf, pad([midi(x) for x in tones[:3]], bar, soft=soft_pad), bt, gain=0.22 if b < 4 else 0.18)
        if bass and b >= 2:
            for k in range(4):
                place(buf, sub(midi(root), beat * 0.92), bt + k * beat, gain=0.85)
        if drums != "none" and b >= 4:
            for k in range(4):
                place(buf, kick(), bt + k * beat, gain=1.0)
            if drums in ("full", "beat"):
                for h in range(8):
                    if h % 2 == 1:
                        place(buf, hat(), bt + h * beat * 0.5, gain=0.8)
            if drums == "beat":  # backbeat snare on 2 & 4
                place(buf, snare(), bt + beat, gain=0.7)
                place(buf, snare(), bt + 3 * beat, gain=0.7)
            if claps:
                place(buf, clap(), bt + beat, gain=0.5)
                place(buf, clap(), bt + 3 * beat, gain=0.5)
        if b in (3, 11):
            place(buf, riser(bar), bt, gain=0.45)
    buf = buf[:N]
    buf = np.tanh(buf * 1.1)
    buf /= np.max(np.abs(buf)) + 1e-9
    buf *= 0.89
    fin, fout = int(0.04 * SR), int(1.0 * SR)
    buf[:fin] *= np.linspace(0, 1, fin)
    buf[-fout:] *= np.linspace(1, 0, fout)
    pcm = (np.stack([buf, buf], 1) * 32767).astype(np.int16)
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print("wrote", name, f"{N/SR:.1f}s")


# chord progressions: (root_midi, [chord tones])
Am, F, C, G = (45, [57, 60, 64, 69]), (41, [57, 60, 65, 69]), (48, [60, 64, 67, 72]), (43, [59, 62, 67, 71])
Em, Dm = (40, [55, 59, 64, 67]), (38, [53, 57, 62, 65])

render("wsti-drive.wav", 123, [Am, F, C, G], drums="full")
render("wsti-uplift.wav", 112, [C, G, Am, F], drums="full", claps=True)
render("wsti-chill.wav", 90, [Am, Em, F, C], drums="none", arp=True, soft_pad=True)
render("wsti-bold.wav", 100, [Am, F, G, Em], drums="beat")
print("done ->", OUT)
