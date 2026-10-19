"""Bande-son synthétisée du spot Inko (18 s, 120 bpm) — koto in-sen, taiko, impacts calés sur l'image."""
import numpy as np, wave

SR = 48000
DUR = 20.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(3)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if j <= i: return
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:j] += sig[:j - i] * gain * l * 1.414
    R[i:j] += sig[:j - i] * gain * r * 1.414


def env(n, a=0.002, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s; y[i] = s
    return y


def koto(freq, dur=2.2, bright=0.5):
    """Karplus-Strong : corde pincée."""
    n = int(dur * SR); p = int(SR / freq)
    buf = rng.uniform(-1, 1, p)
    buf = buf * (1 - bright) + np.convolve(buf, np.ones(3) / 3, 'same') * bright
    out = np.empty(n); out[:p] = buf
    k = p
    while k < n:
        prev = out[k - p:k]
        nxt = 0.5 * (prev + np.roll(prev, -1)) * 0.996
        m = min(p, n - k); out[k:k + m] = nxt[:m]; k += m
    # attaque « plectre »
    out[:200] += rng.uniform(-1, 1, 200) * np.linspace(0.6, 0, 200)
    return out * env(n, 0.001, dur * 0.45)


def taiko(f0=110, f1=48, dur=1.1, noise=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / (dur * 0.32))
    hit = rng.uniform(-1, 1, n) * np.exp(-t / 0.018) * noise
    return np.tanh((body + hit) * 1.6)


def sub(dur=1.6, f=42):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f + 60 * np.exp(-t * 10)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / (dur * 0.35))


def kick():
    return taiko(150, 45, 0.45, 0.25) * 0.9


def hat(dur=0.06):
    n = int(dur * SR); x = rng.uniform(-1, 1, n)
    x = x - onepole_lp(x, 6000)
    return x * env(n, 0.0005, dur * 0.25)


def clap():
    n = int(0.25 * SR); x = rng.uniform(-1, 1, n)
    x = x - onepole_lp(x, 900)
    e = np.zeros(n)
    for o in (0, 0.009, 0.018):
        i = int(o * SR); e[i:] += np.exp(-np.arange(n - i) / SR / 0.012)
    e += np.exp(-np.arange(n) / SR / 0.09) * 0.5
    return x * e * 0.7


def whoosh(dur, up=True):
    n = int(dur * SR); x = rng.uniform(-1, 1, n)
    t = np.linspace(0, 1, n)
    # filtre passe-bas glissant (approx. par mélange de deux bandes)
    lo = onepole_lp(x, 500); hi = x - onepole_lp(x, 3000)
    mix = t if up else 1 - t
    y = lo * (1 - mix) + hi * mix * 0.8
    shape = np.sin(np.pi * t) ** 2 if not up else t ** 2.2
    return y * shape


def drop_plink():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 900 + 1800 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06)


def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 120 * (2 ** (t / dur * 3.2))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    nz = rng.uniform(-1, 1, n); nz = nz - onepole_lp(nz, 1500)
    sh = (t / dur) ** 2.5
    return (tone * 0.35 + nz * 0.6) * sh


def stamp():
    return taiko(180, 70, 0.35, 0.9) * 0.8


def ui_click():
    n = int(0.04 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.006)


# ---- gamme in-sen (D) ----
D4 = 293.66
def note(semi): return D4 * 2 ** (semi / 12)
INSEN = [0, 1, 5, 7, 10, 12, 13, 17, 19, 22, 24]

# ---------- S1 : goutte (0 → 2.4) ----------
add(drop_plink(), 0.54, 0.35, 0.1)
add(sub(2.4, 38), 0.56, 0.9)
add(taiko(95, 40, 1.8, 0.6), 0.56, 0.55)
for k, (tt, s) in enumerate([(0.9, 7), (1.2, 5), (1.5, 1), (1.8, 0)]):
    add(koto(note(s), 2.6), tt, 0.32, -0.3 + k * 0.2)
add(whoosh(0.45, True), 1.95, 0.35)

