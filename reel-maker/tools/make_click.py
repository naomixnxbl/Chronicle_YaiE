#!/usr/bin/env python3
"""Synthesize a crisp UI 'click' sound -> public/sfx/click.wav (generated, royalty-free)."""
import os, wave, numpy as np

SR = 44100
def tone(freq, dur, decay):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * decay)

# transient noise + two quick high 'tocks' = a satisfying mechanical click
n_noise = int(0.006 * SR)
noise = np.random.randn(n_noise) * np.exp(-np.arange(n_noise) / SR * 600)
click = np.zeros(int(0.11 * SR))
click[:n_noise] += noise * 0.6
a = tone(2100, 0.05, 90); click[:len(a)] += a * 0.7
b = tone(1300, 0.07, 60); click[:len(b)] += b * 0.4
click /= np.max(np.abs(click)) + 1e-9
click *= 0.85
pcm = (np.stack([click, click], axis=1) * 32767).astype(np.int16)

out = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "sfx", "click.wav"))
os.makedirs(os.path.dirname(out), exist_ok=True)
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", out, os.path.getsize(out), "bytes")
