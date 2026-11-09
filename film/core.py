"""Core helpers: ffmpeg plumbing, shot rendering, transitions, Hebrew text drawing."""
import json, os, re, subprocess, math
from PIL import Image, ImageDraw, ImageFont
from bidi.algorithm import get_display

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2"
MEDIA = os.environ.get("MEDIA_ROOT", "/tmp/media")
FONTS = MEDIA + "/fonts"
WORK = MEDIA + "/work"
FPS = 25
W, H = 1920, 1080

F = {
    "title": FONTS + "/FrankRuhlLibre_800ExtraBold.ttf",
    "title2": FONTS + "/FrankRuhlLibre_600SemiBold.ttf",
    "serif": FONTS + "/NotoSerifHebrew_600SemiBold.ttf",
    "serif_r": FONTS + "/NotoSerifHebrew_400Regular.ttf",
    "david": FONTS + "/DavidLibre_700Bold.ttf",
    "sans": FONTS + "/Heebo_600SemiBold.ttf",
    "sans_r": FONTS + "/Heebo_400Regular.ttf",
    "sans_b": FONTS + "/Heebo_800ExtraBold.ttf",
    "assist": FONTS + "/Assistant_600SemiBold.ttf",
}

# palette
INK = (11, 13, 18)
PARCH = (232, 220, 192)
GOLD = (201, 162, 39)
GOLD_L = (240, 214, 150)
CYAN = (127, 166, 184)
WHITE = (245, 242, 235)


def run(cmd, quiet=True, timeout=3600):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0 and not quiet:
        raise RuntimeError("ffmpeg failed:\n" + " ".join(cmd) + "\n" + r.stderr[-3000:])
    return r


def font(key, size):
    return ImageFont.truetype(F[key], size)


def vis(s):
    """Logical Hebrew -> visual order for PIL's LTR shaper."""
    return get_display(s)


def text_wh(draw, s, fnt):
    b = draw.textbbox((0, 0), s, font=fnt)
    return b[2] - b[0], b[3] - b[1]


def draw_rtl(draw, xy, s, fnt, fill, anchor="ra", spacing=8, stroke=0, stroke_fill=None):
    """Draw Hebrew text right-aligned at xy (anchor 'ra' = right-ascender)."""
    draw.text(xy, vis(s), font=fnt, fill=fill, anchor=anchor, spacing=spacing,
              stroke_width=stroke, stroke_fill=stroke_fill)


def draw_center(draw, xy, s, fnt, fill, spacing=8, stroke=0, stroke_fill=None):
    draw.text(xy, vis(s), font=fnt, fill=fill, anchor="ma", spacing=spacing,
              stroke_width=stroke, stroke_fill=stroke_fill)


def fit_font(draw, s, key, max_w, start=100, min_s=18):
    """Largest font size (<=start) whose rendered width fits max_w."""
    size = start
    while size > min_s:
        f = font(key, size)
        w, _ = text_wh(draw, s, f)
        if w <= max_w:
            return f, size
        size -= 2
    return font(key, min_s), min_s


# ---------------------------------------------------------------- shots

def _vf_cover(w, h):
    return (f"scale='if(gt(a,{W}/{H}),-2,{W})':'if(gt(a,{W}/{H}),{H},-2)',"
            f"crop={W}:{H},setsar=1,fps={FPS}")


def _vf_contain_blur():
    """Fit source inside frame; fill remaining area with a blurred, darkened copy."""
    return (
        f"split=2[bg][fg];"
        f"[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        f"gblur=sigma=28,eq=brightness=-0.16:saturation=0.55[bgd];"
        f"[fg]scale={W}:{H}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgd][fgs]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2,setsar=1,fps={FPS}"
    )


def _vf_motion(kind, dur, amount=0.09):
    """Gentle push / pull. Returns a filter appended AFTER the frame is 1920x1080."""
    if kind == "none" or dur <= 0:
        return ""
    z = amount
    sw, sh = int(W * (1 + z)), int(H * (1 + z))
    if kind == "in":
        p = "t/%.4f" % max(dur, .01)
    elif kind == "out":
        p = "1-t/%.4f" % max(dur, .01)
    elif kind == "left":
        p = "1-t/%.4f" % max(dur, .01)
    else:  # right
        p = "t/%.4f" % max(dur, .01)
    xs = "(in_w-out_w)*%s" % p
    ys = "(in_h-out_h)*0.5"
    if kind in ("left", "right"):
        xs = "(in_w-out_w)*%s" % ("1-t/%.4f" % max(dur, .01) if kind == "right" else "t/%.4f" % max(dur, .01))
        ys = "(in_h-out_h)*0.5"
    return f"scale={sw}:{sh},crop={W}:{H}:x='{xs}':y='{ys}'"