# ---------- groove 2.4 → 15.2, 4 temps par scène (≈ 92 bpm) ----------
beat = 0.65
grid = np.arange(2.4, 15.2 - 1e-6, beat)
for i, t in enumerate(grid):
    add(kick(), t, 0.72 if i % 4 == 0 else 0.5)
    add(hat(), t + beat / 2, 0.2, 0.4)
    add(hat(0.03), t + beat / 4, 0.08, -0.5); add(hat(0.03), t + 3 * beat / 4, 0.08, 0.5)
    if i % 2 == 1 and t > 5.0:
        add(clap(), t, 0.3, -0.1)
    f = [73.4, 73.4, 77.8, 65.4][(i // 4) % 4]
    n = int(0.55 * SR); tt_ = np.arange(n) / SR
    add(np.tanh(2.5 * np.sin(2 * np.pi * f * tt_)) * env(n, 0.005, 0.22), t, 0.22)
# arpège koto (croches)
for i, t in enumerate(np.arange(2.4, 15.2 - 1e-6, beat / 2)):
    if i % 16 in (14, 15): continue
    s = INSEN[[0, 3, 4, 5, 4, 3, 6, 5, 3, 2, 1, 0][i % 12]]
    add(koto(note(s) * (2 if (i // 16) % 2 else 1), 1.4, 0.7), t, 0.13, np.sin(i) * 0.6)

# coupes : impact + whoosh d'anticipation (whip)
for tt in (2.4, 5.0, 7.6, 10.2, 12.8):
    add(sub(1.0, 45), tt, 0.5); add(clap(), tt, 0.22)
for tt in (2.1, 4.68, 7.28, 9.88, 12.48, 14.88):
    add(whoosh(0.34, True), tt, 0.32)
# S2 : chaque mot / « une seule app »
for k, tt in enumerate((2.55, 2.77, 2.99)):
    add(koto(note(INSEN[5 + k]) * 2, 1.0, 0.9), tt, 0.2)
add(sub(0.9, 50), 4.1, 0.45)
# S3 : clic du curseur, anneau, étiquette
add(ui_click(), 6.4, 0.4); add(koto(note(17) * 2, 1.0, 0.9), 6.48, 0.2); add(koto(note(24), 1.0, 0.9), 6.6, 0.16)
# S4 / S5 / S6 : entrées de fenêtres et puces
for tt in (8.35, 11.35, 12.95, 13.1, 13.25):
    add(whoosh(0.3, False), tt - 0.05, 0.3, 0.3)
for k, tt in enumerate((9.05, 9.3, 13.8, 14.05, 14.3)):
    add(koto(note(INSEN[4 + k % 4]) * 2, 0.9, 0.9), tt, 0.18, -0.5 + k * 0.25)

# ---------- S7 : manifeste, trois tampons à sec ----------
for tt in (15.3, 15.7, 16.1):
    add(stamp(), tt, 0.85); add(sub(0.7, 52), tt, 0.45)
add(whoosh(0.5, True), 16.35, 0.6)

# ---------- S8 : logo ----------
add(taiko(120, 42, 2.6, 0.8), 17.06, 0.95)
add(sub(3.0, 36), 17.06, 0.9)
add(clap(), 17.06, 0.4)
for k, s in enumerate([0, 7, 12, 17, 24]):
    add(koto(note(s), 3.5, 0.4), 17.06 + k * 0.05, 0.22, -0.6 + k * 0.3)
for k, s in enumerate([12, 10, 7, 5, 7]):
    add(koto(note(s) * 2, 2.5, 0.6), 18.2 + k * 0.3, 0.12, 0.3 - k * 0.15)
n = int(3.0 * SR); tt = np.arange(n) / SR
pad = sum(np.sin(2 * np.pi * note(s) / 2 * tt * (1 + d)) for s in (0, 7, 12) for d in (-0.002, 0.002))
pad *= np.minimum(1, tt / 0.6) * np.minimum(1, (3.0 - tt) / 1.0) * 0.05
add(pad, 17.1, 1.0)

# ---------- réverbe + master ----------
irn = int(2.2 * SR); ti = np.arange(irn) / SR
def ir(): x = rng.normal(0, 1, irn) * np.exp(-ti / 0.55); x[:int(0.012 * SR)] = 0; return x / np.sqrt((x ** 2).sum())
def conv(x, h):
    m = len(x) + len(h) - 1; F = 1 << (m - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(h, F), F)[:len(x)]
wetL = conv(L, ir()); wetR = conv(R, ir())
L2 = L + wetL * 0.22; R2 = R + wetR * 0.22
mix = np.stack([L2, R2], 1)
# silence net avant l'impact final (drop)
i0, i1 = int(16.75 * SR), int(17.05 * SR)
mix[i0:i1] *= np.linspace(1, 0, i1 - i0)[:, None] ** 3
mix[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.6) * 0.89
pcm = (mix * 32767).astype('<i2')
with wave.open('_audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', mix.shape)
