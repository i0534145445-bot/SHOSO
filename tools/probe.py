#!/usr/bin/env python3
"""Probe clips and build composite contact sheets (several clips per sheet)."""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

FF = subprocess.run([sys.executable, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"],
                    capture_output=True, text=True).stdout.strip()
SRC = "/home/user/media/src"
WORK = "/home/user/media/work"
os.makedirs(f"{WORK}/sheets", exist_ok=True)
os.makedirs(f"{WORK}/fr", exist_ok=True)
VID = (".mp4", ".mov", ".mkv", ".webm")


import re


def probe(path):
    """imageio_ffmpeg ships ffmpeg only (no ffprobe) -> parse -i stderr."""
    cmd = [FF, "-hide_banner", "-i", path]
    err = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stderr
    try:
        hms = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", err)
        if not hms:
            return None
        dur = int(hms.group(1)) * 3600 + int(hms.group(2)) * 60 + float(hms.group(3))
        st = re.search(r"Stream #\d+:\d+.*?Video:.*?,\s*(\d{2,5})x(\d{2,5})", err)
        w, hgt = (int(st.group(1)), int(st.group(2))) if st else (0, 0)
        fr = re.search(r"Video:.*?([\d.]+)\s*fps", err)
        fps = round(float(fr.group(1)), 3) if fr else 25.0
        return dict(w=w, h=hgt, fps=fps, dur=round(dur, 2))
    except Exception:
        return None


def grab(path, ts, out, w=320):
    cmd = [FF, "-y", "-v", "error", "-ss", str(ts), "-i", path, "-frames:v", "1",
           "-vf", f"scale={w}:-2", out]
    subprocess.run(cmd, capture_output=True, timeout=120)


def main():
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(VID))
    meta = {}
    for f in files:
        m = probe(os.path.join(SRC, f))
        if m:
            meta[f] = m
    json.dump(meta, open(f"{WORK}/meta.json", "w"), ensure_ascii=False, indent=1)

    for f, m in sorted(meta.items()):
        print(f"{m['dur']:8.2f}s {m['w']:>5}x{m['h']:<5} {m['fps']:>6} | {f}")

    # composite sheets: 8 clips x 4 frames
    names = sorted(meta.keys())
    TW, TH = 320, 180
    per_sheet = 8
    for si in range(0, len(names), per_sheet):
        grp = names[si:si + per_sheet]
        rows = []
        for f in grp:
            base = "".join(c for c in f if c.isalnum())[:40]
            imgs = []
            dur = meta[f]["dur"]
            for i in range(4):
                t = dur * (i + 0.5) / 4.0
                p = f"{WORK}/fr/{base}_{i}.jpg"
                grab(os.path.join(SRC, f), t, p, TW)
                if os.path.exists(p):
                    imgs.append(Image.open(p).convert("RGB"))
            while len(imgs) < 4:
                imgs.append(Image.new("RGB", (TW, TH), (20, 20, 20)))
            rows.append((f, imgs))
        H = len(rows) * (TH + 22)
        sheet = Image.new("RGB", (4 * TW + 16, H), (10, 10, 12))
        d = ImageDraw.Draw(sheet)
        for r, (f, imgs) in enumerate(rows):
            y = r * (TH + 22)
            for c, im in enumerate(imgs):
                sheet.paste(im, (c * TW + c * 4, y + 20))
            d.text((2, y + 4), f"[{si//per_sheet}.{r}] {f[:70]}  {meta[f]['dur']}s {meta[f]['w']}x{meta[f]['h']}",
                   fill=(255, 220, 120))
        out = f"{WORK}/sheets/sheet{si//per_sheet}.jpg"
        sheet.save(out, quality=82)
        print("wrote", out)


if __name__ == "__main__":
    main()
