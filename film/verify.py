#!/usr/bin/env python3
"""Numeric checks on rendered frames and the finished mix (no vision available)."""
import os, re, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import FF, MEDIA, W, H, run, dur_of, font, vis

OUT = MEDIA + "/out"
WORK = MEDIA + "/work"
FR = WORK + "/vf"
os.makedirs(FR, exist_ok=True)


def frame(video, t, out_png, scale=None):
    vf = f"scale={scale}" if scale else None
    cmd = [FF, "-y", "-v", "error", "-ss", "%.3f" % t, "-i", video, "-frames:v", "1"]
    if vf:
        cmd += ["-vf", vf]
    cmd += [out_png]
    run(cmd, quiet=False)
    return out_png


def png_stats(path):
    from PIL import Image
    im = Image.open(path).convert("L")
    a = np.asarray(im).astype(np.float32)
    return dict(mean=float(a.mean()), std=float(a.std()),
                bright_frac=float((a > 60).mean()),
                dark_frac=float((a < 12).mean()),
                p99=float(np.percentile(a, 99)))


def ink_bbox(path, thr=60):
    from PIL import Image
    a = np.asarray(Image.open(path).convert("L")).astype(np.float32)
    m = a > thr
    if not m.any():
        return None
    ys, xs = np.nonzero(m)
    return dict(x0=int(xs.min()), x1=int(xs.max()), y0=int(ys.min()), y1=int(ys.max()),
                frac=float(m.mean()))


def band_ink(path, y0, y1, thr=90):
    """Ink fraction inside a horizontal band (used to detect burned subtitles)."""
    from PIL import Image
    a = np.asarray(Image.open(path).convert("L")).astype(np.float32)
    b = a[int(y0 * a.shape[0]):int(y1 * a.shape[0])]
    return float((b > thr).mean())


def ebur128(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path, "-af", "ebur128=framelog=quiet",
                        "-f", "null", "-"], capture_output=True, text=True, timeout=1800)
    m = re.search(r"I:\s*(-?[\d.]+)\s*LUFS", r.stderr)
    lra = re.search(r"LRA:\s*(-?[\d.]+)\s*LU", r.stderr)
    tp = re.search(r"Peak:\s*(-?[\d.]+)\s*dBFS", r.stderr)
    return dict(I=float(m.group(1)) if m else None,
                LRA=float(lra.group(1)) if lra else None,
                peak=float(tp.group(1)) if tp else None)


def silence_report(path, noise="-42dB", d=0.6):
    r = subprocess.run([FF, "-hide_banner", "-i", path, "-af",
                        f"silencedetect=noise={noise}:d={d}", "-f", "null", "-"],
                       capture_output=True, text=True, timeout=1800)
    starts = [float(x) for x in re.findall(r"silence_start:\s*([\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)", r.stderr)]
    return list(zip(ends, starts))


def main():
    film = OUT + "/film.mp4"
    if not os.path.exists(film):
        print("no film")
        return
    print("duration %.2f  size %.1f MB" % (dur_of(film), os.path.getsize(film) / 1e6))
    print("loudness", ebur128(film))
    ts = [0.6, 1.6, 3.0, 8.0, 20.0, 40.0, 70.0, 110.0, 150.0, 190.0, 230.0, 270.0]
    for t in ts:
        if t > dur_of(film) - 0.2:
            continue
        p = frame(film, t, f"{FR}/f_{t:06.1f}.png")
        st = png_stats(p)
        bb = ink_bbox(p)
        sub = band_ink(p, 0.82, 0.96)
        print("t=%6.1f mean=%5.1f std=%5.1f bright=%.3f dark=%.3f bbox=%s subband=%.4f"
              % (t, st["mean"], st["std"], st["bright_frac"], st["dark_frac"], bb, sub))
    print("silences (>0.6s):", silence_report(film)[:20])


if __name__ == "__main__":
    main()