def grade(look="neutral"):
    """Subtle, repeatable colour treatment."""
    L = {
        "neutral": "eq=brightness=0.01:contrast=1.06:saturation=1.02",
        "dawn": "eq=brightness=0.035:contrast=1.05:saturation=0.92:gamma=1.03,"
                "colorchannelmixer=rr=1.03:rb=0.02:br=0.03:bb=0.97",
        "warm": "eq=brightness=0.015:contrast=1.05:saturation=1.06:gamma=0.98,"
                "colorchannelmixer=rr=1.04:bb=0.96",
        "cool": "eq=brightness=-0.01:contrast=1.08:saturation=0.85,"
                "colorchannelmixer=rr=0.97:bb=1.05",
        "arch": "eq=brightness=0.0:contrast=1.22:saturation=0.0:gamma=1.02",
        "archwarm": "eq=brightness=0.01:contrast=1.18:saturation=0.32:gamma=1.0,"
                    "colorchannelmixer=rr=1.0:gg=0.96:bb=0.86",
        "night": "eq=brightness=-0.02:contrast=1.10:saturation=0.9",
    }
    return L.get(look, L["neutral"])


def make_shot(src, out, start, dur, mode="cover", motion="in", amount=0.09,
              look="neutral", speed=1.0, vign=True, grain=6):
    """Render one shot: trimmed, reframed, moved, graded -> silent 1920x1080 mp4."""
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return out
    is_img = src.lower().endswith((".jpg", ".jpeg", ".png", ".JPG"))
    vf = []
    cmd = [FF, "-y", "-v", "error"]
    if is_img:
        cmd += ["-loop", "1", "-t", "%.3f" % dur, "-i", src]
    else:
        cmd += ["-ss", "%.3f" % start, "-t", "%.3f" % dur, "-i", src]
    if mode == "cover":
        vf.append(_vf_cover(0, 0))
    elif mode == "contain":
        vf.append(_vf_contain_blur())
    m = _vf_motion(motion, dur, amount)
    if m:
        vf.append(m)
    if abs(speed - 1.0) > 0.01:
        vf.append("setpts=%.4f*PTS" % (1.0 / speed))
    vf.append(grade(look))
    if vign:
        vf.append("vignette=PI/4.6")
    if grain:
        vf.append(f"noise=alls={grain}:allf=t+u")
    vf.append("format=yuv420p")
    cmd += ["-vf", ",".join(vf), "-an", "-r", str(FPS),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
            "-g", "50", out]
    run(cmd, quiet=False)
    return out


def dur_of(path):
    cmd = [FF, "-hide_banner", "-i", path]
    err = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stderr
    m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", err)
    if not m:
        raise RuntimeError("no duration for " + path)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def xfade_chain(inputs, trans, out, tmpdir=None):
    """inputs: [paths]; trans: [ (type, dur) ] with len == len(inputs)-1.
    Chained in groups so the filter graph never explodes."""
    tmpdir = tmpdir or os.path.dirname(out) or "."
    os.makedirs(tmpdir, exist_ok=True)
    cur = list(inputs)
    cur_t = list(trans)
    stage = 0
    while len(cur) > 1:
        nxt, nxt_t = [], []
        i = 0
        j = 0
        while i < len(cur):
            grp = cur[i:i + 30]
            gt = cur_t[i:i + 29]
            if len(grp) == 1:
                nxt.append(grp[0])
                i += 1
                continue
            stage += 1
            o = f"{tmpdir}/xc_{os.path.basename(out)}_{len(cur)}_{j}.mp4"
            j += 1
            _xfade_group(grp, gt, o)
            nxt.append(o)
            if i + len(grp) - 1 < len(cur_t):
                nxt_t.append(cur_t[i + len(grp) - 1])
            i += len(grp)
        cur, cur_t = nxt, nxt_t
    if cur[0] != out:
        run([FF, "-y", "-v", "error", "-i", cur[0], "-c", "copy", out], quiet=False)
    return out


def _xfade_group(grp, trans, out):
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return out
    cmd = [FF, "-y", "-v", "error"]
    for g in grp:
        cmd += ["-i", g]
    durs = [dur_of(g) for g in grp]
    parts, prev = [], "[0:v]"
    for i, (t, d) in enumerate(trans):
        off = max(0.0, durs[i] - d)
        lbl = f"[x{i}]"
        parts.append(f"{prev}[{i+1}:v]xfade=transition={t}:duration={d:.3f}:offset={off:.3f}{lbl}")
        prev = lbl
        durs[i + 1] = off + durs[i + 1]
    parts.append(f"{prev}format=yuv420p[v]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[v]", "-r", str(FPS),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-g", "50", out]
    run(cmd, quiet=False)
    return out


def encode_png_seq(indir, out, fps=FPS, w=W, h=H):
    """PNG sequence (with alpha) -> lossless mov with alpha."""
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return out
    cmd = [FF, "-y", "-v", "error", "-framerate", str(fps), "-i", f"{indir}/f%05d.png",
           "-c:v", "qtrle", "-pix_fmt", "argb", out]
    run(cmd, quiet=False)
    return out
